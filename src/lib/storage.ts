// Persistence in localStorage, wrapped so the app keeps working (in memory) when storage is unavailable.
import { DEFAULT_CATEGORIES, isValidDate, type Category, type Ledger, type Transaction } from './model';

const KEY = 'ledgerly.v1';

export const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};

/** Validates data read back from storage; anything malformed is dropped rather than trusted. */
export function parseLedger(json: string | null): Ledger | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Partial<Ledger>;
    if (raw.version !== 1 || !Array.isArray(raw.categories) || !Array.isArray(raw.transactions)) return null;
    const categories = raw.categories.filter(
      (c): c is Category =>
        !!c && typeof c.id === 'string' && typeof c.name === 'string' && (c.kind === 'expense' || c.kind === 'income') &&
        Number.isInteger(c.budget) && c.budget >= 0 && Number.isInteger(c.slot),
    );
    if (categories.length === 0) categories.push(...DEFAULT_CATEGORIES.map((c) => ({ ...c })));
    const ids = new Set(categories.map((c) => c.id));
    const transactions = raw.transactions.filter(
      (t): t is Transaction =>
        !!t && typeof t.id === 'string' && typeof t.date === 'string' && isValidDate(t.date) &&
        (t.kind === 'expense' || t.kind === 'income') && ids.has(t.categoryId) &&
        Number.isInteger(t.amount) && t.amount > 0 && typeof t.note === 'string',
    );
    const currency = typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'USD';
    return { version: 1, currency, categories, transactions };
  } catch {
    return null;
  }
}

export const loadLedger = (): Ledger | null => parseLedger(store.get(KEY));
export const saveLedger = (ledger: Ledger): boolean => store.set(KEY, JSON.stringify(ledger));
