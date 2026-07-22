import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  buildCyclePayload,
  buildPrivatePayload,
  buildSharedPayload,
  parseCyclePayload,
  parsePrivatePayload,
  parseSharedPayload,
  restoreCloudSnapshot,
} from '@/lib/cloud-payload';
import { useApp, type AppSnapshot } from '@/lib/store';
import { authRedirectUrl, cloudConfigured, supabase } from '@/lib/supabase';
import { OTHER, type Person } from '@/lib/types';

export interface CloudMembership {
  userId: string;
  coupleId: string;
  role: Person;
}

export type CloudStatus =
  | 'local'
  | 'authenticating'
  | 'pairing'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

interface CloudContextValue {
  configured: boolean;
  email: string | null;
  membership: CloudMembership | null;
  pairComplete: boolean;
  status: CloudStatus;
  notice: string | null;
  inviteCode: string | null;
  lastSync: Date | null;
  sendMagicLink: (email: string) => Promise<void>;
  createPair: (role: Person) => Promise<void>;
  joinPair: (code: string) => Promise<void>;
  rotateInvite: () => Promise<void>;
  syncNow: () => Promise<void>;
  switchAccountForMigration: () => Promise<void>;
  signOut: () => Promise<void>;
}

const CloudContext = createContext<CloudContextValue | null>(null);

function snapshot(): AppSnapshot {
  const state = useApp.getState();
  return { entries: state.entries, cycleNotes: state.cycleNotes, settings: state.settings };
}

function hasLocalDataForRole(current: AppSnapshot, role: Person): boolean {
  const hasEntry = Object.values(current.entries).some((entry) =>
    role === 'her'
      ? entry.flow !== undefined ||
        entry.moodHer !== undefined ||
        entry.noteHer !== undefined ||
        entry.goodHer !== undefined ||
        entry.badHer !== undefined
      : entry.moodHim !== undefined ||
        entry.noteHim !== undefined ||
        entry.goodHim !== undefined ||
        entry.badHim !== undefined,
  );
  if (hasEntry) return true;
  return Object.values(current.cycleNotes).some((note) =>
    role === 'her'
      ? note.summaryHer !== undefined || note.autoSummaryHer !== undefined
      : note.summaryHim !== undefined || note.autoSummaryHim !== undefined,
  );
}

function friendlyError(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (message.includes('invalid_invite_code')) return 'El código de pareja no es válido.';
  if (message.includes('already_in_couple')) return 'Esta cuenta ya pertenece a una pareja.';
  if (message.includes('couple_full')) return 'Ese espacio de pareja ya tiene dos personas.';
  if (/rate|too many/i.test(message)) return 'Demasiados intentos; espera unos minutos.';
  if (/network|fetch|offline/i.test(message)) return 'No hay conexión. Tus cambios siguen guardados aquí.';
  return 'No se pudo completar la sincronización. Inténtalo de nuevo.';
}

async function waitForLocalHydration(): Promise<void> {
  if (useApp.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = useApp.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<CloudMembership | null>(null);
  const [pairComplete, setPairComplete] = useState(false);
  const [status, setStatus] = useState<CloudStatus>(cloudConfigured ? 'authenticating' : 'local');
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const suppressUpload = useRef(false);
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushRemote = useCallback(async (member: CloudMembership) => {
    if (!supabase) return;
    const current = snapshot();
    const version = Date.now();
    const writes = [
      supabase.from('private_snapshots').upsert({
        user_id: member.userId,
        payload: buildPrivatePayload(current, member.role),
        version,
        updated_at: new Date().toISOString(),
      }),
      supabase.from('shared_snapshots').upsert({
        user_id: member.userId,
        couple_id: member.coupleId,
        payload: buildSharedPayload(current, member.role),
        version,
        updated_at: new Date().toISOString(),
      }),
    ];
    if (member.role === 'her') {
      writes.push(
        supabase.from('cycle_snapshots').upsert({
          couple_id: member.coupleId,
          payload: buildCyclePayload(current),
          version,
          updated_by: member.userId,
          updated_at: new Date().toISOString(),
        }),
      );
    }
    const results = await Promise.all(writes);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    setLastSync(new Date());
    setStatus('synced');
    setNotice(null);
  }, []);

  const pullRemote = useCallback(async (member: CloudMembership) => {
    if (!supabase) return;
    const [privateResult, sharedResult, cycleResult] = await Promise.all([
      supabase
        .from('private_snapshots')
        .select('payload')
        .eq('user_id', member.userId)
        .maybeSingle(),
      supabase
        .from('shared_snapshots')
        .select('payload')
        .eq('couple_id', member.coupleId),
      supabase
        .from('cycle_snapshots')
        .select('payload')
        .eq('couple_id', member.coupleId)
        .maybeSingle(),
    ]);
    const failed = [privateResult, sharedResult, cycleResult].find((result) => result.error);
    if (failed?.error) throw failed.error;

    const own = parsePrivatePayload(privateResult.data?.payload, member.role);
    if (!own) throw new Error('invalid_private_snapshot');
    const shared = (sharedResult.data ?? [])
      .map((row) => parseSharedPayload(row.payload))
      .filter((value) => value !== null);
    const cycle = parseCyclePayload(cycleResult.data?.payload);
    const restored = restoreCloudSnapshot(
      useApp.getState().settings,
      member.role,
      own,
      shared,
      cycle,
    );

    suppressUpload.current = true;
    useApp.setState(restored);
    suppressUpload.current = false;
    setLastSync(new Date());
    setStatus('synced');
    setNotice(null);
  }, []);

  const activateMembership = useCallback(
    async (member: CloudMembership) => {
      if (!supabase) return;
      setMembership(member);
      setStatus('syncing');
      setNotice('Preparando tu copia privada…');
      await waitForLocalHydration();

      const members = await supabase
        .from('couple_members')
        .select('user_id')
        .eq('couple_id', member.coupleId);
      if (members.error) throw members.error;
      const complete = (members.data?.length ?? 0) >= 2;
      setPairComplete(complete);
      const preservePeerMigration =
        !complete && hasLocalDataForRole(snapshot(), OTHER[member.role]);

      const existing = await supabase
        .from('private_snapshots')
        .select('user_id')
        .eq('user_id', member.userId)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) await pushRemote(member);
      // En el primer alta conservamos temporalmente la capa local de la otra
      // persona para poder migrarla iniciando su cuenta a continuación.
      if (!preservePeerMigration) await pullRemote(member);
      else {
        suppressUpload.current = true;
        useApp.setState((state) => ({
          settings: {
            ...state.settings,
            perspective: member.role,
            roleChosen: true,
          },
        }));
        suppressUpload.current = false;
        setStatus('synced');
        setNotice('Tu capa está guardada. Ahora podéis enlazar la cuenta de tu pareja.');
      }
    },
    [pullRemote, pushRemote],
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) {
        setMembership(null);
        setPairComplete(false);
        setStatus('local');
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setStatus('authenticating');
      } else {
        setMembership(null);
        setPairComplete(false);
        setStatus('local');
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('couple_members')
          .select('user_id,couple_id,role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!active) return;
        if (error) throw error;
        if (!data) {
          setMembership(null);
          setStatus('pairing');
          setNotice('Cuenta verificada. Crea un espacio o introduce el código de tu pareja.');
          return;
        }
        await activateMembership({
          userId: data.user_id,
          coupleId: data.couple_id,
          role: data.role as Person,
        });
      } catch (error: unknown) {
        if (!active) return;
        setStatus('error');
        setNotice(friendlyError(error));
      }
    })();
    return () => {
      active = false;
    };
  }, [activateMembership, session]);

  useEffect(() => {
    if (!membership) return;
    const unsubscribe = useApp.subscribe((state, previous) => {
      if (
        suppressUpload.current ||
        (state.entries === previous.entries &&
          state.cycleNotes === previous.cycleNotes &&
          state.settings === previous.settings)
      ) {
        return;
      }
      if (uploadTimer.current) clearTimeout(uploadTimer.current);
      setStatus('syncing');
      uploadTimer.current = setTimeout(() => {
        void pushRemote(membership).catch((error) => {
          setStatus('offline');
          setNotice(friendlyError(error));
        });
      }, 900);
    });
    return () => {
      unsubscribe();
      if (uploadTimer.current) clearTimeout(uploadTimer.current);
    };
  }, [membership, pushRemote]);

  useEffect(() => {
    if (!supabase || !membership) return;
    const client = supabase;
    let pullTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = setTimeout(() => {
        void pullRemote(membership).catch((error) => {
          setStatus('offline');
          setNotice(friendlyError(error));
        });
      }, 350);
    };
    const channel = client
      .channel(`mareas-${membership.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'private_snapshots',
          filter: `user_id=eq.${membership.userId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_snapshots',
          filter: `couple_id=eq.${membership.coupleId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cycle_snapshots',
          filter: `couple_id=eq.${membership.coupleId}`,
        },
        refresh,
      )
      .subscribe();
    return () => {
      if (pullTimer) clearTimeout(pullTimer);
      void client.removeChannel(channel);
    };
  }, [membership, pullRemote]);

  const sendMagicLink = useCallback(async (email: string) => {
    if (!supabase) return;
    setStatus('authenticating');
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: false },
    });
    if (error) {
      setStatus('error');
      setNotice(friendlyError(error));
      return;
    }
    setStatus('local');
    setNotice('Te hemos enviado un enlace. Ábrelo en este dispositivo para continuar.');
  }, []);

  const createPair = useCallback(
    async (role: Person) => {
      if (!supabase || !session) return;
      try {
        setStatus('syncing');
        setNotice(null);
        const { data, error } = await supabase.rpc('create_couple', { requested_role: role });
        if (error || !data?.[0]) throw error ?? new Error('empty_create_couple');
        const row = data[0];
        setInviteCode(row.invite_code);
        await activateMembership({
          userId: session.user.id,
          coupleId: row.couple_id,
          role: row.member_role as Person,
        });
      } catch (error) {
        setStatus('error');
        setNotice(friendlyError(error));
      }
    },
    [activateMembership, session],
  );

  const joinPair = useCallback(
    async (code: string) => {
      if (!supabase || !session) return;
      try {
        setStatus('syncing');
        setNotice(null);
        const { data, error } = await supabase.rpc('join_couple', { provided_code: code });
        if (error || !data?.[0]) throw error ?? new Error('empty_join_couple');
        const row = data[0];
        await activateMembership({
          userId: session.user.id,
          coupleId: row.couple_id,
          role: row.member_role as Person,
        });
      } catch (error) {
        setStatus('error');
        setNotice(friendlyError(error));
      }
    },
    [activateMembership, session],
  );

  const rotateInvite = useCallback(async () => {
    if (!supabase || !membership) return;
    const { data, error } = await supabase.rpc('rotate_invite_code');
    if (error || typeof data !== 'string') {
      setStatus('error');
      setNotice(friendlyError(error));
      return;
    }
    setInviteCode(data);
    setNotice('Código nuevo creado. El anterior ya no funciona.');
  }, [membership]);

  const syncNow = useCallback(async () => {
    if (!membership) return;
    setStatus('syncing');
    try {
      await pushRemote(membership);
      await pullRemote(membership);
    } catch (error) {
      setStatus('offline');
      setNotice(friendlyError(error));
    }
  }, [membership, pullRemote, pushRemote]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      if (membership) await pushRemote(membership);
      suppressUpload.current = true;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMembership(null);
      setPairComplete(false);
      useApp.getState().clearAll();
      setInviteCode(null);
      setLastSync(null);
      setStatus('local');
      setNotice('Sesión cerrada. La copia local de esta cuenta se ha borrado del dispositivo.');
    } catch (error) {
      setStatus('offline');
      setNotice(`No se cerró la sesión para evitar perder cambios. ${friendlyError(error)}`);
    } finally {
      suppressUpload.current = false;
    }
  }, [membership, pushRemote]);

  const switchAccountForMigration = useCallback(async () => {
    if (!supabase || !membership || pairComplete) return;
    try {
      await pushRemote(membership);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMembership(null);
      setPairComplete(false);
      setInviteCode(null);
      setStatus('local');
      setNotice(
        'Cuenta cambiada sin borrar los datos locales. Inicia ahora la cuenta de tu pareja y usa el código.',
      );
    } catch (error) {
      setStatus('offline');
      setNotice(`No se cambió la cuenta para evitar perder cambios. ${friendlyError(error)}`);
    }
  }, [membership, pairComplete, pushRemote]);

  const value = useMemo<CloudContextValue>(
    () => ({
      configured: cloudConfigured,
      email: session?.user.email ?? null,
      membership,
      pairComplete,
      status,
      notice,
      inviteCode,
      lastSync,
      sendMagicLink,
      createPair,
      joinPair,
      rotateInvite,
      syncNow,
      switchAccountForMigration,
      signOut,
    }),
    [
      createPair,
      inviteCode,
      joinPair,
      lastSync,
      membership,
      notice,
      pairComplete,
      rotateInvite,
      sendMagicLink,
      session,
      signOut,
      status,
      switchAccountForMigration,
      syncNow,
    ],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudContextValue {
  const value = useContext(CloudContext);
  if (!value) throw new Error('useCloud debe usarse dentro de CloudProvider.');
  return value;
}
