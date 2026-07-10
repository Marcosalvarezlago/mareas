import type { ISODate } from './dates';

/** Intensidad de sangrado: 0 = nada, 1 = ligero, 2 = medio, 3 = fuerte. */
export type Flow = 0 | 1 | 2 | 3;

export const FLOW_LABELS = ['Nada', 'Ligero', 'Medio', 'Fuerte'] as const;

/** Emojis de estado emocional disponibles en el diario. */
export const MOODS = ['🥰', '😊', '😐', '😴', '🤕', '😢', '😡', '🤯'] as const;

/**
 * Los dos roles de la pareja. OJO: 'her'/'him' son CLAVES DE ALMACENAMIENTO
 * (no renombrar: hay datos persistidos); los nombres visibles viven en
 * PERSON_META — Luna 🌙 (quien vive el ciclo) y Mar 🌊 (quien acompaña).
 */
export type Person = 'her' | 'him';

/**
 * Entrada del diario de un día. Compartido por diseño: ciclo (flow), estado
 * emocional y bienestar (qué sentó bien/mal — lenguaje de cuidado de la
 * pareja). Privado por defecto: las notas, con candado por día o preferencia
 * general.
 */
export interface DayEntry {
  date: ISODate;
  flow?: Flow;
  moodHer?: string;
  moodHim?: string;
  noteHer?: string;
  noteHim?: string;
  /** undefined = usa el valor por defecto de privacidad de esa persona. */
  noteHerShared?: boolean;
  noteHimShared?: boolean;
  /** Bienestar: etiquetas separadas por comas ("paseo, manta, infusión"). */
  goodHer?: string;
  badHer?: string;
  goodHim?: string;
  badHim?: string;
}

/**
 * Resumen del "día N del ciclo" — conocimiento acumulado sobre qué significa
 * ese punto del ciclo (no una fecha concreta). Editable a mano o generado
 * automáticamente a partir del historial.
 */
export interface CycleDayNote {
  summaryHer?: string;
  summaryHim?: string;
  summaryHerShared?: boolean;
  summaryHimShared?: boolean;
}

export interface PersonMeta {
  label: string;
  emoji: string;
  moodKey: 'moodHer' | 'moodHim';
  noteKey: 'noteHer' | 'noteHim';
  sharedKey: 'noteHerShared' | 'noteHimShared';
  summaryKey: 'summaryHer' | 'summaryHim';
  summarySharedKey: 'summaryHerShared' | 'summaryHimShared';
  goodKey: 'goodHer' | 'goodHim';
  badKey: 'badHer' | 'badHim';
}

/** Mapea cada rol a sus campos, para escribir código simétrico. */
export const PERSON_META: Record<Person, PersonMeta> = {
  her: {
    label: 'Luna',
    emoji: '🌙',
    moodKey: 'moodHer',
    noteKey: 'noteHer',
    sharedKey: 'noteHerShared',
    summaryKey: 'summaryHer',
    summarySharedKey: 'summaryHerShared',
    goodKey: 'goodHer',
    badKey: 'badHer',
  },
  him: {
    label: 'Mar',
    emoji: '🌊',
    moodKey: 'moodHim',
    noteKey: 'noteHim',
    sharedKey: 'noteHimShared',
    summaryKey: 'summaryHim',
    summarySharedKey: 'summaryHimShared',
    goodKey: 'goodHim',
    badKey: 'badHim',
  },
};

export const OTHER: Record<Person, Person> = { her: 'him', him: 'her' };

/** Preferencias de compartición por defecto de una persona. */
export interface PrivacyPrefs {
  notesShared: boolean;
  summariesShared: boolean;
}

export interface Settings {
  /** Duración típica de ciclo usada mientras no hay historial suficiente. */
  fallbackCycleLen: number;
  onboarded: boolean;
  /** Desde qué lado se está usando la app (se sustituirá por el login). */
  perspective: Person;
  /** Compartición por defecto; el candado de cada día/resumen manda sobre esto. */
  privacy: Record<Person, PrivacyPrefs>;
}

export const DEFAULT_SETTINGS: Settings = {
  fallbackCycleLen: 28,
  onboarded: false,
  perspective: 'her',
  privacy: {
    her: { notesShared: false, summariesShared: false },
    him: { notesShared: false, summariesShared: false },
  },
};
