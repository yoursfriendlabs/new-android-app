import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';

import type { HabitWin } from '@/src/features/habits/lib/habits';
import { plusCoins } from '@/src/features/habits/lib/coins';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

interface WinMomentProps {
  win: HabitWin | null;
  onClose: () => void;
  onAgain?: () => void;
}

export function WinMoment({ onAgain, onClose, win }: WinMomentProps) {
  const colors = usePalette();

  useEffect(() => {
    if (!win) return;
    const timer = setTimeout(onClose, 2400);
    return () => clearTimeout(timer);
  }, [onClose, win]);

  if (!win) return null;

  const toneBg =
    win.tone === 'streak' || win.tone === 'coin'
      ? colors.warningSoft
      : win.tone === 'badge'
        ? colors.purpleSoft
        : colors.successSoft;
  const toneFg =
    win.tone === 'streak' || win.tone === 'coin'
      ? colors.warning
      : win.tone === 'badge'
        ? colors.purple
        : colors.success;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: toneBg }]}>
            <MaterialCommunityIcons color={toneFg} name={win.icon} size={36} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{win.title}</Text>
          {win.coins ? (
            <Text style={[styles.coins, { color: colors.warning }]}>{plusCoins(win.coins)}</Text>
          ) : null}
          <Text style={[styles.message, { color: colors.textMuted }]}>{win.message}</Text>
          <Pressable style={[styles.primary, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={[styles.primaryLabel, { color: colors.white }]}>Nice</Text>
          </Pressable>
          {onAgain ? (
            <Pressable style={styles.again} onPress={onAgain}>
              <Text style={[styles.againLabel, { color: colors.text }]}>Add another</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20, 16, 12, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    textAlign: 'center',
  },
  coins: {
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  message: {
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  primary: {
    marginTop: spacing.sm,
    minHeight: 48,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  again: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  againLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
});
