import { categoryLabel } from '@esm-famil/shared';
import { Letter, Page } from '../components/ui';
import { VerdictCell } from '../components/VerdictCell';
import { num } from '../format';
import { useGame } from '../game';

export function Review() {
  const { state, me, isHost, override, next } = useGame();
  if (!state || !me || !state.review) return null;
  const r = state.review;
  const players = state.players;
  const stopper = players.find((p) => p.id === r.stoppedBy);
  const last = r.number >= state.settings.totalRounds;

  return (
    <Page wide>
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-ink-soft text-sm">
            دور {num(r.number)} از {num(state.settings.totalRounds)}
            {stopper ? ` · ${stopper.name} استپ زد` : ' · زمان تمام شد'}
          </p>
          <h2 className="text-2xl font-black">نتیجه‌ی این دور</h2>
        </div>
        <Letter letter={r.letter} />
      </header>

      <div className="sheet overflow-x-auto">
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-rule border-b-[1.5px]">
              <th className="text-ink-soft px-3 py-2 text-sm font-normal">دسته</th>
              {players.map((p) => (
                <th key={p.id} className="px-3 py-2 font-bold whitespace-nowrap">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-rule divide-y">
            {state.settings.categoryIds.map((cat) => (
              <tr key={cat}>
                <th className="text-ink-soft px-3 py-2 text-sm font-normal whitespace-nowrap">
                  {categoryLabel(cat)}
                </th>
                {players.map((p) => {
                  const cell = r.cells[p.id]?.[cat];
                  return (
                    <td key={p.id} className="px-3 py-2 align-top">
                      {cell && (
                        <VerdictCell
                          cell={cell}
                          canOverride={isHost && cell.verdict.status !== 'empty'}
                          onOverride={(valid) => override(p.id, cat, valid)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-rule border-t-[1.5px]">
              <th className="text-ink-soft px-3 py-2 text-sm font-normal whitespace-nowrap">
                این دور
              </th>
              {players.map((p) => (
                <td key={p.id} className="px-3 py-2 text-xl font-black">
                  {num(r.totals[p.id] ?? 0)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="text-ink-soft px-3 py-2 text-sm font-normal">جمع</th>
              {players.map((p) => (
                <td key={p.id} className="text-ink-soft px-3 py-2 font-bold">
                  {num(p.score)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-ink-soft text-sm">
        {isHost
          ? 'اگر با حکم راستی‌آزما مخالفید، روی جواب بزنید تا درست یا غلطش کنید.'
          : 'میزبان می‌تواند حکم راستی‌آزما را تغییر دهد.'}
      </p>

      {isHost ? (
        <button className="btn btn-marker text-xl" onClick={next}>
          {last ? 'نتیجه‌ی نهایی' : 'دور بعد'}
        </button>
      ) : (
        <p className="text-ink-soft text-center">منتظر میزبان…</p>
      )}
    </Page>
  );
}
