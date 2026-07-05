import { useMemo } from 'react';

import {
  avgPeriodLen,
  cycleStarts,
  cycleStats,
  predict,
  type CycleStats,
  type Prediction,
} from '@/lib/cycle';
import { useApp } from '@/lib/store';
import type { ISODate } from '@/lib/dates';

export interface CycleModel {
  starts: ISODate[];
  stats: CycleStats;
  prediction: Prediction | null;
}

/** Modelo del ciclo derivado del diario; se recalcula solo cuando cambian los datos. */
export function useCycle(): CycleModel {
  const entries = useApp((s) => s.entries);
  const fallbackLen = useApp((s) => s.settings.fallbackCycleLen);

  return useMemo(() => {
    const starts = cycleStarts(entries);
    const stats = cycleStats(starts, fallbackLen);
    const prediction = predict(starts, stats, avgPeriodLen(entries));
    return { starts, stats, prediction };
  }, [entries, fallbackLen]);
}
