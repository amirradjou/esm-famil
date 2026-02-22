import { customAlphabet } from 'nanoid';
import { Room, type RoomDeps } from './room.js';

// No 0/O/1/I so codes are easy to read out loud.
const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

const IDLE_MS = 15 * 60 * 1000;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly lastActivity = new Map<string, number>();
  private sweeper: NodeJS.Timeout | null = null;

  private broadcast: (room: Room) => void = () => {};

  constructor(private readonly deps: Omit<RoomDeps, 'onClosed' | 'onChange'>) {}

  /** The transport registers how snapshots reach clients. */
  setBroadcast(fn: (room: Room) => void): void {
    this.broadcast = fn;
  }

  create(): Room {
    let id = roomCode();
    while (this.rooms.has(id)) id = roomCode();
    const room = new Room(id, {
      ...this.deps,
      onChange: (r) => {
        this.lastActivity.set(r.id, Date.now());
        this.broadcast(r);
      },
      onClosed: (r) => this.rooms.delete(r.id) && this.lastActivity.delete(r.id),
    });
    this.rooms.set(id, room);
    this.lastActivity.set(id, Date.now());
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id.toUpperCase());
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Drop rooms where everyone has been gone for a while. */
  startSweeper(intervalMs = 60_000): void {
    this.sweeper = setInterval(() => {
      const cutoff = Date.now() - IDLE_MS;
      for (const room of this.rooms.values()) {
        if (room.allDisconnected && (this.lastActivity.get(room.id) ?? 0) < cutoff) {
          room.close('idle');
        }
      }
    }, intervalMs);
    this.sweeper.unref();
  }

  stopSweeper(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }
}
