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
  it('maps model results back onto candidate keys and ignores unknown ids', () => {
    const out = new Map<string, Verdict>();
    applyJudgement(
      {
        results: [
          { id: 'p1:city', valid: false, note: 'شهری به این نام نیست' },
          { id: 'p1:color', valid: false, note: '' },
          { id: 'p2:name', valid: true, note: '' },
          { id: 'made-up', valid: true, note: '' },
        ],
      },
      candidates,
      out,
    );
    expect(out.get('p1:city')).toEqual({
      status: 'invalid',
      reason: 'not-a-thing',
      note: 'شهری به این نام نیست',
    });
    expect(out.get('p1:color')).toEqual({ status: 'invalid', reason: 'not-a-thing' });
    expect(out.get('p2:name')).toEqual({ status: 'valid', source: 'llm' });
    expect(out.has('made-up')).toBe(false);
  });
});

describe('buildUserPrompt', () => {
  it('lists every candidate with its id, category label and letter', () => {
    const p = buildUserPrompt(candidates);
    expect(p).toContain('id="p1:city"');
    expect(p).toContain('شهر (city)');
    expect(p).toContain('حرف: چ');
    expect(p).toContain('«چنگیز»');
  });
});
