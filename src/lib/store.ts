// Estado global de la app con persistencia automática: cada cambio se
// guarda en el almacenamiento del dispositivo (AsyncStorage) y sobrevive
// a cierres de la app. En la Fase 2 esta misma forma se sincroniza con Supabase.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ISODate } from './dates';
import {
  DEFAULT_SETTINGS,
  type CycleDayNote,
  type DayEntry,
  type PrivacyMode,
  type Settings,
} from './types';

interface AppState {
  entries: Record<ISODate, DayEntry>;
  /**
   * Resúmenes por PUNTO del ciclo. Clave = coordenada fase-consciente
   * ("F4", "B8", "O0" — ver coordKeyOf en cycle.ts), así el mismo resumen
   * vale para todos los días equivalentes de todos los ciclos.
   */
  cycleNotes: Record<string, CycleDayNote>;
  settings: Settings;
  updateDay: (date: ISODate, patch: Partial<Omit<DayEntry, 'date'>>) => void;
  updateCycleNote: (coordKey: string, patch: Partial<CycleDayNote>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearAll: () => void;
}

/** Migra formatos antiguos guardados: claves numéricas y privacidad booleana. */
function migrate(p: Partial<AppState>): Partial<AppState> {
  if (p.cycleNotes) {
    const notes: Record<string, CycleDayNote> = {};
    for (const [k, v] of Object.entries(p.cycleNotes)) {
      notes[/^[FBO]/.test(k) ? k : `F${k}`] = v; // "5" (día fijo) → "F5"
    }
    p = { ...p, cycleNotes: notes };
  }
  if (p.settings?.privacy) {
    const priv = { ...p.settings.privacy } as Record<string, unknown>;
    for (const person of ['her', 'him'] as const) {
      if (typeof priv[person] !== 'string') priv[person] = 'manual';
    }
    p = { ...p, settings: { ...p.settings, privacy: priv as Record<'her' | 'him', PrivacyMode> } };
  }
  return p;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      entries: {},
      cycleNotes: {},
      settings: DEFAULT_SETTINGS,

      updateDay: (date, patch) =>
        set((s) => ({
          entries: {
            ...s.entries,
            [date]: { ...(s.entries[date] ?? { date }), ...patch },
          },
        })),

      updateCycleNote: (coordKey, patch) =>
        set((s) => ({
          cycleNotes: {
            ...s.cycleNotes,
            [coordKey]: { ...(s.cycleNotes[coordKey] ?? {}), ...patch },
          },
        })),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      clearAll: () =>
        set({ entries: {}, cycleNotes: {}, settings: { ...DEFAULT_SETTINGS } }),
    }),
    {
      name: 'mareas-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = migrate((persisted ?? {}) as Partial<AppState>);
        return {
          ...current,
          ...p,
          settings: {
            ...current.settings,
            ...(p.settings ?? {}),
            privacy: {
              ...current.settings.privacy,
              ...(p.settings?.privacy ?? {}),
            },
          },
          entries: p.entries ?? current.entries,
          cycleNotes: p.cycleNotes ?? current.cycleNotes,
        };
      },
    },
  ),
);
