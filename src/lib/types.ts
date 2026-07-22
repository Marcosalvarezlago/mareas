import type { ISODate } from './dates';

/** Intensidad de sangrado: 0 = nada, 1 = ligero, 2 = medio, 3 = fuerte. */
export type Flow = 0 | 1 | 2 | 3;

export const FLOW_LABELS = ['Nada', 'Ligero', 'Medio', 'Fuerte'] as const;

/**
 * Estados emocionales disponibles en el diario. Las etiquetas evitan que el
 * significado dependa solo de interpretar un emoji y sirven como texto
 * accesible. Los emojis antiguos se mantienen para no romper datos guardados.
 */
export const MOOD_OPTIONS = [
  { emoji: '🥰', label: 'Cariño' },
  { emoji: '😊', label: 'Bien' },
  { emoji: '😌', label: 'Calma' },
  { emoji: '🙂', label: 'Ánimo' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '😕', label: 'Revuelta' },
  { emoji: '😴', label: 'Cansancio' },
  { emoji: '🤕', label: 'Dolor' },
  { emoji: '🥺', label: 'Sensible' },
  { emoji: '😢', label: 'Tristeza' },
  { emoji: '😤', label: 'Irritación' },
  { emoji: '😡', label: 'Enfado' },
  { emoji: '😰', label: 'Agobio' },
  { emoji: '🤯', label: 'Saturación' },
] as const;

export const MOODS = MOOD_OPTIONS.map(({ emoji }) => emoji);

/**
 * Los dos roles de la pareja. OJO: 'her'/'him' son CLAVES DE ALMACENAMIENTO
 * (no renombrar: hay datos persistidos). Cada persona accede solo a SU capa:
 * el rol se elige al entrar (puerta "¿Quién eres?") y se puede cambiar desde
 * Privacidad. Con las cuentas reales (Fase 2) esto será el login.
 */
export type Person = 'her' | 'him';

/**
 * Entrada del diario de un día. Compartido por diseño: ciclo (flow), estado
 * emocional y bienestar (qué sentó bien/mal — lenguaje de cuidado de la
 * pareja). Las notas siguen el modo de privacidad de su autora/autor.
 */
export interface DayEntry {
  date: ISODate;
  flow?: Flow;
  moodHer?: string;
  moodHim?: string;
  noteHer?: string;
  noteHim?: string;
  /** Candado por día — solo tiene efecto en modo "selección manual". */
  noteHerShared?: boolean;
  noteHimShared?: boolean;
  /** Bienestar: etiquetas separadas por comas ("paseo, manta, infusión"). */
  goodHer?: string;
  badHer?: string;
  goodHim?: string;
  badHim?: string;
}

/**
 * Resumen de un PUNTO del ciclo (no de una fecha). La clave es la coordenada
 * fase-consciente ("F4" = día 4 desde la regla; "B8" = 8 días antes de la
 * siguiente; "O0" = día de ovulación), así el mismo resumen aparece en todos
 * los días equivalentes de todos los ciclos. Manual y automático conviven.
 */
export interface CycleDayNote {
  summaryHer?: string;
  summaryHim?: string;
  autoSummaryHer?: string;
  autoSummaryHim?: string;
  /** Candado del resumen — solo tiene efecto en modo "selección manual". */
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
  autoSummaryKey: 'autoSummaryHer' | 'autoSummaryHim';
  summarySharedKey: 'summaryHerShared' | 'summaryHimShared';
  goodKey: 'goodHer' | 'goodHim';
  badKey: 'badHer' | 'badHim';
}

/** Mapea cada rol a sus campos, para escribir código simétrico. */
export const PERSON_META: Record<Person, PersonMeta> = {
  her: {
    label: 'Maya',
    emoji: '🌸',
    moodKey: 'moodHer',
    noteKey: 'noteHer',
    sharedKey: 'noteHerShared',
    summaryKey: 'summaryHer',
    autoSummaryKey: 'autoSummaryHer',
    summarySharedKey: 'summaryHerShared',
    goodKey: 'goodHer',
    badKey: 'badHer',
  },
  him: {
    label: 'Marcos',
    emoji: '🌊',
    moodKey: 'moodHim',
    noteKey: 'noteHim',
    sharedKey: 'noteHimShared',
    summaryKey: 'summaryHim',
    autoSummaryKey: 'autoSummaryHim',
    summarySharedKey: 'summaryHimShared',
    goodKey: 'goodHim',
    badKey: 'badHim',
  },
};

export const OTHER: Record<Person, Person> = { her: 'him', him: 'her' };

/**
 * Modo de privacidad de una persona sobre sus textos (notas y resúmenes):
 * - 'private': todo privado (los candados individuales no aplican)
 * - 'public':  todo compartido con la pareja
 * - 'manual':  decide candado a candado (🔒/👁️ por elemento)
 */
export type PrivacyMode = 'private' | 'public' | 'manual';

export const PRIVACY_MODES: { mode: PrivacyMode; label: string; icon: string }[] = [
  { mode: 'private', label: 'Todo privado', icon: '🔒' },
  { mode: 'public', label: 'Todo compartido', icon: '👁️' },
  { mode: 'manual', label: 'Selección manual', icon: '🎛️' },
];

/** Compartición efectiva de un elemento según el modo de su autor/a. */
export function effectiveShared(mode: PrivacyMode, explicit: boolean | undefined): boolean {
  if (mode === 'private') return false;
  if (mode === 'public') return true;
  return explicit ?? false;
}

export interface Settings {
  /** Duración típica de ciclo usada mientras no hay historial suficiente. */
  fallbackCycleLen: number;
  onboarded: boolean;
  /** Qué capa ve este dispositivo; se elige en la puerta de entrada. */
  perspective: Person;
  /** true cuando ya se pasó por la puerta "¿Quién eres?". */
  roleChosen: boolean;
  privacy: Record<Person, PrivacyMode>;
  /**
   * Radio de "días equivalentes": 0 = solo el día exacto, hasta ±3. Cada fase
   * tiene su propio tope (la regla es más rígida) y NUNCA se cruzan fases.
   */
  matchRadius: number;
}

export const DEFAULT_SETTINGS: Settings = {
  fallbackCycleLen: 28,
  onboarded: false,
  perspective: 'her',
  roleChosen: false,
  privacy: { her: 'public', him: 'public' },
  matchRadius: 2,
};
