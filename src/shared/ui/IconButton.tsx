import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { a11y, iconSize, radius } from '@/src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/**
 * A compact visual icon button with a comfortable hit area.
 * Keep it for secondary actions where a full text button would add clutter.
 */
export function IconButton({ disabled = false, icon, label, onPress, style }: IconButtonProps) {
  const colors = usePalette();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={a11y.hitSlop}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && !disabled ? colors.backgroundAlt : colors.surface,
          borderColor: colors.border,
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}>
      <MaterialCommunityIcons
        accessible={false}
        importantForAccessibility="no"
        color={colors.text}
        name={icon}
        size={iconSize.control}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
