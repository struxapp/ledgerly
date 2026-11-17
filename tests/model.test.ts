import { describe, expect, it } from 'vitest';
import { clearExampleData, exampleLedger, exampleMonth, hasExampleData } from '../src/lib/example';
import { addMonths, donutSlices, emptyLedger, freeSlot, isValidDate, monthRange, summarise } from '../src/lib/model';
import { parseLedger } from '../src/lib/storage';

describe('months', () => {
  it('steps across years', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2026-10', '2027-01')).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
  });
  it('validates calendar dates', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
  });
});

describe('monthly summary', () => {
  const ledger = emptyLedger();
  ledger.transactions = [
    { id: 'a', date: '2026-11-01', kind: 'expense', categoryId: 'housing', amount: 145000, note: '' },
    { id: 'b', date: '2026-11-03', kind: 'expense', categoryId: 'groceries', amount: 5000, note: '' },
    { id: 'c', date: '2026-11-04', kind: 'expense', categoryId: 'groceries', amount: 2550, note: '' },
    { id: 'd', date: '2026-11-25', kind: 'income', categoryId: 'salary', amount: 420000, note: '' },
    { id: 'e', date: '2026-10-25', kind: 'income', categoryId: 'salary', amount: 999, note: '' },
    { id: 'f', date: '2026-11-09', kind: 'expense', categoryId: 'other', amount: 1000, note: '' },
  ];

  it('totals income, spending and net in exact cents', () => {
    const s = summarise(ledger, '2026-11');
    expect(s.income).toBe(420000);
    expect(s.spent).toBe(153550);
    expect(s.net).toBe(266450);
    expect(s.transactions.map((t) => t.id)).toEqual(['d', 'f', 'c', 'b', 'a']);
    expect(s.byCategory.find((x) => x.category.id === 'groceries')).toMatchObject({ spent: 7550, budget: 45000 });
  });

  it('makes donut slices in category order with the neutral slice last', () => {
    const slices = donutSlices(summarise(ledger, '2026-11'));
    expect(slices.map((s) => [s.label, s.slot, s.amount])).toEqual([
      ['Housing', 1, 145000],
      ['Groceries', 2, 7550],
      ['Other', 0, 1000],
    ]);
  });

  it('finds a free colour slot or none', () => {
    expect(freeSlot(emptyLedger().categories)).toBe(0);
    expect(freeSlot(emptyLedger().categories.filter((c) => c.slot !== 3))).toBe(3);
  });
});

describe('example data', () => {
  const today = new Date(2026, 10, 17);
  it('covers three months, all marked as examples, never in the future', () => {
    const ledger = exampleLedger(today);
    const months = new Set(ledger.transactions.map((t) => t.date.slice(0, 7)));
    expect([...months].sort()).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(ledger.transactions.every((t) => t.example)).toBe(true);
    expect(ledger.transactions.every((t) => t.date <= '2026-11-17')).toBe(true);
    expect(ledger.transactions.every((t) => isValidDate(t.date) && t.amount > 0)).toBe(true);
  });
  it('is deterministic', () => {
    expect(exampleMonth('2026-10', 31)).toEqual(exampleMonth('2026-10', 31));
  });
  it('clears in one step, keeping the user’s own entries', () => {
    const ledger = exampleLedger(today);
    ledger.transactions.push({ id: 'mine', date: '2026-11-10', kind: 'expense', categoryId: 'fun', amount: 1200, note: 'Mine' });
    const cleared = clearExampleData(ledger);
    expect(hasExampleData(cleared)).toBe(false);
    expect(cleared.transactions.map((t) => t.id)).toEqual(['mine']);
  });
});

describe('stored data', () => {
  it('reads back a saved ledger and drops malformed entries', () => {
    const ledger = emptyLedger('GBP');
    const json = JSON.stringify({
      ...ledger,
      transactions: [
        { id: 'ok', date: '2026-11-02', kind: 'expense', categoryId: 'groceries', amount: 1000, note: '' },
        { id: 'bad-date', date: '2026-02-31', kind: 'expense', categoryId: 'groceries', amount: 1000, note: '' },
        { id: 'bad-cat', date: '2026-11-02', kind: 'expense', categoryId: 'nope', amount: 1000, note: '' },
        { id: 'bad-amount', date: '2026-11-02', kind: 'expense', categoryId: 'groceries', amount: 10.5, note: '' },
        null,
      ],
    });
    const back = parseLedger(json)!;
    expect(back.currency).toBe('GBP');
    expect(back.transactions.map((t) => t.id)).toEqual(['ok']);
  });
  it('rejects unreadable data', () => {
    expect(parseLedger('{')).toBeNull();
    expect(parseLedger(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseLedger(null)).toBeNull();
  });
});
