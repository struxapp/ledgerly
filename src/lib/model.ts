// Ledgerly's data model: categories with monthly budgets, transactions in minor units (cents), and the monthly
// summaries the views are built from.

export type Kind = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  kind: Kind;
  /** Monthly budget in cents (expenses only; 0 = no budget). */
  budget: number;
  /** Fixed categorical slot 1–8 for colour; 0 = neutral ("Other" and any category past the eighth). */
  slot: number;
  icon: string;
}

export interface Transaction {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  kind: Kind;
  categoryId: string;
  /** Always positive, in cents. */
  amount: number;
  note: string;
  /** Part of the bundled example data. */
  example?: boolean;
}

export interface Ledger {
  version: 1;
  currency: string;
  categories: Category[];
  transactions: Transaction[];
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'housing', name: 'Housing', kind: 'expense', budget: 150000, slot: 1, icon: 'home' },
  { id: 'groceries', name: 'Groceries', kind: 'expense', budget: 45000, slot: 2, icon: 'cart' },
  { id: 'dining', name: 'Dining out', kind: 'expense', budget: 22000, slot: 3, icon: 'cup' },
  { id: 'transport', name: 'Transport', kind: 'expense', budget: 16000, slot: 4, icon: 'bus' },
  { id: 'utilities', name: 'Bills & utilities', kind: 'expense', budget: 20000, slot: 5, icon: 'bolt' },
  { id: 'health', name: 'Health & fitness', kind: 'expense', budget: 9000, slot: 6, icon: 'heart' },
  { id: 'shopping', name: 'Shopping', kind: 'expense', budget: 20000, slot: 7, icon: 'bag' },
  { id: 'fun', name: 'Entertainment', kind: 'expense', budget: 9000, slot: 8, icon: 'ticket' },
  { id: 'other', name: 'Other', kind: 'expense', budget: 6000, slot: 0, icon: 'dots' },
  { id: 'salary', name: 'Salary', kind: 'income', budget: 0, slot: 0, icon: 'briefcase' },
  { id: 'freelance', name: 'Freelance', kind: 'income', budget: 0, slot: 0, icon: 'spark' },
  { id: 'other-income', name: 'Other income', kind: 'income', budget: 0, slot: 0, icon: 'coins' },
];

export const emptyLedger = (currency = 'USD'): Ledger => ({
  version: 1,
  currency,
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  transactions: [],
});

/** "2026-11" */
export type MonthKey = string;

export const monthOf = (date: string): MonthKey => date.slice(0, 7);

export const monthKey = (year: number, month: number): MonthKey => `${year}-${String(month).padStart(2, '0')}`;

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return monthKey(Math.floor(total / 12), (total % 12) + 1);
}

export const todayIso = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function isValidDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export interface CategoryTotal {
  category: Category;
  spent: number;
  budget: number;
}

export interface MonthSummary {
  month: MonthKey;
  income: number;
  spent: number;
  net: number;
  budgetTotal: number;
  /** Expense categories with spending or a budget, in category order. */
  byCategory: CategoryTotal[];
  transactions: Transaction[];
}

export function summarise(ledger: Ledger, month: MonthKey): MonthSummary {
  const transactions = ledger.transactions
    .filter((t) => monthOf(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const spentBy = new Map<string, number>();
  let income = 0;
  let spent = 0;
  for (const t of transactions) {
    if (t.kind === 'income') income += t.amount;
    else {
      spent += t.amount;
      spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + t.amount);
    }
  }
  const byCategory = ledger.categories
    .filter((c) => c.kind === 'expense')
    .map((c) => ({ category: c, spent: spentBy.get(c.id) ?? 0, budget: c.budget }))
    .filter((x) => x.spent > 0 || x.budget > 0);
  const budgetTotal = byCategory.reduce((s, x) => s + x.budget, 0);
  return { month, income, spent, net: income - spent, budgetTotal, byCategory, transactions };
}

/** Months from `from` to `to` inclusive. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

/**
 * Donut slices: the categories with spending, in category order. Categories without a colour slot (past the eighth)
 * fold into one neutral "Other" slice, so no colour is ever generated or reused.
 */
export function donutSlices(summary: MonthSummary): { label: string; slot: number; amount: number; ids: string[] }[] {
  const slices: { label: string; slot: number; amount: number; ids: string[] }[] = [];
  let other = 0;
  const otherIds: string[] = [];
  for (const x of summary.byCategory) {
    if (x.spent <= 0) continue;
    if (x.category.slot > 0) slices.push({ label: x.category.name, slot: x.category.slot, amount: x.spent, ids: [x.category.id] });
    else {
      other += x.spent;
      otherIds.push(x.category.id);
    }
  }
  if (other > 0) slices.push({ label: otherIds.length === 1 && otherIds[0] === 'other' ? 'Other' : 'Other categories', slot: 0, amount: other, ids: otherIds });
  return slices;
}

let counter = 0;
export const newId = (): string => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Next free colour slot for a new expense category, or 0 when all eight are taken. */
export function freeSlot(categories: Category[]): number {
  const used = new Set(categories.filter((c) => c.kind === 'expense').map((c) => c.slot));
  for (let s = 1; s <= 8; s++) if (!used.has(s)) return s;
  return 0;
}
