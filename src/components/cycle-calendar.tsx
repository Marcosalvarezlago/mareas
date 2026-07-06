import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import {
  addDays,
  isBetween,
  monthGrid,
  monthLabel,
  todayISO,
  WEEKDAYS_MIN,
  type ISODate,
} from '@/lib/dates';
import { useApp } from '@/lib/store';

interface Props {
  selectedDate: ISODate;
  onSelect: (date: ISODate) => void;
}

/** Calendario real (Gregoriano) con navegación de mes/año y capas del ciclo. */
export function CycleCalendar({ selectedDate, onSelect }: Props) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const { prediction } = useCycle();
  const today = todayISO();

  const [view, setView] = useState(() => ({
    y: Number(selectedDate.slice(0, 4)),
    m: Number(selectedDate.slice(5, 7)) - 1,
  }));

  // Si el día seleccionado salta a otro mes (p. ej. desde la memoria cíclica),
  // el calendario lo sigue.
  useEffect(() => {
    setView({ y: Number(selectedDate.slice(0, 4)), m: Number(selectedDate.slice(5, 7)) - 1 });
  }, [selectedDate]);

  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const t = y * 12 + m + delta;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });

  const cells = monthGrid(view.y, view.m);
  const predictedTo = prediction ? addDays(prediction.nextStart, prediction.periodLen - 1) : null;

  return (
    <View>
      <View style={styles.nav}>
        <Pressable onPress={() => shift(-1)} hitSlop={12} style={styles.arrow}>
          <Text style={[styles.arrowTxt, { color: palette.tint }]}>‹</Text>
        </Pressable>
        <ThemedText style={styles.month}>{monthLabel(view.y, view.m)}</ThemedText>
        <Pressable onPress={() => shift(1)} hitSlop={12} style={styles.arrow}>
          <Text style={[styles.arrowTxt, { color: palette.tint }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEKDAYS_MIN.map((w, i) => (
          <View key={i} style={styles.cell}>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              {w}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />;

          const entry = entries[date];
          const flow = entry?.flow ?? 0;
          const mood = entry?.moodHer ?? entry?.moodHim;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const isFertile =
            prediction && isBetween(date, prediction.fertileFrom, prediction.fertileTo);
          const isPredicted =
            prediction && predictedTo && isBetween(date, prediction.nextStart, predictedTo);

          const dayStyle: object[] = [styles.day];
          let numColor: string = palette.text;

          if (isSelected) dayStyle.push({ backgroundColor: palette.backgroundSelected });
          if (isFertile) dayStyle.push({ backgroundColor: palette.fertileSoft });
          if (isPredicted) {
            dayStyle.push({ borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.period });
            numColor = palette.period;
          }
          if (flow > 0) {
            dayStyle.push({ backgroundColor: palette.period, opacity: 0.55 + flow * 0.15 });
            numColor = '#ffffff';
          }
          if (isToday || isSelected) {
            dayStyle.push({ borderWidth: 2, borderColor: palette.tint });
          }

          return (
            <Pressable key={i} style={styles.cell} onPress={() => onSelect(date)}>
              <View style={dayStyle}>
                <Text style={[styles.num, { color: numColor }]}>{Number(date.slice(8))}</Text>
                <Text style={styles.mood}>{mood ?? ' '}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        {[
          { sw: { backgroundColor: palette.period }, label: 'Regla' },
          { sw: { borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: palette.period }, label: 'Prevista' },
          { sw: { backgroundColor: palette.fertileSoft }, label: 'Fértil' },
          { sw: { borderWidth: 2, borderColor: palette.tint }, label: 'Hoy/sel.' },
        ].map(({ sw, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.swatch, sw]} />
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  arrow: { paddingHorizontal: Spacing.three },
  arrowTxt: { fontSize: 28, fontWeight: '700', lineHeight: 32 },
  month: { fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  week: { flexDirection: 'row', marginBottom: Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.half,
  },
  day: {
    width: 42,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontSize: 15, fontWeight: '600' },
  mood: { fontSize: 10, height: 13 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 14, height: 14, borderRadius: 5 },
});
