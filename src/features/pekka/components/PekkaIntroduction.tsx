import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, spacing } from '@/src/theme';
import type { PekkaGuideTopic } from '../lib/guide';

export function PekkaIntroduction({ personal, topics, onOpen }: {
  personal: boolean; topics: PekkaGuideTopic[]; onOpen: (route?: string) => void;
}) {
  const colors = usePalette();
  const { t } = useTranslation();
  const [step, setStep] = useState<number | null>(null);
  const topic = step === null ? null : topics[step];
  return <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
    <Text variant="subheading">{t('pekka.meet')}</Text>
    <Text variant="body" tone="muted">{t(personal ? 'pekka.introPersonal' : 'pekka.introBusiness')}</Text>
    {topic && step !== null ? <>
      <Text variant="overline" tone="muted">{t('pekka.tourStep', { step: step + 1, total: topics.length })}</Text>
      <View style={styles.heading}><MaterialCommunityIcons name={topic.icon} size={22} color={colors.primary} /><Text variant="bodyStrong">{t(topic.titleKey)}</Text></View>
      <Text variant="body">{t(topic.bodyKey)}</Text>
      <Pressable accessibilityRole="button" onPress={() => onOpen(topic.route)} style={styles.action}><Text variant="label" color={colors.primary}>{t('pekka.openFeature')}</Text></Pressable>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => setStep(step > 0 ? step - 1 : null)} style={styles.action}><Text variant="label">{t('common.back')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setStep(step + 1 < topics.length ? step + 1 : null)} style={styles.action}><Text variant="label" color={colors.primary}>{t(step + 1 < topics.length ? 'common.next' : 'common.done')}</Text></Pressable>
      </View>
    </> : <Pressable accessibilityRole="button" onPress={() => setStep(0)} style={[styles.action, { backgroundColor: colors.backgroundAlt, borderRadius: radius.md }]}><Text variant="label" color={colors.primary}>{t('pekka.startTour')}</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
});
