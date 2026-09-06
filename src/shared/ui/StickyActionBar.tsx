import type { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';

interface ActionProps {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
}

interface StickyActionBarProps {
  leading?: ReactNode;
  primary: ActionProps;
  secondary?: ActionProps;
  containerStyle?: StyleProp<ViewStyle>;
}

function ActionButton({ label, onPress, tone = 'secondary' }: ActionProps) {
  const colors = usePalette();
  let bg = colors.backgroundAlt;
  let fg = colors.text;

  if (tone === 'primary') {
    bg = colors.primary;
    fg = colors.onPrimary || '#ffffff';
  } else if (tone === 'success') {
    bg = colors.success;
    fg = colors.white || '#ffffff';
  } else if (tone === 'danger') {
    bg = colors.danger;
    fg = colors.white || '#ffffff';
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        pressed && { opacity: 0.88 },
      ]}
      onPress={onPress}>
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function StickyActionBar({ containerStyle, leading, primary, secondary }: StickyActionBarProps) {
  const colors = usePalette();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderColor: colors.border },
          containerStyle,
        ]}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.actions}>
          {secondary ? <ActionButton {...secondary} /> : null}
          <ActionButton {...primary} tone={primary.tone || 'primary'} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
  },
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: 4,
    padding: spacing.xs + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadows.floating,
    gap: spacing.xs,
  },
  leading: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
});
