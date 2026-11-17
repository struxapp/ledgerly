// Money in integer cents: parsing what people type or what a bank export contains, and formatting with Intl.

export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish złoty' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'ZAR', name: 'South African rand' },
];

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${compact}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    });
    formatters.set(key, f);
  }
  return f;
}

/** "$1,234.50"; amounts are cents. Currencies without minor units (JPY, KRW) round to whole units. */
export const formatMoney = (cents: number, currency: string): string =>
  formatter(currency, false).format(cents / 100).replace('-', '−');

/** "$1.2K" for axis labels. */
export const formatMoneyCompact = (cents: number, currency: string): string =>
  formatter(currency, true).format(cents / 100);

/**
 * Parses an amount such as "1,234.50", "1.234,50", "€ 12", "(45.00)" or "-12.5" into cents. With `decimalComma`,
 * a comma is the decimal separator. Returns null when the text is not a number.
 */
export function parseAmount(text: string, decimalComma = false): number | null {
  let s = text.trim().replace(/[\s\u00a0\u202f']/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^[^\d.,+\-−]+|[^\d.,]+$/g, ''); // currency symbols or codes before or after
  if (/^[-−]/.test(s)) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  s = s.replace(/^[^\d.,]+/, '');
  if (!decimalComma && /^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) decimalComma = true; // "1.234,50"
  if (!decimalComma && /^\d+,\d{1,2}$/.test(s)) decimalComma = true; // "12,50"
  if (decimalComma) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  // Work on the digits, not a float, so "1.005" rounds half up to 101 cents exactly.
  const [whole, frac = ''] = s.split('.');
  const thousandths = Number((frac + '000').slice(0, 3));
  const cents = Number(whole || '0') * 100 + Math.round(thousandths / 10);
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}
