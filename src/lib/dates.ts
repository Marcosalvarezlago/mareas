// Fechas como cadenas 'YYYY-MM-DD' (días civiles, sin husos horarios).
// Toda la aritmética pasa por Date.UTC: un día = 86 400 000 ms exactos,
// así evitamos los saltos de hora local (cambio horario, etc.).

export type ISODate = string;

const DAY_MS = 86_400_000;

export function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromUTC(ms: number): ISODate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha civil de hoy según el reloj local del dispositivo. */
export function todayISO(): ISODate {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}

/** Días de a → b (positivo si b es posterior). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

export function isBetween(d: ISODate, from: ISODate, to: ISODate): boolean {
  return d >= from && d <= to; // el formato YYYY-MM-DD ordena bien como texto
}

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

export const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;

export const WEEKDAYS = [
  'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
] as const;

export const WEEKDAYS_MIN = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'] as const;

/** Índice de día de semana con lunes = 0 (convención española). */
export function weekdayMon0(d: ISODate): number {
  return (new Date(toUTC(d)).getUTCDay() + 6) % 7;
}

/** "12 jul" */
export function formatShort(d: ISODate): string {
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS_SHORT[m - 1]}`;
}

/** "viernes, 5 de julio" */
export function formatLong(d: ISODate): string {
  const [, m, day] = d.split('-').map(Number);
  return `${WEEKDAYS[weekdayMon0(d)]}, ${day} de ${MONTHS[m - 1]}`;
}

/** "julio 2026" */
export function monthLabel(year: number, month0: number): string {
  return `${MONTHS[month0]} ${year}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Rejilla mensual para el calendario: celdas null de relleno hasta el lunes
 * inicial, luego cada día del mes como ISODate.
 */
export function monthGrid(year: number, month0: number): (ISODate | null)[] {
  const first = `${year}-${String(month0 + 1).padStart(2, '0')}-01`;
  const lead = weekdayMon0(first);
  const total = daysInMonth(year, month0);
  const cells: (ISODate | null)[] = Array(lead).fill(null);
  for (let day = 1; day <= total; day++) {
    cells.push(`${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
