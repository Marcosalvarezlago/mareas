import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/** Colores del tema activo (claro/oscuro). */
export function usePalette() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
