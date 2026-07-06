import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import { cycleDayOf, cyclicMemories, PHASE_INFO, phaseOf, type Phase } from '@/lib/cycle';
import { formatLong, formatShort, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';
import { FLOW_LABELS, MOODS, OTHER, PERSON_META, type DayEntry, type Flow } from '@/lib/types';

/** Info del día seleccionado: general arriba, diario debajo, y memoria cíclica. */
export function DayPanel({ date }: { date: ISODate }) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const updateDay = useApp((s) => s.updateDay);
  const me = useApp((s) => s.settings.perspective);
  const { starts, prediction } = useCycle();

  const entry = entries[date];
  const cd = cycleDayOf(date, starts);
  const phase = phaseOf(date, entries, prediction);
  const meMeta = PERSON_META[me];
  const otherMeta = PERSON_META[OTHER[me]];

  const myMood = entry?.[meMeta.moodKey];
  const myNote = entry?.[meMeta.noteKey] ?? '';
  const myShared = entry?.[meMeta.sharedKey] ?? false;
  const otherMood = entry?.[otherMeta.moodKey];
  const otherNote = entry?.[otherMeta.noteKey];
  const otherShared = entry?.[otherMeta.sharedKey] ?? false;

  const memories = cyclicMemories(date, entries, starts).slice(0, 6);

  const patchMood = (m?: string) => {
    const p: Partial<DayEntry> = {};
    p[meMeta.moodKey] = m;
    updateDay(date, p);
  };
  const patchNote = (t: string) => {
    const p: Partial<DayEntry> = {};
    p[meMeta.noteKey] = t;
    updateDay(date, p);
  };
  const toggleShare = () => {
    const p: Partial<DayEntry> = {};
    p[meMeta.sharedKey] = !myShared;
    updateDay(date, p);
  };
  const setFlow = (f: Flow) => updateDay(date, { flow: (entry?.flow ?? 0) === f ? 0 : f });

  const phaseColors: Record<Phase, string> = {
    menstrual: palette.period,
    folicular: palette.tint,
    fertil: palette.fertile,
    lutea: palette.tint,
  };
  const phaseColor = phase ? phaseColors[phase] : palette.textSecondary;

  return (
    <View style={styles.wrap}>
      {/* ---------- INFO GENERAL ---------- */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.date}>{formatLong(date)}</ThemedText>
        {cd != null ? (
          <View style={styles.phaseRow}>
            <View style={[styles.bar, { backgroundColor: phaseColor }]} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.cd}>Día {cd} del ciclo</ThemedText>
              {phase && (
                <ThemedText style={{ color: phaseColor, fontWeight: '700' }}>
                  {PHASE_INFO[phase].name}
                </ThemedText>
              )}
              {phase && (
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  {PHASE_INFO[phase].hint}
                </ThemedText>
              )}
            </View>
            <View style={styles.peek}>
              <Text style={styles.peekTxt}>{PERSON_META.her.emoji}{entry?.moodHer ?? '·'}</Text>
              <Text style={styles.peekTxt}>{PERSON_META.him.emoji}{entry?.moodHim ?? '·'}</Text>
            </View>
          </View>
        ) : (
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {me === 'her'
              ? 'Aún no hay reglas registradas. Marca abajo tu primer día de regla 👇'
              : 'Ella aún no ha registrado su ciclo.'}
          </ThemedText>
        )}
      </ThemedView>

      {/* ---------- DIARIO ---------- */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.h}>📖 Diario del día</ThemedText>

        {/* Regla (la registra ella) */}
        <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
          🩸 Regla{me === 'him' ? ' · la registra ella' : ''}
        </ThemedText>
        {me === 'her' ? (
          <View style={styles.chipRow}>
            {FLOW_LABELS.map((label, i) => {
              const sel = (entry?.flow ?? 0) === i && i > 0;
              return (
                <Pressable
                  key={label}
                  onPress={() => setFlow(i as Flow)}
                  style={[styles.chip, { backgroundColor: sel ? palette.period : palette.background }]}>
                  <Text style={{ color: sel ? '#fff' : palette.text, fontWeight: '600' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ThemedText>{FLOW_LABELS[entry?.flow ?? 0]}</ThemedText>
        )}

        {/* Mi estado */}
        <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
          {meMeta.emoji} ¿Cómo estás, {meMeta.label}?
        </ThemedText>
        <View style={styles.moodRow}>
          {MOODS.map((m) => {
            const sel = myMood === m;
            return (
              <Pressable
                key={m}
                onPress={() => patchMood(sel ? undefined : m)}
                style={[styles.moodBtn, { backgroundColor: sel ? palette.tint : palette.background }]}>
                <Text style={{ fontSize: 20 }}>{m}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Mi nota privada + compartir */}
        <TextInput
          multiline
          value={myNote}
          onChangeText={patchNote}
          placeholder="Tu nota privada de hoy…"
          placeholderTextColor={palette.textSecondary}
          style={[styles.note, { backgroundColor: palette.background, color: palette.text }]}
        />
        <Pressable onPress={toggleShare} style={styles.share} hitSlop={8}>
          <Text style={{ fontSize: 15 }}>{myShared ? '👁️' : '🔒'}</Text>
          <ThemedText type="small" style={{ color: myShared ? palette.fertile : palette.textSecondary }}>
            {myShared ? `Compartida con ${otherMeta.label}` : 'Privada · toca para compartir'}
          </ThemedText>
        </Pressable>

        {/* Lo del otro */}
        <View style={[styles.divider, { backgroundColor: palette.backgroundSelected }]} />
        <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
          {otherMeta.emoji} {otherMeta.label}
        </ThemedText>
        <ThemedText>{otherMood ? `Se siente ${otherMood}` : 'Sin estado registrado'}</ThemedText>
        {otherShared && otherNote ? (
          <ThemedText style={{ marginTop: Spacing.one }}>“{otherNote}”</ThemedText>
        ) : (
          <ThemedText type="small" style={{ color: palette.textSecondary, marginTop: Spacing.one }}>
            🔒 {otherNote ? 'Su nota es privada' : 'Sin nota'}
          </ThemedText>
        )}
      </ThemedView>

      {/* ---------- MEMORIA CÍCLICA ---------- */}
      {memories.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.h}>🔁 En este punto del ciclo</ThemedText>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            Días parecidos (≈ día {cd}) de ciclos anteriores:
          </ThemedText>
          {memories.map((mem) => {
            const oShared = mem.entry[otherMeta.sharedKey] ?? false;
            const oNote = mem.entry[otherMeta.noteKey];
            const mNote = mem.entry[meMeta.noteKey];
            return (
              <View key={mem.date} style={[styles.memItem, { borderLeftColor: palette.tint }]}>
                <ThemedText type="small" style={{ fontWeight: '700' }}>
                  {formatShort(mem.date)} · día {mem.cycleDay}  {mem.entry.moodHer ?? ''}
                  {mem.entry.moodHim ?? ''}
                </ThemedText>
                {mNote ? (
                  <ThemedText type="small">{meMeta.emoji} “{mNote}”</ThemedText>
                ) : null}
                {oShared && oNote ? (
                  <ThemedText type="small">{otherMeta.emoji} “{oNote}”</ThemedText>
                ) : null}
              </View>
            );
          })}
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  card: { borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  date: { fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
  phaseRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  bar: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  cd: { fontSize: 20, fontWeight: '700' },
  peek: { alignItems: 'flex-end', gap: 2 },
  peekTxt: { fontSize: 16 },
  h: { fontWeight: '700', fontSize: 16 },
  sub: { marginTop: Spacing.two, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  moodBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    borderRadius: 12,
    padding: Spacing.three,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 15,
    marginTop: Spacing.one,
  },
  share: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  divider: { height: 1, marginVertical: Spacing.two },
  memItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
    marginTop: Spacing.two,
    gap: 2,
  },
});
