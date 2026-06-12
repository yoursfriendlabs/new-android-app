import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

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
  return (
    <View style={[styles.container, containerStyle]}>
      <MaterialCommunityIcons color={palette.textMuted} name="magnify" size={22} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={palette.textSoft}
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')}>
          <MaterialCommunityIcons color={palette.textSoft} name="close-circle" size={20} />
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
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    color: palette.text,
    fontSize: 17,
    paddingVertical: spacing.xs,
  },
});
