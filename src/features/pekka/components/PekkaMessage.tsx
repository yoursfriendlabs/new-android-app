import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/src/i18n';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

export type PekkaRole = 'user' | 'pekka';

export interface PekkaMessageAction {
  label: string;
  route?: string;
  /** Id of a prepared sale or money draft (see pekka-handoff). */
  handoffId?: string;
  /** A link to open outside the app, e.g. a ready-made WhatsApp message. */
  url?: string;
  /** Party to write a payment reminder for. */
  collectId?: string;
}

export interface PekkaChatMessage {
  id: string;
  role: PekkaRole;
  text: string;
  /** A button under the answer: opens a screen, or a draft Pekka prepared. */
  action?: PekkaMessageAction;
  /** Ready-made text the user can send on WhatsApp or Viber. */
  shareText?: string;
}

export function PekkaMessage({ message, onSpeak, onAction, onShare }: {
  message: PekkaChatMessage;
  onSpeak?: (text: string) => void;
  onAction?: (action: PekkaMessageAction) => void;
  onShare?: (text: string) => void;
}) {
  const colors = usePalette();
  const { t } = useTranslation();
  const mine = message.role === 'user';

  return (
    <View style={[styles.row, mine ? styles.rowEnd : styles.rowStart]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.backgroundAlt, borderBottomLeftRadius: 4 },
        ]}>
        <Text variant="body" color={mine ? colors.onPrimary : colors.text}>
          {message.text}
        </Text>
        {message.action && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onAction(message.action!)}
            style={[styles.action, { borderColor: colors.primary }]}>
            <Text variant="label" color={colors.primary}>
              {message.action.label}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
        {message.shareText && onShare ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onShare(message.shareText!)}
            style={[styles.action, { borderColor: colors.primary }]}>
            <Text variant="label" color={colors.primary}>
              {t('pekka.share.button')}
            </Text>
            <MaterialCommunityIcons name="share-variant" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {!mine && onSpeak ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('pekka.readAloud')}
          hitSlop={8}
          onPress={() => onSpeak(message.text)}
          style={styles.speak}>
          <MaterialCommunityIcons name="volume-high" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  rowStart: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  rowEnd: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '84%',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  speak: {
    padding: spacing.xxs,
    marginLeft: spacing.xxs,
  },
});
