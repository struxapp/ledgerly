import { describe, expect, it } from 'vitest';
import { formatMoney, parseAmount } from '../src/lib/money';

describe('parseAmount', () => {
  it('reads plain and grouped amounts into cents', () => {
    expect(parseAmount('12')).toBe(1200);
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('1,234.56')).toBe(123456);
    expect(parseAmount('.99')).toBe(99);
    expect(parseAmount(' 0.10 ')).toBe(10);
  });
  it('reads decimal commas', () => {
    expect(parseAmount('12,50')).toBe(1250);
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('1 234,56', true)).toBe(123456);
  });
  it('reads signs, parentheses and currency symbols', () => {
    expect(parseAmount('-45.00')).toBe(-4500);
    expect(parseAmount('(45.00)')).toBe(-4500);
    expect(parseAmount('$1,200')).toBe(120000);
    expect(parseAmount('€ 9,99')).toBe(999);
    expect(parseAmount('25 EUR')).toBe(2500);
    expect(parseAmount('−7.25')).toBe(-725);
  });
  it('rejects text that is not a number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('12a4')).toBeNull();
  });
  it('avoids floating point drift', () => {
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('1.005')).toBe(101);
  });
});

describe('formatMoney', () => {
  it('formats cents in the chosen currency', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(-500, 'EUR')).toBe('−€5.00');
    expect(formatMoney(150000, 'JPY')).toBe('¥1,500');
  });
});
