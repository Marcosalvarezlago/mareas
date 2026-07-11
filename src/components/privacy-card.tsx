import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { buildDemoData } from '@/lib/demo';
import { useApp } from '@/lib/store';
import { PERSON_META, PRIVACY_MODES } from '@/lib/types';

interface Props {
  open: boolean;
  onToggleOpen: () => void;
  /** Propuesta mostrada cuando se llegó aquí tocando un candado en modo global. */
  hint: string | null;
  onClearHint: () => void;
}

/**
 * Privacidad de la persona activa, con modo triple: todo privado, todo
 * compartido o selección manual (candado a candado). Vive arriba de la
 * página; tocar un candado individual estando en un modo global abre esta
 * tarjeta proponiendo el cambio.
 */
export function PrivacyCard({ open, onToggleOpen, hint, onClearHint }: Props) {
  const palette = usePalette();
  const me = useApp((s) => s.settings.perspective);
  const privacy = useApp((s) => s.settings.privacy);
  const updateSettings = useApp((s) => s.updateSettings);
  const replaceData = useApp((s) => s.replaceData);
  const [confirmDemo, setConfirmDemo] = useState(false);

  const meMeta = PERSON_META[me];
  const mode = privacy[me];

  const setMode = (m: typeof mode) => {
    updateSettings({ privacy: { ...privacy, [me]: m } });
    onClearHint();
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable onPress={onToggleOpen} hitSlop={8} style={styles.headRow}>
        <ThemedText style={styles.h}>
          {open ? '▾' : '▸'} 🔐 Privacidad · {meMeta.emoji} {meMeta.label}
        </ThemedText>
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {PRIVACY_MODES.find((p) => p.mode === mode)?.icon}{' '}
          {PRIVACY_MODES.find((p) => p.mode === mode)?.label}
        </ThemedText>
      </Pressable>

      {open && (
        <>
          {hint ? (
            <View style={[styles.hintBox, { borderLeftColor: palette.period }]}>
              <ThemedText type="small">{hint}</ThemedText>
            </View>
          ) : null}

          <View style={styles.modes}>
            {PRIVACY_MODES.map(({ mode: m, label, icon }) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[
                    styles.modeBtn,
                    { backgroundColor: active ? palette.tint : palette.background },
                  ]}>
                  <Text style={styles.modeIcon}>{icon}</Text>
                  <Text
                    style={{
                      color: active ? '#fff' : palette.text,
                      fontWeight: '700',
                      fontSize: 12,
                      textAlign: 'center',
                    }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            Afecta a tus notas y resúmenes. Los emojis de estado y el bienestar
            (qué sienta bien/mal) se comparten siempre: son el idioma de cuidado
            de la pareja. En «selección manual» decides con el candado 🔒/👁️ de
            cada elemento.
          </ThemedText>

          <Pressable
            onPress={() => updateSettings({ roleChosen: false })}
            hitSlop={8}
            style={styles.switchUser}>
            <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
              👤 Cambiar de usuario
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              if (!confirmDemo) {
                setConfirmDemo(true);
                return;
              }
              const demo = buildDemoData();
              replaceData(demo.entries, demo.cycleNotes);
              setConfirmDemo(false);
            }}
            hitSlop={8}
            style={styles.switchUser}>
            <ThemedText
              type="small"
              style={{
                color: confirmDemo ? palette.period : palette.tint,
                fontWeight: '700',
              }}>
              {confirmDemo
                ? '⚠️ Sustituye TODOS los datos actuales — toca otra vez para confirmar'
                : '🧪 Rellenar con 6 meses de datos de ejemplo'}
            </ThemedText>
          </Pressable>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  h: { fontWeight: '700', fontSize: 15 },
  hintBox: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.one,
  },
  modes: { flexDirection: 'row', gap: Spacing.two },
  modeBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    gap: 2,
  },
  modeIcon: { fontSize: 18 },
  switchUser: { marginTop: Spacing.one },
});
