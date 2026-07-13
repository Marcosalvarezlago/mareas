import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PhaseInfoSheet } from '@/components/phase-info-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCycle } from '@/hooks/use-cycle';
import { usePalette } from '@/hooks/use-palette';
import { aiCycleSummary } from '@/lib/ai';
import {
  cycleCoord,
  dayPhase,
  PHASE_COLOR,
  PHASE_INFO,
  similarDays,
  summarizeCyclePoint,
  type Phase,
} from '@/lib/cycle';
import { diffDays, formatLong, formatShort, todayISO, type ISODate } from '@/lib/dates';
import { useApp } from '@/lib/store';
import {
  effectiveShared,
  FLOW_LABELS,
  MOOD_OPTIONS,
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
 * Info del día seleccionado, en secciones PLEGABLES para una vista compacta:
 * general (siempre visible) → diario → resumen del punto del ciclo (manual +
 * automático, solo de uno mismo) → días equivalentes con notas expandibles.
 */
export function DayPanel({ date, onRequestPrivacy }: Props) {
  const palette = usePalette();
  const entries = useApp((s) => s.entries);
  const cycleNotes = useApp((s) => s.cycleNotes);
  const updateDay = useApp((s) => s.updateDay);
  const updateCycleNote = useApp((s) => s.updateCycleNote);
  const me = useApp((s) => s.settings.perspective);
  const privacy = useApp((s) => s.settings.privacy);
  const radius = useApp((s) => s.settings.matchRadius);
  const aiApiKey = useApp((s) => s.settings.aiApiKey);
  const { starts, stats, windows, periodLen } = useCycle();

  // Secciones plegables (compactas por defecto) y estado efímero de UI.
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [equivOpen, setEquivOpen] = useState(false);
  const [showAllMems, setShowAllMems] = useState(false);
  const [expandedMem, setExpandedMem] = useState<ISODate | null>(null);
  const [infoPhase, setInfoPhase] = useState<Phase | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const today = todayISO();
  const isFuture = date > today;
  const daysAhead = isFuture ? diffDays(today, date) : 0;

  const entry = entries[date];
  const dp = dayPhase(date, entries, windows, periodLen);
  const coord = cycleCoord(date, entries, windows, periodLen);
  const meMeta = PERSON_META[me];
  const otherMeta = PERSON_META[OTHER[me]];
  const maya = PERSON_META.her; // rol que vive el ciclo

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
  const mySummaryShared =
    effectiveShared(myMode, cycleNote[meMeta.summarySharedKey]);
  const otherSummary = cycleNote[otherMeta.summaryKey];
  const otherAuto = cycleNote[otherMeta.autoSummaryKey];
  const otherSummaryVisible = effectiveShared(
    otherMode,
    cycleNote[otherMeta.summarySharedKey],
  );

  // Días equivalentes (bidireccional), con el radio configurado en Ajustes.
  const memories = similarDays(date, entries, windows, periodLen, radius);
  const visibleMems = showAllMems ? memories : memories.slice(0, 4);

  // "La siguiente regla llegó…" (dato real) vs "se prevé…" (proyección).
  const win = windows.find((w) => w.start <= date && date < w.nextStart);
  const nextU = win
    ? Math.min(10, Math.max(1, Math.ceil(stats.sd * Math.sqrt(win.k + 1))))
    : 1;
  const nextLine = win
    ? win.nextProjected
      ? `Se prevé la siguiente regla ~${formatShort(win.nextStart)} (±${nextU} d)`
      : `La siguiente regla llegó el ${formatShort(win.nextStart)}`
    : null;

  // --- helpers de escritura ---
  const patchEntry = (p: Partial<DayEntry>) => updateDay(date, p);
  const setFlow = (f: Flow) => patchEntry({ flow: (entry?.flow ?? 0) === f ? 0 : f });

  const generateSummary = async () => {
    if (!coord || !dp) return;
    setAiNote(null);
    const key = aiApiKey.trim();
    if (key) {
      setAiBusy(true);
      try {
        const text = await aiCycleSummary({
          apiKey: key,
          me,
          cycleDay: dp.cycleDay,
          phase: dp.phase,
          context: coord.context,
          matches: memories,
          manualSummary: mySummary || undefined,
        });
        updateCycleNote(coord.key, { [meMeta.autoSummaryKey]: text });
        setAiBusy(false);
        return;
      } catch (err) {
        setAiBusy(false);
        const msg = err instanceof Error ? err.message : 'Error desconocido.';
        setAiNote(`⚠️ IA no disponible (${msg}) — usado el resumen estadístico.`);
      }
    }
    const text = summarizeCyclePoint(date, entries, starts, windows, periodLen, me, radius);
    if (text) updateCycleNote(coord.key, { [meMeta.autoSummaryKey]: text });
    else setAiNote('Sin registros propios en los días equivalentes todavía.');
  };

  const phaseColor = dp ? palette[PHASE_COLOR[dp.phase].main] : palette.textSecondary;
  const modeInfo = PRIVACY_MODES.find((p) => p.mode === myMode);

  const preview = (t: string) => {
    const clean = t.replace(/\s+/g, ' ').trim();
    return clean.length > 64 ? clean.slice(0, 64) + '…' : clean;
  };

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

  /** Cabecera plegable de sección. */
  const sectionHeader = (open: boolean, toggle: () => void, title: string, extra?: string) => (
    <Pressable onPress={toggle} hitSlop={8} style={styles.sectionHead}>
      <ThemedText style={styles.h}>
        {open ? '▾' : '▸'} {title}
      </ThemedText>
      {extra ? (
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {extra}
        </ThemedText>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {/* ---------- INFO GENERAL (siempre visible) ---------- */}
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

            {nextLine ? (
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                🩸 {nextLine}
              </ThemedText>
            ) : null}

            <Pressable onPress={() => setInfoPhase(dp.phase)} hitSlop={8}>
              <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
                ℹ️ Saber más de esta fase (cuerpo, mente, alimentación…)
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {me === 'her'
              ? 'Sin datos de ciclo para este día. Marca tu regla abajo o mantén pulsado un día del calendario 👆'
              : `${maya.label} aún no ha registrado ciclo alrededor de este día.`}
          </ThemedText>
        )}
      </ThemedView>

      {/* ---------- DIARIO (plegable) ---------- */}
      <ThemedView type="backgroundElement" style={styles.card}>
        {sectionHeader(
          diaryOpen,
          () => setDiaryOpen((v) => !v),
          '📖 Diario del día',
          !diaryOpen && myMood ? myMood : undefined,
        )}
        {diaryOpen &&
          (isFuture ? (
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              Este día aún no ha llegado: el diario se escribe cuando se vive. 🌊
            </ThemedText>
          ) : (
            <>
              <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
                🩸 Regla{me === 'him' ? ` · la registra ${maya.label}` : ''}
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

              <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
                {meMeta.emoji} ¿Cómo estás?
              </ThemedText>
              <View style={styles.moodRow}>
                {MOOD_OPTIONS.map(({ emoji, label }) => {
                  const sel = myMood === emoji;
                  return (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityLabel={`Estado: ${label}`}
                      accessibilityState={{ selected: sel }}
                      onPress={() =>
                        patchEntry({ [meMeta.moodKey]: sel ? undefined : emoji })
                      }
                      style={[
                        styles.moodBtn,
                        { backgroundColor: sel ? palette.tint : palette.background },
                      ]}>
                      <Text style={styles.moodEmoji}>{emoji}</Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.moodLabel, { color: sel ? '#fff' : palette.textSecondary }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

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

              <View style={[styles.divider, { backgroundColor: palette.backgroundSelected }]} />
              <ThemedText type="small" style={[styles.sub, { color: palette.textSecondary }]}>
                {otherMeta.emoji} {otherMeta.label}
              </ThemedText>
              <ThemedText>
                {otherMood ? `Se siente ${otherMood}` : 'Sin estado registrado'}
              </ThemedText>
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
                <ThemedText
                  type="small"
                  style={{ color: palette.textSecondary, marginTop: Spacing.one }}>
                  🔒 {otherNote ? 'Su nota es privada' : 'Sin nota'}
                </ThemedText>
              )}
            </>
          ))}
      </ThemedView>

      {/* ---------- RESUMEN DEL PUNTO DEL CICLO (plegable) ---------- */}
      {coord && dp && (
        <ThemedView type="backgroundElement" style={styles.card}>
          {sectionHeader(
            summaryOpen,
            () => setSummaryOpen((v) => !v),
            `🧭 Día ${dp.cycleDay} · ${PHASE_INFO[dp.phase].name}`,
            !summaryOpen && (mySummary || myAuto) ? '✓' : undefined,
          )}
          {summaryOpen && (
            <>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                {coord.context ? `${coord.context} · ` : ''}
                Tu resumen, solo tuyo (se guarda para todos los días equivalentes).
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
                  {aiApiKey.trim() ? '🤖 Resumen de la IA' : '✨ Resumen automático'}
                </ThemedText>
                {memories.length > 0 && (
                  <Pressable
                    onPress={generateSummary}
                    disabled={aiBusy}
                    style={[
                      styles.genBtn,
                      { backgroundColor: aiBusy ? palette.backgroundSelected : palette.tint },
                    ]}>
                    <Text style={[styles.genBtnTxt, aiBusy && { color: palette.textSecondary }]}>
                      {aiBusy ? '⏳ Generando…' : myAuto ? '↻ Actualizar' : '✨ Generar'}
                    </Text>
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
                    ? aiApiKey.trim()
                      ? 'Pulsa Generar y la IA lo redactará con tus días equivalentes.'
                      : 'Pulsa Generar (estadístico). Con una clave de IA en Ajustes, lo redacta un chatbot.'
                    : 'Sin días equivalentes registrados todavía.'}
                </ThemedText>
              )}
              {aiNote ? (
                <ThemedText type="small" style={{ color: palette.period }}>
                  {aiNote}
                </ThemedText>
              ) : null}

              {shareRow(cycleNote[meMeta.summarySharedKey], () =>
                updateCycleNote(coord.key, {
                  [meMeta.summarySharedKey]: !mySummaryShared,
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
            </>
          )}
        </ThemedView>
      )}

      {/* ---------- DÍAS EQUIVALENTES (plegable, expandible) ---------- */}
      {memories.length > 0 && dp && (
        <ThemedView type="backgroundElement" style={styles.card}>
          {sectionHeader(
            equivOpen,
            () => setEquivOpen((v) => !v),
            `🔁 En este punto del ciclo (${memories.length})`,
          )}
          {equivOpen && (
            <>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                Días equivalentes de otros ciclos ({PHASE_INFO[dp.phase].name.toLowerCase()},
                radio ±{Math.min(radius, 3)}). Toca uno para ver la nota completa.
              </ThemedText>
              {visibleMems.map((mem) => {
                const oNoteVisible = effectiveShared(otherMode, mem.entry[otherMeta.sharedKey]);
                const oNote = mem.entry[otherMeta.noteKey];
                const mNote = mem.entry[meMeta.noteKey];
                const goods = [mem.entry.goodHer, mem.entry.goodHim].filter(Boolean).join(', ');
                const bads = [mem.entry.badHer, mem.entry.badHim].filter(Boolean).join(', ');
                const isOpen = expandedMem === mem.date;
                const hasNotes = Boolean(mNote || (oNoteVisible && oNote));
                return (
                  <Pressable
                    key={mem.date}
                    onPress={() => hasNotes && setExpandedMem(isOpen ? null : mem.date)}
                    style={[styles.memItem, { borderLeftColor: palette.tint }]}>
                    <ThemedText type="small" style={{ fontWeight: '700' }}>
                      {formatShort(mem.date)} · día {mem.cycleDay}{'  '}
                      {mem.entry.moodHer ?? ''}
                      {mem.entry.moodHim ?? ''}
                      {(mem.entry.flow ?? 0) > 0 ? ' 🩸' : ''}
                      {hasNotes ? (isOpen ? '  ▾' : '  ▸') : ''}
                    </ThemedText>
                    {goods || bads ? (
                      <ThemedText type="small">
                        {goods ? `✅ ${goods}` : ''}
                        {goods && bads ? '   ' : ''}
                        {bads ? `⚠️ ${bads}` : ''}
                      </ThemedText>
                    ) : null}
                    {isOpen ? (
                      <View style={[styles.noteBox, { backgroundColor: palette.background }]}>
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
                    ) : (
                      <>
                        {mNote ? (
                          <ThemedText type="small">
                            {meMeta.emoji} {preview(mNote)}
                          </ThemedText>
                        ) : null}
                        {oNoteVisible && oNote ? (
                          <ThemedText type="small">
                            {otherMeta.emoji} {preview(oNote)}
                          </ThemedText>
                        ) : null}
                      </>
                    )}
                  </Pressable>
                );
              })}
              {memories.length > 4 && (
                <Pressable onPress={() => setShowAllMems((v) => !v)} hitSlop={8}>
                  <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
                    {showAllMems ? '▴ Ver menos' : `▾ Ver todas (${memories.length})`}
                  </ThemedText>
                </Pressable>
              )}
            </>
          )}
        </ThemedView>
      )}

      <PhaseInfoSheet phase={infoPhase} onClose={() => setInfoPhase(null)} />
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
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  h: { fontWeight: '700', fontSize: 16 },
  sub: { marginTop: Spacing.two, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
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
  noteBox: {
    borderRadius: 10,
    padding: Spacing.two,
    marginTop: Spacing.one,
    gap: Spacing.one,
  },
});
