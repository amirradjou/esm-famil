import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LearnedWords } from './learned.js';
import { WordListValidator } from './wordlist.js';

let dir: string;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'esm-learned-'))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('LearnedWords', () => {
  it('remembers normalized words per category and persists them', () => {
    const l = new LearnedWords(dir).load();
    l.add('city', ' بلخ ');
    l.add('city', 'بلخ');
    l.add('food', 'بزقورمه');
    expect(l.has('city', 'بلخ')).toBe(true);
    expect(l.has('food', 'بلخ')).toBe(false);
    l.flush();
    expect(JSON.parse(readFileSync(join(dir, 'city.json'), 'utf8'))).toEqual(['بلخ']);
    const again = new LearnedWords(dir).load();
    expect(again.has('food', 'بزقورمه')).toBe(true);
    expect(again.size('city')).toBe(1);
  });

  it('feeds the word-list validator', async () => {
    const l = new LearnedWords(dir).load();
    const wl = new WordListValidator(undefined, l);
    expect(wl.has('city', 'بلخ')).toBe(false);
    l.add('city', 'بلخ');
    expect(wl.has('city', 'بلخ')).toBe(true);
    const out = await wl.check([{ key: 'k', categoryId: 'city', letter: 'ب', answer: 'بلخ' }]);
    expect(out.get('k')).toEqual({ status: 'valid', source: 'list' });
  });
});
