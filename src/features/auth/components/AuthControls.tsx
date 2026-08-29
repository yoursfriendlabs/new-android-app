import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getPasswordIssues, PASSWORD_MIN_LENGTH, type PasswordIssue } from '@/src/features/auth/lib/auth';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

interface AuthButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost';
}

export function AuthButton({
  disabled = false,
  label,
  loading = false,
  onPress,
  tone = 'primary',
}: AuthButtonProps) {
  const colors = usePalette();
  const isPrimary = tone === 'primary';
  const isGhost = tone === 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        isPrimary && { backgroundColor: colors.primary },
        !isPrimary && !isGhost && { backgroundColor: colors.backgroundAlt },
        isGhost && styles.ghostButton,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.text} />
      ) : (
        <Text style={[styles.buttonLabel, { color: isPrimary ? colors.onPrimary : colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

interface AuthNoticeProps {
  message: string;
  tone?: 'error' | 'success' | 'info';
}

export function AuthNotice({ message, tone = 'info' }: AuthNoticeProps) {
  const colors = usePalette();
  const icon =
    tone === 'error' ? 'alert-circle-outline' : tone === 'success' ? 'check-circle-outline' : 'information-outline';
  const iconColor = tone === 'error' ? colors.danger : tone === 'success' ? colors.success : colors.textMuted;
  const textColor = tone === 'error' ? colors.danger : tone === 'success' ? colors.success : colors.textMuted;
  const backgroundColor =
    tone === 'error' ? colors.dangerSoft : tone === 'success' ? colors.successSoft : colors.backgroundWarm;
  const borderColor = tone === 'error' ? '#f1c0c0' : tone === 'success' ? '#b7e0c8' : colors.border;

  return (
    <View style={[styles.notice, { backgroundColor, borderColor }]}>
      <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      <Text style={[styles.noticeText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

interface AuthFooterLinkProps {
  prompt: string;
  action: string;
  onPress: () => void;
}

export function AuthFooterLink({ action, onPress, prompt }: AuthFooterLinkProps) {
  const colors = usePalette();
  return (
    <View style={styles.footerRow}>
      <Text style={[styles.footerPrompt, { color: colors.textMuted }]}>{prompt}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={[styles.footerAction, { color: colors.primary }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

interface StepIndicatorProps {
  step: number;
  total: number;
}

export function StepIndicator({ step, total }: StepIndicatorProps) {
  const colors = usePalette();
  return (
    <View style={styles.stepWrap}>
      <Text style={[styles.stepLabel, { color: colors.textSoft }]}>
        Step {step} of {total}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.accentMuted }]}>
        <View style={[styles.trackFill, { width: `${(step / total) * 100}%`, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}

const PASSWORD_RULES: Array<{ key: PasswordIssue; label: string }> = [
  { key: 'length', label: `${PASSWORD_MIN_LENGTH}+ chars` },
  { key: 'uppercase', label: 'Uppercase' },
  { key: 'lowercase', label: 'Lowercase' },
  { key: 'number', label: 'Number' },
];

export function PasswordHints({ password }: { password: string }) {
  const colors = usePalette();
  if (!password) return null;
  const issues = new Set(getPasswordIssues(password));

  return (
    <View style={styles.hintRow}>
      {PASSWORD_RULES.map((rule) => {
        const ok = !issues.has(rule.key);
        return (
          <View
            key={rule.key}
            style={[
              styles.hintChip,
              {
                backgroundColor: ok ? colors.successSoft : colors.backgroundWarm,
                borderColor: ok ? '#b7e0c8' : colors.border,
              },
            ]}>
            <MaterialCommunityIcons
              name={ok ? 'check' : 'circle-outline'}
              size={12}
              color={ok ? colors.success : colors.textSoft}
            />
            <Text style={[styles.hintText, { color: ok ? colors.success : colors.textSoft }]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function AuthInlineLink({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const colors = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Text style={[styles.inlineLink, { color: colors.primary }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md,
  },
  noticeText: {
    flex: 1,
    fontSize: typography.label,
    lineHeight: 20,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  footerPrompt: {
    fontSize: typography.body,
  },
  footerAction: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  stepWrap: {
    gap: spacing.xs,
  },
  stepLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  track: {
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  hintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inlineLink: {
    fontSize: typography.label,
    fontWeight: '700',
  },
});
