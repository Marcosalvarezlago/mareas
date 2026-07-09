import type { ISODate } from './dates';

/** Intensidad de sangrado: 0 = nada, 1 = ligero, 2 = medio, 3 = fuerte. */
export type Flow = 0 | 1 | 2 | 3;

export const FLOW_LABELS = ['Nada', 'Ligero', 'Medio', 'Fuerte'] as const;

/** Emojis de estado emocional disponibles en el diario. */
export const MOODS = ['🥰', '😊', '😐', '😴', '🤕', '😢', '😡', '🤯'] as const;

/** Los dos miembros de la pareja (provisional hasta que haya login real). */
export type Person = 'her' | 'him';

/**
 * Entrada del diario de un día. El ciclo (flow) y el estado emocional son
 * información compartida de la pareja; las NOTAS son privadas y cada quien
 * decide compartir la suya (por día con `note*Shared`, o por defecto en
 * Ajustes de privacidad).
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
}

/** Mapea cada persona a sus campos, para escribir código simétrico. */
export const PERSON_META: Record<Person, PersonMeta> = {
  her: {
    label: 'Ella',
    emoji: '🌸',
    moodKey: 'moodHer',
    noteKey: 'noteHer',
    sharedKey: 'noteHerShared',
    summaryKey: 'summaryHer',
    summarySharedKey: 'summaryHerShared',
  },
  him: {
    label: 'Él',
    emoji: '🌊',
    moodKey: 'moodHim',
    noteKey: 'noteHim',
    sharedKey: 'noteHimShared',
    summaryKey: 'summaryHim',
    summarySharedKey: 'summaryHimShared',
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
