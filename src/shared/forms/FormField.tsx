import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  AccessibilityInfo,
  Platform,
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
import { useTranslation } from '@/src/i18n';
import { a11y, radius, spacing, typography } from '@/src/theme';

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
  const { t } = useTranslation();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const showPasswordToggle = secureTextEntry && !multiline;

  useEffect(() => {
    // Android/web announce the live region below; VoiceOver needs an announcement.
    if (error && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(`${label}. ${error}`);
    }
  }, [error, label]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? colors.danger : focused ? colors.primaryText : colors.borderStrong,
            backgroundColor: error ? colors.dangerSoft : !editable ? colors.surfaceMuted : colors.surface,
          },
          multiline && styles.inputWrapMultiline,
        ]}>
        {icon ? (
          <MaterialCommunityIcons
            accessible={false}
            importantForAccessibility="no"
            name={icon}
            size={20}
            color={error ? colors.danger : focused ? colors.primaryText : colors.textSoft}
            style={[styles.leadingIcon, multiline && styles.leadingIconMultiline]}
          />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error || helperText}
          accessibilityState={{ disabled: !editable }}
          aria-invalid={Boolean(error)}
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
          ]}
        />
        {showPasswordToggle ? (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={t(passwordVisible ? 'common.hidePassword' : 'common.showPassword')}
            onPress={() => setPasswordVisible((current) => !current)}>
            <MaterialCommunityIcons
              accessible={false}
              importantForAccessibility="no"
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSoft}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
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
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
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
    height: a11y.minTouchTarget,
    width: a11y.minTouchTarget,
    marginRight: spacing.xxs,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
