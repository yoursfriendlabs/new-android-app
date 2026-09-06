import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

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

  return (
    <View
      style={[
        styles.container,
        { borderColor: colors.border, backgroundColor: colors.surface },
        containerStyle,
      ]}>
      <MaterialCommunityIcons color={colors.textMuted} name="magnify" size={18} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={[styles.input, { color: colors.text }, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {value ? (
        <Pressable hitSlop={6} onPress={() => onChangeText('')}>
          <MaterialCommunityIcons color={colors.textSoft} name="close-circle" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    fontSize: typography.body,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
});
