import { describe, expect, it } from 'vitest';
import { ALL_CATEGORIES, normalize, PERSIAN_ALPHABET } from '@esm-famil/shared';
import { WORD_LISTS } from './index.js';

describe('word database', () => {
  it('has a list for every category', () => {
    for (const c of ALL_CATEGORIES) expect(WORD_LISTS[c.id]?.length ?? 0).toBeGreaterThan(50);
  });

  it('contains no duplicates after normalization', () => {
    for (const [cat, words] of Object.entries(WORD_LISTS)) {
      const seen = new Map<string, string>();
      const dups: string[] = [];
      for (const w of words) {
        const n = normalize(w);
        if (seen.has(n)) dups.push(`${w} ≈ ${seen.get(n)}`);
        else seen.set(n, w);
      }
      expect(dups, `${cat}.json`).toEqual([]);
    }
  });

  it('only holds trimmed Persian entries that start with a letter of the alphabet', () => {
    const letters = new Set<string>([...PERSIAN_ALPHABET, 'آ']);
    for (const [cat, words] of Object.entries(WORD_LISTS)) {
      const odd = words.filter((w) => w !== w.trim() || !letters.has(w.charAt(0)));
      expect(odd, `${cat}.json`).toEqual([]);
    }
  });
});
