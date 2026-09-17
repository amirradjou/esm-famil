import type { CellResult, RoundResult, Verdict } from './protocol.js';
import { normalize } from './persian.js';

export const POINTS = { solo: 20, unique: 10, duplicate: 5, none: 0 } as const;

export interface ScoringOptions {
  soloBonus: boolean;
  unverifiedPolicy: 'accept' | 'reject';
}

export function verdictCounts(verdict: Verdict, opts: ScoringOptions): boolean {
  switch (verdict.status) {
    case 'valid':
      return true;
    case 'unverified':
      return opts.unverifiedPolicy === 'accept';
    default:
      return false;
  }
}

/**
 * Assign points per cell following the classic paper-game rules:
 *  - the only valid answer in a column: 20 (10 when the solo bonus is off)
 *  - a valid answer nobody else wrote: 10
 *  - a valid answer someone else also wrote: 5
 *  - empty or invalid: 0
 * `cells` is mutated in place (points filled in) and totals are returned.
 */
export function scoreRound(
  cells: Record<string, Record<string, CellResult>>,
  categoryIds: readonly string[],
  opts: ScoringOptions,
): Record<string, number> {
  const totals: Record<string, number> = {};
  const playerIds = Object.keys(cells);
  for (const pid of playerIds) totals[pid] = 0;

  for (const cat of categoryIds) {
    const valid: { pid: string; key: string }[] = [];
    for (const pid of playerIds) {
      const cell = cells[pid]?.[cat];
      if (cell && verdictCounts(cell.verdict, opts)) {
        valid.push({ pid, key: normalize(cell.answer) });
      }
    }
    const occurrences = new Map<string, number>();
    for (const v of valid) occurrences.set(v.key, (occurrences.get(v.key) ?? 0) + 1);

    for (const pid of playerIds) {
      const cell = cells[pid]?.[cat];
      if (!cell) continue;
      const entry = valid.find((v) => v.pid === pid);
      let points: number = POINTS.none;
      if (entry) {
        if (valid.length === 1) points = opts.soloBonus ? POINTS.solo : POINTS.unique;
        else if ((occurrences.get(entry.key) ?? 0) > 1) points = POINTS.duplicate;
        else points = POINTS.unique;
      }
      cell.points = points;
      totals[pid] = (totals[pid] ?? 0) + points;
    }
  }
  return totals;
}

/** Re-score after a host override without touching verdict sources. */
export function rescore(result: RoundResult, categoryIds: readonly string[], opts: ScoringOptions) {
  result.totals = scoreRound(result.cells, categoryIds, opts);
}
