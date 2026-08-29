import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

interface SuccessSheetProps {
  visible: boolean;
  title: string;
  message: string;
  queued?: boolean;
  actions: Array<{ label: string; onPress: () => void; primary?: boolean }>;
  onClose: () => void;
}

export function SuccessSheet({ actions, message, onClose, queued, title, visible }: SuccessSheetProps) {
  const colors = usePalette();
  const primaryAction = actions.find((action) => action.primary) ?? actions[0];
  const secondaryActions = actions.filter((action) => action !== primaryAction);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.illustrationWrap}>
            <View
              style={[
                styles.illustrationHalo,
                { backgroundColor: queued ? colors.warningSoft : colors.successSoft },
              ]}>
              <View
                style={[
                  styles.illustrationCore,
                  { backgroundColor: queued ? colors.warning : colors.success },
                ]}>
                <MaterialCommunityIcons
                  color={colors.white}
                  name={queued ? 'cloud-upload-outline' : 'check'}
                  size={54}
                />
              </View>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {message}
            {queued ? ' It will sync automatically when you are back online.' : ''}
          </Text>
          {primaryAction ? (
            <Pressable style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={primaryAction.onPress}>
              <Text style={[styles.primaryActionLabel, { color: colors.onPrimary }]}>{primaryAction.label}</Text>
            </Pressable>
          ) : null}
          {secondaryActions.map((action) => (
            <Pressable key={action.label} style={styles.secondaryAction} onPress={action.onPress}>
              <Text style={[styles.secondaryActionLabel, { color: colors.text }]}>{action.label}</Text>
            </Pressable>
          ))}
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
  sheet: {
    width: '100%',
    borderRadius: 32,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationHalo: {
    width: 144,
    height: 144,
    borderRadius: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCore: {
    width: 114,
    height: 114,
    borderRadius: 57,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: typography.subheading,
    lineHeight: 34,
    textAlign: 'center',
  },
  primaryAction: {
    width: '100%',
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionLabel: {
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  secondaryAction: {
    minHeight: 32,
    justifyContent: 'center',
  },
  secondaryActionLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
});
