const fa = new Intl.NumberFormat('fa-IR', { useGrouping: false });

export const num = (n: number): string => fa.format(n);

export function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${num(m)}:${num(s).padStart(2, '۰')}`;
}
