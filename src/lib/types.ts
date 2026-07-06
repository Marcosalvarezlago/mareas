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
 * información compartida de la pareja; las NOTAS son privadas por defecto y
 * cada quien decide compartir la suya con `note*Shared`.
 */
export interface DayEntry {
  date: ISODate;
  flow?: Flow;
  moodHer?: string;
  moodHim?: string;
  noteHer?: string;
  noteHim?: string;
  noteHerShared?: boolean;
  noteHimShared?: boolean;
}

export interface PersonMeta {
  label: string;
  emoji: string;
  moodKey: 'moodHer' | 'moodHim';
  noteKey: 'noteHer' | 'noteHim';
  sharedKey: 'noteHerShared' | 'noteHimShared';
}

/** Mapea cada persona a sus campos en DayEntry, para escribir código simétrico. */
export const PERSON_META: Record<Person, PersonMeta> = {
  her: { label: 'Ella', emoji: '🌸', moodKey: 'moodHer', noteKey: 'noteHer', sharedKey: 'noteHerShared' },
  him: { label: 'Él', emoji: '🌊', moodKey: 'moodHim', noteKey: 'noteHim', sharedKey: 'noteHimShared' },
};

export const OTHER: Record<Person, Person> = { her: 'him', him: 'her' };

export interface Settings {
  /** Duración típica de ciclo usada mientras no hay historial suficiente. */
  fallbackCycleLen: number;
  onboarded: boolean;
  /** Desde qué lado se está usando la app (se sustituirá por el login). */
  perspective: Person;
}

export const DEFAULT_SETTINGS: Settings = {
  fallbackCycleLen: 28,
  onboarded: false,
  perspective: 'her',
};
