import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import { cycleDayOf } from '@/lib/cycle';
import { formatLong, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';
import { FLOW_LABELS, MOOD_OPTIONS, type Flow } from '@/lib/types';

interface Props {
  date: ISODate | null;
  onClose: () => void;
}

/** Hoja de diario de un día: regla, estado emocional de ambos y notas. */
export function DaySheet({ date, onClose }: Props) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const updateDay = useApp((s) => s.updateDay);
  const { starts } = useCycle();

  if (!date) return null;

  const entry = entries[date];
  const cycleDay = cycleDayOf(date, starts);

  const setFlow = (f: Flow) => updateDay(date, { flow: entry?.flow === f ? 0 : f });
  const setMood = (who: 'moodHer' | 'moodHim', m: string) =>
    updateDay(date, { [who]: entry?.[who] === m ? undefined : m });

  const moodRow = (who: 'moodHer' | 'moodHim') => (
    <View style={styles.moodRow}>
      {MOOD_OPTIONS.map(({ emoji, label }) => {
        const selected = entry?.[who] === emoji;
        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`Estado: ${label}`}
            accessibilityState={{ selected }}
            onPress={() => setMood(who, emoji)}
            style={[
              styles.moodBtn,
              { backgroundColor: selected ? palette.tint : palette.backgroundElement },
            ]}>
            <Text style={styles.moodEmoji}>{emoji}</Text>
            <Text
              numberOfLines={1}
              style={[styles.moodLabel, { color: selected ? '#fff' : palette.textSecondary }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const noteInput = (who: 'noteHer' | 'noteHim', placeholder: string) => (
    <TextInput
      multiline
      value={entry?.[who] ?? ''}
      onChangeText={(t) => updateDay(date, { [who]: t })}
      placeholder={placeholder}
      placeholderTextColor={palette.textSecondary}
      style={[
        styles.note,
        { backgroundColor: palette.backgroundElement, color: palette.text },
      ]}
    />
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={styles.safe}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
              <View>
                <ThemedText type="title" style={styles.title}>
                  {formatLong(date)}
                </ThemedText>
                {cycleDay != null && (
                  <ThemedText type="small" style={{ color: palette.textSecondary }}>
                    Día {cycleDay} del ciclo
                  </ThemedText>
                )}
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <ThemedText type="title" style={{ color: palette.textSecondary }}>
                  ✕
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled">
              <ThemedText style={styles.section}>🩸 Regla</ThemedText>
              <View style={styles.chipRow}>
                {FLOW_LABELS.map((label, i) => {
                  const selected = (entry?.flow ?? 0) === i && i > 0;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setFlow(i as Flow)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? palette.period : palette.backgroundElement,
                        },
                      ]}>
                      <Text
                        style={{
                          color: selected ? '#fff' : palette.text,
                          fontWeight: '600',
                        }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText style={styles.section}>🌸 Ella — ¿cómo está?</ThemedText>
              {moodRow('moodHer')}
              {noteInput('noteHer', 'Nota de ella…')}

              <ThemedText style={styles.section}>🌊 Él — ¿cómo está?</ThemedText>
              {moodRow('moodHim')}
              {noteInput('noteHim', 'Nota de él…')}

              <Pressable
                onPress={onClose}
                style={[styles.done, { backgroundColor: palette.tint }]}>
                <Text style={styles.doneText}>Listo</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
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
  },
  title: { fontSize: 22 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  section: {
    marginTop: Spacing.four,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  moodRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  moodBtn: {
    width: 68,
    minHeight: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  moodEmoji: { fontSize: 21 },
  moodLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  note: {
    borderRadius: 12,
    padding: Spacing.three,
    minHeight: 64,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  done: {
    marginTop: Spacing.five,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
