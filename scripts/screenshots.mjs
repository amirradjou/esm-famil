// Plays one round with two headless browsers and saves the screenshots used in the README.
// Usage: node scripts/screenshots.mjs [baseUrl]   (server must be running, e.g. `pnpm start`)
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const out = 'docs/screenshots';
await mkdir(out, { recursive: true });

const HOST = {
  name: 'بابک',
  family: 'بابایی',
  city: 'بروجرد',
  country: 'برزیل',
  color: 'بادمجانی',
  food: 'بریانی',
  fruit: 'به',
  animal: 'بوقلمون',
  object: 'بالش',
  flower: 'بابونه',
};
const GUEST = {
  name: 'بهرام',
  family: 'بهرامی',
  city: 'بلخ',
  country: 'بلژیک',
  color: 'بلبل',
  food: 'باقالی پلو',
  fruit: 'به',
  animal: 'ببر',
  object: 'بشقاب',
  flower: 'بنفشه',
};

const browser = await chromium.launch();
const phone = { viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, locale: 'fa-IR' };
const host = await (await browser.newContext(phone)).newPage();
const guest = await (await browser.newContext(phone)).newPage();
const shot = async (page, name, fullPage = true) => {
  await page.mouse.move(0, 0); // no hover highlight in the picture
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
};

// Home
await host.goto(base);
await host.getByLabel('اسم شما در بازی').fill('سارا');
await shot(host, '1-home', false);
await host.getByRole('button', { name: 'اتاق جدید بساز' }).click();
const code = (
  await host
    .getByText(/^[A-Z0-9]{4}$/)
    .first()
    .textContent()
).trim();

// Lobby: play with the letter ب only, one round
for (const l of [
  'ا',
  'پ',
  'ت',
  'ج',
  'چ',
  'ح',
  'خ',
  'د',
  'ر',
  'ز',
  'س',
  'ش',
  'ص',
  'ط',
  'ع',
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
]) {
  await host.getByRole('button', { name: l, exact: true }).click();
  await host.waitForTimeout(60);
}
await host.getByLabel('تعداد دور').fill('1');
await guest.goto(`${base}/?room=${code}`);
await guest.getByLabel('اسم شما در بازی').fill('رضا');
await guest.getByRole('button', { name: 'بپیوند' }).click();
await host.getByText('رضا').waitFor();
await shot(host, '2-lobby');

// Round
await host.getByRole('button', { name: 'شروع بازی' }).click();
await guest.getByRole('button', { name: 'استپ!' }).waitFor();
for (const [cat, word] of Object.entries(GUEST)) await guest.locator(`#cat-${cat}`).fill(word);
for (const [cat, word] of Object.entries(HOST)) await host.locator(`#cat-${cat}`).fill(word);
await host.getByText(`رضا ${'۱۰'}/${'۱۰'}`).waitFor(); // the guest's autosave has landed
await shot(host, '3-round', false);
await host.getByRole('button', { name: 'استپ!' }).click();
await guest.getByRole('status').waitFor();
await shot(guest, '4-stop', false);

// Review (the LLM judge can take a while on a CPU-only model)
await host.getByText('نتیجه‌ی این دور').waitFor({ timeout: 180_000 });
await shot(host, '5-review');
await guest.setViewportSize({ width: 1100, height: 800 });
await shot(guest, '5-review-desktop', false);

// Final
await host.getByRole('button', { name: 'نتیجه‌ی نهایی' }).click();
await host.getByText('برد!').waitFor();
await shot(host, '6-final', false);

await browser.close();
console.log(`saved screenshots to ${out}/ (room ${code})`);
