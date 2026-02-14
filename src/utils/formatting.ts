/**
 * Currency and Number Formatting Utilities
 *
 * CONVENTION:
 * - Currency format: "$1,234" (positive) or "$-1,234" (negative)
 * - Dollar sign always comes first, no space
 * - Negative values: dollar sign, minus sign, number (no space)
 * - Locale-aware thousand/decimal separators (de: 1.234,56 / en: 1,234.56)
 * - No cents for whole numbers in display contexts
 * - Use 2 decimal places for precise trading values
 */

export type FormatLocale = 'de' | 'en';

/**
 * Get the locale string for toLocaleString based on language code.
 */
const getLocaleString = (locale: FormatLocale): string => {
  return locale === 'de' ? 'de-DE' : 'en-US';
};

/**
 * Format a number as currency with "$value" or "$-value" format.
 * Use this for displaying monetary values throughout the app.
 *
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 0 for display, 2 for trading)
 * @param locale - Language code for locale-specific formatting (default: 'en')
 * @returns Formatted string like "$1,234" or "$-1,234" (en) / "$1.234" or "$-1.234" (de)
 *
 * @example
 * formatCurrency(1234)           // "$1,234"
 * formatCurrency(-1234)          // "$-1,234"
 * formatCurrency(1234.56, 2)     // "$1,234.56"
 * formatCurrency(1234, 0, 'de')  // "$1.234"
 */
export const formatCurrency = (value: number, decimals: number = 0, locale: FormatLocale = 'en'): string => {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString(getLocaleString(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 ? `$-${formatted}` : `$${formatted}`;
};

/**
 * Format a number with thousand separators (no currency symbol).
 * Use this for quantities, share counts, etc.
 *
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 0)
 * @param locale - Language code for locale-specific formatting (default: 'en')
 * @returns Formatted string like "1,234" or "-1,234" (en) / "1.234" or "-1.234" (de)
 */
export const formatNumber = (value: number, decimals: number = 0, locale: FormatLocale = 'en'): string => {
  return value.toLocaleString(getLocaleString(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format a percentage value.
 *
 * @param value - The numeric value (0.15 = 15%)
 * @param decimals - Number of decimal places (default: 1)
 * @param showSign - Whether to show + for positive values (default: false)
 * @param locale - Language code for locale-specific formatting (default: 'en')
 * @returns Formatted string like "15.0%" or "+15.0%" (en) / "15,0%" (de)
 */
export const formatPercent = (value: number, decimals: number = 1, showSign: boolean = false, locale: FormatLocale = 'en'): string => {
  const percent = value * 100;
  const absFormatted = Math.abs(percent).toLocaleString(getLocaleString(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (percent < 0) return `-${absFormatted}%`;
  if (showSign && percent > 0) return `+${absFormatted}%`;
  return `${absFormatted}%`;
};

/**
 * Determine the format locale from an i18n language code.
 * Maps 'de' to German formatting, everything else to English.
 */
export const getFormatLocale = (language: string): FormatLocale => {
  return language === 'de' ? 'de' : 'en';
};

/**
 * Convert a positive integer to Roman numerals.
 * Used for loan numbering (K#I, K#II, K#III, etc.)
 *
 * @param num - The number to convert (1-3999)
 * @returns Roman numeral string
 *
 * @example
 * toRomanNumeral(1)  // "I"
 * toRomanNumeral(4)  // "IV"
 * toRomanNumeral(9)  // "IX"
 * toRomanNumeral(10) // "X"
 */
export const toRomanNumeral = (num: number): string => {
  if (num < 1 || num > 3999) return String(num);

  const romanNumerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let remaining = num;

  for (const [value, symbol] of romanNumerals) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }

  return result;
};
