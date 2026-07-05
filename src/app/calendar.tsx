import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DaySheet } from '@/components/day-sheet';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { monthLabel, type ISODate } from '@/lib/dates';

export default function CalendarScreen() {
  const palette = usePalette();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sheetDate, setSheetDate] = useState<ISODate | null>(null);

  const shift = (delta: number) => {
    setYm(({ y, m }) => {
      const t = y * 12 + m + delta;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });
  };

  const legend = [
    { swatch: { backgroundColor: palette.period }, label: 'Regla' },
    {
      swatch: {
        borderWidth: 1.5,
        borderStyle: 'dashed' as const,
        borderColor: palette.period,
      },
      label: 'Prevista',
    },
    { swatch: { backgroundColor: palette.fertileSoft }, label: 'Ventana fértil' },
    {
      swatch: { borderWidth: 2, borderColor: palette.tint },
      label: 'Hoy',
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.nav}>
          <Pressable onPress={() => shift(-1)} hitSlop={12} style={styles.arrow}>
            <ThemedText type="title" style={{ color: palette.tint }}>
              ‹
            </ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.monthTitle}>
            {monthLabel(ym.y, ym.m)}
          </ThemedText>
          <Pressable onPress={() => shift(1)} hitSlop={12} style={styles.arrow}>
            <ThemedText type="title" style={{ color: palette.tint }}>
              ›
            </ThemedText>
          </Pressable>
        </View>

        <MonthCalendar year={ym.y} month0={ym.m} onPressDay={setSheetDate} />

        <View style={styles.legend}>
          {legend.map(({ swatch, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.swatch, swatch]} />
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                {label}
              </ThemedText>
            </View>
          ))}
        </View>

        <ThemedText type="small" style={[styles.hint, { color: palette.textSecondary }]}>
          Toca cualquier día para abrir su diario y marcar la regla.
        </ThemedText>
      </SafeAreaView>

      <DaySheet date={sheetDate} onClose={() => setSheetDate(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safe: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  arrow: { paddingHorizontal: Spacing.three },
  monthTitle: { fontSize: 20, textTransform: 'capitalize' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.four,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 16, height: 16, borderRadius: 6 },
  hint: { textAlign: 'center', marginTop: Spacing.three },
});
