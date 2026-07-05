import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import { addDays, isBetween, monthGrid, todayISO, WEEKDAYS_MIN, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';

interface Props {
  year: number;
  month0: number;
  onPressDay: (date: ISODate) => void;
}

export function MonthCalendar({ year, month0, onPressDay }: Props) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const { prediction } = useCycle();
  const today = todayISO();

  const cells = monthGrid(year, month0);
  const predictedTo = prediction ? addDays(prediction.nextStart, prediction.periodLen - 1) : null;

  return (
    <View>
      <View style={styles.row}>
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
          const isFertile =
            prediction && isBetween(date, prediction.fertileFrom, prediction.fertileTo);
          const isPredicted =
            prediction && predictedTo && isBetween(date, prediction.nextStart, predictedTo);

          const dayStyle: object[] = [styles.day];
          let numColor: string = palette.text;

          if (isFertile) dayStyle.push({ backgroundColor: palette.fertileSoft });
          if (isPredicted) {
            dayStyle.push({
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: palette.period,
            });
            numColor = palette.period;
          }
          if (flow > 0) {
            dayStyle.push({
              backgroundColor: palette.period,
              opacity: 0.55 + flow * 0.15,
            });
            numColor = '#ffffff';
          }
          if (isToday) {
            dayStyle.push({ borderWidth: 2, borderStyle: 'solid', borderColor: palette.tint });
          }

          return (
            <Pressable key={i} style={styles.cell} onPress={() => onPressDay(date)}>
              <View style={dayStyle}>
                <Text style={[styles.num, { color: numColor }]}>{Number(date.slice(8))}</Text>
                <Text style={styles.mood}>{mood ?? ' '}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.half,
  },
  day: {
    width: 44,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    fontSize: 15,
    fontWeight: '600',
  },
  mood: {
    fontSize: 10,
    height: 13,
  },
});
