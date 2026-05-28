import { ALL_CATEGORIES, isPersianLetter, type GameSettings } from '@esm-famil/shared';
import { RoomError } from './errors.js';

export const LIMITS = {
  roundSeconds: { min: 0, max: 600 },
  stopGraceSeconds: { min: 0, max: 30 },
  totalRounds: { min: 1, max: 20 },
  minCategories: 2,
} as const;

/**
 * Validate a host's settings patch against the current settings and return the new settings.
 * Unknown category ids and letters are dropped; numbers are clamped; anything unusable throws.
 */
export function applySettingsPatch(
  current: GameSettings,
  patch: Partial<GameSettings>,
  llmAvailable: boolean,
): GameSettings {
  const next: GameSettings = { ...current };
  if (patch.categoryIds) {
    const known = new Set(ALL_CATEGORIES.map((c) => c.id));
    const ids = [...new Set(patch.categoryIds.filter((id) => known.has(id)))];
    if (ids.length < LIMITS.minCategories)
      throw new RoomError('bad-request', 'حداقل دو دسته لازم است');
    next.categoryIds = ids;
  }
  if (patch.letterPool) {
    const letters = [...new Set(patch.letterPool.filter(isPersianLetter))];
    if (letters.length === 0) throw new RoomError('bad-request', 'حداقل یک حرف لازم است');
    next.letterPool = letters;
  }
  if (patch.roundSeconds !== undefined)
    next.roundSeconds = clampInt(patch.roundSeconds, LIMITS.roundSeconds, 'زمان دور');
  if (patch.stopGraceSeconds !== undefined)
    next.stopGraceSeconds = clampInt(patch.stopGraceSeconds, LIMITS.stopGraceSeconds, 'مهلت استپ');
  if (patch.totalRounds !== undefined)
    next.totalRounds = clampInt(patch.totalRounds, LIMITS.totalRounds, 'تعداد دور');
  if (patch.soloBonus !== undefined) next.soloBonus = Boolean(patch.soloBonus);
  if (patch.llmJudge !== undefined) {
    if (patch.llmJudge && !llmAvailable)
      throw new RoomError('bad-request', 'روی این سرور داور هوش مصنوعی تنظیم نشده');
    next.llmJudge = Boolean(patch.llmJudge);
  }
  if (patch.unverifiedPolicy !== undefined) {
    if (patch.unverifiedPolicy !== 'accept' && patch.unverifiedPolicy !== 'reject')
      throw new RoomError('bad-request', 'سیاست نامعتبر');
    next.unverifiedPolicy = patch.unverifiedPolicy;
  }
  return next;
}

function clampInt(value: unknown, range: { min: number; max: number }, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RoomError('bad-request', `${label} نامعتبر است`);
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}
