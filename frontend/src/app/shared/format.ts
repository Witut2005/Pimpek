const STEPS = new Intl.NumberFormat('pl-PL');
const WEEKDAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

/** 7.83 → "7 h 50 min" */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 12) * 5;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** 8240 → "8 240" */
export function formatSteps(steps: number): string {
  return STEPS.format(Math.round(steps));
}

/** `YYYY-MM-DD` → "pn", "wt", … */
export function weekdayShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/** Minutes ago → "przed chwilą", "12 min temu", "3 h temu". */
export function sinceLabel(fromIso: string | undefined, now: number): string {
  if (!fromIso) return 'jeszcze nie';
  const minutes = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h temu` : `${Math.round(hours / 24)} dni temu`;
}
