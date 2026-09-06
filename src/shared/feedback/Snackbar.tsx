import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';

export interface SnackbarProps {
  visible: boolean;
  message: string;
  tone?: 'success' | 'danger' | 'info';
  onDismiss: () => void;
  duration?: number;
}

export function Snackbar({
  duration = 3000,
  message,
  onDismiss,
  tone = 'success',
  visible,
}: SnackbarProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }
  }, [visible, duration]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 20,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const isSuccess = tone === 'success';
  const isDanger = tone === 'danger';
  const bg = isSuccess ? colors.success : isDanger ? colors.danger : colors.text;
  const icon = isSuccess ? 'check-circle' : isDanger ? 'alert-circle' : 'information';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: insets.bottom + 16,
          opacity,
          transform: [{ translateY }],
        },
      ]}>
      <View style={[styles.snack, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.white} />
        <Text style={[styles.text, { color: colors.white }]}>{message}</Text>
        <Pressable onPress={handleClose} hitSlop={8} style={styles.close}>
          <MaterialCommunityIcons name="close" size={16} color="rgba(255, 255, 255, 0.8)" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    width: '100%',
    ...shadows.card,
  },
  text: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '600',
  },
  close: {
    padding: 2,
  },
});
