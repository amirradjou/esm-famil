import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalize } from '@esm-famil/shared';

/**
 * Answers the LLM judge or a host approved, kept on disk so the word database grows with
 * play and the same word is instant (and free) next time. One JSON file per category.
 */
export class LearnedWords {
  private readonly words = new Map<string, Set<string>>();
  private dirty = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dir: string,
    private readonly log: (msg: string, err?: unknown) => void = () => {},
  ) {}

  load(): this {
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch (err) {
      this.log(`learned words: cannot create ${this.dir}; learning disabled`, err);
      return this;
    }
    return this;
  }

  private setFor(category: string): Set<string> {
    let set = this.words.get(category);
    if (!set) {
      set = new Set();
      try {
        const raw = JSON.parse(readFileSync(this.file(category), 'utf8')) as string[];
        for (const w of raw) set.add(normalize(w));
      } catch {
        /* first word for this category */
      }
      this.words.set(category, set);
    }
    return set;
  }

  has(category: string, answer: string): boolean {
    return this.setFor(category).has(normalize(answer));
  }

  add(category: string, answer: string): void {
    const n = normalize(answer);
    if (!n || this.setFor(category).has(n)) return;
    this.setFor(category).add(n);
    this.dirty.add(category);
    this.timer ??= setTimeout(() => this.flush(), 2000);
  }

  size(category: string): number {
    return this.setFor(category).size;
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const category of this.dirty) {
      try {
        writeFileSync(this.file(category), JSON.stringify([...this.setFor(category)]) + '\n');
      } catch (err) {
        this.log(`learned words: cannot write ${this.file(category)}`, err);
      }
    }
    this.dirty.clear();
  }

  private file(category: string): string {
    return join(this.dir, `${category}.json`);
  }
}
