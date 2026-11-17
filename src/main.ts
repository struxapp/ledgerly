import './styles.css';
import { exportCsv, importCsv, type ImportResult } from './lib/csv';
import { clearExampleData, exampleLedger, hasExampleData } from './lib/example';
import { CURRENCIES, formatMoney, parseAmount } from './lib/money';
import {
  addMonths,
  donutSlices,
  freeSlot,
  isValidDate,
  monthKey,
  monthOf,
  monthRange,
  newId,
  summarise,
  todayIso,
  type Category,
  type Kind,
  type Ledger,
  type MonthKey,
  type Transaction,
} from './lib/model';
import { loadLedger, saveLedger, store } from './lib/storage';
import { donutSvg, trendSvg, type TrendMonth } from './ui/charts';
import { icon, icons, logo } from './ui/icons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ---------- Theme ----------
type Theme = 'light' | 'dark';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const storedTheme = store.get('ledgerly.theme');
let theme: Theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : media.matches ? 'dark' : 'light';
function applyTheme(): void {
  document.documentElement.dataset.theme = theme;
  const next = theme === 'dark' ? 'light' : 'dark';
  const b = $('theme-toggle');
  b.innerHTML = theme === 'dark' ? icons.sun() : icons.moon();
  b.setAttribute('aria-label', `Switch to ${next} theme`);
  b.title = `Switch to ${next} theme`;
}
media.addEventListener('change', (e) => {
  if (!store.get('ledgerly.theme')) {
    theme = e.matches ? 'dark' : 'light';
    applyTheme();
  }
});

// ---------- State ----------
const now = new Date();
const currentMonth = monthKey(now.getFullYear(), now.getMonth() + 1);
let ledger: Ledger = loadLedger() ?? exampleLedger(now);
let storageOk = true;

function initialMonth(): MonthKey {
  // Early in a month the example's current month is thin: open on the previous, complete month instead.
  if (hasExampleData(ledger) && now.getDate() < 8) return addMonths(currentMonth, -1);
  return currentMonth;
}

const view = {
  month: initialMonth(),
  filter: 'all' as 'all' | Kind,
  categoryFilter: null as string[] | null,
  categoryLabel: '',
};

function commit(): void {
  storageOk = saveLedger(ledger);
  render();
}

const categoryById = () => new Map(ledger.categories.map((c) => [c.id, c]));
const money = (cents: number) => formatMoney(cents, ledger.currency);
const monthName = (key: MonthKey, style: 'long' | 'short' = 'long') => {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: style, year: style === 'long' ? 'numeric' : undefined, timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
};
const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const slotOf = (c: Category | undefined) => (c && c.kind === 'expense' ? c.slot : -1);

// ---------- Rendering ----------
function renderHeader(): void {
  $('month-title').textContent = monthName(view.month);
  ($('next-month') as HTMLButtonElement).disabled = view.month >= addMonths(currentMonth, 1);
  ($('currency') as HTMLSelectElement).value = ledger.currency;
  $('example-banner').hidden = !hasExampleData(ledger);
}

function renderStats(): void {
  const s = summarise(ledger, view.month);
  const used = s.budgetTotal > 0 ? s.spent / s.budgetTotal : 0;
  const over = s.budgetTotal > 0 && s.spent > s.budgetTotal;
  const pct = Math.round(used * 100);
  const tiles = [
    { label: 'Income', value: money(s.income), note: plural(s.transactions.filter((t) => t.kind === 'income').length, 'payment') + ' in' },
    { label: 'Spent', value: money(s.spent), note: plural(s.transactions.filter((t) => t.kind === 'expense').length, 'expense') },
    {
      label: s.net >= 0 ? 'Left over' : 'Overspent',
      value: money(Math.abs(s.net)),
      note: s.income === 0 ? 'No income recorded' : s.net >= 0 ? `${Math.round((s.net / s.income) * 100)}% of income kept` : 'Spending is above income',
      tone: s.net >= 0 ? 'good' : 'bad',
    },
  ];
  $('stats').innerHTML =
    tiles
      .map(
        (t) => `<div class="stat${t.tone ? ` is-${t.tone}` : ''}"><p class="stat-label">${esc(t.label)}</p><p class="stat-value">${esc(t.value)}</p><p class="stat-note">${esc(t.note)}</p></div>`,
      )
      .join('') +
    `<div class="stat"><p class="stat-label">Budget used</p><p class="stat-value">${s.budgetTotal ? `${pct}%` : '—'}</p>
      <div class="meter${over ? ' is-over' : ''}" role="meter" aria-label="Budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, pct)}" aria-valuetext="${pct}% of ${esc(money(s.budgetTotal))}"><span class="meter-fill"></span></div>
      <p class="stat-note">${over ? `${icons.alert()}Over by ${esc(money(s.spent - s.budgetTotal))}` : `of ${esc(money(s.budgetTotal))} planned`}</p></div>`;
  const fill = document.querySelector<HTMLElement>('#stats .meter-fill');
  if (fill) fill.style.width = `${Math.min(100, pct)}%`;
}

function renderWhere(): void {
  const s = summarise(ledger, view.month);
  const slices = donutSlices(s);
  const share = (amount: number) => (s.spent ? `${Math.round((amount / s.spent) * 100)}%` : '');
  $('where-note').textContent = s.spent ? `${slices.length} categories` : '';
  const legend = slices.length
    ? `<ul class="legend">${slices
        .map(
          (sl) => `<li><button type="button" class="legend-item${view.categoryFilter?.join() === sl.ids.join() ? ' is-active' : ''}" data-filter-ids="${sl.ids.join(',')}" data-filter-label="${esc(sl.label)}" aria-pressed="${view.categoryFilter?.join() === sl.ids.join()}">
            <span class="swatch" data-slot="${sl.slot}"></span><span class="legend-name">${esc(sl.label)}</span>
            <span class="legend-amount">${esc(money(sl.amount))}</span><span class="legend-share">${share(sl.amount)}</span>
          </button></li>`,
        )
        .join('')}</ul>`
    : `<div class="empty"><p>No spending recorded in ${esc(monthName(view.month))} yet.</p><button type="button" class="button primary" data-action="add">Add an expense</button></div>`;
  $('where').innerHTML = `<div class="donut-wrap">${donutSvg(slices, s.spent, ledger.currency, 'Spent')}</div>${legend}`;
}

function renderBudgets(): void {
  const s = summarise(ledger, view.month);
  const rows = s.byCategory.filter((x) => x.budget > 0 || x.spent > 0);
  $('budgets').innerHTML = rows.length
    ? rows
        .map((x) => {
          const pct = x.budget ? (x.spent / x.budget) * 100 : 100;
          const over = x.budget > 0 && x.spent > x.budget;
          const status = !x.budget
            ? '<span class="b-status">No budget</span>'
            : over
              ? `<span class="b-status is-over">${icons.alert()}Over by ${esc(money(x.spent - x.budget))}</span>`
              : `<span class="b-status">${esc(money(x.budget - x.spent))} left</span>`;
          return `<li class="budget">
            <div class="b-top"><span class="b-name"><span class="swatch" data-slot="${x.category.slot}"></span>${esc(x.category.name)}</span>
              <span class="b-amounts"><strong>${esc(money(x.spent))}</strong>${x.budget ? ` of ${esc(money(x.budget))}` : ''}</span></div>
            <div class="b-track${over ? ' is-over' : ''}" role="meter" aria-label="${esc(x.category.name)} budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(pct))}" aria-valuetext="${esc(`${money(x.spent)} of ${x.budget ? money(x.budget) : 'no budget'}`)}">
              <span class="b-fill" data-slot="${x.category.slot}" data-pct="${Math.min(100, pct).toFixed(1)}"></span></div>
            ${status}
          </li>`;
        })
        .join('')
    : '<li class="empty"><p>No budgets yet.</p></li>';
  document.querySelectorAll<HTMLElement>('#budgets .b-fill').forEach((el) => {
    el.style.width = `${el.dataset.pct}%`;
  });
}

function renderTrend(): void {
  const host = $('trend');
  const width = Math.max(300, Math.floor(host.clientWidth));
  // Up to six months ending with the one in view, starting no earlier than the first month with data (at least three).
  const first = ledger.transactions.reduce((m, t) => (monthOf(t.date) < m ? monthOf(t.date) : m), view.month);
  const start = [addMonths(view.month, -5), first].sort()[1];
  const months = monthRange(start < addMonths(view.month, -2) ? start : addMonths(view.month, -2), view.month);
  const expenseCats = ledger.categories.filter((c) => c.kind === 'expense');
  const data: TrendMonth[] = months.map((m) => {
    const s = summarise(ledger, m);
    const bySlot = new Map<number, number>();
    for (const x of s.byCategory) bySlot.set(x.category.slot, (bySlot.get(x.category.slot) ?? 0) + x.spent);
    const slots = [...new Set(expenseCats.map((c) => c.slot))].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
    return {
      month: m,
      label: monthName(m, 'short'),
      income: s.income,
      spent: s.spent,
      stack: slots.map((slot) => ({
        slot,
        label: slot ? expenseCats.find((c) => c.slot === slot)!.name : 'Other',
        amount: bySlot.get(slot) ?? 0,
      })),
    };
  });
  host.innerHTML = trendSvg(data, ledger.currency, width, view.month);
  $('trend-table').innerHTML = `<caption>Income and spending by month</caption><thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Spent</th></tr></thead><tbody>${data
    .map((d) => `<tr><th scope="row">${esc(monthName(d.month))}</th><td>${esc(money(d.income))}</td><td>${esc(money(d.spent))}</td></tr>`)
    .join('')}</tbody>`;
}

function renderTransactions(): void {
  const s = summarise(ledger, view.month);
  const cats = categoryById();
  let list = s.transactions;
  if (view.filter !== 'all') list = list.filter((t) => t.kind === view.filter);
  if (view.categoryFilter) list = list.filter((t) => view.categoryFilter!.includes(t.categoryId));
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === view.filter)));
  const note = $('filter-note');
  note.hidden = !view.categoryFilter;
  if (view.categoryFilter) {
    note.innerHTML = `Showing ${esc(view.categoryLabel)} only · <button type="button" class="text-button" data-action="clear-filter">Show all categories</button>`;
  }
  if (list.length === 0) {
    $('tx-list').innerHTML = `<li class="empty"><p>No transactions here yet.</p><button type="button" class="button primary" data-action="add">Add a transaction</button></li>`;
    return;
  }
  let lastDate = '';
  $('tx-list').innerHTML = list
    .map((t) => {
      const c = cats.get(t.categoryId);
      const header = t.date !== lastDate ? `<li class="tx-day" aria-hidden="false"><span>${esc(dayLabel(t.date))}</span></li>` : '';
      lastDate = t.date;
      const income = t.kind === 'income';
      return `${header}<li class="tx">
        <span class="tx-icon" data-slot="${slotOf(c)}">${icon(c?.icon ?? 'tag')}</span>
        <span class="tx-main"><span class="tx-note">${esc(t.note || c?.name || 'Transaction')}</span>
          <span class="tx-cat">${esc(c?.name ?? '')}${t.example ? ' · <span class="tx-example">Example</span>' : ''}</span></span>
        <span class="tx-amount${income ? ' is-income' : ''}">${income ? '+' : '−'}${esc(money(t.amount))}</span>
        <span class="tx-actions">
          <button type="button" class="icon-button tiny" data-edit="${esc(t.id)}" aria-label="Edit ${esc(t.note || c?.name || 'transaction')}, ${esc(dayLabel(t.date))}">${icons.edit()}</button>
          <button type="button" class="icon-button tiny" data-delete="${esc(t.id)}" aria-label="Delete ${esc(t.note || c?.name || 'transaction')}, ${esc(dayLabel(t.date))}">${icons.trash()}</button>
        </span>
      </li>`;
    })
    .join('');
}

function render(): void {
  renderHeader();
  renderStats();
  renderWhere();
  renderBudgets();
  renderTrend();
  renderTransactions();
  if (!storageOk) toast('Changes are kept for this visit only: this browser is not allowing storage.');
}

// ---------- Tooltip for charts ----------
const tip = $('chart-tip');
function showTip(target: Element, x: number, y: number): void {
  const parts = (target.getAttribute('data-tip') ?? '').split('|');
  tip.innerHTML = `<strong>${esc(parts[0])}</strong>${parts.slice(1).map((p) => `<span>${esc(p)}</span>`).join('')}`;
  tip.classList.add('show');
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14));
  const top = y - h - 12 < 8 ? y + 16 : y - h - 12;
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}
document.addEventListener('pointermove', (e) => {
  const target = (e.target as Element).closest?.('[data-tip]');
  if (target && e.pointerType !== 'touch') showTip(target, e.clientX, e.clientY);
  else tip.classList.remove('show');
});
document.addEventListener('pointerdown', (e) => {
  const target = (e.target as Element).closest?.('[data-tip]');
  if (target && e.pointerType === 'touch') showTip(target, e.clientX, e.clientY);
  else tip.classList.remove('show');
});

// ---------- Toast ----------
let toastTimer = 0;
function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 3800);
}

// ---------- Transaction dialog ----------
const txDialog = $('tx-dialog') as HTMLDialogElement;
let editingId: string | null = null;

function kindValue(): Kind {
  return (document.querySelector<HTMLInputElement>('input[name=kind]:checked')?.value as Kind) ?? 'expense';
}

function fillCategories(kind: Kind, selected?: string): void {
  const sel = $('tx-category') as HTMLSelectElement;
  sel.innerHTML = ledger.categories
    .filter((c) => c.kind === kind)
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
    .join('');
  if (selected && ledger.categories.some((c) => c.id === selected && c.kind === kind)) sel.value = selected;
}

function defaultDate(): string {
  const today = todayIso(now);
  if (monthOf(today) === view.month) return today;
  // Another month: its last day if past, else its first.
  if (view.month < currentMonth) {
    const [y, m] = view.month.split('-').map(Number);
    return `${view.month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  }
  return `${view.month}-01`;
}

function currencySymbol(): string {
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency: ledger.currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? ledger.currency
  );
}

function openTx(t?: Transaction, kind: Kind = 'expense'): void {
  editingId = t?.id ?? null;
  $('tx-dialog-title').textContent = t ? 'Edit transaction' : 'Add transaction';
  const k = t?.kind ?? kind;
  document.querySelectorAll<HTMLInputElement>('input[name=kind]').forEach((r) => (r.checked = r.value === k));
  fillCategories(k, t?.categoryId);
  ($('tx-amount') as HTMLInputElement).value = t ? (t.amount / 100).toFixed(2) : '';
  ($('tx-date') as HTMLInputElement).value = t?.date ?? defaultDate();
  ($('tx-note') as HTMLInputElement).value = t?.note ?? '';
  $('amount-symbol').textContent = currencySymbol();
  $('tx-error').textContent = '';
  $('tx-delete').hidden = !t;
  txDialog.showModal();
  ($('tx-amount') as HTMLInputElement).focus();
}

document.querySelectorAll<HTMLInputElement>('input[name=kind]').forEach((r) =>
  r.addEventListener('change', () => fillCategories(kindValue())),
);

$('tx-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseAmount(($('tx-amount') as HTMLInputElement).value);
  const date = ($('tx-date') as HTMLInputElement).value;
  const err = $('tx-error');
  if (amount === null || amount <= 0) {
    err.textContent = 'Enter an amount above zero, like 12.50.';
    ($('tx-amount') as HTMLInputElement).focus();
    return;
  }
  if (!isValidDate(date)) {
    err.textContent = 'Choose a date.';
    ($('tx-date') as HTMLInputElement).focus();
    return;
  }
  const record: Transaction = {
    id: editingId ?? newId(),
    date,
    kind: kindValue(),
    categoryId: ($('tx-category') as HTMLSelectElement).value,
    amount,
    note: ($('tx-note') as HTMLInputElement).value.trim().slice(0, 120),
  };
  if (editingId) ledger = { ...ledger, transactions: ledger.transactions.map((t) => (t.id === editingId ? record : t)) };
  else ledger = { ...ledger, transactions: [...ledger.transactions, record] };
  txDialog.close();
  if (monthOf(date) !== view.month) view.month = monthOf(date);
  commit();
  toast(editingId ? 'Transaction updated.' : `${record.kind === 'income' ? 'Income' : 'Expense'} of ${money(record.amount)} added.`);
});

let lastDeleted: Transaction | null = null;
function deleteTx(id: string): void {
  lastDeleted = ledger.transactions.find((t) => t.id === id) ?? null;
  ledger = { ...ledger, transactions: ledger.transactions.filter((t) => t.id !== id) };
  commit();
  toast('Transaction deleted. Press Ctrl+Z to undo.');
}

$('tx-delete').addEventListener('click', () => {
  if (editingId) deleteTx(editingId);
  txDialog.close();
  $('add-button').focus();
});

// ---------- Budget dialog ----------
const budgetDialog = $('budget-dialog') as HTMLDialogElement;
let draftCategories: Category[] = [];

function renderBudgetEdit(): void {
  const used = new Set(ledger.transactions.map((t) => t.categoryId));
  $('budget-edit').innerHTML = draftCategories
    .filter((c) => c.kind === 'expense')
    .map(
      (c) => `<li class="be-row">
        <span class="swatch" data-slot="${c.slot}"></span>
        <label class="field grow"><span class="sr-only">Category name</span><input data-name="${esc(c.id)}" value="${esc(c.name)}" maxlength="40" /></label>
        <label class="field budget-field"><span class="sr-only">${esc(c.name)} monthly budget</span><span class="amount-input"><span class="amount-symbol">${esc(currencySymbol())}</span><input data-budget="${esc(c.id)}" inputmode="decimal" value="${c.budget ? (c.budget / 100).toFixed(0) : ''}" placeholder="None" /></span></label>
        <button type="button" class="icon-button tiny" data-remove="${esc(c.id)}" aria-label="Remove ${esc(c.name)}" ${used.has(c.id) || c.id === 'other' ? 'disabled title="In use: categories with transactions stay"' : ''}>${icons.trash()}</button>
      </li>`,
    )
    .join('');
}

function openBudgets(): void {
  draftCategories = ledger.categories.map((c) => ({ ...c }));
  $('budget-error').textContent = '';
  ($('new-category') as HTMLInputElement).value = '';
  renderBudgetEdit();
  budgetDialog.showModal();
}

function readDraft(): boolean {
  let ok = true;
  document.querySelectorAll<HTMLInputElement>('#budget-edit [data-budget]').forEach((input) => {
    const c = draftCategories.find((x) => x.id === input.dataset.budget)!;
    const text = input.value.trim();
    const cents = text === '' ? 0 : parseAmount(text);
    if (cents === null || cents < 0) {
      ok = false;
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
      c.budget = cents;
    }
  });
  document.querySelectorAll<HTMLInputElement>('#budget-edit [data-name]').forEach((input) => {
    const c = draftCategories.find((x) => x.id === input.dataset.name)!;
    const name = input.value.trim();
    if (name) c.name = name;
  });
  return ok;
}

$('add-category').addEventListener('click', () => {
  readDraft();
  const input = $('new-category') as HTMLInputElement;
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  if (draftCategories.some((c) => c.kind === 'expense' && c.name.toLowerCase() === name.toLowerCase())) {
    $('budget-error').textContent = `There is already a category called “${name}”.`;
    return;
  }
  $('budget-error').textContent = '';
  draftCategories.push({ id: `c-${newId()}`, name, kind: 'expense', budget: 0, slot: freeSlot(draftCategories), icon: 'tag' });
  input.value = '';
  renderBudgetEdit();
  document.querySelector<HTMLInputElement>('#budget-edit li:last-child [data-budget]')?.focus();
});

$('budget-edit').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-remove]')?.dataset.remove;
  if (!id) return;
  readDraft();
  draftCategories = draftCategories.filter((c) => c.id !== id);
  renderBudgetEdit();
});

$('budget-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!readDraft()) {
    $('budget-error').textContent = 'Budgets must be amounts like 250, or empty for none.';
    return;
  }
  ledger = { ...ledger, categories: draftCategories };
  budgetDialog.close();
  commit();
  toast('Budgets saved.');
});

// ---------- Import and export ----------
const importDialog = $('import-dialog') as HTMLDialogElement;
let pendingImport: ImportResult | null = null;

$('import-button').addEventListener('click', () => ($('import-file') as HTMLInputElement).click());
$('import-file').addEventListener('change', async () => {
  const input = $('import-file') as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('That file is larger than 5 MB.');
    return;
  }
  const result = importCsv(await file.text(), ledger);
  pendingImport = result;
  const n = result.transactions.length;
  $('import-summary').innerHTML = `
    <p class="import-file">${esc(file.name)}</p>
    <ul class="import-stats">
      <li><strong>${n}</strong> transaction${n === 1 ? '' : 's'} to import</li>
      ${result.newCategories.length ? `<li><strong>${result.newCategories.length}</strong> new categor${result.newCategories.length === 1 ? 'y' : 'ies'}: ${esc(result.newCategories.map((c) => c.name).join(', '))}</li>` : ''}
      ${result.skippedDuplicates ? `<li><strong>${result.skippedDuplicates}</strong> already in Ledgerly, skipped</li>` : ''}
    </ul>
    ${result.errors.length ? `<div class="import-errors"><p>${icons.alert()}Some rows could not be read:</p><ul>${result.errors.map((er) => `<li>${esc(er)}</li>`).join('')}</ul></div>` : ''}
    <p class="dialog-note">Expected columns: date (YYYY-MM-DD), type (expense or income), category, amount, note. Files exported from Ledgerly import as they are.</p>`;
  ($('import-confirm') as HTMLButtonElement).disabled = n === 0;
  importDialog.showModal();
});

$('import-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pendingImport) return;
  const r = pendingImport;
  ledger = { ...ledger, categories: [...ledger.categories, ...r.newCategories], transactions: [...ledger.transactions, ...r.transactions] };
  pendingImport = null;
  importDialog.close();
  const latest = r.transactions.map((t) => t.date).sort().pop();
  if (latest) view.month = monthOf(latest);
  commit();
  toast(`${r.transactions.length} transactions imported.`);
});

$('export-button').addEventListener('click', () => {
  if (ledger.transactions.length === 0) {
    toast('There is nothing to export yet.');
    return;
  }
  const blob = new Blob([exportCsv(ledger)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledgerly-${todayIso(new Date())}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---------- Wiring ----------
$('brand-mark').innerHTML = logo(30);
$('prev-month').innerHTML = icons.left();
$('next-month').innerHTML = icons.right();
$('add-icon').innerHTML = icons.plus();
$('import-icon').innerHTML = icons.upload();
$('export-icon').innerHTML = icons.download();
document.querySelectorAll<HTMLElement>('[data-close].icon-button').forEach((b) => (b.innerHTML = icons.close()));
($('currency') as HTMLSelectElement).innerHTML = CURRENCIES.map(
  (c) => `<option value="${c.code}" title="${esc(c.name)}">${c.code}</option>`,
).join('');
applyTheme();

$('theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  store.set('ledgerly.theme', theme);
  applyTheme();
});
$('currency').addEventListener('change', () => {
  ledger = { ...ledger, currency: ($('currency') as HTMLSelectElement).value };
  commit();
});
$('prev-month').addEventListener('click', () => {
  view.month = addMonths(view.month, -1);
  render();
});
$('next-month').addEventListener('click', () => {
  view.month = addMonths(view.month, 1);
  render();
});
$('add-button').addEventListener('click', () => openTx());
$('edit-budgets').addEventListener('click', openBudgets);
$('clear-example').addEventListener('click', () => {
  ledger = clearExampleData(ledger);
  view.categoryFilter = null;
  view.month = currentMonth;
  commit();
  toast('Example data cleared. Add your first expense with the Add button.');
  $('add-button').focus();
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('[data-close]')) {
    target.closest('dialog')?.close();
    return;
  }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'add') return openTx();
  if (action === 'clear-filter') {
    view.categoryFilter = null;
    render();
    return;
  }
  const edit = target.closest<HTMLElement>('[data-edit]')?.dataset.edit;
  if (edit) {
    const t = ledger.transactions.find((x) => x.id === edit);
    if (t) openTx(t);
    return;
  }
  const del = target.closest<HTMLElement>('[data-delete]')?.dataset.delete;
  if (del) {
    deleteTx(del);
    return;
  }
  const filter = target.closest<HTMLElement>('[data-filter]')?.dataset.filter;
  if (filter) {
    view.filter = filter as 'all' | Kind;
    renderTransactions();
    return;
  }
  const legend = target.closest<HTMLElement>('[data-filter-ids]');
  if (legend) {
    const ids = legend.dataset.filterIds!.split(',');
    const same = view.categoryFilter?.join() === ids.join();
    view.categoryFilter = same ? null : ids;
    view.categoryLabel = legend.dataset.filterLabel ?? '';
    view.filter = 'all';
    renderWhere();
    renderTransactions();
    if (!same) document.getElementById('tx-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const monthBar = target.closest<SVGElement>('[data-month]');
  if (monthBar) {
    view.month = monthBar.getAttribute('data-month')!;
    render();
  }
});

// Undo a deletion with Ctrl/Cmd+Z.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && lastDeleted && !(e.target as HTMLElement).closest('input, textarea, select')) {
    ledger = { ...ledger, transactions: [...ledger.transactions, lastDeleted] };
    lastDeleted = null;
    commit();
    toast('Deletion undone.');
  }
});

new ResizeObserver(() => renderTrend()).observe($('trend'));
render();
