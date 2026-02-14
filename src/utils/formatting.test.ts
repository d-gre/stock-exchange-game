import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatPercent, getFormatLocale, toRomanNumeral } from './formatting';

describe('formatting utilities', () => {
  describe('formatCurrency', () => {
    it('should format positive values as "$value"', () => {
      expect(formatCurrency(1234)).toBe('$1,234');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(1000000)).toBe('$1,000,000');
    });

    it('should format negative values as "$-value"', () => {
      expect(formatCurrency(-1234)).toBe('$-1,234');
      expect(formatCurrency(-1000000)).toBe('$-1,000,000');
    });

    it('should support decimal places', () => {
      expect(formatCurrency(1234.56, 2)).toBe('$1,234.56');
      expect(formatCurrency(-1234.56, 2)).toBe('$-1,234.56');
      expect(formatCurrency(1234, 2)).toBe('$1,234.00');
    });

    it('should round values correctly', () => {
      expect(formatCurrency(1234.999, 2)).toBe('$1,235.00');
      expect(formatCurrency(1234.994, 2)).toBe('$1,234.99');
    });

    it('should use German locale formatting', () => {
      expect(formatCurrency(1234, 0, 'de')).toBe('$1.234');
      expect(formatCurrency(-1234, 0, 'de')).toBe('$-1.234');
      expect(formatCurrency(1234.56, 2, 'de')).toBe('$1.234,56');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with thousand separators', () => {
      expect(formatNumber(1234)).toBe('1,234');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(0)).toBe('0');
    });

    it('should format negative numbers', () => {
      expect(formatNumber(-1234)).toBe('-1,234');
    });

    it('should support decimal places', () => {
      expect(formatNumber(1234.56, 2)).toBe('1,234.56');
      expect(formatNumber(1234, 2)).toBe('1,234.00');
    });

    it('should use German locale formatting', () => {
      expect(formatNumber(1234, 0, 'de')).toBe('1.234');
      expect(formatNumber(1234.56, 2, 'de')).toBe('1.234,56');
    });
  });

  describe('formatPercent', () => {
    it('should format percentages', () => {
      expect(formatPercent(0.15)).toBe('15.0%');
      expect(formatPercent(0.5)).toBe('50.0%');
      expect(formatPercent(1)).toBe('100.0%');
    });

    it('should format negative percentages', () => {
      expect(formatPercent(-0.15)).toBe('-15.0%');
    });

    it('should support custom decimal places', () => {
      expect(formatPercent(0.1567, 2)).toBe('15.67%');
      expect(formatPercent(0.15, 0)).toBe('15%');
    });

    it('should optionally show plus sign for positive values', () => {
      expect(formatPercent(0.15, 1, true)).toBe('+15.0%');
      expect(formatPercent(-0.15, 1, true)).toBe('-15.0%');
      expect(formatPercent(0, 1, true)).toBe('0.0%');
    });

    it('should use German locale formatting', () => {
      expect(formatPercent(0.15, 1, false, 'de')).toBe('15,0%');
      expect(formatPercent(0.1567, 2, false, 'de')).toBe('15,67%');
    });
  });

  describe('getFormatLocale', () => {
    it('should return "de" for German language', () => {
      expect(getFormatLocale('de')).toBe('de');
    });

    it('should return "en" for English and other languages', () => {
      expect(getFormatLocale('en')).toBe('en');
      expect(getFormatLocale('ja')).toBe('en');
      expect(getFormatLocale('la')).toBe('en');
      expect(getFormatLocale('fr')).toBe('en');
    });
  });

  describe('toRomanNumeral', () => {
    it('should convert basic numbers 1-10', () => {
      expect(toRomanNumeral(1)).toBe('I');
      expect(toRomanNumeral(2)).toBe('II');
      expect(toRomanNumeral(3)).toBe('III');
      expect(toRomanNumeral(4)).toBe('IV');
      expect(toRomanNumeral(5)).toBe('V');
      expect(toRomanNumeral(6)).toBe('VI');
      expect(toRomanNumeral(7)).toBe('VII');
      expect(toRomanNumeral(8)).toBe('VIII');
      expect(toRomanNumeral(9)).toBe('IX');
      expect(toRomanNumeral(10)).toBe('X');
    });

    it('should convert tens and hundreds', () => {
      expect(toRomanNumeral(40)).toBe('XL');
      expect(toRomanNumeral(50)).toBe('L');
      expect(toRomanNumeral(90)).toBe('XC');
      expect(toRomanNumeral(100)).toBe('C');
      expect(toRomanNumeral(400)).toBe('CD');
      expect(toRomanNumeral(500)).toBe('D');
      expect(toRomanNumeral(900)).toBe('CM');
      expect(toRomanNumeral(1000)).toBe('M');
    });

    it('should convert complex numbers', () => {
      expect(toRomanNumeral(14)).toBe('XIV');
      expect(toRomanNumeral(49)).toBe('XLIX');
      expect(toRomanNumeral(99)).toBe('XCIX');
      expect(toRomanNumeral(1994)).toBe('MCMXCIV');
      expect(toRomanNumeral(2024)).toBe('MMXXIV');
      expect(toRomanNumeral(3999)).toBe('MMMCMXCIX');
    });

    it('should return string representation for out of range numbers', () => {
      expect(toRomanNumeral(0)).toBe('0');
      expect(toRomanNumeral(-1)).toBe('-1');
      expect(toRomanNumeral(4000)).toBe('4000');
      expect(toRomanNumeral(10000)).toBe('10000');
    });
  });
});
