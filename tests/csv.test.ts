import { describe, expect, it } from 'vitest';
import { exportCsv, importCsv, parseCsv, toCsv } from '../src/lib/csv';
import { emptyLedger } from '../src/lib/model';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded newlines, CRLF and a BOM', () => {
    const text = '\ufeffa,b,c\r\n"x, y","say ""hi""","line\nbreak"\r\n1,,3\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line\nbreak'],
      ['1', '', '3'],
    ]);
  });
  it('skips blank lines and keeps a last line without a newline', () => {
    expect(parseCsv('a;b\n\n1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('round-trips through toCsv', () => {
    const rows = [
      ['date', 'note'],
      ['2026-01-02', 'Café, "the good one"'],
      ['2026-01-03', ' padded '],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('import and export', () => {
  it('exports and re-imports the same transactions', () => {
    const ledger = emptyLedger('EUR');
    ledger.transactions = [
      { id: '1', date: '2026-10-03', kind: 'expense', categoryId: 'groceries', amount: 8450, note: 'Market, fruit' },
      { id: '2', date: '2026-10-25', kind: 'income', categoryId: 'salary', amount: 420000, note: 'Salary' },
      { id: '3', date: '2026-10-09', kind: 'expense', categoryId: 'other', amount: 1200, note: '=SUM(A1)' },
    ];
    const csv = exportCsv(ledger);
    expect(csv.split('\r\n')[0]).toBe('date,type,category,amount,currency,note');
    expect(csv).toContain("'=SUM(A1)");
    const fresh = emptyLedger('EUR');
    const result = importCsv(csv, fresh);
    expect(result.errors).toEqual([]);
    expect(result.newCategories).toEqual([]);
    const pick = (t: { date: string; kind: string; categoryId: string; amount: number; note: string }) => [t.date, t.kind, t.categoryId, t.amount, t.note];
    expect(result.transactions.map(pick).sort()).toEqual(ledger.transactions.map(pick).sort());
  });

  it('skips duplicates already in the ledger', () => {
    const ledger = emptyLedger();
    ledger.transactions = [{ id: '1', date: '2026-10-03', kind: 'expense', categoryId: 'groceries', amount: 8450, note: 'Shop' }];
    const result = importCsv(exportCsv(ledger), ledger);
    expect(result.transactions).toHaveLength(0);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('reads a bank-style file with signed amounts, semicolons and decimal commas', () => {
    const text = 'Date;Description;Amount\n2026-09-01;Rent;-1.450,00\n2026-09-25;Salary;3.900,00\n2026/9/7;Coffee;-3,20\n';
    const result = importCsv(text, emptyLedger());
    expect(result.errors).toEqual([]);
    expect(result.transactions.map((t) => [t.date, t.kind, t.amount, t.categoryId])).toEqual([
      ['2026-09-01', 'expense', 145000, 'other'],
      ['2026-09-25', 'income', 390000, 'other-income'],
      ['2026-09-07', 'expense', 320, 'other'],
    ]);
  });

  it('creates unknown categories with the next free colour slot', () => {
    const ledger = emptyLedger();
    ledger.categories = ledger.categories.filter((c) => c.id !== 'fun');
    const result = importCsv('date,type,category,amount\n2026-09-02,expense,Pets,40\n', ledger);
    expect(result.newCategories).toHaveLength(1);
    expect(result.newCategories[0]).toMatchObject({ name: 'Pets', kind: 'expense', slot: 8 });
    expect(result.transactions[0].categoryId).toBe(result.newCategories[0].id);
  });

  it('reports bad rows without importing them', () => {
    const text = 'date,type,amount\n31/12/2026,expense,10\n2026-02-30,expense,10\n2026-03-01,expense,ten\n2026-03-02,refund,5\n2026-03-03,expense,7\n';
    const result = importCsv(text, emptyLedger());
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(4);
    expect(result.errors[0]).toContain('Row 2');
  });

  it('asks for a header with date and amount', () => {
    expect(importCsv('2026-01-01,10\n', emptyLedger()).errors[0]).toContain('date');
    expect(importCsv('', emptyLedger()).errors[0]).toContain('empty');
  });
});
