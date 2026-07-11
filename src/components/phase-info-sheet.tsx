import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { PHASE_COLOR, PHASE_INFO, type Phase } from '@/lib/cycle';

interface Props {
  phase: Phase | null;
  onClose: () => void;
}

/**
 * Ficha divulgativa de una fase: qué ocurre en el cuerpo, en la mente, qué
 * comer y qué cuidados ayudan. Se abre desde la leyenda del calendario y
 * desde el "saber más" del día seleccionado — misma información en ambos.
 */
export function PhaseInfoSheet({ phase, onClose }: Props) {
  const palette = usePalette();
  if (!phase) return null;

  const info = PHASE_INFO[phase];
  const color = palette[PHASE_COLOR[phase].main];

  const section = (icon: string, title: string, text: string) => (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>
        {icon} {title}
      </ThemedText>
      <ThemedText type="small" style={styles.sectionBody}>
        {text}
      </ThemedText>
    </View>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.bar, { backgroundColor: color }]} />
              <View>
                <ThemedText style={[styles.title, { color }]}>{info.name}</ThemedText>
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  {info.hint}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={[styles.close, { color: palette.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {section('🫀', 'Qué ocurre en el cuerpo', info.body)}
            {section('🧠', 'Mente y ánimo', info.mind)}
            {section('🥗', 'Alimentación que ayuda', info.diet)}
            {section('💪', 'Cuidados y hábitos', info.care)}
            <ThemedText type="small" style={[styles.disclaimer, { color: palette.textSecondary }]}>
              Información divulgativa: cada cuerpo es distinto y esto no sustituye el
              consejo médico.
            </ThemedText>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  titleRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center', flex: 1 },
  bar: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  title: { fontSize: 24, fontWeight: '700' },
  close: { fontSize: 22, fontWeight: '700' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  section: { gap: Spacing.one },
  sectionTitle: { fontWeight: '700', fontSize: 16 },
  sectionBody: { lineHeight: 21 },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
});
