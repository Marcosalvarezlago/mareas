import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { useCloud } from '@/providers/cloud-provider';
import { PERSON_META, type Person } from '@/lib/types';

const STATUS_LABEL = {
  local: 'Solo en este dispositivo',
  authenticating: 'Comprobando cuenta…',
  pairing: 'Falta enlazar la pareja',
  syncing: 'Sincronizando…',
  synced: 'Copia privada al día',
  offline: 'Sin conexión · cambios guardados aquí',
  error: 'Requiere atención',
} as const;

export function SyncCard() {
  const palette = usePalette();
  const cloud = useCloud();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [createRole, setCreateRole] = useState<Person>('her');
  const busy = cloud.status === 'authenticating' || cloud.status === 'syncing';

  return (
    <View style={[styles.box, { backgroundColor: palette.background }]}>
      <View style={styles.head}>
        <ThemedText style={styles.title}>☁️ Memoria entre dispositivos</ThemedText>
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {STATUS_LABEL[cloud.status]}
        </ThemedText>
      </View>

      {!cloud.configured ? (
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          La sincronización segura está preparada, pero todavía no está activada en esta
          instalación. Mientras tanto, todo permanece únicamente en el dispositivo.
        </ThemedText>
      ) : !cloud.email ? (
        <>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            Introduce tu correo. Recibirás un enlace de acceso sin contraseña; al volver,
            tus datos se recuperarán incluso desde incógnito u otro dispositivo.
          </ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="tu-correo@ejemplo.com"
            placeholderTextColor={palette.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Correo para sincronización"
            style={[styles.input, { color: palette.text, borderColor: palette.backgroundSelected }]}
          />
          <Pressable
            disabled={busy || !email.includes('@')}
            onPress={() => void cloud.sendMagicLink(email)}
            style={[
              styles.primary,
              { backgroundColor: busy || !email.includes('@') ? palette.backgroundSelected : palette.tint },
            ]}>
            <Text style={styles.primaryText}>Enviar enlace seguro</Text>
          </Pressable>
        </>
      ) : !cloud.membership ? (
        <>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            Sesión iniciada como {cloud.email}. Cread uno de los dos el espacio; la otra
            persona entra después con el código.
          </ThemedText>

          <ThemedText style={styles.subtitle}>Crear nuestro espacio</ThemedText>
          <View style={styles.roleRow}>
            {(['her', 'him'] as Person[]).map((role) => {
              const selected = createRole === role;
              return (
                <Pressable
                  key={role}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCreateRole(role)}
                  style={[
                    styles.roleButton,
                    { backgroundColor: selected ? palette.tint : palette.backgroundElement },
                  ]}>
                  <Text style={{ color: selected ? '#fff' : palette.text, fontWeight: '700' }}>
                    {PERSON_META[role].emoji} {PERSON_META[role].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            disabled={busy}
            onPress={() => void cloud.createPair(createRole)}
            style={[styles.primary, { backgroundColor: busy ? palette.backgroundSelected : palette.tint }]}>
            <Text style={styles.primaryText}>Crear y obtener código</Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: palette.backgroundSelected }]} />
          <ThemedText style={styles.subtitle}>Ya tengo el código</ThemedText>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            placeholder="ABCD-1234-EF56"
            placeholderTextColor={palette.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={14}
            accessibilityLabel="Código de pareja"
            style={[styles.input, styles.code, { color: palette.text, borderColor: palette.backgroundSelected }]}
          />
          <Pressable
            disabled={busy || code.replace(/-/g, '').length !== 12}
            onPress={() => void cloud.joinPair(code)}
            style={[
              styles.secondary,
              { borderColor: palette.tint, opacity: busy ? 0.5 : 1 },
            ]}>
            <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
              Unirme al espacio
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {PERSON_META[cloud.membership.role].emoji} {PERSON_META[cloud.membership.role].label}
            {' · '}{cloud.email}
            {cloud.lastSync ? ` · ${cloud.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </ThemedText>

          {cloud.inviteCode ? (
            <View style={[styles.invite, { borderColor: palette.tint }]}>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                Código para tu pareja
              </ThemedText>
              <ThemedText style={styles.inviteCode}>{cloud.inviteCode}</ThemedText>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                Envíalo solo a tu pareja. Crear otro invalida este.
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={() => void cloud.syncNow()}
              style={[styles.secondary, { borderColor: palette.tint }]}>
              <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
                Sincronizar ahora
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void cloud.rotateInvite()}
              style={[styles.secondary, { borderColor: palette.tint }]}>
              <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
                Crear código
              </ThemedText>
            </Pressable>
          </View>
          {!cloud.pairComplete ? (
            <Pressable
              disabled={busy}
              onPress={() => void cloud.switchAccountForMigration()}
              hitSlop={8}>
              <ThemedText type="small" style={{ color: palette.tint, fontWeight: '700' }}>
                Cambiar a la cuenta de mi pareja para migrar sus datos
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable disabled={busy} onPress={() => void cloud.signOut()} hitSlop={8}>
            <ThemedText type="small" style={{ color: palette.period, fontWeight: '700' }}>
              Cerrar sesión y borrar la copia de este dispositivo
            </ThemedText>
          </Pressable>
        </>
      )}

      {cloud.notice ? (
        <ThemedText type="small" style={{ color: cloud.status === 'error' ? palette.period : palette.textSecondary }}>
          {cloud.notice}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  head: { gap: 2 },
  title: { fontWeight: '700', fontSize: 14 },
  subtitle: { fontWeight: '700', fontSize: 13, marginTop: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  code: { letterSpacing: 1.5, fontWeight: '700', textAlign: 'center' },
  primary: { borderRadius: 12, paddingVertical: Spacing.two, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleButton: { flex: 1, borderRadius: 12, paddingVertical: Spacing.two, alignItems: 'center' },
  divider: { height: 1, marginVertical: Spacing.one },
  invite: { borderWidth: 1, borderRadius: 12, padding: Spacing.two, alignItems: 'center' },
  inviteCode: { fontWeight: '800', fontSize: 20, letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
