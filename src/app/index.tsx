import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CycleCalendar } from '@/components/cycle-calendar';
import { DayPanel } from '@/components/day-panel';
import { PrivacyCard } from '@/components/privacy-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { todayISO, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';
import { PERSON_META, type Person } from '@/lib/types';

/** Puerta de entrada: cada persona accede solo a su capa. */
function RoleGate() {
  const palette = usePalette();
  const updateSettings = useApp((s) => s.updateSettings);

  return (
    <View style={styles.gateWrap}>
      <ThemedText style={styles.brand}>Mareas 🌊</ThemedText>
      <ThemedText type="small" style={{ color: palette.textSecondary }}>
        El ciclo, en la misma orilla
      </ThemedText>
      <ThemedView type="backgroundElement" style={[styles.card, styles.gateCard]}>
        <ThemedText style={styles.gateTitle}>¿Quién eres?</ThemedText>
        {(['her', 'him'] as Person[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => updateSettings({ perspective: p, roleChosen: true })}
            style={[styles.gateBtn, { backgroundColor: palette.tint }]}>
            <Text style={styles.gateBtnTxt}>
              {PERSON_META[p].emoji} {PERSON_META[p].label}
            </Text>
          </Pressable>
        ))}
        <ThemedText type="small" style={{ color: palette.textSecondary, textAlign: 'center' }}>
          Cada persona ve solo su capa: lo tuyo editable, del otro lo que comparta.
          Podrás cambiar de usuario desde Privacidad.
        </ThemedText>
      </ThemedView>
    </View>
  );
}

export default function HomeScreen() {
  const palette = usePalette();
  const me = useApp((s) => s.settings.perspective);
  const roleChosen = useApp((s) => s.settings.roleChosen);
  const [selected, setSelected] = useState<ISODate>(todayISO());
  const [privOpen, setPrivOpen] = useState(false);
  const [privHint, setPrivHint] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const requestPrivacy = (hint: string) => {
    setPrivHint(hint);
    setPrivOpen(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const meMeta = PERSON_META[me];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {!roleChosen ? (
          <RoleGate />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {/* Cabecera: marca + capa activa */}
            <View style={styles.header}>
              <ThemedText style={styles.brand}>Mareas 🌊</ThemedText>
              <Pressable
                onPress={() => setPrivOpen((v) => !v)}
                style={[styles.who, { backgroundColor: palette.backgroundElement }]}>
                <ThemedText type="small" style={{ fontWeight: '700' }}>
                  {meMeta.emoji} {meMeta.label}
                </ThemedText>
              </Pressable>
            </View>

            {/* Privacidad arriba, plegada por defecto */}
            <PrivacyCard
              open={privOpen}
              onToggleOpen={() => setPrivOpen((v) => !v)}
              hint={privHint}
              onClearHint={() => setPrivHint(null)}
            />

            {/* Calendario (aquí irán las alarmas seleccionables) */}
            <ThemedView type="backgroundElement" style={styles.calCard}>
              <CycleCalendar selectedDate={selected} onSelect={setSelected} />
            </ThemedView>

            {/* Info del día seleccionado */}
            <DayPanel date={selected} onRequestPrivacy={requestPrivacy} />

            <ThemedText type="small" style={[styles.disclaimer, { color: palette.textSecondary }]}>
              Las predicciones son estimaciones estadísticas. Mareas no sirve como método
              anticonceptivo ni sustituye el consejo médico.
            </ThemedText>
          </ScrollView>
        )}
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
  who: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  calCard: { borderRadius: 18, padding: Spacing.three },
  disclaimer: { textAlign: 'center', marginTop: Spacing.one },
  gateWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  card: { borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  gateCard: { alignSelf: 'stretch', marginTop: Spacing.four },
  gateTitle: { fontWeight: '700', fontSize: 18, textAlign: 'center' },
  gateBtn: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  gateBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
