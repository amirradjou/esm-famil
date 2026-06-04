import type { ClientToServerEvents, ServerToClientEvents } from '@esm-famil/shared';
import { io, type Socket } from 'socket.io-client';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Where the game server lives. Empty (the default) means same origin: Vite proxies /socket.io
 * in dev and the server serves the app in production. A static deployment (Netlify) sets
 * VITE_SERVER_URL at build time to the server's public URL.
 */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? '';

export const socket: GameSocket = io(SERVER_URL || undefined, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
