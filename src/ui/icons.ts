// Inline SVG icons (24×24, stroke-based). Decorative: hidden from assistive technology.
const svg = (body: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons: Record<string, () => string> = {
  sun: () =>
    svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'),
  moon: () => svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  left: () => svg('<path d="m15 18-6-6 6-6"/>'),
  right: () => svg('<path d="m9 18 6-6-6-6"/>'),
  plus: () => svg('<path d="M12 5v14M5 12h14"/>'),
  edit: () => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: () => svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>'),
  close: () => svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  upload: () => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  download: () => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  alert: () => svg('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>'),
  check: () => svg('<path d="M20 6 9 17l-5-5"/>'),
  sliders: () => svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  sparkle: () => svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  home: () => svg('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  cart: () => svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 7H6"/>'),
  cup: () => svg('<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2"/>'),
  bus: () => svg('<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M8 21v-4M16 21v-4"/><circle cx="8" cy="14" r=".5"/><circle cx="16" cy="14" r=".5"/>'),
  bolt: () => svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  heart: () => svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>'),
  bag: () => svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>'),
  ticket: () => svg('<path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 11v2M13 17v2"/>'),
  dots: () => svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  briefcase: () => svg('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20"/>'),
  spark: () => svg('<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>'),
  coins: () => svg('<circle cx="9" cy="9" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.4 18.1M7 7h2v4"/>'),
  tag: () => svg('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
};

export const icon = (name: string): string => (icons[name] ?? icons.tag)();

/** The app mark: a ledger page with a donut slice. */
export const logo = (size = 30): string => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <rect width="48" height="48" rx="12" fill="var(--logo-bg)"/>
  <circle cx="24" cy="24" r="12.5" fill="none" stroke="var(--logo-ring)" stroke-width="6"/>
  <path d="M24 11.5A12.5 12.5 0 0 1 36.5 24" fill="none" stroke="var(--logo-fg)" stroke-width="6"/>
  <path d="M33.8 31.8A12.5 12.5 0 0 1 14.2 31.8" fill="none" stroke="var(--logo-fg2)" stroke-width="6"/>
</svg>`;
