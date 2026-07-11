import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import {
  cycleCoord,
  dayPhase,
  PHASE_COLOR,
  PHASE_INFO,
  similarDays,
  summarizeCyclePoint,
} from '@/lib/cycle';
import { diffDays, formatLong, formatShort, todayISO, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';
import {
  effectiveShared,
  FLOW_LABELS,
  MOODS,
  OTHER,
  PERSON_META,
  PRIVACY_MODES,
  type CycleDayNote,
  type DayEntry,
  type Flow,
} from '@/lib/types';

interface Props {
  date: ISODate;
  /** Llamado al tocar un candado estando en modo global (abre Privacidad). */
  onRequestPrivacy: (hint: string) => void;
}

/**
 * Info del día seleccionado: general (fase) → diario → resumen del punto del
 * ciclo (manual + automático) → días equivalentes. Cada persona ve su capa:
 * lo suyo editable, del otro solo lo compartido.
 */
export function DayPanel({ date, onRequestPrivacy }: Props) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const cycleNotes = useApp((s) => s.cycleNotes);
  const updateDay = useApp((s) => s.updateDay);
  const updateCycleNote = useApp((s) => s.updateCycleNote);
  const me = useApp((s) => s.settings.perspective);
  const privacy = useApp((s) => s.settings.privacy);
  const { starts, windows, periodLen } = useCycle();
  const [eduOpen, setEduOpen] = useState(false);

  const today = todayISO();
  const isFuture = date > today;
  const daysAhead = isFuture ? diffDays(today, date) : 0;

  const entry = entries[date];
  const dp = dayPhase(date, entries, windows, periodLen);
  const coord = cycleCoord(date, entries, windows, periodLen);
  const meMeta = PERSON_META[me];
  const otherMeta = PERSON_META[OTHER[me]];
  const luna = PERSON_META.her; // rol que vive el ciclo

  const myMode = privacy[me];
  const otherMode = privacy[OTHER[me]];

  const myMood = entry?.[meMeta.moodKey];
  const myNote = entry?.[meMeta.noteKey] ?? '';
  const myGood = entry?.[meMeta.goodKey] ?? '';
  const myBad = entry?.[meMeta.badKey] ?? '';
  const otherMood = entry?.[otherMeta.moodKey];
  const otherNote = entry?.[otherMeta.noteKey];
  const otherGood = entry?.[otherMeta.goodKey];
  const otherBad = entry?.[otherMeta.badKey];
  const otherNoteVisible = effectiveShared(otherMode, entry?.[otherMeta.sharedKey]);

  // --- resumen del punto del ciclo (clave = coordenada F/B/O) ---
  const cycleNote: CycleDayNote = (coord ? cycleNotes[coord.key] : undefined) ?? {};
  const mySummary = cycleNote[meMeta.summaryKey] ?? '';
  const myAuto = cycleNote[meMeta.autoSummaryKey] ?? '';
  const otherSummary = cycleNote[otherMeta.summaryKey];
  const otherAuto = cycleNote[otherMeta.autoSummaryKey];
  const otherSummaryVisible = effectiveShared(
    otherMode,
    cycleNote[otherMeta.summarySharedKey],
  );

  // Días equivalentes de cualquier ciclo (antes o después del seleccionado).
  const memories = similarDays(date, entries, windows, periodLen).slice(0, 6);

  // --- helpers de escritura ---
  const patchEntry = (p: Partial<DayEntry>) => updateDay(date, p);
  const setFlow = (f: Flow) => patchEntry({ flow: (entry?.flow ?? 0) === f ? 0 : f });
  const generateSummary = () => {
    if (!coord) return;
    const text = summarizeCyclePoint(
      date, entries, starts, windows, periodLen, me, otherMode,
    );
    if (text) updateCycleNote(coord.key, { [meMeta.autoSummaryKey]: text });
  };

  const phaseColor = dp ? palette[PHASE_COLOR[dp.phase].main] : palette.textSecondary;
  const modeInfo = PRIVACY_MODES.find((p) => p.mode === myMode);

  /** Candado: en manual alterna; en modo global propone cambiar de modo. */
  const shareRow = (explicit: boolean | undefined, onToggleManual: () => void) => {
    const shared = effectiveShared(myMode, explicit);
    const onPress =
      myMode === 'manual'
        ? onToggleManual
        : () =>
            onRequestPrivacy(
              `Estás en modo «${modeInfo?.label}»: los candados individuales no aplican. ` +
                'Si quieres decidir elemento a elemento, pasa a «Selección manual».',
            );
    return (
      <Pressable onPress={onPress} style={styles.share} hitSlop={8}>
        <Text style={{ fontSize: 15 }}>{shared ? '👁️' : '🔒'}</Text>
        <ThemedText
          type="small"
          style={{ color: shared ? palette.fertile : palette.textSecondary }}>
          {shared ? `Compartido con ${otherMeta.label}` : 'Privado'}
          {myMode !== 'manual' ? ` · modo ${modeInfo?.label.toLowerCase()}` : ' · toca para cambiar'}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      {/* ---------- INFO GENERAL ---------- */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.dateRow}>
          <ThemedText style={styles.date}>{formatLong(date)}</ThemedText>
          {isFuture && (
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              🔮 en {daysAhead} día{daysAhead === 1 ? '' : 's'}
            </ThemedText>
          )}
        </View>

        {dp ? (
          <>
            <View style={styles.phaseRow}>
              <View style={[styles.bar, { backgroundColor: phaseColor }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.cd}>
                  Día {dp.cycleDay} del ciclo
                  {dp.projected && dp.uncertainty > 0 && (
                    <ThemedText type="small" style={{ color: palette.textSecondary }}>
                      {'  '}(previsión ±{dp.uncertainty} d)
                    </ThemedText>
                  )}
                </ThemedText>
                <ThemedText style={{ color: phaseColor, fontWeight: '700' }}>
                  {PHASE_INFO[dp.phase].name}
                  {dp.projected ? ' · estimada' : ''}
                </ThemedText>
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  {PHASE_INFO[dp.phase].hint}
                </ThemedText>
              </View>
              {!isFuture && (
                <View style={styles.peek}>
                  <Text style={styles.peekTxt}>
                    {PERSON_META.her.emoji}
                    {entry?.moodHer ?? '·'}
                  </Text>
                  <Text style={styles.peekTxt}>
                    {PERSON_META.him.emoji}
                    {entry?.moodHim ?? '·'}
                  </Text>
                </View>
              )}
            </View>

            {/* Divulgación médica/psíquica de la fase (colapsable) */}
            <Pressable onPress={() => setEduOpen((v) => !v)} hitSlop={8} style={styles.eduHead}>
              <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
                {eduOpen ? '▾' : '▸'} ¿Qué pasa en esta fase?
              </ThemedText>
            </Pressable>
            {eduOpen && (
              <View style={[styles.eduBox, { borderLeftColor: phaseColor }]}>
                <ThemedText type="small">🫀 {PHASE_INFO[dp.phase].body}</ThemedText>
                <ThemedText type="small">🧠 {PHASE_INFO[dp.phase].mind}</ThemedText>
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  Información divulgativa: cada cuerpo es distinto.
                </ThemedText>
              </View>
            )}
          </>
        ) : (
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {me === 'her'
              ? 'Sin datos de ciclo para este día. Marca tu regla abajo o mantén pulsado un día del calendario 👆'
              : `${luna.label} aún no ha registrado ciclo alrededor de este día.`}
          </ThemedText>
        )}
      </ThemedView>

      {/* ---------- DIARIO ---------- */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.h}>📖 Diario del día</ThemedText>

        {isFuture ? (
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            Este día aún no ha llegado: el diario se escribe cuando se vive. 🌊{'\n'}
            Abajo puedes ver cómo soléis estar en este punto del ciclo.
          </ThemedText>
        ) : (
          <>
            {/* Regla (la registra ella) */}
            <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
              🩸 Regla{me === 'him' ? ` · la registra ${luna.label}` : ''}
            </ThemedText>
            {me === 'her' ? (
              <View style={styles.chipRow}>
                {FLOW_LABELS.map((label, i) => {
                  const sel = (entry?.flow ?? 0) === i && i > 0;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setFlow(i as Flow)}
                      style={[
                        styles.chip,
                        { backgroundColor: sel ? palette.period : palette.background },
                      ]}>
                      <Text style={{ color: sel ? '#fff' : palette.text, fontWeight: '600' }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ThemedText>{FLOW_LABELS[entry?.flow ?? 0]}</ThemedText>
            )}

            {/* Mi estado */}
            <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
              {meMeta.emoji} ¿Cómo estás?
            </ThemedText>
            <View style={styles.moodRow}>
              {MOODS.map((m) => {
                const sel = myMood === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => patchEntry({ [meMeta.moodKey]: sel ? undefined : m })}
                    style={[
                      styles.moodBtn,
                      { backgroundColor: sel ? palette.tint : palette.background },
                    ]}>
                    <Text style={{ fontSize: 20 }}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Bienestar: se comparte, es el idioma de cuidado */}
            <View style={styles.wellRow}>
              <ThemedText type="small" style={styles.wellIcon}>✅</ThemedText>
              <TextInput
                value={myGood}
                onChangeText={(t) => patchEntry({ [meMeta.goodKey]: t })}
                placeholder="Me sentó bien… (paseo, manta, infusión)"
                placeholderTextColor={palette.textSecondary}
                style={[styles.wellInput, { backgroundColor: palette.background, color: palette.text }]}
              />
            </View>
            <View style={styles.wellRow}>
              <ThemedText type="small" style={styles.wellIcon}>⚠️</ThemedText>
              <TextInput
                value={myBad}
                onChangeText={(t) => patchEntry({ [meMeta.badKey]: t })}
                placeholder="Me sentó mal… (café, trasnochar)"
                placeholderTextColor={palette.textSecondary}
                style={[styles.wellInput, { backgroundColor: palette.background, color: palette.text }]}
              />
            </View>

            {/* Mi nota */}
            <TextInput
              multiline
              value={myNote}
              onChangeText={(t) => patchEntry({ [meMeta.noteKey]: t })}
              placeholder="Tu nota de hoy…"
              placeholderTextColor={palette.textSecondary}
              style={[styles.note, { backgroundColor: palette.background, color: palette.text }]}
            />
            {shareRow(entry?.[meMeta.sharedKey], () =>
              patchEntry({
                [meMeta.sharedKey]: !effectiveShared(myMode, entry?.[meMeta.sharedKey]),
              }),
            )}

            {/* La capa compartida del otro */}
            <View style={[styles.divider, { backgroundColor: palette.backgroundSelected }]} />
            <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
              {otherMeta.emoji} {otherMeta.label}
            </ThemedText>
            <ThemedText>{otherMood ? `Se siente ${otherMood}` : 'Sin estado registrado'}</ThemedText>
            {otherGood || otherBad ? (
              <ThemedText type="small">
                {otherGood ? `✅ ${otherGood}` : ''}
                {otherGood && otherBad ? '   ' : ''}
                {otherBad ? `⚠️ ${otherBad}` : ''}
              </ThemedText>
            ) : null}
            {otherNoteVisible && otherNote ? (
              <ThemedText style={{ marginTop: Spacing.one }}>“{otherNote}”</ThemedText>
            ) : (
              <ThemedText type="small" style={{ color: palette.textSecondary, marginTop: Spacing.one }}>
                🔒 {otherNote ? 'Su nota es privada' : 'Sin nota'}
              </ThemedText>
            )}
          </>
        )}
      </ThemedView>

      {/* ---------- RESUMEN DEL PUNTO DEL CICLO ---------- */}
      {coord && dp && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.h}>
            🧭 Día {dp.cycleDay} · {PHASE_INFO[dp.phase].name}
          </ThemedText>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {coord.context ? `${coord.context} · ` : ''}
            Se guarda para todos los días equivalentes de todos los ciclos.
          </ThemedText>

          <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
            📝 Tu resumen
          </ThemedText>
          <TextInput
            multiline
            value={mySummary}
            onChangeText={(t) => updateCycleNote(coord.key, { [meMeta.summaryKey]: t })}
            placeholder="Con tus palabras: qué suele significar este punto del ciclo…"
            placeholderTextColor={palette.textSecondary}
            style={[styles.note, { backgroundColor: palette.background, color: palette.text }]}
          />

          <View style={styles.autoHead}>
            <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
              ✨ Resumen automático
            </ThemedText>
            {memories.length > 0 && (
              <Pressable
                onPress={generateSummary}
                style={[styles.genBtn, { backgroundColor: palette.tint }]}>
                <Text style={styles.genBtnTxt}>{myAuto ? '↻ Actualizar' : '✨ Generar'}</Text>
              </Pressable>
            )}
          </View>
          {myAuto ? (
            <View style={[styles.autoBox, { borderLeftColor: palette.tint }]}>
              <ThemedText type="small">{myAuto}</ThemedText>
            </View>
          ) : (
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              {memories.length
                ? 'Aún no generado: pulsa ✨ y se redactará con los días equivalentes.'
                : 'Sin días equivalentes registrados todavía.'}
            </ThemedText>
          )}

          {shareRow(cycleNote[meMeta.summarySharedKey], () =>
            updateCycleNote(coord.key, {
              [meMeta.summarySharedKey]: !effectiveShared(
                myMode,
                cycleNote[meMeta.summarySharedKey],
              ),
            }),
          )}

          {otherSummaryVisible && (otherSummary || otherAuto) ? (
            <>
              <View style={[styles.divider, { backgroundColor: palette.backgroundSelected }]} />
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                {otherMeta.emoji} Resumen de {otherMeta.label}:
              </ThemedText>
              {otherSummary ? <ThemedText type="small">“{otherSummary}”</ThemedText> : null}
              {otherAuto ? (
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  ✨ {otherAuto}
                </ThemedText>
              ) : null}
            </>
          ) : null}
        </ThemedView>
      )}

      {/* ---------- DÍAS EQUIVALENTES ---------- */}
      {memories.length > 0 && dp && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.h}>🔁 En este punto del ciclo</ThemedText>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            Días equivalentes de otros ciclos ({PHASE_INFO[dp.phase].name.toLowerCase()},
            posición comparable):
          </ThemedText>
          {memories.map((mem) => {
            const oNoteVisible = effectiveShared(otherMode, mem.entry[otherMeta.sharedKey]);
            const oNote = mem.entry[otherMeta.noteKey];
            const mNote = mem.entry[meMeta.noteKey];
            const goods = [mem.entry.goodHer, mem.entry.goodHim].filter(Boolean).join(', ');
            const bads = [mem.entry.badHer, mem.entry.badHim].filter(Boolean).join(', ');
            return (
              <View key={mem.date} style={[styles.memItem, { borderLeftColor: palette.tint }]}>
                <ThemedText type="small" style={{ fontWeight: '700' }}>
                  {formatShort(mem.date)} · día {mem.cycleDay}{'  '}
                  {mem.entry.moodHer ?? ''}
                  {mem.entry.moodHim ?? ''}
                  {(mem.entry.flow ?? 0) > 0 ? ' 🩸' : ''}
                </ThemedText>
                {goods || bads ? (
                  <ThemedText type="small">
                    {goods ? `✅ ${goods}` : ''}
                    {goods && bads ? '   ' : ''}
                    {bads ? `⚠️ ${bads}` : ''}
                  </ThemedText>
                ) : null}
                {mNote ? (
                  <ThemedText type="small">
                    {meMeta.emoji} “{mNote}”
                  </ThemedText>
                ) : null}
                {oNoteVisible && oNote ? (
                  <ThemedText type="small">
                    {otherMeta.emoji} “{oNote}”
                  </ThemedText>
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
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  date: { fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
  phaseRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  bar: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  cd: { fontSize: 20, fontWeight: '700' },
  peek: { alignItems: 'flex-end', gap: 2 },
  peekTxt: { fontSize: 16 },
  eduHead: { marginTop: Spacing.one },
  eduBox: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
    gap: Spacing.one,
  },
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
  wellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  wellIcon: { width: 22, textAlign: 'center' },
  wellInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
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
  autoHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  autoBox: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.one,
  },
  genBtn: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  genBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  divider: { height: 1, marginVertical: Spacing.two },
  memItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
    marginTop: Spacing.two,
    gap: 2,
  },
});
