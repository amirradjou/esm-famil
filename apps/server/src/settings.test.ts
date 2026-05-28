import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@esm-famil/shared';
import { RoomError } from './errors.js';
import { applySettingsPatch } from './settings.js';

const base = { ...DEFAULT_SETTINGS };

describe('applySettingsPatch', () => {
  it('returns a new object and leaves the input untouched', () => {
    const next = applySettingsPatch(base, { totalRounds: 3 }, false);
    expect(next.totalRounds).toBe(3);
    expect(base.totalRounds).toBe(DEFAULT_SETTINGS.totalRounds);
  });

  it('drops unknown categories and letters, and refuses too few', () => {
    const next = applySettingsPatch(
      base,
      { categoryIds: ['name', 'bogus', 'city', 'name'], letterPool: ['ب', 'x', 'ب'] },
      false,
    );
    expect(next.categoryIds).toEqual(['name', 'city']);
    expect(next.letterPool).toEqual(['ب']);
    expect(() => applySettingsPatch(base, { categoryIds: ['name'] }, false)).toThrow(RoomError);
    expect(() => applySettingsPatch(base, { letterPool: ['x'] }, false)).toThrow(RoomError);
  });

  it('clamps numbers and rejects garbage', () => {
    const next = applySettingsPatch(
      base,
      { totalRounds: 99, roundSeconds: -5, stopGraceSeconds: 7.6 },
      false,
    );
    expect(next).toMatchObject({ totalRounds: 20, roundSeconds: 0, stopGraceSeconds: 8 });
    expect(() =>
      applySettingsPatch(base, { totalRounds: 'abc' as unknown as number }, false),
    ).toThrow(/نامعتبر/);
  });

  it('only allows the LLM judge when the server has one', () => {
    expect(applySettingsPatch(base, { llmJudge: true }, true).llmJudge).toBe(true);
    expect(() => applySettingsPatch(base, { llmJudge: true }, false)).toThrow(/داور/);
    expect(applySettingsPatch(base, { llmJudge: false }, false).llmJudge).toBe(false);
  });

  it('validates the unverified policy', () => {
    expect(applySettingsPatch(base, { unverifiedPolicy: 'reject' }, false).unverifiedPolicy).toBe(
      'reject',
    );
    expect(() =>
      applySettingsPatch(base, { unverifiedPolicy: 'maybe' as 'accept' }, false),
    ).toThrow(RoomError);
  });
});
