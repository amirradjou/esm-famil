import { describe, expect, it } from 'vitest';
import { ValidationPipeline, WordListValidator } from './index.js';

const wl = new WordListValidator();

describe('WordListValidator', () => {
  it('matches normalized spellings', () => {
    expect(wl.has('city', 'كرج')).toBe(true);
    expect(wl.has('city', ' تهران ')).toBe(true);
    expect(wl.has('name', 'علي')).toBe(true);
    expect(wl.has('color', 'قهوه ای')).toBe(false); // ZWNJ variant is listed; space variant is not
    expect(wl.has('color', 'قهوه‌ای')).toBe(true);
  });
  it('accepts flowers with or without the گل prefix', () => {
    expect(wl.has('flower', 'گل لاله')).toBe(true);
    expect(wl.has('flower', 'لاله')).toBe(true);
    expect(wl.has('flower', 'رز')).toBe(true);
  });
  it('accepts surname-shaped words for فامیل', async () => {
    const out = await wl.check([
      { key: 'a', categoryId: 'family', letter: 'ب', answer: 'برومندزاده' },
      { key: 'b', categoryId: 'family', letter: 'ب', answer: 'بم' },
    ]);
    expect(out.get('a')).toEqual({ status: 'valid', source: 'heuristic' });
    expect(out.has('b')).toBe(false);
  });
});

describe('ValidationPipeline', () => {
  it('applies the letter rule before any validator and marks leftovers unverified', async () => {
    const p = new ValidationPipeline([wl]);
    const out = await p.judge([
      { key: '1', categoryId: 'city', letter: 'ت', answer: 'تهران' },
      { key: '2', categoryId: 'city', letter: 'ت', answer: 'شیراز' },
      { key: '3', categoryId: 'city', letter: 'ت', answer: '' },
      { key: '4', categoryId: 'city', letter: 'ت', answer: 'تخیلی‌آباد' },
    ]);
    expect(out.get('1')).toEqual({ status: 'valid', source: 'list' });
    expect(out.get('2')).toEqual({ status: 'invalid', reason: 'letter' });
    expect(out.get('3')).toEqual({ status: 'empty' });
    expect(out.get('4')).toEqual({ status: 'unverified' });
  });
});
