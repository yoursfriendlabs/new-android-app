import type { ComponentProps } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface ActionSheetItem {
  id: string;
  label: string;
  icon?: IconName;
  tone?: 'default' | 'danger';
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: ActionSheetItem[];
  onClose: () => void;
}

export function ActionSheet({ actions, onClose, subtitle, title, visible }: ActionSheetProps) {
  const colors = usePalette();

  return (
    <BottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose} compact>
      <View style={styles.list}>
        {actions.map((action) => {
          const color = action.tone === 'danger' ? colors.danger : colors.text;
          return (
            <Pressable
              key={action.id}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.backgroundAlt },
                pressed && { opacity: 0.88 },
              ]}
              onPress={() => {
                onClose();
                setTimeout(() => action.onPress(), 280);
              }}>
              {action.icon ? <MaterialCommunityIcons color={color} name={action.icon} size={20} /> : null}
              <Text style={[styles.label, { color }]}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  row: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
