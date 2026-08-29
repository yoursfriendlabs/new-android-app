import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OTP_LENGTH } from '@/src/features/auth/lib/auth';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({ autoFocus = true, error = false, onChange, onComplete, value }: OtpInputProps) {
  const colors = usePalette();
  const inputRef = useRef<TextInput>(null);
  const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.wrap}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const active = digits.length === index;
          const filled = Boolean(digits[index]);
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  borderColor: error ? colors.danger : active ? colors.primary : filled ? colors.accentMuted : colors.border,
                  backgroundColor: error
                    ? colors.dangerSoft
                    : active
                      ? colors.white
                      : filled
                        ? colors.backgroundWarm
                        : colors.surface,
                },
              ]}>
              <Text style={[styles.digit, { color: colors.text }]}>{digits[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={(next) => {
          const nextDigits = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
          onChange(nextDigits);
          if (nextDigits.length === OTP_LENGTH && nextDigits !== digits) {
            onComplete?.(nextDigits);
          }
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 22,
    fontWeight: '700',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    fontSize: typography.body,
  },
});
