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
/*  Diario cíclico: días parecidos (por fase) y resumen del punto      */
/* ------------------------------------------------------------------ */

/**
 * Coordenadas de un día dentro de su ciclo. La clave del emparejamiento:
 * el comienzo del ciclo se alinea contando HACIA ADELANTE desde la regla
 * (cdF), pero la fase lútea está anclada al FINAL (la ovulación ocurre
 * ~14 días antes de la siguiente regla), así que ahí se alinea contando
 * HACIA ATRÁS (cdB) — así dos ciclos de distinta duración se corresponden.
 */
interface DayCoord {
  phase: Phase;
  /** Día de ciclo contando desde la regla (1 = primer día). */
  cdF: number;
  /** Días hasta la siguiente regla (real si se conoce, proyectada si no). */
  cdB: number | null;
  /** Distancia a la ovulación estimada de SU ciclo (0 = día de ovulación). */
  dOvu: number | null;
}

function coordOf(
  date: ISODate,
  entries: Record<ISODate, DayEntry>,
  windows: CycleWindow[],
  periodLen: number,
): DayCoord | null {
  const dp = dayPhase(date, entries, windows, periodLen);
  if (!dp) return null;
  const w = windows.find((win) => win.start <= date && date < win.nextStart);
  return {
    phase: dp.phase,
    cdF: dp.cycleDay,
    cdB: w ? diffDays(date, w.nextStart) : null,
    dOvu: w ? diffDays(w.ovulation, date) : null,
  };
}

/** Tolerancia de emparejamiento por fase (la regla es lo más "fijo"). */
const MATCH_WINDOW: Record<Phase, number> = {
  menstrual: 1,
  folicular: 2,
  fertil: 2,
  lutea: 2,
};

/**
 * Distancia entre dos días EN EL LENGUAJE DE SU FASE, o null si no son
 * comparables. Fases distintas nunca se mezclan: un día de regla no toma
 * información de la víspera aunque sean consecutivos en el calendario.
 */
function phaseDelta(a: DayCoord, b: DayCoord): number | null {
  if (a.phase !== b.phase) return null;
  switch (a.phase) {
    case 'menstrual':
    case 'folicular':
      return Math.abs(a.cdF - b.cdF);
    case 'fertil':
      return a.dOvu != null && b.dOvu != null
        ? Math.abs(a.dOvu - b.dOvu)
        : Math.abs(a.cdF - b.cdF);
    case 'lutea':
      return a.cdB != null && b.cdB != null
        ? Math.abs(a.cdB - b.cdB)
        : Math.abs(a.cdF - b.cdF);
  }
}

export interface SimilarDay {
  date: ISODate;
  cycleDay: number;
  /** Distancia al objetivo en la métrica de su fase (0 = equivalente exacto). */
  delta: number;
  entry: DayEntry;
}

function hasContent(e: DayEntry): boolean {
  return Boolean(
    (e.flow ?? 0) > 0 ||
      e.moodHer || e.moodHim ||
      e.noteHer || e.noteHim ||
      e.goodHer || e.badHer || e.goodHim || e.badHim,
  );
}

/**
 * Días pasados equivalentes al objetivo en el lenguaje del ciclo: misma fase
 * y posición comparable (hacia adelante desde la regla, hacia atrás hasta la
 * siguiente, o distancia a la ovulación, según la fase). Este es el único
 * punto de acople del "emparejador": un modelo aprendido podrá sustituir a
 * esta regla en el futuro sin tocar nada más.
 */
export function similarDays(
  targetDate: ISODate,
  entries: Record<ISODate, DayEntry>,
  windows: CycleWindow[],
  periodLen: number,
  max = 12,
): SimilarDay[] {
  const target = coordOf(targetDate, entries, windows, periodLen);
  if (!target) return [];
  const out: SimilarDay[] = [];
  for (const d of Object.keys(entries).sort()) {
    if (d >= targetDate) continue; // solo pasado
    const e = entries[d];
    if (!e || !hasContent(e)) continue;
    const c = coordOf(d, entries, windows, periodLen);
    if (!c) continue;
    const delta = phaseDelta(target, c);
    if (delta == null || delta > MATCH_WINDOW[target.phase]) continue;
    out.push({ date: d, cycleDay: c.cdF, delta, entry: e });
  }
  return out.reverse().slice(0, max); // más reciente primero
}

/* --- etiquetas de bienestar ("me sentó bien/mal", separadas por comas) --- */

function splitTags(s?: string): string[] {
  return (s ?? '')
    .split(/[,;·]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** "manta ×3, paseo ×2, infusión" — frecuencia de etiquetas, top 4. */
function tallyTags(values: (string | undefined)[]): string {
  const counts = new Map<string, { disp: string; n: number }>();
  for (const v of values) {
    for (const tag of splitTags(v)) {
      const key = tag.toLowerCase();
      const cur = counts.get(key);
      if (cur) cur.n++;
      else counts.set(key, { disp: tag, n: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map(({ disp, n }) => (n > 1 ? `${disp} ×${n}` : disp))
    .join(', ');
}

/**
 * Resumen AUTOMÁTICO y local del punto del ciclo: estadística sencilla sobre
 * los días parecidos (misma fase, posición comparable), incluido el bienestar
 * (qué sienta bien/mal). Solo usa mis notas y las del otro que estén
 * compartidas — la privacidad se respeta también aquí.
 */
export function summarizeCyclePoint(
  targetDate: ISODate,
  entries: Record<ISODate, DayEntry>,
  starts: ISODate[],
  windows: CycleWindow[],
  periodLen: number,
  me: Person,
  otherNoteDefaultShared: boolean,
): string | null {
  const target = coordOf(targetDate, entries, windows, periodLen);
  const matches = similarDays(targetDate, entries, windows, periodLen);
  if (!target || !matches.length) return null;

  const meMeta = PERSON_META[me];
  const otherMeta = PERSON_META[OTHER[me]];

  // ¿Cuántos ciclos distintos aportan datos?
  const idxOf = (d: ISODate) => {
    let idx = -1;
    for (let i = 0; i < starts.length; i++) if (starts[i] <= d) idx = i;
    return idx;
  };
  const cycles = new Set(matches.map((m) => idxOf(m.date))).size;
  const flowN = matches.filter((m) => (m.entry.flow ?? 0) > 0).length;

  const tallyMoods = (key: 'moodHer' | 'moodHim') => {
    const counts = new Map<string, number>();
    for (const m of matches) {
      const mood = m.entry[key];
      if (mood) counts.set(mood, (counts.get(mood) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([mo, n]) => `${mo}×${n}`)
      .join(' ');
  };

  const snippets: string[] = [];
  for (const m of matches.slice(0, 4)) {
    const mine = m.entry[meMeta.noteKey];
    const theirs = m.entry[otherMeta.noteKey];
    const theirsShared = m.entry[otherMeta.sharedKey] ?? otherNoteDefaultShared;
    const pick = mine ?? (theirsShared ? theirs : undefined);
    if (pick) {
      const short = pick.length > 42 ? pick.slice(0, 42) + '…' : pick;
      snippets.push(`«${short}» (${formatShort(m.date)})`);
    }
  }

  const lines = [
    `✨ Día ${target.cdF} · ${PHASE_INFO[target.phase].name} — ${matches.length} día${
      matches.length === 1 ? '' : 's'
    } parecido${matches.length === 1 ? '' : 's'} en ${cycles} ciclo${cycles === 1 ? '' : 's'}:`,
  ];
  if (flowN > 0) lines.push(`🩸 Regla en ${flowN} de ${matches.length}.`);

  const herMoods = tallyMoods('moodHer');
  const himMoods = tallyMoods('moodHim');
  if (herMoods) lines.push(`${PERSON_META.her.emoji} ${PERSON_META.her.label}: ${herMoods}`);
  if (himMoods) lines.push(`${PERSON_META.him.emoji} ${PERSON_META.him.label}: ${himMoods}`);

  for (const p of ['her', 'him'] as Person[]) {
    const meta = PERSON_META[p];
    const good = tallyTags(matches.map((m) => m.entry[meta.goodKey]));
    const bad = tallyTags(matches.map((m) => m.entry[meta.badKey]));
    if (good) lines.push(`✅ A ${meta.label} le sienta bien: ${good}`);
    if (bad) lines.push(`⚠️ A ${meta.label} le sienta mal: ${bad}`);
  }

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
