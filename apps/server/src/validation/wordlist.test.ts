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

const llmStub = {
  validator: {
    name: 'stub',
    check: async (cs: { key: string }[]) =>
      new Map(cs.map((c) => [c.key, { status: 'invalid', reason: 'not-a-thing' } as const])),
  },
  provider: 'stub',
  model: 'stub-1',
};

describe('ValidationPipeline', () => {
  it('reports whether an LLM judge is configured', () => {
    expect(new ValidationPipeline([wl]).capabilities.llm).toEqual({ available: false });
    expect(new ValidationPipeline([wl], llmStub).capabilities.llm).toEqual({
      available: true,
      provider: 'stub',
      model: 'stub-1',
    });
  });

  it('only consults the LLM judge when the room asks for it', async () => {
    const p = new ValidationPipeline([wl], llmStub);
    const cs = [
      { key: 'known', categoryId: 'city', letter: 'ت', answer: 'تهران' },
      { key: 'unknown', categoryId: 'city', letter: 'ت', answer: 'تخیلی‌آباد' },
    ];
    const withLlm = await p.judge(cs, true);
    expect(withLlm.get('known')).toEqual({ status: 'valid', source: 'list' });
    expect(withLlm.get('unknown')).toEqual({ status: 'invalid', reason: 'not-a-thing' });
    const without = await p.judge(cs, false);
    expect(without.get('unknown')).toEqual({ status: 'unverified' });
  });

  it('applies the letter rule before any validator and marks leftovers unverified', async () => {
    const p = new ValidationPipeline([wl]);
    const out = await p.judge(
      [
        { key: '1', categoryId: 'city', letter: 'ت', answer: 'تهران' },
        { key: '2', categoryId: 'city', letter: 'ت', answer: 'شیراز' },
        { key: '3', categoryId: 'city', letter: 'ت', answer: '' },
        { key: '4', categoryId: 'city', letter: 'ت', answer: 'تخیلی‌آباد' },
      ],
      true,
    );
    expect(out.get('1')).toEqual({ status: 'valid', source: 'list' });
    expect(out.get('2')).toEqual({ status: 'invalid', reason: 'letter' });
    expect(out.get('3')).toEqual({ status: 'empty' });
    expect(out.get('4')).toEqual({ status: 'unverified' });
  });
});
