// Estado global de la app con persistencia automática: cada cambio se
// guarda en el almacenamiento del dispositivo (AsyncStorage) y sobrevive
// a cierres de la app. Mañana esta misma forma se sincroniza con Supabase.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ISODate } from './dates';
import { DEFAULT_SETTINGS, type DayEntry, type Settings } from './types';

interface AppState {
  entries: Record<ISODate, DayEntry>;
  settings: Settings;
  updateDay: (date: ISODate, patch: Partial<Omit<DayEntry, 'date'>>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearAll: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      entries: {},
      settings: DEFAULT_SETTINGS,

      updateDay: (date, patch) =>
        set((s) => ({
          entries: {
            ...s.entries,
            [date]: { ...(s.entries[date] ?? { date }), ...patch },
          },
        })),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      clearAll: () => set({ entries: {}, settings: { ...DEFAULT_SETTINGS } }),
    }),
    {
      name: 'mareas-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
