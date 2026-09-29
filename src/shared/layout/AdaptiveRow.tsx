import { Children, type PropsWithChildren } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { spacing } from '@/src/theme';

/** Wrap whole fields/cards instead of squeezing their contents on small screens. */
export function AdaptiveRow({ children, minItemWidth = 160 }: PropsWithChildren<{ minItemWidth?: number }>) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={styles.row}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={[styles.item, { flexBasis: minItemWidth * Math.max(fontScale, 1) }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { flexGrow: 1, minWidth: 0, maxWidth: '100%' },
});
