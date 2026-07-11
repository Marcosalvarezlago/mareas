import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PhaseInfoSheet } from '@/components/phase-info-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import { dayPhase, PHASE_COLOR, type Phase } from '@/lib/cycle';
import { monthGrid, monthLabel, todayISO, WEEKDAYS_MIN, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';

interface Props {
  selectedDate: ISODate;
  onSelect: (date: ISODate) => void;
}

/**
 * Calendario real con las fases pintadas en todos los días. Lo REGISTRADO va
 * a color pleno; lo PROYECTADO (futuro, o estimaciones) va atenuado — esa es
 * la marca de "previsto", sin entrada aparte en la leyenda. La ovulación
 * estimada lleva su propio anillo. Pulsación larga (solo Maya, ≤ hoy):
 * marca/quita regla. Tocar una fase en la leyenda abre su ficha divulgativa.
 */
export function CycleCalendar({ selectedDate, onSelect }: Props) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const updateDay = useApp((s) => s.updateDay);
  const me = useApp((s) => s.settings.perspective);
  const { windows, periodLen } = useCycle();
  const today = todayISO();
  const [infoPhase, setInfoPhase] = useState<Phase | null>(null);

  const [view, setView] = useState(() => ({
    y: Number(selectedDate.slice(0, 4)),
    m: Number(selectedDate.slice(5, 7)) - 1,
  }));

  // Si el día seleccionado salta a otro mes, el calendario lo sigue.
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
  const ovulationDays = new Set(windows.filter((w) => w.valid).map((w) => w.ovulation));

  // Leyenda en el orden del ciclo; las fases abren su ficha divulgativa.
  const legend: { sw: object; label: string; phase?: Phase }[] = [
    { sw: { backgroundColor: palette.period }, label: 'Regla', phase: 'menstrual' },
    { sw: { backgroundColor: palette.follicularSoft }, label: 'Folicular', phase: 'folicular' },
    { sw: { backgroundColor: palette.fertileSoft }, label: 'Fértil', phase: 'fertil' },
    { sw: { borderWidth: 2, borderColor: palette.fertile }, label: 'Ovulación', phase: 'fertil' },
    { sw: { backgroundColor: palette.luteaSoft }, label: 'Lútea', phase: 'lutea' },
    { sw: { borderWidth: 2, borderColor: palette.tint }, label: 'Hoy' },
  ];

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
          const isOvulation = ovulationDays.has(date);
          const dp = dayPhase(date, entries, windows, periodLen);

          const dayStyle: object[] = [styles.day];
          let numColor: string = palette.text;

          if (dp) {
            dayStyle.push({ backgroundColor: palette[PHASE_COLOR[dp.phase].soft] });
            if (dp.phase === 'menstrual' && dp.projected) {
              // Regla prevista: además de la atenuación, borde discontinuo.
              dayStyle.push({
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: palette.period,
              });
              numColor = palette.period;
            }
          }
          if (realFlow) {
            dayStyle.push({
              backgroundColor: palette.period,
              opacity: 0.55 + (entry?.flow ?? 2) * 0.15,
            });
            numColor = '#ffffff';
          }
          // Todo lo proyectado va ATENUADO: así se distingue de lo registrado.
          if (dp?.projected && !realFlow) {
            dayStyle.push({ opacity: 0.55 });
          }
          if (isOvulation) {
            dayStyle.push({ borderWidth: 2, borderStyle: 'solid', borderColor: palette.fertile });
          }
          if (isToday) {
            dayStyle.push({ borderWidth: 2, borderStyle: 'solid', borderColor: palette.tint });
          } else if (isSelected) {
            dayStyle.push({ borderWidth: 2, borderStyle: 'solid', borderColor: palette.text });
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
        {legend.map(({ sw, label, phase }) => (
          <Pressable
            key={label}
            style={styles.legendItem}
            onPress={phase ? () => setInfoPhase(phase) : undefined}
            hitSlop={6}>
            <View style={[styles.swatch, sw]} />
            <ThemedText
              type="small"
              style={{ color: phase ? palette.tint : palette.textSecondary }}>
              {label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" style={[styles.hint, { color: palette.textSecondary }]}>
        Lo atenuado es previsión, no registro. Toca una fase de la leyenda para saber más.
        {me === 'her' ? '\n💡 Mantén pulsado un día (de hoy hacia atrás) para marcar o quitar la regla.' : ''}
      </ThemedText>

      <PhaseInfoSheet phase={infoPhase} onClose={() => setInfoPhase(null)} />
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
