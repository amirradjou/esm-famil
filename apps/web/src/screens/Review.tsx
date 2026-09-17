import { categoryLabel, type CellResult, type Verdict } from '@esm-famil/shared';
import { num } from '../format';
import { useGame } from '../game';
import { Letter, Page } from '../components/ui';

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
                        <Cell
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

function describe(v: Verdict): string {
  switch (v.status) {
    case 'empty':
      return '';
    case 'valid':
      return {
        list: 'در فهرست',
        heuristic: 'شبیه فامیل',
        llm: 'تأیید هوش مصنوعی',
        host: 'تأیید میزبان',
      }[v.source];
    case 'unverified':
      return 'تشخیص داده نشد';
    case 'invalid':
      if (v.reason === 'letter') return 'با حرف درست شروع نمی‌شود';
      if (v.reason === 'host') return 'رد میزبان';
      return v.note ? `رد: ${v.note}` : 'همچین چیزی نداریم';
  }
}

function Cell({
  cell,
  canOverride,
  onOverride,
}: {
  cell: CellResult;
  canOverride: boolean;
  onOverride: (valid: boolean) => void;
}) {
  const v = cell.verdict;
  if (v.status === 'empty') return <span className="text-ink-soft">—</span>;
  const good = cell.points > 0;
  const tone = good ? 'text-ok' : 'text-pen line-through decoration-2';
  const body = (
    <>
      <span className={`text-lg font-medium ${tone}`}>{cell.answer}</span>
      <span className="text-ink-soft block text-xs">
        {good ? `${num(cell.points)} امتیاز` : '۰'} · {describe(v)}
      </span>
    </>
  );
  if (!canOverride) return <div>{body}</div>;
  const nowValid = v.status === 'valid' || (v.status === 'unverified' && good);
  return (
    <button
      type="button"
      className="hover:bg-marker/30 -m-1 rounded-[6px] p-1 text-right"
      title={nowValid ? 'غلط حساب کن' : 'درست حساب کن'}
      onClick={() => onOverride(!nowValid)}
    >
      {body}
    </button>
  );
}
