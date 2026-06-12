import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '@/src/theme';

interface SuccessSheetProps {
  visible: boolean;
  title: string;
  message: string;
  queued?: boolean;
  actions: Array<{ label: string; onPress: () => void; primary?: boolean }>;
  onClose: () => void;
}

export function SuccessSheet({ actions, message, onClose, queued, title, visible }: SuccessSheetProps) {
  const primaryAction = actions.find((action) => action.primary) ?? actions[0];
  const secondaryActions = actions.filter((action) => action !== primaryAction);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.illustrationWrap}>
            <View style={[styles.illustrationHalo, queued ? styles.illustrationHaloQueued : styles.illustrationHaloSuccess]}>
              <View style={[styles.illustrationCore, queued ? styles.illustrationCoreQueued : styles.illustrationCoreSuccess]}>
                <MaterialCommunityIcons
                  color={palette.white}
                  name={queued ? 'cloud-upload-outline' : 'check'}
                  size={54}
                />
              </View>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            {message}
            {queued ? ' It will sync automatically when you are back online.' : ''}
          </Text>
          {primaryAction ? (
            <Pressable style={styles.primaryAction} onPress={primaryAction.onPress}>
              <Text style={styles.primaryActionLabel}>{primaryAction.label}</Text>
            </Pressable>
          ) : null}
          {secondaryActions.map((action) => (
            <Pressable key={action.label} style={styles.secondaryAction} onPress={action.onPress}>
              <Text style={styles.secondaryActionLabel}>{action.label}</Text>
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
    backgroundColor: palette.surface,
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
  illustrationHaloSuccess: {
    backgroundColor: 'rgba(46, 125, 79, 0.10)',
  },
  illustrationHaloQueued: {
    backgroundColor: 'rgba(184, 107, 31, 0.12)',
  },
  illustrationCore: {
    width: 114,
    height: 114,
    borderRadius: 57,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCoreSuccess: {
    backgroundColor: palette.success,
  },
  illustrationCoreQueued: {
    backgroundColor: palette.warning,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.subheading,
    lineHeight: 34,
    color: palette.textMuted,
    textAlign: 'center',
  },
  primaryAction: {
    width: '100%',
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.success,
  },
  primaryActionLabel: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: palette.white,
  },
  secondaryAction: {
    minHeight: 32,
    justifyContent: 'center',
  },
  secondaryActionLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: palette.text,
  },
});
