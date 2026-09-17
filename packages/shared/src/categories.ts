export interface Category {
  id: string;
  /** Persian label shown in the UI. */
  label: string;
}

/** Every category the app knows how to fact-check. Hosts pick a subset per game. */
export const ALL_CATEGORIES: readonly Category[] = [
  { id: 'name', label: 'اسم' },
  { id: 'family', label: 'فامیل' },
  { id: 'city', label: 'شهر' },
  { id: 'country', label: 'کشور' },
  { id: 'color', label: 'رنگ' },
  { id: 'food', label: 'غذا' },
  { id: 'fruit', label: 'میوه' },
  { id: 'animal', label: 'حیوان' },
  { id: 'object', label: 'اشیا' },
  { id: 'flower', label: 'گل' },
  { id: 'job', label: 'شغل' },
  { id: 'car', label: 'ماشین' },
];

/** The classic table most families play with. */
export const DEFAULT_CATEGORY_IDS: readonly string[] = [
  'name',
  'family',
  'city',
  'country',
  'color',
  'food',
  'fruit',
  'animal',
  'object',
  'flower',
];

export function categoryLabel(id: string): string {
  return ALL_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
