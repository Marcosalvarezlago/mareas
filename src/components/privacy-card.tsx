import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { useApp } from '@/lib/store';
import { PERSON_META } from '@/lib/types';

/**
 * Configuración general de privacidad de la persona activa: qué se comparte
 * por defecto. El candado de cada día/resumen concreto manda sobre esto.
 */
export function PrivacyCard() {
  const palette = usePalette();
  const me = useApp((s) => s.settings.perspective);
  const privacy = useApp((s) => s.settings.privacy);
  const updateSettings = useApp((s) => s.updateSettings);
  const [open, setOpen] = useState(false);

  const meMeta = PERSON_META[me];
  const mine = privacy[me];

  const setPref = (key: 'notesShared' | 'summariesShared', value: boolean) =>
    updateSettings({
      privacy: { ...privacy, [me]: { ...mine, [key]: value } },
    });

  const row = (
    label: string,
    key: 'notesShared' | 'summariesShared',
  ) => (
    <View style={styles.row}>
      <ThemedText type="small" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <Switch
        value={mine[key]}
        onValueChange={(v) => setPref(key, v)}
        trackColor={{ true: palette.tint, false: palette.backgroundSelected }}
        thumbColor="#ffffff"
      />
    </View>
  );

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8}>
        <ThemedText style={styles.h}>
          {open ? '▾' : '▸'} 🔐 Privacidad de {meMeta.emoji} {meMeta.label}
        </ThemedText>
      </Pressable>
      {open && (
        <>
          {row('Compartir mis notas del diario por defecto', 'notesShared')}
          {row('Compartir mis resúmenes del ciclo por defecto', 'summariesShared')}
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            El candado 🔒/👁️ de cada nota o resumen concreto siempre manda sobre
            estos ajustes. Los emojis de estado y el bienestar (qué sienta
            bien/mal) se comparten siempre: son el idioma de cuidado de la pareja.
          </ThemedText>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  h: { fontWeight: '700', fontSize: 15 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: { flex: 1 },
});
