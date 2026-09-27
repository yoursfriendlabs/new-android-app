import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '@/src/i18n';
import { usePalette } from '@/src/stores/theme-store';
import { a11y, radius, spacing, typography } from '@/src/theme';

interface SearchFieldProps {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function SearchField({
  containerStyle,
  inputStyle,
  onChangeText,
  placeholder,
  value,
}: SearchFieldProps) {
  const colors = usePalette();
  const { t } = useTranslation();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        { borderColor: focused ? colors.primaryText : colors.borderStrong, backgroundColor: colors.surface },
        containerStyle,
      ]}>
      <MaterialCommunityIcons accessible={false} importantForAccessibility="no" color={colors.textMuted} name="magnify" size={20} />
      <TextInput
        ref={input}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={[styles.input, { color: colors.text }, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}
          style={({ pressed }) => [styles.clearButton, pressed && { backgroundColor: colors.surfaceMuted }]}
          onPress={() => {
            onChangeText('');
            input.current?.focus();
          }}>
          <MaterialCommunityIcons accessible={false} importantForAccessibility="no" color={colors.textMuted} name="close-circle" size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: a11y.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.xxs,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: a11y.minTouchTarget,
    fontSize: typography.body,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  clearButton: {
    width: a11y.minTouchTarget,
    height: a11y.minTouchTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
