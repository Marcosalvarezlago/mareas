import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

export const cloudConfigured =
  /^https:\/\/.+\.supabase\.co\/?$/i.test(url) && publishableKey.length > 20;

/**
 * La clave publicable puede vivir en el cliente: no es un secreto. La
 * seguridad real está en las políticas RLS de `supabase/migrations`.
 */
export const supabase = cloudConfigured
  ? createClient(url, publishableKey, {
      auth: {
        ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        lock: processLock,
      },
    })
  : null;

export function authRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const base = process.env.EXPO_PUBLIC_BASE_URL?.trim() || '/mareas/';
    return new URL(base, window.location.origin).toString();
  }
  return 'mareas://';
}
