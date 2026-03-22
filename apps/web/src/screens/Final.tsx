import { num } from '../format';
import { useGame } from '../game';
import { Page } from '../components/ui';

export function Final() {
  const { state, isHost, restart, leave } = useGame();
  if (!state) return null;
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return (
    <Page>
      <header className="mt-6">
        <p className="text-ink-soft text-sm">بعد از {num(state.history.length)} دور</p>
        <h2 className="text-4xl font-black">
          {ranked
            .filter((p) => p.score === top)
            .map((p) => p.name)
            .join(' و ')}{' '}
          برد!
        </h2>
      </header>

      <ol className="sheet divide-rule divide-y">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between px-5 py-3 ${p.score === top ? 'bg-marker/40' : ''}`}
          >
            <span className="flex items-center gap-3">
              <span className="text-ink-soft w-6 text-sm">{num(i + 1)}</span>
              <span className="text-lg font-bold">{p.name}</span>
            </span>
            <span className="text-2xl font-black">{num(p.score)}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        {isHost && (
          <button className="btn btn-marker grow text-lg" onClick={restart}>
            بازی دوباره با همین گروه
          </button>
        )}
        <button className="btn btn-quiet" onClick={leave}>
          خروج از اتاق
        </button>
      </div>
    </Page>
  );
}
