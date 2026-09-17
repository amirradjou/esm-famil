import type {
  Ack,
  Answers,
  ErrorPayload,
  GameSettings,
  PlayerPublic,
  RoomState,
  Session,
} from '@esm-famil/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { socket } from './socket';

const SESSION_KEY = 'esm-famil.session';

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: the game still works for this tab */
  }
}

interface GameContextValue {
  state: RoomState | null;
  me: PlayerPublic | null;
  isHost: boolean;
  connected: boolean;
  /** True while we are trying to resume a stored session. */
  resuming: boolean;
  error: ErrorPayload | null;
  clearError: () => void;
  create: (name: string) => Promise<boolean>;
  join: (roomId: string, name: string) => Promise<boolean>;
  leave: () => void;
  updateSettings: (patch: Partial<GameSettings>) => Promise<boolean>;
  kick: (playerId: string) => Promise<boolean>;
  start: () => Promise<boolean>;
  sendAnswers: (answers: Answers) => void;
  stop: (answers: Answers) => Promise<boolean>;
  override: (playerId: string, categoryId: string, valid: boolean) => Promise<boolean>;
  next: () => Promise<boolean>;
  restart: () => Promise<boolean>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<ErrorPayload | null>(null);
  const [session, setSessionState] = useState<Session | null>(loadSession);
  // The connect handler runs outside React's render cycle, so it reads the ref.
  const sessionRef = useRef(session);
  const [resuming, setResuming] = useState(session !== null);
  const setSession = useCallback((s: Session | null) => {
    sessionRef.current = s;
    setSessionState(s);
    saveSession(s);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const s = sessionRef.current;
      if (!s) return;
      socket.emit('room:rejoin', s, (r) => {
        if (!r.ok) {
          setSession(null);
          setState(null);
        }
        setResuming(false);
      });
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: RoomState) => setState(s);
    const onClosed = () => {
      setSession(null);
      setState(null);
      setError({ code: 'room-not-found', message: 'از اتاق خارج شدید' });
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    socket.on('server:error', setError);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('server:error', setError);
      socket.disconnect();
    };
  }, [setSession]);

  const handle = useCallback(<T,>(r: Ack<T>): boolean => {
    if (!r.ok) setError(r.error ?? { code: 'bad-request', message: 'خطای ناشناخته' });
    return r.ok;
  }, []);

  const adopt = useCallback(
    (r: Ack<Session>): boolean => {
      if (r.ok && r.data) setSession(r.data);
      return handle(r);
    },
    [handle, setSession],
  );

  const value = useMemo<GameContextValue>(() => {
    const emit = <T,>(fn: (ack: (r: Ack<T>) => void) => void) =>
      new Promise<boolean>((resolve) => fn((r) => resolve(handle(r))));
    const me = state?.players.find((p) => p.id === session?.playerId) ?? null;
    return {
      state,
      me,
      isHost: !!me && me.id === state?.hostId,
      connected,
      resuming,
      error,
      clearError: () => setError(null),
      create: (name) =>
        new Promise((resolve) => socket.emit('room:create', { name }, (r) => resolve(adopt(r)))),
      join: (roomId, name) =>
        new Promise((resolve) =>
          socket.emit('room:join', { roomId: roomId.trim().toUpperCase(), name }, (r) =>
            resolve(adopt(r)),
          ),
        ),
      leave: () => {
        socket.emit('room:leave');
        setSession(null);
        setState(null);
      },
      updateSettings: (patch) => emit((ack) => socket.emit('room:settings', patch, ack)),
      kick: (playerId) => emit((ack) => socket.emit('room:kick', { playerId }, ack)),
      start: () => emit((ack) => socket.emit('round:start', ack)),
      sendAnswers: (answers) => socket.emit('round:answers', answers),
      stop: (answers) => emit((ack) => socket.emit('round:stop', answers, ack)),
      override: (playerId, categoryId, valid) =>
        emit((ack) => socket.emit('review:override', { playerId, categoryId, valid }, ack)),
      next: () => emit((ack) => socket.emit('review:next', ack)),
      restart: () => emit((ack) => socket.emit('game:restart', ack)),
    };
  }, [state, session, connected, resuming, error, handle, adopt, setSession]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

/** Wall-clock ticker for countdowns; re-renders every 250ms while `active`. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
