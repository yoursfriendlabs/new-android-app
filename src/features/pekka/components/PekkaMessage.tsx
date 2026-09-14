import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

export type PekkaRole = 'user' | 'pekka';

export interface PekkaChatMessage {
  id: string;
  role: PekkaRole;
  text: string;
}

export function PekkaMessage({ message }: { message: PekkaChatMessage }) {
  const colors = usePalette();
  const mine = message.role === 'user';

  return (
    <View style={[styles.row, mine ? styles.rowEnd : styles.rowStart]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.backgroundAlt, borderBottomLeftRadius: 4 },
        ]}>
        <Text variant="body" color={mine ? colors.onPrimary : colors.text}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  rowStart: { justifyContent: 'flex-start' },
  rowEnd: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '84%',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
});
