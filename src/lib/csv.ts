// CSV import and export of transactions (RFC 4180 quoting; comma or semicolon separated).
import { parseAmount } from './money';
import { freeSlot, isValidDate, newId, type Category, type Kind, type Ledger, type Transaction } from './model';

/** Parses CSV text into rows of fields. Handles quotes, escaped quotes, newlines inside quotes, CRLF and a BOM. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const quote = (v: string): string => (/[",\n\r]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const toCsv = (rows: string[][]): string => rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n';

/** Guards a text field against spreadsheet formula injection when the file is opened in a spreadsheet. */
const safeCell = (v: string): string => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function exportCsv(ledger: Ledger, transactions: Transaction[] = ledger.transactions): string {
  const name = new Map(ledger.categories.map((c) => [c.id, c.name]));
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [
      t.date,
      t.kind,
      safeCell(name.get(t.categoryId) ?? 'Other'),
      (t.amount / 100).toFixed(2),
      ledger.currency,
      safeCell(t.note),
    ]);
  return toCsv([['date', 'type', 'category', 'amount', 'currency', 'note'], ...rows]);
}

export interface ImportResult {
  transactions: Transaction[];
  newCategories: Category[];
  skippedDuplicates: number;
  errors: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'booking date', 'transaction date'],
  type: ['type', 'kind'],
  category: ['category'],
  amount: ['amount', 'value', 'sum'],
  note: ['note', 'notes', 'description', 'memo', 'payee', 'details'],
};

function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (!m) return null;
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return isValidDate(iso) ? iso : null;
}

const MAX_ERRORS = 8;

/**
 * Reads transactions from CSV. Required columns: date (YYYY-MM-DD) and amount. Optional: type (expense or income;
 * without it a negative amount is an expense), category (unknown names become new categories) and note.
 */
export function importCsv(text: string, ledger: Ledger): ImportResult {
  const firstLine = text.replace(/^\ufeff/, '').split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows = parseCsv(text, delimiter);
  const result: ImportResult = { transactions: [], newCategories: [], skippedDuplicates: 0, errors: [] };
  if (rows.length === 0) {
    result.errors.push('The file is empty.');
    return result;
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx >= 0) col[key] = idx;
  }
  if (col.date === undefined || col.amount === undefined) {
    result.errors.push('The first row must name the columns, including “date” and “amount”.');
    return result;
  }

  const categories = [...ledger.categories];
  const byName = new Map(categories.map((c) => [`${c.kind}:${c.name.toLowerCase()}`, c]));
  const existing = new Set(ledger.transactions.map((t) => `${t.date}|${t.kind}|${t.categoryId}|${t.amount}|${t.note}`));
  const addError = (msg: string) => {
    if (result.errors.length < MAX_ERRORS) result.errors.push(msg);
    else if (result.errors.length === MAX_ERRORS) result.errors.push('More rows could not be read.');
  };

  const signed = col.type === undefined && hasNegative(rows, col.amount, delimiter);
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const cell = (key: string) => (col[key] === undefined ? '' : (r[col[key]] ?? '').trim());
    const date = normaliseDate(cell('date'));
    if (!date) return addError(`Row ${line}: “${cell('date')}” is not a date in YYYY-MM-DD form.`);
    const cents = parseAmount(cell('amount'), delimiter === ';');
    if (cents === null || cents === 0) return addError(`Row ${line}: “${cell('amount')}” is not an amount.`);
    const typeText = cell('type').toLowerCase();
    let kind: Kind;
    if (['income', 'credit', 'in'].includes(typeText)) kind = 'income';
    else if (['expense', 'debit', 'out', 'spending'].includes(typeText)) kind = 'expense';
    // Without a type, a file that uses negative numbers is signed: negative = expense, positive = income.
    else if (typeText === '') kind = signed && cents > 0 ? 'income' : 'expense';
    else return addError(`Row ${line}: type “${cell('type')}” should be expense or income.`);
    const amount = Math.abs(cents);
    const catName = cell('category').replace(/^'/, '') || (kind === 'income' ? 'Other income' : 'Other');
    let category = byName.get(`${kind}:${catName.toLowerCase()}`);
    if (!category) {
      category = {
        id: `c-${newId()}`,
        name: catName.slice(0, 40),
        kind,
        budget: 0,
        slot: kind === 'expense' ? freeSlot(categories) : 0,
        icon: kind === 'expense' ? 'tag' : 'coins',
      };
      categories.push(category);
      byName.set(`${kind}:${catName.toLowerCase()}`, category);
      result.newCategories.push(category);
    }
    const note = cell('note').replace(/^'(?=[=+\-@])/, '').slice(0, 120);
    const key = `${date}|${kind}|${category.id}|${amount}|${note}`;
    if (existing.has(key)) {
      result.skippedDuplicates++;
      return;
    }
    existing.add(key);
    result.transactions.push({ id: newId(), date, kind, categoryId: category.id, amount, note });
  });
  return result;
}

/** Whether a signed-amount file (no type column) uses negative numbers, meaning positives are income. */
function hasNegative(rows: string[][], amountCol: number, delimiter: string): boolean {
  return rows.slice(1).some((r) => (parseAmount(r[amountCol] ?? '', delimiter === ';') ?? 0) < 0);
}
