// Matemática del ciclo, versión 1 — sencilla y honesta:
// media ± desviación típica de los últimos ciclos, fase lútea ~constante de
// 14 días para estimar la ovulación, y PROYECCIÓN MULTI-CICLO encadenando
// ciclos medios hacia el futuro. La incertidumbre del k-ésimo ciclo futuro
// crece como σ·√k (suma de k duraciones independientes). Los datos reales
// registrados siempre ganan sobre cualquier proyección.

import type { ThemeColor } from '@/constants/theme';

import { addDays, diffDays, formatShort, isBetween, type ISODate } from './dates';
import { PERSON_META, type DayEntry, type Person } from './types';

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
  { name: string; hint: string; body: string; mind: string; diet: string; care: string }
> = {
  menstrual: {
    name: 'Menstruación',
    hint: 'Días de cuidados extra 🫂',
    body:
      'El endometrio se desprende y sale en forma de sangrado; estrógenos y progesterona ' +
      'están en su mínimo. Las prostaglandinas que ayudan al útero a contraerse causan los ' +
      'cólicos, y con el sangrado se pierde hierro. Fatiga, dolor lumbar y sensibilidad son normales.',
    mind:
      'Energía e interés social en mínimos: el cuerpo pide recogimiento y el descanso rinde ' +
      'doble. No es flojera, es fisiología. El calor local alivia los cólicos tanto como ' +
      'muchos analgésicos suaves.',
    diet:
      'Toca reponer hierro: legumbres, espinacas, frutos secos o carne, junto a vitamina C ' +
      '(cítricos, pimiento) para absorberlo mejor. Chocolate negro y plátano aportan magnesio. ' +
      'Reducir alcohol, café y ultraprocesados suele aliviar la inflamación.',
    care:
      'Calor en el abdomen, dormir más y movimiento suave (paseo, estiramientos, yoga). ' +
      'Si el dolor te tumba cada mes o el sangrado es muy abundante, no lo normalices: ' +
      'coméntalo con tu médico.',
  },
  folicular: {
    name: 'Fase folicular',
    hint: 'Energía subiendo 🌱',
    body:
      'La hipófisis libera FSH, que madura un nuevo folículo en el ovario; ese folículo ' +
      'fabrica estrógeno en ascenso, que regenera el endometrio y mejora la piel, la energía ' +
      'y la sensibilidad a la insulina.',
    mind:
      'Con el estrógeno subiendo vuelven la motivación, la concentración y las ganas de ' +
      'gente. Para muchas personas es la mejor fase para empezar proyectos, decidir y aprender.',
    diet:
      'El cuerpo aprovecha muy bien los carbohidratos complejos: avena, quinoa, fruta. ' +
      'Proteína y verdura fresca acompañan la reconstrucción del endometrio; los fermentados ' +
      '(yogur, kéfir) ayudan a metabolizar el estrógeno.',
    care:
      'El mejor momento para entrenamientos exigentes: fuerza, series, retos nuevos — la ' +
      'recuperación está en su punto óptimo. Buena fase para citas médicas o decisiones difíciles.',
  },
  fertil: {
    name: 'Ventana fértil',
    hint: 'Máxima probabilidad de embarazo ⚡',
    body:
      'Un pico de LH dispara la ovulación: el ovario libera el óvulo, que vive unas 24 horas. ' +
      'Los espermatozoides sobreviven hasta 5 días, por eso la ventana fértil dura ~6-7 días. ' +
      'Tras ovular, la temperatura basal sube ~0,3 °C y el flujo se vuelve claro y elástico.',
    mind:
      'Estrógeno en máximo y un toque de testosterona: sociabilidad, seguridad y deseo suelen ' +
      'estar en su pico. Algunas personas notan una punzada pélvica al ovular (mittelschmerz); es normal.',
    diet:
      'Antioxidantes (frutos rojos, verduras de colores), zinc (semillas de calabaza, marisco) ' +
      'y omega-3 (pescado azul, nueces) acompañan la ovulación. E hidratarse: el cuerpo va a plena máquina.',
    care:
      'Máxima probabilidad de embarazo: si no se busca, el método anticonceptivo real es ' +
      'imprescindible (esta app no lo es). Energía alta: buen momento para lo social y lo intenso.',
  },
  lutea: {
    name: 'Fase lútea',
    hint: 'Recta final del ciclo 🌙',
    body:
      'El folículo vacío se convierte en cuerpo lúteo y fabrica progesterona: sube ~0,3 °C la ' +
      'temperatura, se ralentiza la digestión (hinchazón) y se sensibiliza el pecho. Si no hay ' +
      'embarazo, la progesterona cae en picado y ese desplome dispara la regla — y el SPM final.',
    mind:
      'La progesterona es sedante: más sueño, más hambre, menos paciencia. Los últimos 3-5 días ' +
      'pueden traer SPM: irritabilidad, ánimo frágil, antojos. Saberlo y nombrarlo desactiva la ' +
      'mitad de las discusiones.',
    diet:
      'El gasto calórico sube ~100-300 kcal/día: el hambre extra es real. Carbohidratos complejos ' +
      'y proteína estabilizan el ánimo; magnesio (chocolate negro, frutos secos) y calcio alivian ' +
      'el SPM. Menos sal (hinchazón), café y alcohol (sueño e irritabilidad).',
    care:
      'Bajar el listón deportivo sin parar del todo: fuerza suave, caminar, dormir media hora más. ' +
      'Planificar menos compromisos en los últimos días. Si el SPM rompe la vida cada mes, tiene ' +
      'nombre (TDPM) y tratamiento: consulta médica.',
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

/**
 * Tope de radio por fase: el usuario elige el radio (0 = día exacto … ±3),
 * pero cada fase lo acota — la regla es lo más rígido. Cruzar de fase es
 * imposible siempre (phaseDelta exige fase idéntica).
 */
export const PHASE_RADIUS_CAP: Record<Phase, number> = {
  menstrual: 1,
  folicular: 3,
  fertil: 2,
  lutea: 3,
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
 * Días equivalentes al objetivo en el lenguaje del ciclo — de CUALQUIER
 * ciclo, anterior o posterior al día seleccionado: misma fase y posición
 * comparable (hacia adelante desde la regla, hacia atrás hasta la siguiente,
 * o distancia a la ovulación, según la fase). Este es el único punto de
 * acople del "emparejador": un modelo aprendido podrá sustituirlo sin tocar
 * nada más.
 */
export function similarDays(
  targetDate: ISODate,
  entries: Record<ISODate, DayEntry>,
  windows: CycleWindow[],
  periodLen: number,
  radius = 2,
  max = 60,
): SimilarDay[] {
  const target = coordOf(targetDate, entries, windows, periodLen);
  if (!target) return [];
  const effective = Math.min(Math.max(0, radius), PHASE_RADIUS_CAP[target.phase]);
  const out: SimilarDay[] = [];
  for (const d of Object.keys(entries).sort()) {
    if (d === targetDate) continue; // todos los equivalentes, menos él mismo
    const e = entries[d];
    if (!e || !hasContent(e)) continue;
    const c = coordOf(d, entries, windows, periodLen);
    if (!c) continue;
    const delta = phaseDelta(target, c);
    if (delta == null || delta > effective) continue;
    out.push({ date: d, cycleDay: c.cdF, delta, entry: e });
  }
  return out.reverse().slice(0, max); // más reciente primero
}

/**
 * Coordenada RÍGIDA del punto del ciclo, con la doble contabilidad: los
 * resúmenes se guardan bajo esta clave y valen para todos los días
 * equivalentes de todos los ciclos.
 *  - "F4" → día 4 contando desde la regla (fases menstrual y folicular)
 *  - "B8" → 8 días antes de la próxima regla (fase lútea, anclada al final)
 *  - "O0" → día de ovulación estimado; "O-2" dos días antes (ventana fértil)
 */
export function cycleCoord(
  date: ISODate,
  entries: Record<ISODate, DayEntry>,
  windows: CycleWindow[],
  periodLen: number,
): { key: string; context: string | null } | null {
  const c = coordOf(date, entries, windows, periodLen);
  if (!c) return null;
  switch (c.phase) {
    case 'menstrual':
    case 'folicular':
      return { key: `F${c.cdF}`, context: null };
    case 'fertil':
      if (c.dOvu == null) return { key: `F${c.cdF}`, context: null };
      return {
        key: `O${c.dOvu}`,
        context:
          c.dOvu === 0
            ? 'día de ovulación estimado'
            : c.dOvu < 0
              ? `${-c.dOvu} día${c.dOvu === -1 ? '' : 's'} antes de la ovulación`
              : `${c.dOvu} día${c.dOvu === 1 ? '' : 's'} tras la ovulación`,
      };
    case 'lutea':
      if (c.cdB == null) return { key: `F${c.cdF}`, context: null };
      return { key: `B${c.cdB}`, context: `a ${c.cdB} días de la próxima regla` };
  }
}

/* --- etiquetas de bienestar ("me sentó bien/mal", separadas por comas) --- */

function splitTags(s?: string): string[] {
  return (s ?? '')
    .split(/[,;·]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** "a, b y c" (o "e" ante i-/hi-), en castellano decente. */
function joinES(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const last = items[items.length - 1];
  const conj = /^h?i(?!e)/i.test(last.trim()) ? ' e ' : ' y ';
  return items.slice(0, -1).join(', ') + conj + last;
}

/** [{disp:'manta',n:3},{disp:'paseo',n:1}] → "manta (×3) y paseo". */
function proseList(pairs: { disp: string; n: number }[]): string {
  return joinES(pairs.map(({ disp, n }) => (n > 1 ? `${disp} (×${n})` : disp)));
}

function tagPairs(values: (string | undefined)[]): { disp: string; n: number }[] {
  const counts = new Map<string, { disp: string; n: number }>();
  for (const v of values) {
    for (const tag of splitTags(v)) {
      const key = tag.toLowerCase();
      const cur = counts.get(key);
      if (cur) cur.n++;
      else counts.set(key, { disp: tag, n: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 4);
}

function moodPairs(matches: SimilarDay[], key: 'moodHer' | 'moodHim') {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const mood = m.entry[key];
    if (mood) counts.set(mood, (counts.get(mood) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([disp, n]) => ({ disp, n }));
}

/**
 * Resumen AUTOMÁTICO y local del punto del ciclo, en prosa y en SEGUNDA
 * persona ("sueles…", "te sienta…"): estadística sencilla SOLO sobre los
 * registros propios en los días equivalentes. El resumen es de uno mismo;
 * el de la pareja se comparte aparte si se quiere.
 */
export function summarizeCyclePoint(
  targetDate: ISODate,
  entries: Record<ISODate, DayEntry>,
  starts: ISODate[],
  windows: CycleWindow[],
  periodLen: number,
  me: Person,
  radius = 2,
): string | null {
  const target = coordOf(targetDate, entries, windows, periodLen);
  const matches = similarDays(targetDate, entries, windows, periodLen, radius);
  if (!target || !matches.length) return null;

  const meta = PERSON_META[me];

  const idxOf = (d: ISODate) => {
    let idx = -1;
    for (let i = 0; i < starts.length; i++) if (starts[i] <= d) idx = i;
    return idx;
  };
  const cycles = new Set(matches.map((m) => idxOf(m.date))).size;
  const flowN = matches.filter((m) => (m.entry.flow ?? 0) > 0).length;
  const n = matches.length;

  const sentences: string[] = [];
  sentences.push(
    `Basado en tus ${n} día${n === 1 ? '' : 's'} equivalente${n === 1 ? '' : 's'} de ${cycles} ciclo${
      cycles === 1 ? '' : 's'
    } (${PHASE_INFO[target.phase].name.toLowerCase()}).`,
  );

  if (me === 'her') {
    if (flowN === n) sentences.push('Tuviste la regla en todos ellos.');
    else if (flowN > 0) sentences.push(`Tuviste la regla en ${flowN} de ${n}.`);
  }

  const moods = moodPairs(matches, meta.moodKey);
  if (moods.length) sentences.push(`Sueles estar ${proseList(moods)}.`);

  const good = tagPairs(matches.map((m) => m.entry[meta.goodKey]));
  const bad = tagPairs(matches.map((m) => m.entry[meta.badKey]));
  if (good.length && bad.length) {
    sentences.push(`Te sienta bien ${proseList(good)}; te sienta mal ${proseList(bad)}.`);
  } else if (good.length) {
    sentences.push(`Te sienta bien ${proseList(good)}.`);
  } else if (bad.length) {
    sentences.push(`Te sienta mal ${proseList(bad)}.`);
  }

  const snippets: string[] = [];
  for (const m of matches) {
    if (snippets.length >= 4) break;
    const mine = m.entry[meta.noteKey];
    if (!mine) continue;
    // Las notas pueden ser multilínea: aplanar espacios y cortar en palabra.
    const clean = mine.replace(/\s+/g, ' ').trim();
    let short = clean;
    if (clean.length > 48) {
      const cut = clean.slice(0, 48);
      const sp = cut.lastIndexOf(' ');
      short = (sp > 30 ? cut.slice(0, sp) : cut) + '…';
    }
    if (short) snippets.push(`«${short}» (${formatShort(m.date)})`);
  }
  if (snippets.length) sentences.push(`De tus notas: ${snippets.join(' · ')}.`);

  // Si no hay nada propio (los equivalentes eran solo del otro), no hay resumen.
  if (sentences.length === 1) return null;

  return sentences.join('\n');
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
