/**
 * Persian text helpers shared by client and server.
 *
 * Players type on many different keyboards (Arabic layouts, Windows Persian, mobile),
 * so the same word can arrive with Arabic Yeh/Kaf, ZWNJ, tatweel, diacritics or
 * Arabic-Indic digits. Everything is compared through `normalize`.
 */

const DIACRITICS = /[ً-ْٰـ]/g; // harakat, superscript alef, tatweel
const ZWNJ_ZWJ = /[‌‍]/g;
const WHITESPACE = /\s+/g;

const CHAR_MAP: Record<string, string> = {
  ي: 'ی', // ي -> ی
  ى: 'ی', // ى -> ی
  ے: 'ی', // ے -> ی
  ك: 'ک', // ك -> ک
  ڪ: 'ک', // ڪ -> ک
  ة: 'ه', // ة -> ه
  ۀ: 'ه', // ۀ -> ه
  ؤ: 'و', // ؤ -> و
  ئ: 'ی', // ئ -> ی
  إ: 'ا', // إ -> ا
  أ: 'ا', // أ -> ا
  ٱ: 'ا', // ٱ -> ا
};

const DIGIT_MAP: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

/** Canonical form used for comparing answers and word-list lookups. */
export function normalize(input: string): string {
  let s = input.normalize('NFC').trim().toLowerCase();
  s = s.replace(DIACRITICS, '').replace(ZWNJ_ZWJ, '');
  let out = '';
  for (const ch of s) out += CHAR_MAP[ch] ?? DIGIT_MAP[ch] ?? ch;
  return out.replace(WHITESPACE, ' ').trim();
}

/** Alef with madda (آ) counts as alef (ا) for the "starts with" rule, as in the paper game. */
export function firstLetter(input: string): string {
  const s = normalize(input);
  const ch = s.charAt(0);
  return ch === 'آ' ? 'ا' : ch;
}

export function startsWithLetter(answer: string, letter: string): boolean {
  const first = firstLetter(answer);
  return first !== '' && first === firstLetter(letter);
}

/** The 32 letters of the Persian alphabet, in order. */
export const PERSIAN_ALPHABET = [
  'ا',
  'ب',
  'پ',
  'ت',
  'ث',
  'ج',
  'چ',
  'ح',
  'خ',
  'د',
  'ذ',
  'ر',
  'ز',
  'ژ',
  'س',
  'ش',
  'ص',
  'ض',
  'ط',
  'ظ',
  'ع',
  'غ',
  'ف',
  'ق',
  'ک',
  'گ',
  'ل',
  'م',
  'ن',
  'و',
  'ه',
  'ی',
] as const;

export type PersianLetter = (typeof PERSIAN_ALPHABET)[number];

/** Letters most groups skip because too few words start with them. */
export const RARE_LETTERS: readonly PersianLetter[] = ['ث', 'ذ', 'ژ', 'ض', 'ظ', 'غ'];

export const DEFAULT_LETTER_POOL: readonly PersianLetter[] = PERSIAN_ALPHABET.filter(
  (l) => !RARE_LETTERS.includes(l),
);

export function isPersianLetter(s: string): s is PersianLetter {
  return (PERSIAN_ALPHABET as readonly string[]).includes(s);
}
