import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

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
      <MaterialCommunityIcons color={colors.textMuted} name="magnify" size={22} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={[styles.input, { color: colors.text }, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')}>
          <MaterialCommunityIcons color={colors.textSoft} name="close-circle" size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: spacing.xs,
  },
});
