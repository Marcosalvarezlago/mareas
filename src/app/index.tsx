import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CycleCalendar } from '@/components/cycle-calendar';
import { DayPanel } from '@/components/day-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { todayISO, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';
import { PERSON_META, type Person } from '@/lib/types';

export default function HomeScreen() {
  const palette = usePalette();
  const me = useApp((s) => s.settings.perspective);
  const updateSettings = useApp((s) => s.updateSettings);
  const [selected, setSelected] = useState<ISODate>(todayISO());

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Cabecera: marca + selector de quién usa la app */}
          <View style={styles.header}>
            <ThemedText style={styles.brand}>Mareas 🌊</ThemedText>
            <View style={[styles.toggle, { backgroundColor: palette.backgroundElement }]}>
              {(['her', 'him'] as Person[]).map((p) => {
                const active = me === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => updateSettings({ perspective: p })}
                    style={[styles.toggleBtn, active && { backgroundColor: palette.tint }]}>
                    <ThemedText
                      type="small"
                      style={{ color: active ? '#fff' : palette.textSecondary, fontWeight: '700' }}>
                      {PERSON_META[p].emoji} {PERSON_META[p].label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Calendario arriba (aquí irán las alarmas seleccionables) */}
          <ThemedView type="backgroundElement" style={styles.calCard}>
            <CycleCalendar selectedDate={selected} onSelect={setSelected} />
          </ThemedView>

          {/* Info del día seleccionado */}
          <DayPanel date={selected} />

          <ThemedText type="small" style={[styles.disclaimer, { color: palette.textSecondary }]}>
            Las predicciones son estimaciones estadísticas. Mareas no sirve como método
            anticonceptivo ni sustituye el consejo médico.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { fontSize: 24, fontWeight: '700' },
  toggle: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  toggleBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999 },
  calCard: { borderRadius: 18, padding: Spacing.three },
  disclaimer: { textAlign: 'center', marginTop: Spacing.one },
});
