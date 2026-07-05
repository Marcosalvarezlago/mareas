import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DaySheet } from '@/components/day-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import { cycleDayOf, PHASE_INFO, phaseOf, type Phase } from '@/lib/cycle';
import { addDays, diffDays, formatShort, todayISO, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';
import { MOODS } from '@/lib/types';

export default function HomeScreen() {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const updateDay = useApp((s) => s.updateDay);
  const { starts, stats, prediction } = useCycle();
  const [sheetDate, setSheetDate] = useState<ISODate | null>(null);

  const today = todayISO();
  const entry = entries[today];
  const cycleDay = cycleDayOf(today, starts);
  const phase = phaseOf(today, entries, prediction);

  const phaseColor: Record<Phase, string> = {
    menstrual: palette.period,
    folicular: palette.tint,
    fertil: palette.fertile,
    lutea: palette.tint,
  };

  const moodQuickRow = (who: 'moodHer' | 'moodHim') => (
    <View style={styles.moodRow}>
      {MOODS.map((m) => {
        const selected = entry?.[who] === m;
        return (
          <Pressable
            key={m}
            onPress={() => updateDay(today, { [who]: selected ? undefined : m })}
            style={[
              styles.moodBtn,
              { backgroundColor: selected ? palette.tint : palette.backgroundElement },
            ]}>
            <Text style={{ fontSize: 18 }}>{m}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const daysToNext = prediction ? diffDays(today, prediction.nextStart) : null;
  const nextText =
    daysToNext == null
      ? ''
      : daysToNext > 0
        ? `en ${daysToNext} día${daysToNext === 1 ? '' : 's'}`
        : daysToNext === 0
          ? '¡hoy!'
          : `retraso de ${-daysToNext} día${daysToNext === -1 ? '' : 's'}`;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <ThemedText type="title" style={styles.brand}>
              Mareas 🌊
            </ThemedText>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              El ciclo, en la misma orilla
            </ThemedText>
          </View>

          {starts.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText style={styles.cardTitle}>
                Para empezar: ¿cuándo empezó la última regla?
              </ThemedText>
              <View style={styles.chipRow}>
                {[0, -1, -2, -3, -4, -5, -6, -7].map((offset) => {
                  const d = addDays(today, offset);
                  const label = offset === 0 ? 'Hoy' : offset === -1 ? 'Ayer' : formatShort(d);
                  return (
                    <Pressable
                      key={d}
                      onPress={() => updateDay(d, { flow: 2 })}
                      style={[styles.chip, { backgroundColor: palette.period }]}>
                      <Text style={styles.chipText}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                ¿Fue antes? Márcalo en la pestaña Calendario tocando el día.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {phase && (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.phaseRow}>
                    <View style={[styles.phaseBar, { backgroundColor: phaseColor[phase] }]} />
                    <View style={styles.phaseText}>
                      {cycleDay != null && (
                        <ThemedText type="title" style={styles.cycleDay}>
                          Día {cycleDay} del ciclo
                        </ThemedText>
                      )}
                      <ThemedText style={{ color: phaseColor[phase], fontWeight: '700' }}>
                        {PHASE_INFO[phase].name}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: palette.textSecondary }}>
                        {PHASE_INFO[phase].hint}
                      </ThemedText>
                    </View>
                  </View>
                </ThemedView>
              )}

              {prediction && (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.predRow}>
                    <ThemedText>🩸 Próxima regla</ThemedText>
                    <ThemedText style={{ fontWeight: '700' }}>
                      ~{formatShort(prediction.nextStart)} · {nextText}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: palette.textSecondary }}>
                    Incertidumbre: ±{prediction.uncertainty} día
                    {prediction.uncertainty === 1 ? '' : 's'}
                  </ThemedText>
                  <View style={styles.predRow}>
                    <ThemedText>⚡ Ventana fértil</ThemedText>
                    <ThemedText style={{ fontWeight: '700', color: palette.fertile }}>
                      {formatShort(prediction.fertileFrom)} – {formatShort(prediction.fertileTo)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: palette.textSecondary }}>
                    {stats.n > 0
                      ? `Estimado con ${stats.n} ciclo${stats.n === 1 ? '' : 's'} registrado${stats.n === 1 ? '' : 's'}`
                      : 'Aún poco historial: usando un ciclo típico de 28 días'}
                  </ThemedText>
                </ThemedView>
              )}

              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText style={styles.cardTitle}>¿Cómo va el día?</ThemedText>
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  🌸 Ella
                </ThemedText>
                {moodQuickRow('moodHer')}
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  🌊 Él
                </ThemedText>
                {moodQuickRow('moodHim')}

                <Pressable
                  onPress={() => setSheetDate(today)}
                  style={[styles.diaryBtn, { backgroundColor: palette.tint }]}>
                  <Text style={styles.diaryBtnText}>Abrir diario de hoy 📖</Text>
                </Pressable>
              </ThemedView>
            </>
          )}

          <ThemedText type="small" style={[styles.disclaimer, { color: palette.textSecondary }]}>
            Las predicciones son estimaciones estadísticas. Mareas no sirve como método
            anticonceptivo ni sustituye el consejo médico.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <DaySheet date={sheetDate} onClose={() => setSheetDate(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  hero: { alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  brand: { fontSize: 30 },
  card: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardTitle: { fontWeight: '700', fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  chipText: { color: '#fff', fontWeight: '600' },
  phaseRow: { flexDirection: 'row', gap: Spacing.three },
  phaseBar: { width: 5, borderRadius: 3 },
  phaseText: { gap: 2, flex: 1 },
  cycleDay: { fontSize: 24 },
  predRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  moodBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryBtn: {
    marginTop: Spacing.two,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  diaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
});
