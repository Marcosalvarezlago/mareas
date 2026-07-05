import type { ISODate } from './dates';

/** Intensidad de sangrado: 0 = nada, 1 = ligero, 2 = medio, 3 = fuerte. */
export type Flow = 0 | 1 | 2 | 3;

export const FLOW_LABELS = ['Nada', 'Ligero', 'Medio', 'Fuerte'] as const;
export const FLOW_ICONS = ['○', '🩸', '🩸🩸', '🩸🩸🩸'] as const;

/** Emojis de estado emocional disponibles en el diario. */
export const MOODS = ['🥰', '😊', '😐', '😴', '🤕', '😢', '😡', '🤯'] as const;

/**
 * Entrada del diario de un día. Los campos "Her"/"Him" existen desde ya
 * para el modelo de pareja: ella es dueña del ciclo (flow), ambos anotan
 * estado y notas. Mañana esto se mapea 1:1 a la base de datos compartida.
 */
export interface DayEntry {
  date: ISODate;
  flow?: Flow;
  moodHer?: string;
  moodHim?: string;
  noteHer?: string;
  noteHim?: string;
}

export interface Settings {
  /** Duración típica de ciclo usada mientras no hay historial suficiente. */
  fallbackCycleLen: number;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  fallbackCycleLen: 28,
  onboarded: false,
};
