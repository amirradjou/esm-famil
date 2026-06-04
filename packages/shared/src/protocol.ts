/**
 * Everything that crosses the wire between server and client.
 * The server owns the state; clients only ever receive full `RoomState` snapshots.
 */

export type Phase = 'lobby' | 'playing' | 'stopping' | 'validating' | 'review' | 'finished';

export interface GameSettings {
  categoryIds: string[];
  /** Letters the random pick draws from. Letters already used in this game are skipped. */
  letterPool: string[];
  /** Seconds per round; 0 means no timer (only استپ ends the round). */
  roundSeconds: number;
  /** Seconds the other players get to finish typing after someone calls استپ. */
  stopGraceSeconds: number;
  /** Number of rounds in one game. */
  totalRounds: number;
  /** Award 20 instead of 10 when only one player has a valid answer in a column. */
  soloBonus: boolean;
  /**
   * Fact-checking mode. `false`: word database only. `true`: answers the database does not
   * know are sent to the LLM judge (only possible when the server has one configured).
   */
  llmJudge: boolean;
  /** What to do with answers the fact-checker could not decide on. */
  unverifiedPolicy: 'accept' | 'reject';
}

export const DEFAULT_SETTINGS: GameSettings = {
  categoryIds: [
    'name',
    'family',
    'city',
    'country',
    'color',
    'food',
    'fruit',
    'animal',
    'object',
    'flower',
  ],
  letterPool: [
    'ا',
    'ب',
    'پ',
    'ت',
    'ج',
    'چ',
    'ح',
    'خ',
    'د',
    'ر',
    'ز',
    'س',
    'ش',
    'ص',
    'ط',
    'ع',
    'ف',
    'ق',
    'ک',
    'گ',
    'ل',
    'م',
    'ن',
    'و',
    'ه',
    'ی',
  ],
  roundSeconds: 120,
  stopGraceSeconds: 5,
  totalRounds: 5,
  soloBonus: true,
  llmJudge: false,
  unverifiedPolicy: 'accept',
};

export interface PlayerPublic {
  id: string;
  name: string;
  connected: boolean;
  score: number;
}

/** Who decided that an answer is valid. */
export type VerdictSource = 'list' | 'heuristic' | 'llm' | 'host';

/** Why an answer was rejected: wrong starting letter, not a real thing, or the host said so. */
export type RejectReason = 'letter' | 'not-a-thing' | 'host';

export type Verdict =
  | { status: 'empty' }
  | { status: 'unverified' }
  | { status: 'valid'; source: VerdictSource }
  | { status: 'invalid'; reason: RejectReason; note?: string };

export interface CellResult {
  answer: string;
  verdict: Verdict;
  /** Points awarded for this cell after duplicates are resolved. */
  points: number;
}

export interface RoundResult {
  number: number;
  letter: string;
  stoppedBy: string | null;
  /** playerId -> categoryId -> result */
  cells: Record<string, Record<string, CellResult>>;
  /** playerId -> total for this round */
  totals: Record<string, number>;
}

export interface ServerCapabilities {
  /** Whether an LLM judge is configured on the server, and which one. */
  llm: { available: false } | { available: true; provider: string; model: string };
}

export interface RoomState {
  id: string;
  hostId: string;
  phase: Phase;
  server: ServerCapabilities;
  settings: GameSettings;
  players: PlayerPublic[];
  usedLetters: string[];
  round: {
    number: number;
    letter: string;
    /** Epoch ms when the round timer expires, or null when there is no timer. */
    endsAt: number | null;
    /** Set once someone calls استپ: who, and the epoch ms when answers lock. */
    stop: { by: string; deadline: number } | null;
  } | null;
  /** Results of the round currently under review (also kept in history). */
  review: RoundResult | null;
  history: RoundResult[];
}

export type Answers = Record<string, string>;

export interface ErrorPayload {
  code: 'room-not-found' | 'name-taken' | 'not-host' | 'bad-state' | 'bad-request' | 'incomplete';
  message: string;
}

export interface Ack<T = undefined> {
  ok: boolean;
  error?: ErrorPayload;
  data?: T;
}

export interface Session {
  roomId: string;
  playerId: string;
  token: string;
}

export interface ClientToServerEvents {
  'room:create': (payload: { name: string }, ack: (r: Ack<Session>) => void) => void;
  'room:join': (payload: { roomId: string; name: string }, ack: (r: Ack<Session>) => void) => void;
  'room:rejoin': (payload: Session, ack: (r: Ack<Session>) => void) => void;
  'room:leave': () => void;
  'room:settings': (payload: Partial<GameSettings>, ack: (r: Ack) => void) => void;
  'room:kick': (payload: { playerId: string }, ack: (r: Ack) => void) => void;
  'round:start': (ack: (r: Ack) => void) => void;
  'round:answers': (payload: Answers) => void;
  'round:stop': (payload: Answers, ack: (r: Ack) => void) => void;
  'review:override': (
    payload: { playerId: string; categoryId: string; valid: boolean },
    ack: (r: Ack) => void,
  ) => void;
  'review:next': (ack: (r: Ack) => void) => void;
  'game:restart': (ack: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:closed': (payload: { reason: string }) => void;
  'server:error': (payload: ErrorPayload) => void;
}
