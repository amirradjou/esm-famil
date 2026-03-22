import type { ClientToServerEvents, ServerToClientEvents } from '@esm-famil/shared';
import { io, type Socket } from 'socket.io-client';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Same origin: Vite proxies /socket.io in dev, the server serves the app in production.
export const socket: GameSocket = io({ autoConnect: false, transports: ['websocket', 'polling'] });
