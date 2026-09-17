import { ALL_CATEGORIES, normalize, type Verdict } from '@esm-famil/shared';
import { WORD_LISTS } from './data/index.js';
import type { Candidate, Validator } from './types.js';

export function loadWordLists(): Map<string, Set<string>> {
  const lists = new Map<string, Set<string>>();
  for (const cat of ALL_CATEGORIES) {
    const raw = WORD_LISTS[cat.id];
    if (!raw) throw new Error(`no word list bundled for category "${cat.id}"`);
    lists.set(cat.id, new Set(raw.map(normalize)));
  }
  return lists;
}

/** Common Persian surname endings; a word ending like this is accepted as a plausible فامیل. */
const SURNAME_SUFFIXES = ['زاده', 'پور', 'نژاد', 'نیا', 'فر', 'یان', 'وند', 'لو', 'ی', 'ان'];

function looksLikeSurname(normalized: string): boolean {
  if (normalized.length < 4) return false;
  return SURNAME_SUFFIXES.some((s) => normalized.endsWith(s));
}

/**
 * Fast, offline tier: exact (normalized) match against the bundled lists.
 * Also accepts "گل X" for a flower listed as X and vice-versa, since players write both.
 */
export class WordListValidator implements Validator {
  readonly name = 'list';
  constructor(private readonly lists: Map<string, Set<string>> = loadWordLists()) {}

  has(categoryId: string, answer: string): boolean {
    const list = this.lists.get(categoryId);
    if (!list) return false;
    const n = normalize(answer);
    if (list.has(n)) return true;
    if (categoryId === 'flower') {
      if (n.startsWith('گل ') && list.has(n.slice(3))) return true;
      if (list.has(`گل ${n}`)) return true;
    }
    return false;
  }

  async check(candidates: Candidate[]): Promise<Map<string, Verdict>> {
    const out = new Map<string, Verdict>();
    for (const c of candidates) {
      if (this.has(c.categoryId, c.answer)) {
        out.set(c.key, { status: 'valid', source: 'list' });
      } else if (c.categoryId === 'family' && looksLikeSurname(normalize(c.answer))) {
        out.set(c.key, { status: 'valid', source: 'heuristic' });
      }
    }
    return out;
  }
}
