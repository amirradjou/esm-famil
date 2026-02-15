import { describe, expect, it } from 'vitest';
import type { CellResult, Verdict } from './protocol.js';
import { scoreRound } from './scoring.js';

const valid: Verdict = { status: 'valid', source: 'list' };
const cell = (answer: string, verdict: Verdict = valid): CellResult => ({
  answer,
  verdict,
  points: 0,
});
const opts = { soloBonus: true, unverifiedPolicy: 'accept' as const };

describe('scoreRound', () => {
  it('gives 10 for unique, 5 for duplicates, 0 for empty', () => {
    const cells = {
      a: { name: cell('بابک'), city: cell('بم') },
      b: { name: cell('بهرام'), city: cell('بم') },
      c: { name: cell('', { status: 'empty' }), city: cell('بوشهر') },
    };
    const totals = scoreRound(cells, ['name', 'city'], opts);
    expect(cells.a.name.points).toBe(10);
    expect(cells.a.city.points).toBe(5);
    expect(cells.b.city.points).toBe(5);
    expect(cells.c.name.points).toBe(0);
    expect(cells.c.city.points).toBe(10);
    expect(totals).toEqual({ a: 15, b: 15, c: 10 });
  });

  it('gives the solo bonus when only one player has a valid answer', () => {
    const cells = {
      a: { color: cell('بنفش') },
      b: { color: cell('', { status: 'empty' }) },
      c: { color: cell('بلبل', { status: 'invalid', reason: 'not-a-thing' }) },
    };
    scoreRound(cells, ['color'], opts);
    expect(cells.a.color.points).toBe(20);
    scoreRound(cells, ['color'], { ...opts, soloBonus: false });
    expect(cells.a.color.points).toBe(10);
  });

  it('treats duplicates through normalization (Arabic yeh, ZWNJ)', () => {
    const cells = { a: { name: cell('علي') }, b: { name: cell('علی') } };
    scoreRound(cells, ['name'], opts);
    expect(cells.a.name.points).toBe(5);
    expect(cells.b.name.points).toBe(5);
  });

  it('honours the unverified policy', () => {
    const cells = { a: { name: cell('بلقیس', { status: 'unverified' }) }, b: { name: cell('') } };
    cells.b.name.verdict = { status: 'empty' };
    scoreRound(cells, ['name'], opts);
    expect(cells.a.name.points).toBe(20);
    scoreRound(cells, ['name'], { ...opts, unverifiedPolicy: 'reject' });
    expect(cells.a.name.points).toBe(0);
  });

  it('ignores a player with a single-player table', () => {
    const cells = { a: { name: cell('بابک') } };
    const totals = scoreRound(cells, ['name'], opts);
    expect(totals).toEqual({ a: 20 });
  });
});
