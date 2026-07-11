// Datos de ejemplo (~6 meses) para valorar la app con contenido realista:
// ciclos de longitud variable, moods y bienestar coherentes con cada fase,
// notas en castellano (alguna multilínea, a propósito) y resúmenes de punto
// de ciclo ya compartidos. Determinista (PRNG con semilla): siempre genera
// exactamente lo mismo.

import { addDays, todayISO, type ISODate } from './dates';
import type { CycleDayNote, DayEntry, Flow } from './types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type DemoPhase = 'menstrual' | 'folicular' | 'fertil' | 'lutea';

const MOODS_HER: Record<DemoPhase, readonly string[]> = {
  menstrual: ['😴', '🤕', '😢', '😐', '😴'],
  folicular: ['😊', '😊', '🥰', '😐'],
  fertil: ['🥰', '😊', '🥰'],
  lutea: ['😐', '😢', '😡', '🤯', '😴'],
};

const MOODS_HIM = ['😊', '😐', '😴', '🥰', '😊'] as const;

const NOTES_HER: Record<DemoPhase, readonly string[]> = {
  menstrual: [
    'cólicos fuertes por la mañana, mejor por la tarde',
    'plan sofá, peli y manta',
    'dolor de espalda baja\nno dormí bien',
    'flujo intenso hoy, en casa tranquila',
  ],
  folicular: [
    'con energía, día muy productivo',
    'quedamos con amigas, genial',
    'me apetece empezar cosas nuevas',
  ],
  fertil: [
    'día top, ánimo arriba',
    'noche divertida 😏',
    'energía social a tope',
  ],
  lutea: [
    'sensible, necesito mimos',
    'me enfado fácil, no es contigo',
    'antojo de dulce todo el día\ngalletas de chocolate',
    'hinchada y cansada, día lento',
  ],
};

const NOTES_HIM = [
  'día tranquilo juntos',
  'la noté cansada, hice yo la cena',
  'paseo al atardecer, bien bonito',
  'compré chocolate 😌',
  'día raro, mejor no insistir',
] as const;

const GOOD_HER: Record<DemoPhase, readonly string[]> = {
  menstrual: ['manta eléctrica', 'infusión de jengibre', 'sofá y peli', 'calor local'],
  folicular: ['correr', 'planes con amigas', 'comer ligero'],
  fertil: ['salir a bailar', 'cita improvisada'],
  lutea: ['chocolate negro', 'paseo suave', 'baño caliente', 'dormir 8 horas'],
};

const BAD_HER: Record<DemoPhase, readonly string[]> = {
  menstrual: ['café', 'frío', 'estar de pie mucho rato'],
  folicular: ['trasnochar'],
  fertil: ['alcohol de más'],
  lutea: ['café', 'discusiones tontas', 'azúcar de más', 'trasnochar'],
};

const GOOD_HIM = ['hacer deporte', 'cocinar juntos', 'siesta corta'] as const;
const BAD_HIM = ['trasnochar', 'discutir por tonterías'] as const;

/** Resúmenes de punto de ciclo ya escritos (para ver la capa compartida). */
const DEMO_CYCLE_NOTES: Record<string, CycleDayNote> = {
  F1: {
    summaryHer: 'Primer día de regla: cero planes, manta y calor. Suele doler por la mañana.',
    summaryHerShared: true,
  },
  F2: {
    summaryHer: 'El día más intenso de sangrado. Teletrabajo si se puede.',
    summaryHerShared: true,
  },
  B3: {
    summaryHer: 'Recta final: mecha corta y antojo de dulce. No es personal.',
    summaryHerShared: true,
    summaryHim: 'Traer chocolate, proponer peli y no discutir tonterías.',
    summaryHimShared: true,
  },
};

export function buildDemoData(): {
  entries: Record<ISODate, DayEntry>;
  cycleNotes: Record<string, CycleDayNote>;
} {
  const rand = mulberry32(20260711);
  const chance = (p: number) => rand() < p;
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

  const today = todayISO();
  const entries: Record<ISODate, DayEntry> = {};

  // Inicios de ciclo desde ~6 meses atrás; longitudes variables 26-30 días.
  let start = addDays(today, -172);
  const cycles: { start: ISODate; len: number }[] = [];
  for (;;) {
    const len = 26 + Math.floor(rand() * 5);
    cycles.push({ start, len });
    const next = addDays(start, len);
    if (next > today) break;
    start = next;
  }

  const intensity: Flow[] = [2, 3, 2, 1, 1];

  for (const cycle of cycles) {
    const periodLen = chance(0.4) ? 5 : 4;
    const ovuDay = cycle.len - 13; // día (1-index) de ovulación ≈ fin − 14

    for (let d = 1; d <= cycle.len; d++) {
      const date = addDays(cycle.start, d - 1);
      if (date > today) break;

      const phase: DemoPhase =
        d <= periodLen
          ? 'menstrual'
          : d >= ovuDay - 5 && d <= ovuDay + 1
            ? 'fertil'
            : d < ovuDay
              ? 'folicular'
              : 'lutea';

      const e: Partial<DayEntry> = {};
      if (phase === 'menstrual') e.flow = intensity[d - 1] ?? 1;

      // No todos los días se registran: la vida real tiene huecos.
      const active = phase === 'menstrual' || chance(0.75);
      if (active) {
        if (chance(0.7)) e.moodHer = pick(MOODS_HER[phase]);
        if (chance(0.45)) e.moodHim = pick(MOODS_HIM);
        if (chance(0.32)) {
          e.noteHer = pick(NOTES_HER[phase]);
          if (chance(0.55)) e.noteHerShared = true;
        }
        if (chance(0.16)) {
          e.noteHim = pick(NOTES_HIM);
          if (chance(0.4)) e.noteHimShared = true;
        }
        if (chance(phase === 'menstrual' || phase === 'lutea' ? 0.45 : 0.2)) {
          e.goodHer = pick(GOOD_HER[phase]);
        }
        if (chance(phase === 'lutea' ? 0.4 : 0.2)) e.badHer = pick(BAD_HER[phase]);
        if (chance(0.1)) e.goodHim = pick(GOOD_HIM);
        if (chance(0.08)) e.badHim = pick(BAD_HIM);
      }

      if (Object.keys(e).length) entries[date] = { date, ...e };
    }
  }

  return { entries, cycleNotes: { ...DEMO_CYCLE_NOTES } };
}
