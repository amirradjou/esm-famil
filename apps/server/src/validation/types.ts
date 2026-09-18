import type { Verdict } from '@esm-famil/shared';

export interface Candidate {
  /** Opaque key the caller uses to map results back (e.g. `${playerId}:${categoryId}`). */
  key: string;
  categoryId: string;
  letter: string;
  answer: string;
}

/**
 * A validator decides whether an answer is a real thing in its category.
 * It returns a verdict for every candidate it can decide on and leaves the rest out,
 * so cheaper validators can run first and expensive ones only see the leftovers.
 */
export interface Validator {
  readonly name: string;
  check(candidates: Candidate[]): Promise<Map<string, Verdict>>;
  /** Optional: preload whatever makes the first check slow (e.g. a local model). */
  warmUp?(): Promise<void>;
}
