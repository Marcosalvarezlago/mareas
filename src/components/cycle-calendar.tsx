import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import { dayPhase, PHASE_COLOR } from '@/lib/cycle';
import { monthGrid, monthLabel, todayISO, WEEKDAYS_MIN, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';

interface Props {
  selectedDate: ISODate;
  onSelect: (date: ISODate) => void;
}

/**
 * Calendario real (mes/año navegables) con las fases del ciclo pintadas en
 * TODOS los días — pasados, presentes y futuros (proyección multi-ciclo).
 * Pulsación larga sobre un día (solo ella, y nunca en el futuro): marca/quita regla.
 */
export function CycleCalendar({ selectedDate, onSelect }: Props) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const updateDay = useApp((s) => s.updateDay);
  const me = useApp((s) => s.settings.perspective);
  const { windows, periodLen } = useCycle();
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

  const toggleFlow = (date: ISODate) =>
    updateDay(date, { flow: (entries[date]?.flow ?? 0) > 0 ? 0 : 2 });

  const cells = monthGrid(view.y, view.m);

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
        {WEEKDAYS_MIN.map((w) => (
          <View key={w} style={styles.cell}>
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
          const realFlow = (entry?.flow ?? 0) > 0;
          const mood = entry?.moodHer ?? entry?.moodHim;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const dp = dayPhase(date, entries, windows, periodLen);

          const dayStyle: object[] = [styles.day];
          let numColor: string = palette.text;

          if (dp) {
            // Fondo suave según fase (también en meses futuros).
            dayStyle.push({ backgroundColor: palette[PHASE_COLOR[dp.phase].soft] });
            if (dp.phase === 'menstrual' && dp.projected) {
              // Regla prevista: borde discontinuo coral.
              dayStyle.push({
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: palette.period,
              });
              numColor = palette.period;
            }
          }
          if (realFlow) {
            // Regla registrada: coral sólido, intensidad → opacidad.
            dayStyle.push({
              backgroundColor: palette.period,
              opacity: 0.55 + (entry?.flow ?? 2) * 0.15,
            });
            numColor = '#ffffff';
          }
          if (isToday || isSelected) {
            dayStyle.push({ borderWidth: 2, borderStyle: 'solid', borderColor: palette.tint });
          }

          const canQuickMark = me === 'her' && date <= today;

          return (
            <Pressable
              key={i}
              style={styles.cell}
              onPress={() => onSelect(date)}
              onLongPress={canQuickMark ? () => toggleFlow(date) : undefined}
              delayLongPress={350}>
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
          {
            sw: {
              borderWidth: 1.5,
              borderStyle: 'dashed' as const,
              borderColor: palette.period,
              backgroundColor: palette.periodSoft,
            },
            label: 'Prevista',
          },
          { sw: { backgroundColor: palette.fertileSoft }, label: 'Fértil' },
          { sw: { backgroundColor: palette.follicularSoft }, label: 'Folicular' },
          { sw: { backgroundColor: palette.luteaSoft }, label: 'Lútea' },
          { sw: { borderWidth: 2, borderColor: palette.tint }, label: 'Hoy' },
        ].map(({ sw, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.swatch, sw]} />
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>

      {me === 'her' && (
        <ThemedText type="small" style={[styles.hint, { color: palette.textSecondary }]}>
          💡 Mantén pulsado un día (de hoy hacia atrás) para marcar o quitar la regla.
        </ThemedText>
      )}
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
    gap: Spacing.two,
    rowGap: Spacing.one,
    marginTop: Spacing.three,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 14, height: 14, borderRadius: 5 },
  hint: { textAlign: 'center', marginTop: Spacing.two },
});
