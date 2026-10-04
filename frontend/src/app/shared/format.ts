const WEEKDAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

const DAY_MONTH = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' });
const MONTH_YEAR = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' });

const parseKey = (dateKey: string): Date => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** `YYYY-MM-DD` → "3 października" */
export function formatDayMonth(dateKey: string): string {
  return DAY_MONTH.format(parseKey(dateKey));
}

/** `YYYY-MM` → "październik 2026" (standalone month name). */
export function formatMonthYear(monthKey: string): string {
  return MONTH_YEAR.format(parseKey(`${monthKey}-01`));
}

/** `YYYY-MM-DD` → "pn", "wt", … */
export function weekdayShort(dateKey: string): string {
  return WEEKDAYS[parseKey(dateKey).getDay()];
}
