import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Verdict } from '@esm-famil/shared';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import type { Candidate, Validator } from './types.js';

const JudgementSchema = z.object({
  results: z.array(
    z.object({
      /** The 1-based number of the answer in the prompt. */
      id: z.number().int(),
      valid: z.boolean(),
      note: z.string(),
    }),
  ),
});

export type Judgement = z.infer<typeof JudgementSchema>;

/** Fact-checks the answers the word lists did not know, in one call per round. */
export class ClaudeValidator implements Validator {
  readonly name = 'claude';
  private readonly client: Anthropic;

  constructor(
    private readonly model: string,
    private readonly log: (msg: string, err?: unknown) => void = () => {},
    client?: Anthropic,
  ) {
    // Credentials come from ANTHROPIC_API_KEY or an `ant auth login` profile.
    this.client = client ?? new Anthropic();
  }

  async check(candidates: Candidate[]): Promise<Map<string, Verdict>> {
    const out = new Map<string, Verdict>();
    if (candidates.length === 0) return out;
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(candidates) }],
        output_config: { format: zodOutputFormat(JudgementSchema), effort: 'low' },
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        this.log(`claude validator returned no judgement (stop_reason=${response.stop_reason})`);
        return out;
      }
      const undecided = applyJudgement(response.parsed_output, candidates, out);
      if (undecided > 0)
        this.log(`claude validator: ${undecided}/${candidates.length} answers left undecided`);
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        this.log('claude validator: invalid or missing API key', err);
      } else if (err instanceof Anthropic.RateLimitError) {
        this.log('claude validator: rate limited', err);
      } else if (err instanceof Anthropic.APIError) {
        this.log(`claude validator: API error ${err.status}`, err);
      } else {
        this.log('claude validator: request failed', err);
      }
    }
    return out;
  }
}

/** Map numbered results back onto candidates; returns how many candidates got no verdict. */
export function applyJudgement(
  judgement: Judgement,
  candidates: Candidate[],
  out: Map<string, Verdict>,
): number {
  let decided = 0;
  for (const r of judgement.results) {
    const c = candidates[r.id - 1];
    if (!c || out.has(c.key)) continue;
    decided += 1;
    out.set(
      c.key,
      r.valid
        ? { status: 'valid', source: 'llm' }
        : { status: 'invalid', reason: 'not-a-thing', ...(r.note ? { note: r.note } : {}) },
    );
  }
  return candidates.length - decided;
}
