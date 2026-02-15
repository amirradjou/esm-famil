import { describe, expect, it } from 'vitest';
import { firstLetter, normalize, startsWithLetter, DEFAULT_LETTER_POOL } from './persian.js';

describe('normalize', () => {
  it('maps Arabic yeh/kaf to Persian', () => {
    expect(normalize('علي')).toBe('علی');
    expect(normalize('كرمان')).toBe('کرمان');
  });
  it('strips ZWNJ, tatweel and diacritics', () => {
    expect(normalize('می‌خواهم')).toBe('میخواهم');
    expect(normalize('مـحـمـد')).toBe('محمد');
    expect(normalize('مُحَمَّد')).toBe('محمد');
  });
  it('collapses whitespace and trims', () => {
    expect(normalize('  سیب   زمینی ')).toBe('سیب زمینی');
  });
  it('converts Persian and Arabic digits', () => {
    expect(normalize('پژو ۲۰۶')).toBe('پژو 206');
  });
});

describe('startsWithLetter', () => {
  it('treats آ as ا', () => {
    expect(firstLetter('آرش')).toBe('ا');
    expect(startsWithLetter('آرش', 'ا')).toBe(true);
    expect(startsWithLetter('امیر', 'ا')).toBe(true);
  });
  it('rejects other letters and empty strings', () => {
    expect(startsWithLetter('بابک', 'ا')).toBe(false);
    expect(startsWithLetter('', 'ا')).toBe(false);
    expect(startsWithLetter('   ', 'ب')).toBe(false);
  });
  it('ignores leading whitespace and Arabic variants', () => {
    expect(startsWithLetter('  كرج', 'ک')).toBe(true);
  });
});

describe('DEFAULT_LETTER_POOL', () => {
  it('excludes the rare letters', () => {
    for (const l of ['ث', 'ذ', 'ژ', 'ض', 'ظ', 'غ']) expect(DEFAULT_LETTER_POOL).not.toContain(l);
    expect(DEFAULT_LETTER_POOL).toContain('ب');
  });
});
