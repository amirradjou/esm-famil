import { describe, expect, it } from 'vitest';
import { mmss, num } from './format';

describe('num', () => {
  it('renders Persian digits without grouping', () => {
    expect(num(0)).toBe('۰');
    expect(num(1234)).toBe('۱۲۳۴');
  });
});

describe('mmss', () => {
  it('rounds up to the next second and pads seconds', () => {
    expect(mmss(0)).toBe('۰:۰۰');
    expect(mmss(1)).toBe('۰:۰۱');
    expect(mmss(65_000)).toBe('۱:۰۵');
    expect(mmss(600_000)).toBe('۱۰:۰۰');
  });
  it('never goes negative', () => {
    expect(mmss(-5000)).toBe('۰:۰۰');
  });
});
