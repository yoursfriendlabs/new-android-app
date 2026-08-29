import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import type { AppPalette } from '@/src/theme/app-palette';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function useThemedStyles<T extends NamedStyles<T>>(factory: (colors: AppPalette) => T): T {
  const colors = usePalette();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
