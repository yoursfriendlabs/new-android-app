import { useWindowDimensions } from 'react-native';

import { layout } from '@/src/theme';

export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= layout.tabletBreakpoint;
}
