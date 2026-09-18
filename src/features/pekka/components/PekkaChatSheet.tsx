import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { Text } from '@/src/shared/ui/Text';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { getRangeForPeriod, type DatePeriod } from '@/src/shared/lib/format';
import { useDashboardSummary } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, spacing } from '@/src/theme';

import { usePekkaStore } from '../stores/pekka-store';
import { guideForWorkspace } from '../lib/guide';
import { questionsForWorkspace, type PekkaQuestion } from '../lib/questions';
import { PekkaMessage, type PekkaChatMessage } from './PekkaMessage';

const PERIOD_ORDER: DatePeriod[] = ['today', 'this_week', 'this_month', 'this_year'];

export function PekkaChatSheet() {
  const colors = usePalette();
  const { t } = useTranslation();
  const open = usePekkaStore((state) => state.open);
  const setOpen = usePekkaStore((state) => state.setOpen);

  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);

  const isPersonal = useMemo(
    () =>
      isPersonalWorkspace({
        role: session?.role ?? user?.role ?? undefined,
        permissions: accessControl?.permissions ?? user?.permissions,
        accessControl,
        enabledModules: businessProfile?.enabledModules,
        businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
      }),
    [accessControl, businessProfile, session, user],
  );

  const questions = useMemo(() => questionsForWorkspace(isPersonal), [isPersonal]);
  const guideTopics = useMemo(() => guideForWorkspace(isPersonal), [isPersonal]);

  const [messages, setMessages] = useState<PekkaChatMessage[]>([]);
  const [period, setPeriod] = useState<DatePeriod>('this_month');
  const [awaiting, setAwaiting] = useState<PekkaQuestion | null>(null);
  const [pending, setPending] = useState<PekkaQuestion | null>(null);

  const range = useMemo(() => getRangeForPeriod(period), [period]);
  const summaryQuery = useDashboardSummary(range);

  const counter = useRef(0);
  const nextId = () => `m${counter.current++}`;

  const greetingName = user?.name?.split(' ')[0] || t('pekka.friend');

  const pushMessage = (role: PekkaChatMessage['role'], text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role, text }]);
  };

  // Resolve a pending question once the summary for the chosen range is ready.
  useEffect(() => {
    if (!pending) return;
    if (summaryQuery.isLoading || summaryQuery.isFetching) return;

    if (summaryQuery.isError || !summaryQuery.data) {
      pushMessage('pekka', t('pekka.noData'));
      setPending(null);
      return;
    }

    const answer = pending.answer({ summary: summaryQuery.data, isPersonal, period, t });
    pushMessage('pekka', answer);
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, summaryQuery.data, summaryQuery.isLoading, summaryQuery.isFetching, summaryQuery.isError]);

  const handleQuestion = (question: PekkaQuestion) => {
    void Haptics.selectionAsync();
    pushMessage('user', t(question.labelKey));
    if (question.needsPeriod) {
      setAwaiting(question);
    } else {
      setPending(question);
    }
  };

  const handlePeriod = (value: DatePeriod) => {
    if (!awaiting) return;
    void Haptics.selectionAsync();
    const question = awaiting;
    setAwaiting(null);
    setPeriod(value);
    setPending(question);
  };

  // Wipe the conversation and start over from the greeting and guide.
  const handleClear = () => {
    void Haptics.selectionAsync();
    setMessages([]);
    setAwaiting(null);
    setPending(null);
  };

  const handleGuide = (route?: string) => {
    if (!route) return;
    void Haptics.selectionAsync();
    setOpen(false);
    router.push(route as never);
  };

  const busy = Boolean(pending);
  const periodOptions = PERIOD_ORDER.map((value) => ({
    value,
    label: t(`common.${periodCommonKey(value)}`),
  }));

  return (
    <BottomSheet
      visible={open}
      onClose={() => setOpen(false)}
      title={t('pekka.title')}
      subtitle={t('pekka.subtitle')}
      heightRatio={0.9}
      footer={
        <View style={styles.footer}>
          {awaiting ? (
            <View>
              <Text variant="label" tone="muted" style={styles.footerHint}>
                {t('pekka.periodPrompt')}
              </Text>
              <SegmentedTabs value={period} options={periodOptions} onChange={handlePeriod} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chipRow}>
              {questions.map((question) => (
                <Pressable
                  key={question.id}
                  onPress={() => handleQuestion(question)}
                  disabled={busy}
                  style={[styles.chip, { backgroundColor: colors.backgroundAlt, opacity: busy ? 0.6 : 1 }]}>
                  <MaterialCommunityIcons name={question.icon} size={15} color={colors.primaryText} />
                  <Text variant="label" style={styles.chipLabel}>
                    {t(question.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      }>
      <View style={styles.body}>
        {messages.length > 0 || awaiting ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pekka.clearChat')}
            hitSlop={8}
            onPress={handleClear}
            style={[styles.clearButton, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="restart" size={15} color={colors.textMuted} />
            <Text variant="label" tone="muted">
              {t('pekka.clearChat')}
            </Text>
          </Pressable>
        ) : null}
        <PekkaMessage
          message={{ id: 'greeting', role: 'pekka', text: t('pekka.greeting', { name: greetingName }) }}
        />

        {messages.length === 0 ? (
          <View style={styles.guide}>
            <Text variant="overline" tone="muted" style={styles.guideHeading}>
              {t('pekka.guideTitle')}
            </Text>
            {guideTopics.map((topic) => (
              <Pressable
                key={topic.id}
                onPress={() => handleGuide(topic.route)}
                style={[styles.guideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.guideIcon, { backgroundColor: colors.backgroundAlt }]}>
                  <MaterialCommunityIcons name={topic.icon} size={18} color={colors.primaryText} />
                </View>
                <View style={styles.guideText}>
                  <Text variant="bodyStrong">{t(topic.titleKey)}</Text>
                  <Text variant="caption" tone="muted">
                    {t(topic.bodyKey)}
                  </Text>
                </View>
                {topic.route ? (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {messages.map((message) => (
          <PekkaMessage key={message.id} message={message} />
        ))}

        {busy ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text variant="caption" tone="muted" style={styles.loadingText}>
              {t('pekka.loading')}
            </Text>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

function periodCommonKey(value: DatePeriod): string {
  switch (value) {
    case 'today':
      return 'today';
    case 'this_week':
      return 'thisWeek';
    case 'this_month':
      return 'thisMonth';
    case 'this_year':
      return 'thisYear';
    default:
      return 'today';
  }
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing.md,
  },
  clearButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  guide: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  guideHeading: {
    marginBottom: spacing.xs,
  },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  guideIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideText: {
    flex: 1,
    gap: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  loadingText: {
    marginLeft: spacing.xxs,
  },
  footer: {
    paddingTop: spacing.xs,
  },
  footerHint: {
    marginBottom: spacing.xs,
  },
  chipRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingRight: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    maxWidth: 220,
  },
});
