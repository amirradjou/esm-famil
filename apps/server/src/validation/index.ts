import { startsWithLetter, type ServerCapabilities, type Verdict } from '@esm-famil/shared';
import type { Config } from '../config.js';
import { ClaudeValidator } from './claude.js';
import { OllamaValidator } from './ollama.js';
import type { Candidate, Validator } from './types.js';
import { WordListValidator } from './wordlist.js';

export type { Candidate, Validator } from './types.js';
export { WordListValidator } from './wordlist.js';

export interface LlmJudge {
  validator: Validator;
  provider: string;
  model: string;
}

/**
 * Runs the letter rule first, then the database validators, then (when the room asks for it
 * and the server has one) the LLM judge, each on whatever is still undecided.
 * Anything left at the end is `unverified` and the room settings decide how to score it.
 */
export class ValidationPipeline {
  constructor(
    private readonly database: Validator[],
    private readonly llm: LlmJudge | null = null,
  ) {}

  get capabilities(): ServerCapabilities {
    return {
      llm: this.llm
        ? { available: true, provider: this.llm.provider, model: this.llm.model }
        : { available: false },
    };
  }

  async judge(candidates: Candidate[], useLlm: boolean): Promise<Map<string, Verdict>> {
    const verdicts = new Map<string, Verdict>();
    let pending: Candidate[] = [];
    for (const c of candidates) {
      if (c.answer.trim() === '') verdicts.set(c.key, { status: 'empty' });
      else if (!startsWithLetter(c.answer, c.letter))
        verdicts.set(c.key, { status: 'invalid', reason: 'letter' });
      else pending.push(c);
    }
    const tiers = [...this.database];
    if (useLlm && this.llm) tiers.push(this.llm.validator);
    for (const v of tiers) {
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
  let llm: LlmJudge | null = null;
  if (config.llmProvider === 'claude') {
    llm = {
      validator: new ClaudeValidator(config.claudeModel, log),
      provider: 'claude',
      model: config.claudeModel,
    };
  } else if (config.llmProvider === 'ollama') {
    llm = {
      validator: new OllamaValidator(config.ollamaUrl, config.ollamaModel, log),
      provider: 'ollama',
      model: config.ollamaModel,
    };
  }
  return new ValidationPipeline([new WordListValidator()], llm);
}
