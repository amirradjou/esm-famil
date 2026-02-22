import { z } from 'zod';
import type { Verdict } from '@esm-famil/shared';
import { applyJudgement } from './claude.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import type { Candidate, Validator } from './types.js';

const ResponseSchema = z.object({
  results: z.array(z.object({ id: z.string(), valid: z.boolean(), note: z.string().default('') })),
});

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          valid: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: ['id', 'valid', 'note'],
      },
    },
  },
  required: ['results'],
};

/** Local fallback for development without an API key: any Ollama chat model with JSON mode. */
export class OllamaValidator implements Validator {
  readonly name = 'ollama';

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly log: (msg: string, err?: unknown) => void = () => {},
  ) {}

  async check(candidates: Candidate[]): Promise<Map<string, Verdict>> {
    const out = new Map<string, Verdict>();
    if (candidates.length === 0) return out;
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: JSON_SCHEMA,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(candidates) },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        this.log(`ollama validator: HTTP ${res.status}`);
        return out;
      }
      const body = (await res.json()) as { message?: { content?: string } };
      const parsed = ResponseSchema.safeParse(JSON.parse(body.message?.content ?? '{}'));
      if (!parsed.success) {
        this.log('ollama validator: response did not match schema', parsed.error);
        return out;
      }
      applyJudgement(parsed.data, candidates, out);
    } catch (err) {
      this.log('ollama validator: request failed', err);
    }
    return out;
  }
}
