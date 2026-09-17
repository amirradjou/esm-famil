import type { PlayerPublic } from '@esm-famil/shared';
import { num } from '../format';

export function PlayerList(props: {
  players: PlayerPublic[];
  hostId: string;
  meId: string;
  /** Present when the viewer may remove players (i.e. is the host). */
  onKick?: (playerId: string) => void;
}) {
  const { players, hostId, meId, onKick } = props;
  return (
    <section className="sheet p-5">
      <h2 className="mb-3 text-lg font-bold">بازیکن‌ها ({num(players.length)})</h2>
      <ul className="divide-rule divide-y">
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2">
            <span className={p.connected ? '' : 'text-ink-soft line-through'}>
              {p.name}
              {p.id === hostId && <span className="text-pen ms-2 text-sm">میزبان</span>}
              {p.id === meId && <span className="text-ink-soft ms-2 text-sm">(شما)</span>}
            </span>
            {onKick && p.id !== meId && (
              <button className="text-ink-soft text-sm hover:text-pen" onClick={() => onKick(p.id)}>
                حذف
              </button>
            )}
          </li>
        ))}
      </ul>
      {players.length < 2 && (
        <p className="text-ink-soft mt-3 text-sm">
          لینک دعوت را بفرستید؛ با دو نفر می‌شود شروع کرد.
        </p>
      )}
    </section>
  );
}
