// Matemática del ciclo, versión 0 — deliberadamente sencilla:
// media y desviación típica de los últimos ciclos, y fase lútea ~constante
// de 14 días para estimar la ovulación. Es un problema de estimación con
// ruido; los refinamientos (pesos, Bayes) llegarán más adelante.

import { addDays, diffDays, isBetween, type ISODate } from './dates';
import type { DayEntry } from './types';

/** Un día con sangrado separado >3 días del anterior inicia un ciclo nuevo. */
const NEW_PERIOD_GAP = 3;

/** Duraciones de ciclo fuera de este rango se descartan (huecos sin registrar). */
const MIN_CYCLE = 15;
const MAX_CYCLE = 60;

/** Cuántos ciclos recientes usamos para estimar. */
const WINDOW = 6;

export function flowDaysSorted(entries: Record<ISODate, DayEntry>): ISODate[] {
  return Object.values(entries)
    .filter((e) => (e.flow ?? 0) > 0)
    .map((e) => e.date)
    .sort();
}

/** Fechas de inicio de cada regla registrada, en orden cronológico. */
export function cycleStarts(entries: Record<ISODate, DayEntry>): ISODate[] {
  const days = flowDaysSorted(entries);
  const starts: ISODate[] = [];
  for (let i = 0; i < days.length; i++) {
    if (i === 0 || diffDays(days[i - 1], days[i]) > NEW_PERIOD_GAP) {
      starts.push(days[i]);
    }
  }
  return starts;
}

/** Duración media de la regla (días de sangrado consecutivos), por defecto 5. */
export function avgPeriodLen(entries: Record<ISODate, DayEntry>): number {
  const days = flowDaysSorted(entries);
  if (!days.length) return 5;
  const runs: number[] = [];
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (diffDays(days[i - 1], days[i]) <= NEW_PERIOD_GAP) run++;
    else { runs.push(run); run = 1; }
  }
  runs.push(run);
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  return Math.min(10, Math.max(2, Math.round(mean)));
}

export interface CycleStats {
  /** Nº de ciclos completos usados en la estimación. */
  n: number;
  meanLen: number;
  /** Desviación típica muestral, acotada a [1, 7] días. */
  sd: number;
}

export function cycleStats(starts: ISODate[], fallbackLen: number): CycleStats {
  const lens: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const L = diffDays(starts[i - 1], starts[i]);
    if (L >= MIN_CYCLE && L <= MAX_CYCLE) lens.push(L);
  }
  const recent = lens.slice(-WINDOW);
  if (!recent.length) return { n: 0, meanLen: fallbackLen, sd: 2 };
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const sd =
    recent.length > 1
      ? Math.sqrt(recent.reduce((s, x) => s + (x - mean) ** 2, 0) / (recent.length - 1))
      : 2;
  return { n: recent.length, meanLen: mean, sd: Math.min(7, Math.max(1, sd)) };
}

export interface Prediction {
  nextStart: ISODate;
  /** ± días de incertidumbre sobre nextStart. */
  uncertainty: number;
  ovulation: ISODate;
  fertileFrom: ISODate;
  fertileTo: ISODate;
  /** Días previstos de regla a pintar en el calendario. */
  periodLen: number;
}

export function predict(
  starts: ISODate[],
  stats: CycleStats,
  periodLen: number,
): Prediction | null {
  if (!starts.length) return null;
  const last = starts[starts.length - 1];
  const nextStart = addDays(last, Math.round(stats.meanLen));
  const ovulation = addDays(nextStart, -14); // fase lútea ≈ constante
  return {
    nextStart,
    uncertainty: Math.ceil(stats.sd),
    ovulation,
    fertileFrom: addDays(ovulation, -5),
    fertileTo: addDays(ovulation, 1),
    periodLen,
  };
}

/** Día del ciclo (1 = primer día de la última regla) para una fecha dada. */
export function cycleDayOf(date: ISODate, starts: ISODate[]): number | null {
  let last: ISODate | null = null;
  for (const s of starts) {
    if (s <= date) last = s;
    else break;
  }
  if (!last) return null;
  const d = diffDays(last, date) + 1;
  return d <= MAX_CYCLE ? d : null;
}

export interface Memory {
  date: ISODate;
  cycleDay: number;
  entry: DayEntry;
}

/**
 * El "diario cíclico": entradas de ciclos anteriores que cayeron en el mismo
 * punto del ciclo que `targetDate` (±`window` días). Permite ver de un vistazo
 * cómo se vivió esa misma fase en vueltas anteriores.
 */
export function cyclicMemories(
  targetDate: ISODate,
  entries: Record<ISODate, DayEntry>,
  starts: ISODate[],
  window = 1,
): Memory[] {
  const cd = cycleDayOf(targetDate, starts);
  if (cd == null) return [];
  const out: Memory[] = [];
  for (const d of Object.keys(entries).sort()) {
    if (d >= targetDate) continue; // solo pasado
    const dcd = cycleDayOf(d, starts);
    if (dcd == null || Math.abs(dcd - cd) > window) continue;
    const e = entries[d];
    if (!e) continue;
    const hasContent = (e.flow ?? 0) > 0 || e.moodHer || e.moodHim || e.noteHer || e.noteHim;
    if (hasContent) out.push({ date: d, cycleDay: dcd, entry: e });
  }
  return out.reverse(); // más reciente primero
}

export type Phase = 'menstrual' | 'folicular' | 'fertil' | 'lutea';

export const PHASE_INFO: Record<Phase, { name: string; hint: string }> = {
  menstrual: { name: 'Menstruación', hint: 'Días de cuidados extra 🫂' },
  folicular: { name: 'Fase folicular', hint: 'Energía subiendo 🌱' },
  fertil: { name: 'Ventana fértil', hint: 'Máxima probabilidad de embarazo ⚡' },
  lutea: { name: 'Fase lútea', hint: 'Recta final del ciclo 🌙' },
};

export function phaseOf(
  date: ISODate,
  entries: Record<ISODate, DayEntry>,
  prediction: Prediction | null,
): Phase | null {
  if ((entries[date]?.flow ?? 0) > 0) return 'menstrual';
  if (!prediction) return null;
  if (isBetween(date, prediction.fertileFrom, prediction.fertileTo)) return 'fertil';
  if (date < prediction.ovulation) return 'folicular';
  return 'lutea';
}
