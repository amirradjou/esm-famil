import type { CellResult, Verdict } from '@esm-famil/shared';
import { num } from '../format';

export function describeVerdict(v: Verdict): string {
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

export function VerdictCell({
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
        {good ? `${num(cell.points)} امتیاز` : '۰'} · {describeVerdict(v)}
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
