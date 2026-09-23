import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { PLANS, planByCode } from '@/src/features/billing/lib/plans';
import { aiEnabled, dailyLimit, planCode, remainingQuestions } from '@/src/features/pekka/lib/quota';
import { usePekkaStore } from '@/src/features/pekka/stores/pekka-store';
import { useTranslation } from '@/src/i18n';
import { Screen } from '@/src/shared/layout/Screen';
import { Text } from '@/src/shared/ui/Text';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { useSubscription } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

/**
 * What the account is on today, and what each plan includes. No payment is
 * taken here: on Android that is Google Play's ground, and elsewhere the
 * upgrade is arranged by the team.
 */
export function PricingScreen() {
  const colors = usePalette();
  const { t } = useTranslation();
  const { data: subscription } = useSubscription();
  const currency = useAuthStore((state) => String(state.businessProfile?.currencyCode ?? 'NPR'));
  const usage = usePekkaStore((state) => state.aiUsage);

  const current = planCode(subscription);
  const currentPlan = planByCode(current);
  const limit = dailyLimit(subscription);
  const left = remainingQuestions(usage, limit);
  const renewal = String(subscription?.renewalDate ?? subscription?.expiryDate ?? '');

  return (
    <Screen topBarTitle={t('billing.title')}>
      <View style={[styles.current, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="label" tone="muted">
          {t('billing.currentPlan')}
        </Text>
        <Text variant="heading">{currentPlan ? t(currentPlan.nameKey) : subscription?.planName || t('billing.plans.free.name')}</Text>
        {renewal ? (
          <Text variant="caption" tone="muted">
            {t('billing.renews', { date: prettyDate(renewal.slice(0, 10)) })}
          </Text>
        ) : null}
        <View style={[styles.usage, { borderTopColor: colors.border }]}>
          <MaterialCommunityIcons name="robot-happy-outline" size={18} color={colors.primary} />
          <Text variant="caption" tone="muted" style={styles.usageText}>
            {aiEnabled(subscription)
              ? t('billing.questionsLeft', { left, limit })
              : t('billing.questionsOff')}
          </Text>
        </View>
      </View>

      {PLANS.map((plan) => {
        const active = plan.code === current;
        return (
          <View
            key={plan.code}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border },
            ]}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitle}>
                <Text variant="bodyStrong">{t(plan.nameKey)}</Text>
                <Text variant="caption" tone="muted">
                  {t(plan.summaryKey)}
                </Text>
              </View>
              <Text variant="bodyStrong" color={colors.primary}>
                {plan.price === null
                  ? t('billing.askUs')
                  : plan.price === 0
                    ? t('billing.free')
                    : t('billing.perMonth', { value: formatCurrency(plan.price, currency) })}
              </Text>
            </View>

            {plan.featureKeys.map((key) => (
              <View key={key} style={styles.feature}>
                <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                <Text variant="caption" style={styles.featureText}>
                  {t(key)}
                </Text>
              </View>
            ))}
            <View style={styles.feature}>
              <MaterialCommunityIcons name="chat-question-outline" size={16} color={colors.primary} />
              <Text variant="caption" style={styles.featureText}>
                {t('billing.features.aiPerDay', { count: plan.aiQuestions })}
              </Text>
            </View>

            {active ? (
              <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                <Text variant="label" color={colors.primaryText}>
                  {t('billing.yourPlan')}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <Text variant="caption" tone="muted" style={styles.footnote}>
        {t('billing.upgradeHint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  current: {
    padding: spacing.md,
    gap: spacing.xxs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  usage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  usageText: { flex: 1 },
  card: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, gap: 2 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  featureText: { flex: 1 },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    marginTop: spacing.xxs,
  },
  footnote: { marginTop: spacing.xs, marginBottom: spacing.xl },
});
