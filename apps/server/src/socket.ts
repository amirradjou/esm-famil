import type { Ack, ClientToServerEvents, ServerToClientEvents, Session } from '@esm-famil/shared';
import type { Server, Socket } from 'socket.io';
import { RoomError } from './errors.js';
import type { Room } from './room.js';
import type { RoomManager } from './rooms.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

interface Bound {
  room: Room;
  playerId: string;
}

export function attachSocketHandlers(
  io: IO,
  rooms: RoomManager,
  log: (msg: string, err?: unknown) => void,
): void {
  const bindings = new WeakMap<Sock, Bound>();
  // A player may have several tabs open; the room only hears about the last one closing.
  const socketsOf = new Map<string, Set<Sock>>();
  const key = (b: Bound) => `${b.room.id}:${b.playerId}`;

  const attach = (socket: Sock, b: Bound) => {
    bindings.set(socket, b);
    let set = socketsOf.get(key(b));
    if (!set) socketsOf.set(key(b), (set = new Set()));
    set.add(socket);
  };
  /** Forget this socket; returns true when it was the player's last connection. */
  const detach = (socket: Sock): Bound | null => {
    const b = bindings.get(socket);
    if (!b) return null;
    bindings.delete(socket);
    const set = socketsOf.get(key(b));
    set?.delete(socket);
    if (set && set.size === 0) {
      socketsOf.delete(key(b));
      return b;
    }
    return null;
  };

  const broadcast = (room: Room) => io.to(room.id).emit('room:state', room.toState());
  rooms.setBroadcast(broadcast);

  const withAck = <T = undefined>(ack: (r: Ack<T>) => void, fn: () => T | void): void => {
    try {
      const data = fn();
      ack(data === undefined ? { ok: true } : { ok: true, data: data as T });
    } catch (err) {
      if (err instanceof RoomError) ack({ ok: false, error: err.toPayload() });
      else {
        log('unexpected error in socket handler', err);
        ack({ ok: false, error: { code: 'bad-request', message: 'خطای غیرمنتظره' } });
      }
    }
  };

  const bind = (socket: Sock, room: Room, playerId: string): Session => {
    const previous = bindings.get(socket);
    if (previous) {
      void socket.leave(previous.room.id);
      const last = detach(socket);
      if (last) last.room.disconnect(last.playerId);
    }
    attach(socket, { room, playerId });
    void socket.join(room.id);
    // The join broadcast fired before this socket was in the room, so send the snapshot directly.
    socket.emit('room:state', room.toState());
    const token = room.players.get(playerId)?.token ?? '';
    return { roomId: room.id, playerId, token };
  };

  const bound = (socket: Sock): Bound => {
    const b = bindings.get(socket);
    if (!b) throw new RoomError('room-not-found', 'شما در اتاقی نیستید');
    return b;
  };

  io.on('connection', (socket) => {
    socket.on('room:create', ({ name }, ack) =>
      withAck(ack, () => {
        const room = rooms.create();
        const player = room.addPlayer(String(name ?? ''));
        return bind(socket, room, player.id);
      }),
    );

    socket.on('room:join', ({ roomId, name }, ack) =>
      withAck(ack, () => {
        const room = rooms.get(String(roomId ?? ''));
        if (!room) throw new RoomError('room-not-found', 'اتاقی با این کد پیدا نشد');
        if (room.phase !== 'lobby')
          throw new RoomError('bad-state', 'بازی شروع شده؛ منتظر دور بعد بمانید');
        const player = room.addPlayer(String(name ?? ''));
        return bind(socket, room, player.id);
      }),
    );

    socket.on('room:rejoin', ({ roomId, playerId, token }, ack) =>
      withAck(ack, () => {
        const room = rooms.get(String(roomId ?? ''));
        if (!room) throw new RoomError('room-not-found', 'اتاق دیگر وجود ندارد');
        room.rejoin(String(playerId), String(token));
        return bind(socket, room, String(playerId));
      }),
    );

    socket.on('room:leave', () => {
      const b = bindings.get(socket);
      if (!b) return;
      // Leaving is explicit: drop every tab of this player.
      for (const s of socketsOf.get(key(b)) ?? []) {
        bindings.delete(s);
        void s.leave(b.room.id);
        if (s !== socket) s.emit('room:closed', { reason: 'left' });
      }
      socketsOf.delete(key(b));
      b.room.removePlayer(b.playerId);
    });

    socket.on('room:settings', (patch, ack) =>
      withAck(ack, () => {
        const { room, playerId } = bound(socket);
        room.updateSettings(playerId, patch ?? {});
      }),
    );

    socket.on('room:kick', ({ playerId: target }, ack) =>
      withAck(ack, () => {
        const { room, playerId } = bound(socket);
        room.kick(playerId, String(target));
        const k = `${room.id}:${String(target)}`;
        for (const s of socketsOf.get(k) ?? []) {
          bindings.delete(s);
          void s.leave(room.id);
          s.emit('room:closed', { reason: 'kicked' });
        }
        socketsOf.delete(k);
      }),
    );

    socket.on('round:start', (ack) =>
      withAck(ack, () => {
        const { room, playerId } = bound(socket);
        room.startRound(playerId);
      }),
    );

    socket.on('round:answers', (answers) => {
      const b = bindings.get(socket);
      if (b && answers && typeof answers === 'object') b.room.setAnswers(b.playerId, answers);
    });

    socket.on('round:stop', (answers, ack) =>
      withAck(ack, () => {
        const { room, playerId } = bound(socket);
        room.stop(playerId, answers ?? {});
      }),
    );

    socket.on('review:override', ({ playerId: target, categoryId, valid }, ack) =>
      withAck(ack, () => {
        const { room, playerId } = bound(socket);
        room.override(playerId, String(target), String(categoryId), Boolean(valid));
      }),
    );

    socket.on('review:next', (ack) =>
      withAck(ack, () => {
        const { room, playerId } = bound(socket);
        room.next(playerId);
      }),
    );

    socket.on('game:restart', (ack) =>
      withAck(ack, () => {
        const { room, playerId } = bound(socket);
        room.restart(playerId);
      }),
    );

    socket.on('disconnect', () => {
      const last = detach(socket);
      if (last) last.room.disconnect(last.playerId);
    });
  });
}
