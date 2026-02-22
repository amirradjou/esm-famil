import { startsWithLetter, type Verdict } from '@esm-famil/shared';
import type { Config } from '../config.js';
import { ClaudeValidator } from './claude.js';
import { OllamaValidator } from './ollama.js';
import type { Candidate, Validator } from './types.js';
import { WordListValidator } from './wordlist.js';

export type { Candidate, Validator } from './types.js';
export { WordListValidator } from './wordlist.js';

/**
 * Runs the letter rule first, then each validator in order on whatever is still undecided.
 * Anything left at the end is `unverified` and the room settings decide how to score it.
 */
export class ValidationPipeline {
  constructor(private readonly validators: Validator[]) {}

  async judge(candidates: Candidate[]): Promise<Map<string, Verdict>> {
    const verdicts = new Map<string, Verdict>();
    let pending: Candidate[] = [];
    for (const c of candidates) {
      if (c.answer.trim() === '') verdicts.set(c.key, { status: 'empty' });
      else if (!startsWithLetter(c.answer, c.letter))
        verdicts.set(c.key, { status: 'invalid', reason: 'letter' });
      else pending.push(c);
    }
    for (const v of this.validators) {
      if (pending.length === 0) break;
      const decided = await v.check(pending);
      for (const [k, verdict] of decided) verdicts.set(k, verdict);
      pending = pending.filter((c) => !decided.has(c.key));
    }
    for (const c of pending) verdicts.set(c.key, { status: 'unverified' });
    return verdicts;
  }
}

export function buildPipeline(
  config: Config,
  log: (msg: string, err?: unknown) => void,
): ValidationPipeline {
  const validators: Validator[] = [new WordListValidator()];
  if (config.validator === 'claude') validators.push(new ClaudeValidator(config.claudeModel, log));
  if (config.validator === 'ollama')
    validators.push(new OllamaValidator(config.ollamaUrl, config.ollamaModel, log));
  return new ValidationPipeline(validators);
}
