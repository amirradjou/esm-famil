import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Verdict } from '@esm-famil/shared';
import { RoomError } from './errors.js';
import { Room } from './room.js';
import { ValidationPipeline, WordListValidator, type Candidate } from './validation/index.js';

/** Accepts everything the word lists don't know, so tests are deterministic and offline. */
const acceptAll = {
  name: 'accept-all',
  check: async (cs: Candidate[]) =>
    new Map<string, Verdict>(cs.map((c) => [c.key, { status: 'valid', source: 'llm' }])),
};
const pipeline = new ValidationPipeline([new WordListValidator()], {
  validator: acceptAll,
  provider: 'stub',
  model: 'stub',
});

function makeRoom(random = () => 0) {
  const changes: string[] = [];
  const room = new Room('TEST', {
    pipeline,
    onChange: (r) => changes.push(r.phase),
    random,
  });
  return { room, changes };
}

async function flush() {
  // let the (fake-timer driven) finalize() promise chain settle
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('Room', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('makes the first player host and rejects duplicate names', () => {
    const { room } = makeRoom();
    const a = room.addPlayer('علی');
    expect(room.hostId).toBe(a.id);
    expect(() => room.addPlayer(' علی ')).toThrow(RoomError);
    expect(() => room.addPlayer('')).toThrow(RoomError);
  });

  it('only the host can change settings, and only in the lobby', () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    expect(() => room.updateSettings(guest.id, { totalRounds: 3 })).toThrow(/میزبان/);
    room.updateSettings(host.id, { totalRounds: 99, categoryIds: ['name', 'city', 'bogus'] });
    expect(room.settings.totalRounds).toBe(20);
    expect(room.settings.categoryIds).toEqual(['name', 'city']);
    expect(() => room.updateSettings(host.id, { categoryIds: ['name'] })).toThrow(/دو دسته/);
  });

  it('defaults the LLM judge to the server capability and refuses to enable it without one', () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    expect(room.settings.llmJudge).toBe(true);
    room.updateSettings(host.id, { llmJudge: false });
    expect(room.settings.llmJudge).toBe(false);
    expect(room.toState().server.llm).toMatchObject({ available: true, provider: 'stub' });

    const noLlm = new Room('NOLLM', {
      pipeline: new ValidationPipeline([new WordListValidator()]),
      onChange: () => {},
    });
    const h = noLlm.addPlayer('host');
    expect(noLlm.settings.llmJudge).toBe(false);
    expect(() => noLlm.updateSettings(h.id, { llmJudge: true })).toThrow(/داور/);
  });

  it('skips the LLM judge when the room turned it off', async () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    room.addPlayer('guest');
    room.updateSettings(host.id, {
      letterPool: ['ب'],
      categoryIds: ['name', 'color'],
      stopGraceSeconds: 0,
      llmJudge: false,
    });
    room.startRound(host.id);
    room.stop(host.id, { name: 'بابک', color: 'بلبل' });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(room.review!.cells[host.id]!.color!.verdict).toEqual({ status: 'unverified' });
  });

  it('needs two players to start and picks an unused letter from the pool', () => {
    const { room } = makeRoom(() => 0.5);
    const host = room.addPlayer('host');
    expect(() => room.startRound(host.id)).toThrow(/دو بازیکن/);
    room.addPlayer('guest');
    room.updateSettings(host.id, { letterPool: ['ب', 'س'], roundSeconds: 0 });
    room.startRound(host.id);
    expect(room.phase).toBe('playing');
    expect(room.round?.letter).toBe('س');
    expect(room.round?.endsAt).toBeNull();
    expect(room.usedLetters).toEqual(['س']);
  });

  it('rejects استپ when a cell is empty or starts with the wrong letter', () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.updateSettings(host.id, { letterPool: ['ب'], categoryIds: ['name', 'city'] });
    room.startRound(host.id);
    expect(() => room.stop(guest.id, { name: 'بابک', city: '' })).toThrow(/پر شده/);
    expect(() => room.stop(guest.id, { name: 'بابک', city: 'تهران' })).toThrow(/پر شده/);
    expect(room.phase).toBe('playing');
  });

  it('runs a full round: stop → grace → validate → score → review', async () => {
    const { room, changes } = makeRoom();
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.updateSettings(host.id, {
      letterPool: ['ب'],
      categoryIds: ['name', 'city', 'color'],
      stopGraceSeconds: 5,
      totalRounds: 1,
    });
    room.startRound(host.id);
    room.setAnswers(guest.id, { name: 'بهرام', city: 'بم', color: 'تهران' });
    room.stop(host.id, { name: 'بابک', city: 'بم', color: 'بنفش' });
    expect(room.phase).toBe('stopping');
    expect(room.round?.stop?.by).toBe(host.id);

    // guest sneaks in an edit during the grace period — allowed
    room.setAnswers(guest.id, { name: 'بهرام', city: 'بم', color: 'بلبل' });
    await vi.advanceTimersByTimeAsync(5000);
    await flush();

    expect(room.phase).toBe('review');
    expect(changes).toContain('validating');
    const r = room.review!;
    expect(r.cells[host.id]!.name).toMatchObject({
      points: 10,
      verdict: { status: 'valid', source: 'list' },
    });
    expect(r.cells[host.id]!.city!.points).toBe(5);
    expect(r.cells[guest.id]!.city!.points).toBe(5);
    // "بلبل" is not in the colour list; the accept-all fallback stands in for the LLM here
    expect(r.cells[guest.id]!.color!.verdict).toEqual({ status: 'valid', source: 'llm' });
    expect(r.cells[host.id]!.color!.points).toBe(10);
    expect(r.totals).toEqual({ [host.id]: 25, [guest.id]: 25 });
    expect(room.players.get(host.id)!.score).toBe(25);
  });

  it('applies host overrides and re-scores', async () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.updateSettings(host.id, {
      letterPool: ['ب'],
      categoryIds: ['name', 'city'],
      stopGraceSeconds: 0,
    });
    room.startRound(host.id);
    room.setAnswers(guest.id, { name: 'بهرام', city: 'بلبل' });
    room.stop(host.id, { name: 'بابک', city: 'بم' });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(room.phase).toBe('review');
    expect(room.review!.cells[host.id]!.city!.points).toBe(10);
    expect(room.players.get(host.id)!.score).toBe(20);

    room.override(host.id, guest.id, 'city', false);
    expect(room.review!.cells[guest.id]!.city!.points).toBe(0);
    expect(room.review!.cells[host.id]!.city!.points).toBe(20);
    expect(room.players.get(host.id)!.score).toBe(30);
    expect(room.players.get(guest.id)!.score).toBe(10);
    expect(() => room.override(guest.id, host.id, 'city', false)).toThrow(/میزبان/);
  });

  it('ends the round on the timer without anyone calling استپ', async () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    room.addPlayer('guest');
    room.updateSettings(host.id, {
      letterPool: ['ب'],
      categoryIds: ['name', 'city'],
      roundSeconds: 30,
    });
    room.startRound(host.id);
    expect(room.round?.endsAt).toBe(Date.now() + 30_000);
    room.setAnswers(host.id, { name: 'بابک', city: '' });
    await vi.advanceTimersByTimeAsync(30_000);
    await flush();
    expect(room.phase).toBe('review');
    expect(room.review!.stoppedBy).toBeNull();
    expect(room.review!.cells[host.id]!.city!.verdict).toEqual({ status: 'empty' });
  });

  it('finishes after the last round and can restart', async () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    room.addPlayer('guest');
    room.updateSettings(host.id, {
      letterPool: ['ب'],
      categoryIds: ['name', 'city'],
      totalRounds: 1,
      stopGraceSeconds: 0,
    });
    room.startRound(host.id);
    room.stop(host.id, { name: 'بابک', city: 'بم' });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    room.next(host.id);
    expect(room.phase).toBe('finished');
    room.restart(host.id);
    expect(room.phase).toBe('lobby');
    expect(room.history).toEqual([]);
    expect(room.players.get(host.id)!.score).toBe(0);
  });

  it('hands the room to another player when the host leaves, and closes when empty', () => {
    let closed = '';
    const room = new Room('X', {
      pipeline,
      onChange: () => {},
      onClosed: (_r, reason) => (closed = reason),
    });
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.removePlayer(host.id);
    expect(room.hostId).toBe(guest.id);
    room.removePlayer(guest.id);
    expect(closed).toBe('everyone left');
  });

  it('hands over the host role after a disconnect grace period', () => {
    const { room } = makeRoom();
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.disconnect(host.id);
    expect(room.hostId).toBe(host.id);
    vi.advanceTimersByTime(30_000);
    expect(room.hostId).toBe(guest.id);
    expect(() => room.rejoin(host.id, 'wrong-token')).toThrow(RoomError);
    room.rejoin(host.id, room.players.get(host.id)!.token);
    expect(room.players.get(host.id)!.connected).toBe(true);
  });
});

describe('Room — game-night polish', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('broadcasts per-player progress without revealing answers', () => {
    const { room, changes } = makeRoom();
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.updateSettings(host.id, { letterPool: ['ب'], categoryIds: ['name', 'city', 'color'] });
    room.startRound(host.id);
    const before = changes.length;
    room.setAnswers(guest.id, { name: 'بابک', city: 'تهران', color: '' });
    expect(room.toState().round?.progress[guest.id]).toBe(1); // تهران has the wrong letter
    expect(changes.length).toBe(before + 1);
    room.setAnswers(guest.id, { name: 'بابک', city: 'تهران', color: '' });
    expect(changes.length).toBe(before + 1); // unchanged count -> no broadcast
    expect(JSON.stringify(room.toState())).not.toContain('بابک');
  });

  it("shows everyone's answers as pending while the judge is working", async () => {
    let release!: () => void;
    const slow = {
      name: 'slow',
      check: () =>
        new Promise<Map<string, Verdict>>((resolve) => {
          release = () => resolve(new Map());
        }),
    };
    const room = new Room('SLOW', {
      pipeline: new ValidationPipeline([new WordListValidator(), slow]),
      onChange: () => {},
    });
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.updateSettings(host.id, {
      letterPool: ['ب'],
      categoryIds: ['name', 'city'],
      stopGraceSeconds: 0,
    });
    room.startRound(host.id);
    room.setAnswers(guest.id, { name: 'بهرام', city: '' });
    room.stop(host.id, { name: 'بابک', city: 'بلخ' });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(room.phase).toBe('validating');
    expect(room.review?.cells[host.id]?.city).toMatchObject({
      answer: 'بلخ',
      verdict: { status: 'pending' },
    });
    expect(room.review?.cells[guest.id]?.city?.verdict).toEqual({ status: 'empty' });
    release();
    await flush();
    expect(room.phase).toBe('review');
    expect(room.review?.cells[host.id]?.city?.verdict).toEqual({ status: 'unverified' });
    expect(room.history).toHaveLength(1);
  });

  it('remembers answers the LLM or the host approved', async () => {
    const learned = { added: [] as string[] };
    const llm = {
      name: 'llm',
      check: async (cs: Candidate[]) =>
        new Map<string, Verdict>(cs.map((c) => [c.key, { status: 'valid', source: 'llm' }])),
    };
    const pipeline = new ValidationPipeline([new WordListValidator()], {
      validator: llm,
      provider: 'x',
      model: 'y',
    });
    pipeline.learn = (cat, word) => learned.added.push(`${cat}:${word}`);
    const room = new Room('LEARN', { pipeline, onChange: () => {} });
    const host = room.addPlayer('host');
    const guest = room.addPlayer('guest');
    room.updateSettings(host.id, {
      letterPool: ['ب'],
      categoryIds: ['name', 'city'],
      stopGraceSeconds: 0,
    });
    room.startRound(host.id);
    room.setAnswers(guest.id, { name: 'بهرام', city: 'بلخ' });
    room.stop(host.id, { name: 'بابک', city: 'بوشهر' });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(learned.added).toEqual(['city:بلخ']); // the rest came from the list
    room.override(host.id, guest.id, 'name', false);
    room.override(host.id, guest.id, 'name', true);
    expect(learned.added).toEqual(['city:بلخ', 'name:بهرام']);
  });
});
