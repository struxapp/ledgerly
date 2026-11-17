// Example data: three months of a plausible household budget, marked `example: true` so one click removes it.
// It is generated (deterministically, from the month) and never presented as anyone's real spending.
import { addMonths, emptyLedger, monthKey, type Kind, type Ledger, type MonthKey, type Transaction } from './model';

/** Small deterministic generator (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const daysIn = (key: MonthKey) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function exampleMonth(key: MonthKey, lastDay: number): Transaction[] {
  const [y, m] = key.split('-').map(Number);
  const rnd = random(y * 100 + m);
  const span = Math.min(lastDay, daysIn(key));
  const out: Transaction[] = [];
  let n = 0;
  const add = (day: number, kind: Kind, categoryId: string, dollars: number, note: string) => {
    if (day < 1 || day > span) return;
    out.push({
      id: `ex-${key}-${n++}`,
      date: `${key}-${String(day).padStart(2, '0')}`,
      kind,
      categoryId,
      amount: Math.round(dollars * 100),
      note,
      example: true,
    });
  };
  const between = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * 100) / 100;
  const day = (lo: number, hi: number) => Math.floor(lo + rnd() * (hi - lo + 1));

  add(1, 'expense', 'housing', 1450, 'Rent');
  add(2, 'expense', 'transport', 86, 'Monthly transit pass');
  add(5, 'expense', 'health', 39, 'Gym membership');
  add(8, 'expense', 'utilities', between(58, 96), 'Electricity');
  add(12, 'expense', 'utilities', 45, 'Internet');
  add(15, 'expense', 'utilities', 25, 'Phone plan');
  add(10, 'expense', 'fun', 15.99, 'Streaming subscription');
  add(18, 'expense', 'fun', 10.99, 'Music subscription');
  add(1, 'income', 'salary', 2100, 'Salary');
  add(15, 'income', 'salary', 2100, 'Salary');
  add(day(6, 20), 'income', 'freelance', Math.round(between(320, 880)), 'Freelance design project');
  for (let d = 3; d <= 31; d += 7) add(d + day(0, 2), 'expense', 'groceries', between(62, 138), 'Weekly groceries');
  const dining = ['Lunch with a colleague', 'Pizza night', 'Coffee and pastries', 'Dinner out', 'Takeaway', 'Brunch'];
  const meals = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < meals; i++) add(day(1, 28), 'expense', 'dining', between(9, 62), dining[i % dining.length]);
  const rides = ['Taxi home', 'Bike share', 'Train ticket'];
  for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) add(day(3, 28), 'expense', 'transport', between(6, 34), rides[i % rides.length]);
  const shops = ['Running shoes', 'Kitchen supplies', 'Books', 'Gift for a friend', 'Winter jacket', 'Houseplants'];
  for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) add(day(2, 27), 'expense', 'shopping', between(18, 165), shops[(m + i) % shops.length]);
  if (rnd() > 0.35) add(day(4, 26), 'expense', 'health', between(9, 32), 'Pharmacy');
  if (rnd() > 0.3) add(day(10, 27), 'expense', 'fun', between(16, 58), m % 2 ? 'Concert tickets' : 'Cinema');
  add(day(3, 27), 'expense', 'other', between(12, 38), 'Haircut');
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** A ledger with example data for the current month (up to today) and the two before it. */
export function exampleLedger(today: Date, currency = 'USD'): Ledger {
  const ledger = emptyLedger(currency);
  const current = monthKey(today.getFullYear(), today.getMonth() + 1);
  for (const k of [addMonths(current, -2), addMonths(current, -1)]) ledger.transactions.push(...exampleMonth(k, 31));
  ledger.transactions.push(...exampleMonth(current, today.getDate()));
  return ledger;
}

export const hasExampleData = (ledger: Ledger): boolean => ledger.transactions.some((t) => t.example);

export const clearExampleData = (ledger: Ledger): Ledger => ({
  ...ledger,
  transactions: ledger.transactions.filter((t) => !t.example),
});
