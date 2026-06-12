import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/src/theme';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  helperText?: string;
}

export function FormField({
  autoCapitalize = 'sentences',
  error,
  helperText,
  keyboardType = 'default',
  label,
  multiline = false,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: FormFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const showPasswordToggle = secureTextEntry && !multiline;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textSoft}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={showPasswordToggle ? !passwordVisible : false}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={[styles.input, multiline && styles.inputMultiline, showPasswordToggle && styles.inputWithAction]}
        />
        {showPasswordToggle ? (
          <Pressable style={styles.actionButton} onPress={() => setPasswordVisible((current) => !current)}>
            <MaterialCommunityIcons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={palette.textSoft}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.textMuted,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    color: palette.text,
    fontSize: typography.body,
  },
  inputWithAction: {
    paddingRight: 52,
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  helper: {
    fontSize: typography.caption,
    color: palette.textSoft,
    lineHeight: 18,
  },
  error: {
    fontSize: typography.caption,
    color: palette.danger,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionButton: {
    position: 'absolute',
    right: spacing.md,
    height: 40,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
