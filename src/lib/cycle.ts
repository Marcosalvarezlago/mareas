// Matemática del ciclo, versión 1 — sencilla y honesta:
// media ± desviación típica de los últimos ciclos, fase lútea ~constante de
// 14 días para estimar la ovulación, y PROYECCIÓN MULTI-CICLO encadenando
// ciclos medios hacia el futuro. La incertidumbre del k-ésimo ciclo futuro
// crece como σ·√k (suma de k duraciones independientes). Los datos reales
// registrados siempre ganan sobre cualquier proyección.

import type { ThemeColor } from '@/constants/theme';

import { addDays, diffDays, formatShort, isBetween, type ISODate } from './dates';
import { OTHER, PERSON_META, type DayEntry, type Person } from './types';

/** Un día con sangrado separado >3 días del anterior inicia un ciclo nuevo. */
const NEW_PERIOD_GAP = 3;

/** Duraciones de ciclo fuera de este rango se descartan (huecos sin registrar). */
const MIN_CYCLE = 15;
const MAX_CYCLE = 60;

/** Cuántos ciclos recientes usamos para estimar. */
const WINDOW = 6;

/** Cuántos ciclos futuros proyectamos (≈ un año de calendario navegable). */
export const PROJECTED_CYCLES = 12;

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

/* ------------------------------------------------------------------ */
/*  Ventanas de ciclo: histórico real + proyección futura             */
/* ------------------------------------------------------------------ */

export interface CycleWindow {
  /** Día 1 del ciclo. */
  start: ISODate;
  /** Inicio del ciclo siguiente (exclusivo). */
  nextStart: ISODate;
  /** true si el INICIO de esta ventana es proyectado (no registrado). */
  projected: boolean;
  /** true si el final/ovulación dependen de proyección (ciclo en curso o futuro). */
  nextProjected: boolean;
  /** false si es un hueco enorme sin registrar (no se puede inferir fase). */
  valid: boolean;
  /** 0 = histórico/en curso; k ≥ 1 = k-ésimo ciclo proyectado. */
  k: number;
  /** ± días de incertidumbre sobre el inicio (0 si el inicio es real). */
  uncertainty: number;
  ovulation: ISODate;
  fertileFrom: ISODate;
  fertileTo: ISODate;
}

/**
 * Une los ciclos históricos (entre inicios registrados) con `count` ciclos
 * proyectados hacia el futuro en una sola lista ordenada de ventanas.
 * Nota: proyStart_k = último + round(k·media) — se redondea al final para
 * que el error de redondeo no se acumule ciclo a ciclo.
 */
export function buildWindows(
  starts: ISODate[],
  stats: CycleStats,
  count = PROJECTED_CYCLES,
): CycleWindow[] {
  if (!starts.length) return [];

  const mk = (
    start: ISODate,
    nextStart: ISODate,
    projected: boolean,
    nextProjected: boolean,
    k: number,
    uncertainty: number,
  ): CycleWindow => {
    const len = diffDays(start, nextStart);
    const ovulation = addDays(nextStart, -14); // fase lútea ≈ constante
    return {
      start,
      nextStart,
      projected,
      nextProjected,
      valid: projected || (len >= MIN_CYCLE && len <= MAX_CYCLE),
      k,
      uncertainty,
      ovulation,
      fertileFrom: addDays(ovulation, -5),
      fertileTo: addDays(ovulation, 1),
    };
  };

  const out: CycleWindow[] = [];
  // Ciclos históricos completos (inicio y fin registrados).
  for (let i = 0; i + 1 < starts.length; i++) {
    out.push(mk(starts[i], starts[i + 1], false, false, 0, 0));
  }
  // Ciclo en curso (inicio real, fin proyectado) + ciclos futuros.
  const last = starts[starts.length - 1];
  const proj = (k: number) => addDays(last, Math.round(k * stats.meanLen));
  out.push(mk(last, proj(1), false, true, 0, Math.ceil(stats.sd)));
  for (let k = 1; k < count; k++) {
    const u = Math.min(10, Math.ceil(stats.sd * Math.sqrt(k)));
    out.push(mk(proj(k), proj(k + 1), true, true, k, u));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Fase de cualquier fecha                                            */
/* ------------------------------------------------------------------ */

export type Phase = 'menstrual' | 'folicular' | 'fertil' | 'lutea';

export interface DayPhaseInfo {
  phase: Phase;
  /** true si viene de proyección/estimación (no de datos registrados). */
  projected: boolean;
  cycleDay: number;
  /** ± días de incertidumbre heredada de la ventana (0 = base real). */
  uncertainty: number;
}

/**
 * Fase de CUALQUIER fecha — pasada, presente o futura. El sangrado registrado
 * siempre gana; después se consulta la ventana de ciclo que contiene la fecha.
 */
export function dayPhase(
  date: ISODate,
  entries: Record<ISODate, DayEntry>,
  windows: CycleWindow[],
  periodLen: number,
): DayPhaseInfo | null {
  const w = windows.find((win) => win.start <= date && date < win.nextStart);

  if ((entries[date]?.flow ?? 0) > 0) {
    const cycleDay = w ? diffDays(w.start, date) + 1 : 1;
    return { phase: 'menstrual', projected: false, cycleDay, uncertainty: 0 };
  }
  if (!w || !w.valid) return null;

  const cycleDay = diffDays(w.start, date) + 1;
  if (!w.projected && !w.nextProjected && cycleDay > MAX_CYCLE) return null;

  // Regla prevista al comienzo de un ciclo proyectado.
  if (w.projected && cycleDay <= periodLen) {
    return { phase: 'menstrual', projected: true, cycleDay, uncertainty: w.uncertainty };
  }

  const estimated = w.nextProjected; // ovulación basada en proyección, no en dato
  const u = w.projected ? w.uncertainty : 0;
  if (isBetween(date, w.fertileFrom, w.fertileTo)) {
    return { phase: 'fertil', projected: estimated, cycleDay, uncertainty: u };
  }
  if (date < w.ovulation) {
    return { phase: 'folicular', projected: estimated, cycleDay, uncertainty: u };
  }
  return { phase: 'lutea', projected: estimated, cycleDay, uncertainty: u };
}

/** Día del ciclo (1 = primer día de la última regla anterior) — solo datos reales. */
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

/* ------------------------------------------------------------------ */
/*  Textos por fase (divulgativos, no prescriptivos)                   */
/* ------------------------------------------------------------------ */

export const PHASE_INFO: Record<
  Phase,
  { name: string; hint: string; body: string; mind: string }
> = {
  menstrual: {
    name: 'Menstruación',
    hint: 'Días de cuidados extra 🫂',
    body:
      'El endometrio se desprende y estrógenos y progesterona están en mínimos. ' +
      'Son habituales los cólicos, la fatiga y la sensibilidad; el hierro baja con el sangrado.',
    mind:
      'Energía e interés social suelen estar en mínimos: el descanso rinde doble. ' +
      'Calor, sueño y no exigirse demasiado ayudan más que forzar planes.',
  },
  folicular: {
    name: 'Fase folicular',
    hint: 'Energía subiendo 🌱',
    body:
      'La hormona FSH madura un nuevo folículo y el estrógeno sube día a día: ' +
      'el cuerpo entero se prepara para la ovulación.',
    mind:
      'Con el estrógeno en ascenso suelen volver la energía, el ánimo y la concentración. ' +
      'Para muchas personas es la mejor fase para empezar cosas.',
  },
  fertil: {
    name: 'Ventana fértil',
    hint: 'Máxima probabilidad de embarazo ⚡',
    body:
      'Rodea a la ovulación: el óvulo vive ~24 h, pero los espermatozoides sobreviven ' +
      'hasta 5 días — por eso la ventana dura unos 6-7 días, no uno.',
    mind:
      'Pico de estrógeno (y algo de testosterona): sociabilidad, seguridad y deseo ' +
      'suelen estar en su punto más alto del ciclo.',
  },
  lutea: {
    name: 'Fase lútea',
    hint: 'Recta final del ciclo 🌙',
    body:
      'El folículo vacío (cuerpo lúteo) produce progesterona: temperatura algo más alta, ' +
      'posible hinchazón y sensibilidad en el pecho. Si no hay embarazo, cae y llega la regla.',
    mind:
      'Al final de esta fase puede aparecer el SPM: irritabilidad, antojos o ánimo más frágil. ' +
      'No es debilidad ni exageración: es química, y pasa.',
  },
};

/** Claves de color de cada fase dentro de la paleta del tema. */
export const PHASE_COLOR: Record<Phase, { main: ThemeColor; soft: ThemeColor }> = {
  menstrual: { main: 'period', soft: 'periodSoft' },
  folicular: { main: 'follicular', soft: 'follicularSoft' },
  fertil: { main: 'fertile', soft: 'fertileSoft' },
  lutea: { main: 'lutea', soft: 'luteaSoft' },
};

/* ------------------------------------------------------------------ */
/*  Diario cíclico: memoria y resumen del día N                        */
/* ------------------------------------------------------------------ */

export interface Memory {
  date: ISODate;
  cycleDay: number;
  entry: DayEntry;
}

/**
 * Entradas pasadas que cayeron en el mismo punto del ciclo (±window días)
 * que el día objetivo. Funciona también para fechas futuras: se compara
 * contra su día de ciclo PROYECTADO.
 */
export function cyclicMemories(
  targetCycleDay: number | null,
  beforeDate: ISODate,
  entries: Record<ISODate, DayEntry>,
  starts: ISODate[],
  window = 1,
): Memory[] {
  if (targetCycleDay == null) return [];
  const out: Memory[] = [];
  for (const d of Object.keys(entries).sort()) {
    if (d >= beforeDate) continue; // solo pasado
    const dcd = cycleDayOf(d, starts);
    if (dcd == null || Math.abs(dcd - targetCycleDay) > window) continue;
    const e = entries[d];
    if (!e) continue;
    const hasContent =
      (e.flow ?? 0) > 0 || e.moodHer || e.moodHim || e.noteHer || e.noteHim;
    if (hasContent) out.push({ date: d, cycleDay: dcd, entry: e });
  }
  return out.reverse(); // más reciente primero
}

/**
 * Resumen AUTOMÁTICO y local del día N del ciclo: estadística sencilla sobre
 * los registros históricos en ese punto (±window). Solo usa mis notas y las
 * notas del otro que estén compartidas — la privacidad se respeta también aquí.
 */
export function summarizeCycleDay(
  cd: number,
  entries: Record<ISODate, DayEntry>,
  starts: ISODate[],
  me: Person,
  otherNoteDefaultShared: boolean,
  window = 1,
): string | null {
  const meMeta = PERSON_META[me];
  const otherMeta = PERSON_META[OTHER[me]];

  const matches: { date: ISODate; e: DayEntry; startIdx: number }[] = [];
  for (const d of Object.keys(entries).sort()) {
    const dcd = cycleDayOf(d, starts);
    if (dcd == null || Math.abs(dcd - cd) > window) continue;
    const e = entries[d];
    if (!e) continue;
    let startIdx = -1;
    for (let i = 0; i < starts.length; i++) if (starts[i] <= d) startIdx = i;
    matches.push({ date: d, e, startIdx });
  }
  if (!matches.length) return null;

  const cycles = new Set(matches.map((m) => m.startIdx)).size;
  const flowN = matches.filter((m) => (m.e.flow ?? 0) > 0).length;

  const tally = (key: 'moodHer' | 'moodHim') => {
    const counts = new Map<string, number>();
    for (const m of matches) {
      const mood = m.e[key];
      if (mood) counts.set(mood, (counts.get(mood) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, n]) => `${m}×${n}`)
      .join(' ');
  };

  const herMoods = tally('moodHer');
  const himMoods = tally('moodHim');

  const snippets: string[] = [];
  for (const m of matches.slice(-4).reverse()) {
    const mine = m.e[meMeta.noteKey];
    const theirs = m.e[otherMeta.noteKey];
    const theirsShared = m.e[otherMeta.sharedKey] ?? otherNoteDefaultShared;
    const pick = mine ?? (theirsShared ? theirs : undefined);
    if (pick) {
      const short = pick.length > 42 ? pick.slice(0, 42) + '…' : pick;
      snippets.push(`«${short}» (${formatShort(m.date)})`);
    }
  }

  const lines = [
    `✨ Día ${cd} del ciclo — resumen automático (${matches.length} registro${
      matches.length === 1 ? '' : 's'
    }, ${cycles} ciclo${cycles === 1 ? '' : 's'}):`,
  ];
  if (flowN > 0) lines.push(`🩸 Regla en ${flowN} de ${matches.length} registros.`);
  if (herMoods) lines.push(`🌸 Ella: ${herMoods}`);
  if (himMoods) lines.push(`🌊 Él: ${himMoods}`);
  if (snippets.length) lines.push(`📝 ${snippets.join(' · ')}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Predicción "titular" (siguiente regla) — para textos de resumen    */
/* ------------------------------------------------------------------ */

export interface Prediction {
  nextStart: ISODate;
  uncertainty: number;
  ovulation: ISODate;
  fertileFrom: ISODate;
  fertileTo: ISODate;
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
  const ovulation = addDays(nextStart, -14);
  return {
    nextStart,
    uncertainty: Math.ceil(stats.sd),
    ovulation,
    fertileFrom: addDays(ovulation, -5),
    fertileTo: addDays(ovulation, 1),
    periodLen,
  };
}
