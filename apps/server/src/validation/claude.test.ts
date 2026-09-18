import { describe, expect, it } from 'vitest';
import type { Verdict } from '@esm-famil/shared';
import { applyJudgement } from './claude.js';
import { buildUserPrompt } from './prompt.js';

const candidates = [
  { key: 'p1:city', categoryId: 'city', letter: 'چ', answer: 'چم' },
  { key: 'p1:color', categoryId: 'color', letter: 'چ', answer: 'چرک' },
  { key: 'p2:name', categoryId: 'name', letter: 'چ', answer: 'چنگیز' },
];

describe('applyJudgement', () => {
  it('maps numbered results back onto candidates and ignores unknown numbers', () => {
    const out = new Map<string, Verdict>();
    const undecided = applyJudgement(
      {
        results: [
          { id: 1, valid: false, note: 'شهری به این نام نیست' },
          { id: 2, valid: false, note: '' },
          { id: 3, valid: true, note: '' },
          { id: 9, valid: true, note: '' },
        ],
      },
      candidates,
      out,
    );
    expect(undecided).toBe(0);
    expect(out.get('p1:city')).toEqual({
      status: 'invalid',
      reason: 'not-a-thing',
      note: 'شهری به این نام نیست',
    });
    expect(out.get('p1:color')).toEqual({ status: 'invalid', reason: 'not-a-thing' });
    expect(out.get('p2:name')).toEqual({ status: 'valid', source: 'llm' });
    expect(out.size).toBe(3);
  });

  it('reports candidates the model did not answer', () => {
    const out = new Map<string, Verdict>();
    expect(applyJudgement({ results: [{ id: 2, valid: true, note: '' }] }, candidates, out)).toBe(
      2,
    );
    expect(out.get('p1:color')).toEqual({ status: 'valid', source: 'llm' });
  });
});

describe('buildUserPrompt', () => {
  it('numbers every candidate and shows category label and letter', () => {
    const p = buildUserPrompt(candidates);
    expect(p).toContain('1. id=1');
    expect(p).toContain('3. id=3');
    expect(p).toContain('شهر (city)');
    expect(p).toContain('حرف: چ');
    expect(p).toContain('«چنگیز»');
  });
});
