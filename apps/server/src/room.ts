import {
  DEFAULT_SETTINGS,
  rescore,
  scoreRound,
  startsWithLetter,
  type Answers,
  type GameSettings,
  type Phase,
  type PlayerPublic,
  type RoomState,
  type RoundResult,
  type Verdict,
} from '@esm-famil/shared';
import { nanoid } from 'nanoid';
import { RoomError } from './errors.js';
import { applySettingsPatch } from './settings.js';
import type { Candidate, ValidationPipeline } from './validation/index.js';

export interface Player extends PlayerPublic {
  token: string;
  joinedAt: number;
}

export interface RoomDeps {
  pipeline: ValidationPipeline;
  /** Called after every state change so the transport can broadcast a snapshot. */
  onChange: (room: Room) => void;
  onClosed?: (room: Room, reason: string) => void;
  now?: () => number;
  random?: () => number;
  log?: (msg: string, err?: unknown) => void;
}

const HOST_HANDOVER_MS = 30_000;
const MAX_PLAYERS = 12;
const MAX_NAME = 24;
const MAX_ANSWER = 40;

/**
 * One game room. All mutation goes through methods that validate the phase, so the
 * socket layer only translates events and errors.
 */
export class Room {
  hostId = '';
  phase: Phase = 'lobby';
  settings: GameSettings = structuredClone(DEFAULT_SETTINGS);
  readonly players = new Map<string, Player>();
  usedLetters: string[] = [];
  round: RoomState['round'] = null;
  review: RoundResult | null = null;
  history: RoundResult[] = [];

  private answers = new Map<string, Answers>();
  private roundTimer: NodeJS.Timeout | null = null;
  private stopTimer: NodeJS.Timeout | null = null;
  private hostTimer: NodeJS.Timeout | null = null;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly log: (msg: string, err?: unknown) => void;

  constructor(
    readonly id: string,
    private readonly deps: RoomDeps,
  ) {
    this.now = deps.now ?? Date.now;
    this.random = deps.random ?? Math.random;
    this.log = deps.log ?? (() => {});
    // Judge with the LLM by default whenever the server has one.
    this.settings.llmJudge = deps.pipeline.capabilities.llm.available;
  }

  // ---- players -------------------------------------------------------------

  addPlayer(rawName: string): Player {
    const name = rawName.trim().slice(0, MAX_NAME);
    if (!name) throw new RoomError('bad-request', 'اسم خالی است');
    if (this.players.size >= MAX_PLAYERS) throw new RoomError('bad-state', 'اتاق پر است');
    for (const p of this.players.values()) {
      if (p.name === name) throw new RoomError('name-taken', 'این اسم قبلاً انتخاب شده');
    }
    const player: Player = {
      id: nanoid(10),
      token: nanoid(24),
      name,
      connected: true,
      score: 0,
      joinedAt: this.now(),
    };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.changed();
    return player;
  }

  rejoin(playerId: string, token: string): Player {
    const p = this.players.get(playerId);
    if (!p || p.token !== token) throw new RoomError('room-not-found', 'جلسه معتبر نیست');
    p.connected = true;
    if (p.id === this.hostId && this.hostTimer) {
      clearTimeout(this.hostTimer);
      this.hostTimer = null;
    }
    this.changed();
    return p;
  }

  disconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = false;
    if (p.id === this.hostId && !this.hostTimer) {
      // Give the host a moment to refresh the page before handing the room to someone else.
      this.hostTimer = setTimeout(() => {
        this.hostTimer = null;
        if (!this.players.get(this.hostId)?.connected) this.pickNewHost();
      }, HOST_HANDOVER_MS);
    }
    this.changed();
  }

  removePlayer(playerId: string): void {
    if (!this.players.delete(playerId)) return;
    this.answers.delete(playerId);
    if (this.players.size === 0) {
      this.close('everyone left');
      return;
    }
    if (playerId === this.hostId) this.pickNewHost();
    this.changed();
  }

  kick(hostId: string, playerId: string): void {
    this.assertHost(hostId);
    if (playerId === hostId) throw new RoomError('bad-request', 'میزبان نمی‌تواند خودش را حذف کند');
    this.removePlayer(playerId);
  }

  private pickNewHost(): void {
    const candidates = [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const next = candidates.find((p) => p.connected) ?? candidates[0];
    if (next) this.hostId = next.id;
    this.changed();
  }

  get allDisconnected(): boolean {
    for (const p of this.players.values()) if (p.connected) return false;
    return true;
  }

  // ---- settings ------------------------------------------------------------

  updateSettings(hostId: string, patch: Partial<GameSettings>): void {
    this.assertHost(hostId);
    this.assertPhase('lobby');
    this.settings = applySettingsPatch(
      this.settings,
      patch,
      this.deps.pipeline.capabilities.llm.available,
    );
    this.changed();
  }

  // ---- round lifecycle -----------------------------------------------------

  startRound(hostId: string): void {
    this.assertHost(hostId);
    if (this.phase !== 'lobby' && this.phase !== 'review')
      throw new RoomError('bad-state', 'الان نمی‌شود دور جدید شروع کرد');
    if (this.players.size < 2) throw new RoomError('bad-state', 'حداقل دو بازیکن لازم است');
    this.beginRound();
  }

  private beginRound(): void {
    const number = (this.round?.number ?? 0) + 1;
    const letter = this.pickLetter();
    this.usedLetters.push(letter);
    this.answers.clear();
    this.review = null;
    const endsAt =
      this.settings.roundSeconds > 0 ? this.now() + this.settings.roundSeconds * 1000 : null;
    this.round = { number, letter, endsAt, stop: null, progress: {} };
    this.phase = 'playing';
    this.clearTimers();
    if (endsAt !== null) {
      this.roundTimer = setTimeout(() => void this.finalize(), this.settings.roundSeconds * 1000);
    }
    this.changed();
  }

  private pickLetter(): string {
    let pool = this.settings.letterPool.filter((l) => !this.usedLetters.includes(l));
    if (pool.length === 0) {
      this.usedLetters = [];
      pool = [...this.settings.letterPool];
    }
    const letter = pool[Math.floor(this.random() * pool.length)];
    if (!letter) throw new RoomError('bad-state', 'حرفی برای انتخاب نیست');
    return letter;
  }

  setAnswers(playerId: string, answers: Answers): void {
    if (this.phase !== 'playing' && this.phase !== 'stopping') return;
    if (!this.players.has(playerId) || !this.round) return;
    const clean = this.sanitize(answers);
    this.answers.set(playerId, clean);
    // Everyone sees how far the others are, like glancing at the table — but never the words.
    const letter = this.round.letter;
    const filled = this.settings.categoryIds.filter((c) =>
      startsWithLetter(clean[c] ?? '', letter),
    ).length;
    if (this.round.progress[playerId] !== filled) {
      this.round.progress[playerId] = filled;
      this.changed();
    }
  }

  stop(playerId: string, answers: Answers): void {
    this.assertPhase('playing');
    if (!this.players.has(playerId) || !this.round) return;
    const clean = this.sanitize(answers);
    const letter = this.round.letter;
    for (const cat of this.settings.categoryIds) {
      const a = clean[cat] ?? '';
      if (!a || !startsWithLetter(a, letter))
        throw new RoomError('incomplete', 'همه‌ی خانه‌ها باید با حرف درست پر شده باشند');
    }
    this.answers.set(playerId, clean);
    const grace = this.settings.stopGraceSeconds * 1000;
    this.round = {
      ...this.round,
      stop: { by: playerId, deadline: this.now() + grace },
      progress: { ...this.round.progress, [playerId]: this.settings.categoryIds.length },
    };
    this.phase = 'stopping';
    this.clearTimers();
    this.stopTimer = setTimeout(() => void this.finalize(), grace);
    this.changed();
  }

  private sanitize(answers: Answers): Answers {
    const out: Answers = {};
    for (const cat of this.settings.categoryIds) {
      const v = answers[cat];
      out[cat] = typeof v === 'string' ? v.trim().slice(0, MAX_ANSWER) : '';
    }
    return out;
  }

  /** Lock answers, fact-check them, score, and move to review. Idempotent. */
  /**
   * Lock answers, show them to everyone right away, fact-check, score, and move to review.
   * Idempotent.
   */
  async finalize(): Promise<void> {
    if ((this.phase !== 'playing' && this.phase !== 'stopping') || !this.round) return;
    this.clearTimers();
    const { letter, number, stop } = this.round;
    const playerIds = [...this.players.keys()];
    const candidates: Candidate[] = [];
    const cells: RoundResult['cells'] = {};
    for (const pid of playerIds) {
      const answers = this.answers.get(pid) ?? {};
      for (const cat of this.settings.categoryIds) {
        const answer = answers[cat] ?? '';
        candidates.push({ key: `${pid}:${cat}`, categoryId: cat, letter, answer });
        (cells[pid] ??= {})[cat] = {
          answer,
          verdict: { status: answer ? 'pending' : 'empty' },
          points: 0,
        };
      }
    }
    // The table is readable while the judge works; verdicts fill in when it is done.
    const result: RoundResult = { number, letter, stoppedBy: stop?.by ?? null, cells, totals: {} };
    for (const pid of playerIds) result.totals[pid] = 0;
    this.review = result;
    this.phase = 'validating';
    this.changed();

    let verdicts: Map<string, Verdict>;
    try {
      verdicts = await this.deps.pipeline.judge(candidates, this.settings.llmJudge);
    } catch (err) {
      this.log('validation pipeline failed; treating answers as unverified', err);
      verdicts = new Map();
    }
    if (this.review !== result) return; // the room was reset while we were judging

    for (const c of candidates) {
      const [pid, cat] = c.key.split(':') as [string, string];
      const cell = cells[pid]?.[cat];
      if (!cell) continue;
      cell.verdict = verdicts.get(c.key) ?? { status: c.answer ? 'unverified' : 'empty' };
      if (cell.verdict.status === 'valid' && cell.verdict.source === 'llm') {
        this.deps.pipeline.learn(cat, c.answer);
      }
    }
    result.totals = scoreRound(cells, this.settings.categoryIds, this.settings);
    this.history.push(result);
    this.recomputeScores();
    this.phase = 'review';
    this.changed();
  }

  override(hostId: string, playerId: string, categoryId: string, valid: boolean): void {
    this.assertHost(hostId);
    this.assertPhase('review');
    const cell = this.review?.cells[playerId]?.[categoryId];
    if (!cell || !this.review) throw new RoomError('bad-request', 'خانه پیدا نشد');
    if (cell.verdict.status === 'empty') throw new RoomError('bad-request', 'خانه خالی است');
    cell.verdict = valid
      ? { status: 'valid', source: 'host' }
      : { status: 'invalid', reason: 'host' };
    if (valid) this.deps.pipeline.learn(categoryId, cell.answer);
    rescore(this.review, this.settings.categoryIds, this.settings);
    this.recomputeScores();
    this.changed();
  }

  next(hostId: string): void {
    this.assertHost(hostId);
    this.assertPhase('review');
    if ((this.round?.number ?? 0) >= this.settings.totalRounds) {
      this.phase = 'finished';
      this.changed();
      return;
    }
    if (this.players.size < 2) throw new RoomError('bad-state', 'حداقل دو بازیکن لازم است');
    this.beginRound();
  }

  restart(hostId: string): void {
    this.assertHost(hostId);
    if (this.phase === 'validating') throw new RoomError('bad-state', 'صبر کنید');
    this.clearTimers();
    this.answers.clear();
    this.history = [];
    this.review = null;
    this.round = null;
    this.usedLetters = [];
    for (const p of this.players.values()) p.score = 0;
    this.phase = 'lobby';
    this.changed();
  }

  private recomputeScores(): void {
    for (const p of this.players.values()) {
      p.score = this.history.reduce((sum, r) => sum + (r.totals[p.id] ?? 0), 0);
    }
  }

  // ---- plumbing ------------------------------------------------------------

  close(reason: string): void {
    this.clearTimers();
    if (this.hostTimer) clearTimeout(this.hostTimer);
    this.deps.onClosed?.(this, reason);
  }

  private clearTimers(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.roundTimer = null;
    this.stopTimer = null;
  }

  private changed(): void {
    this.deps.onChange(this);
  }

  private assertHost(playerId: string): void {
    if (playerId !== this.hostId)
      throw new RoomError('not-host', 'فقط میزبان می‌تواند این کار را بکند');
  }

  private assertPhase(phase: Phase): void {
    if (this.phase !== phase) throw new RoomError('bad-state', 'در این مرحله ممکن نیست');
  }

  toState(): RoomState {
    return {
      id: this.id,
      hostId: this.hostId,
      phase: this.phase,
      server: this.deps.pipeline.capabilities,
      serverTime: this.now(),
      settings: this.settings,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(({ id, name, connected, score }) => ({ id, name, connected, score })),
      usedLetters: this.usedLetters,
      round: this.round,
      review: this.review,
      history: this.history,
    };
  }
}
