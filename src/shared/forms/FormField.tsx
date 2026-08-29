import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  helperText?: string;
  icon?: IconName;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  blurOnSubmit?: boolean;
  editable?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  autoCorrect?: boolean;
}

export function FormField({
  autoCapitalize = 'sentences',
  autoComplete,
  autoCorrect = false,
  autoFocus = false,
  blurOnSubmit,
  editable = true,
  error,
  helperText,
  icon,
  keyboardType = 'default',
  label,
  maxLength,
  multiline = false,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  secureTextEntry = false,
  textContentType,
  value,
}: FormFieldProps) {
  const colors = usePalette();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const showPasswordToggle = secureTextEntry && !multiline;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
            backgroundColor: error ? colors.dangerSoft : !editable ? colors.surfaceMuted : colors.surface,
          },
          multiline && styles.inputWrapMultiline,
        ]}>
        {icon ? (
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={error ? colors.danger : focused ? colors.primary : colors.textSoft}
            style={[styles.leadingIcon, multiline && styles.leadingIconMultiline]}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={showPasswordToggle ? !passwordVisible : false}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          editable={editable}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { color: colors.text },
            icon ? styles.inputWithIcon : null,
            multiline && styles.inputMultiline,
            showPasswordToggle && styles.inputWithAction,
          ]}
        />
        {showPasswordToggle ? (
          <Pressable
            style={styles.actionButton}
            hitSlop={8}
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            onPress={() => setPasswordVisible((current) => !current)}>
            <MaterialCommunityIcons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSoft}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {!error && helperText ? <Text style={[styles.helper, { color: colors.textSoft }]}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  inputWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  inputWrapMultiline: {
    alignItems: 'flex-start',
  },
  leadingIcon: {
    marginLeft: spacing.md,
  },
  leadingIconMultiline: {
    marginTop: 16,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
  inputWithAction: {
    paddingRight: 44,
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  helper: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  error: {
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: 18,
  },
  actionButton: {
    position: 'absolute',
    right: spacing.sm,
    height: 40,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
