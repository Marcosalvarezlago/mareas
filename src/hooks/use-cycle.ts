import { useMemo } from 'react';

import {
  avgPeriodLen,
  buildWindows,
  cycleStarts,
  cycleStats,
  predict,
  type CycleStats,
  type CycleWindow,
  type Prediction,
} from '@/lib/cycle';
import type { ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';

export interface CycleModel {
  starts: ISODate[];
  stats: CycleStats;
  /** Duración típica de la regla (días de sangrado). */
  periodLen: number;
  /** Ciclos históricos + proyectados, para pintar y clasificar cualquier fecha. */
  windows: CycleWindow[];
  prediction: Prediction | null;
}

/** Modelo del ciclo derivado del diario; se recalcula solo cuando cambian los datos. */
export function useCycle(): CycleModel {
  const entries = useApp((s) => s.entries);
  const fallbackLen = useApp((s) => s.settings.fallbackCycleLen);

  return useMemo(() => {
    const starts = cycleStarts(entries);
    const stats = cycleStats(starts, fallbackLen);
    const periodLen = avgPeriodLen(entries);
    const windows = buildWindows(starts, stats);
    const prediction = predict(starts, stats, periodLen);
    return { starts, stats, periodLen, windows, prediction };
  }, [entries, fallbackLen]);
}
