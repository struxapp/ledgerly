// SVG charts: the spending donut and the monthly trend. Colours come from CSS variables (--series-1…8, --series-0
// for the neutral slice), so light and dark themes each use their own validated steps.
import { formatMoney, formatMoneyCompact } from '../lib/money';
import type { MonthKey } from '../lib/model';

export interface Slice {
  label: string;
  slot: number;
  amount: number;
  ids: string[];
}

const TAU = Math.PI * 2;
const seriesVar = (slot: number) => `var(--series-${slot})`;

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  if (a1 - a0 >= TAU - 1e-6) {
    // A full ring: two half arcs.
    return `M${p(r1, 0)}A${r1} ${r1} 0 1 1 ${p(r1, Math.PI)}A${r1} ${r1} 0 1 1 ${p(r1, 0)}ZM${p(r0, 0)}A${r0} ${r0} 0 1 0 ${p(r0, Math.PI)}A${r0} ${r0} 0 1 0 ${p(r0, 0)}Z`;
  }
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

export function donutSvg(slices: Slice[], total: number, currency: string, centreLabel: string): string {
  const size = 220;
  const c = size / 2;
  const r1 = 104;
  const r0 = 70;
  const parts: string[] = [];
  if (total <= 0) {
    parts.push(`<path d="${arc(c, c, r0, r1, 0, TAU)}" class="donut-empty" fill-rule="evenodd"/>`);
  } else {
    let a = 0;
    for (const s of slices) {
      const sweep = (s.amount / total) * TAU;
      const pct = Math.round((s.amount / total) * 1000) / 10;
      parts.push(
        `<path d="${arc(c, c, r0, r1, a, a + sweep)}" fill="${seriesVar(s.slot)}" class="donut-seg" fill-rule="evenodd"
          data-tip="${escapeAttr(`${s.label}|${formatMoney(s.amount, currency)} · ${pct}% of spending`)}"/>`,
      );
      a += sweep;
    }
  }
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeAttr(
    total > 0
      ? `Spending by category: ${slices.map((s) => `${s.label} ${formatMoney(s.amount, currency)}`).join(', ')}`
      : 'No spending recorded this month',
  )}">${parts.join('')}
    <text x="${c}" y="${c - 8}" text-anchor="middle" class="donut-label">${escapeText(centreLabel)}</text>
    <text x="${c}" y="${c + 18}" text-anchor="middle" class="donut-total">${escapeText(formatMoney(total, currency))}</text>
  </svg>`;
}

export interface TrendMonth {
  month: MonthKey;
  label: string;
  income: number;
  /** Spending per slot, in the fixed slot order with the neutral slot (0) last. */
  stack: { slot: number; label: string; amount: number }[];
  spent: number;
}

/** Stacked monthly spending by category, with each month's income marked as a tick on the same money axis. */
export function trendSvg(months: TrendMonth[], currency: string, width: number, selected: MonthKey): string {
  const height = 240;
  const left = 54;
  const right = width - 8;
  const top = 12;
  const bottom = height - 28;
  const max = Math.max(1, ...months.map((m) => Math.max(m.spent, m.income)));
  const step = niceStep(max / 4);
  const yMax = Math.ceil(max / step) * step;
  const y = (v: number) => bottom - (v / yMax) * (bottom - top);
  const colW = (right - left) / months.length;
  const barW = Math.min(46, colW * 0.5);
  const parts: string[] = [];
  for (let v = 0; v <= yMax + 1; v += step) {
    parts.push(`<line class="${v === 0 ? 'axis-base' : 'gridline'}" x1="${left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`);
    parts.push(`<text class="tick" x="${left - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${escapeText(formatMoneyCompact(v, currency))}</text>`);
  }
  months.forEach((m, i) => {
    const cx = left + colW * (i + 0.5);
    const x = cx - barW / 2;
    let base = 0;
    const segs = m.stack.filter((s) => s.amount > 0);
    segs.forEach((s, j) => {
      const y0 = y(base);
      const y1 = y(base + s.amount);
      const h = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0)); // 2px surface gap between stacked segments
      const isTop = j === segs.length - 1;
      const r = isTop ? Math.min(4, h / 2, barW / 2) : 0;
      parts.push(
        `<path d="${roundedTop(x, y1, barW, h, r)}" fill="${seriesVar(s.slot)}" class="bar-seg"/>`,
      );
      base += s.amount;
    });
    if (m.income > 0) {
      const iy = y(m.income);
      parts.push(`<line class="income-tick" x1="${(cx - barW / 2 - 6).toFixed(1)}" x2="${(cx + barW / 2 + 6).toFixed(1)}" y1="${iy.toFixed(1)}" y2="${iy.toFixed(1)}"/>`);
    }
    const isSel = m.month === selected;
    parts.push(`<text class="tick month${isSel ? ' is-selected' : ''}" x="${cx.toFixed(1)}" y="${height - 8}" text-anchor="middle">${escapeText(m.label)}</text>`);
    const tip = `${m.label}|Spent ${formatMoney(m.spent, currency)}|Income ${formatMoney(m.income, currency)}|${m.income - m.spent >= 0 ? 'Left over' : 'Overspent'} ${formatMoney(Math.abs(m.income - m.spent), currency)}`;
    parts.push(
      `<rect class="hit" x="${(cx - colW / 2).toFixed(1)}" y="${top}" width="${colW.toFixed(1)}" height="${bottom - top}" data-tip="${escapeAttr(tip)}" data-month="${m.month}"/>`,
    );
  });
  return `<svg class="trend" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;');
