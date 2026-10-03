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

const KM = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

/** 5.23 → "5,2 km" */
export function formatKm(km: number): string {
  return `${KM.format(km)} km`;
}

const DAY_MONTH = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' });

/** `YYYY-MM-DD` → "3 października" */
export function formatDayMonth(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return DAY_MONTH.format(new Date(y, m - 1, d));
}

/** 52 → "52 min", 125 → "2 h 05 min" */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

/** Minutes per km → "5:32 /km" */
export function formatPace(minPerKm: number): string {
  const seconds = Math.round(minPerKm * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} /km`;
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
