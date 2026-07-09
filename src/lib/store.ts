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
  type Settings,
} from './types';

interface AppState {
  entries: Record<ISODate, DayEntry>;
  /** Resúmenes por día-de-ciclo (clave = día N del ciclo, no una fecha). */
  cycleNotes: Record<number, CycleDayNote>;
  settings: Settings;
  updateDay: (date: ISODate, patch: Partial<Omit<DayEntry, 'date'>>) => void;
  updateCycleNote: (cycleDay: number, patch: Partial<CycleDayNote>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearAll: () => void;
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

      updateCycleNote: (cycleDay, patch) =>
        set((s) => ({
          cycleNotes: {
            ...s.cycleNotes,
            [cycleDay]: { ...(s.cycleNotes[cycleDay] ?? {}), ...patch },
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
      // Rellena claves nuevas (privacy, cycleNotes…) al rehidratar datos
      // guardados con una versión anterior del esquema.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
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
