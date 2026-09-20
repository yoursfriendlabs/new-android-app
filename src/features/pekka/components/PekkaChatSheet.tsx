import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { askPekka, type PekkaChoice, type PekkaReply } from '@/src/api/pekka';
import { PekkaIntroduction } from './PekkaIntroduction';
import { PekkaComposer } from './PekkaComposer';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { Text } from '@/src/shared/ui/Text';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { formatCurrency, getRangeForPeriod, type DatePeriod } from '@/src/shared/lib/format';
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
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [choices, setChoices] = useState<PekkaChoice[]>([]);
  const lastQuestion = useRef('');
  const requestVersion = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => () => { requestVersion.current += 1; }, []);

  const [period, setPeriod] = useState<DatePeriod>('this_month');
  const [awaiting, setAwaiting] = useState<PekkaQuestion | null>(null);
  const [pending, setPending] = useState<PekkaQuestion | null>(null);

  const range = useMemo(() => getRangeForPeriod(period), [period]);
  const summaryQuery = useDashboardSummary(range, open && Boolean(pending));

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
    requestVersion.current += 1;
    inFlight.current = false;
    setAsking(false);
    setChoices([]);
    setDraft('');
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

  function replyText(reply: PekkaReply) {
    if (reply.status === 'choose') return t('pekka.chooseMatch');
    if (reply.status === 'not-found') return t('pekka.noMatch');
    if (reply.status === 'personal') return t('pekka.personalLookup');
    if (reply.status !== 'answer') return t('pekka.lookupHelp');
    const value = formatCurrency(reply.amount ?? 0, reply.currency || businessProfile?.currencyCode || 'NPR');
    if (reply.kind === 'product') return t('pekka.productAnswer', { name: reply.name || '', value, unit: reply.unit ? ` / ${reply.unit}` : '' });
    return t(`pekka.partyAnswer.${reply.direction || 'settled'}`, { name: reply.name || '', value });
  }

  async function handleAsk(choice?: PekkaChoice) {
    if (inFlight.current || pending) return;
    const question = choice ? lastQuestion.current : draft.trim();
    if (!question) return;
    inFlight.current = true;
    const version = ++requestVersion.current;
    setAsking(true);
    setAwaiting(null);
    setChoices([]);
    pushMessage('user', choice ? choice.name : question);
    if (!choice) { setDraft(''); lastQuestion.current = question; }
    try {
      const reply = await askPekka(question, choice ? { id: choice.id, kind: choice.kind } : undefined);
      if (requestVersion.current !== version) return;
      pushMessage('pekka', replyText(reply));
      setChoices(reply.candidates ?? []);
    } catch (error) {
      if (requestVersion.current === version) pushMessage('pekka', error instanceof Error ? error.message : t('pekka.noData'));
    } finally {
      if (requestVersion.current === version) { inFlight.current = false; setAsking(false); }
    }
  }

  const busy = Boolean(pending) || asking;
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
          <PekkaComposer value={draft} onChange={setDraft} onSend={() => void handleAsk()} open={open} busy={busy} />
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
          message={{ id: 'greeting', role: 'pekka', text: t(isPersonal ? 'pekka.greetingPersonal' : 'pekka.greeting', { name: greetingName }) }}
        />

        {messages.length === 0 ? (
          <PekkaIntroduction personal={isPersonal} topics={guideTopics} onOpen={handleGuide} />
        ) : null}

        {messages.map((message) => (
          <PekkaMessage key={message.id} message={message} />
        ))}

        {choices.map((choice) => (
          <Pressable key={`${choice.kind}-${choice.id}`} onPress={() => void handleAsk(choice)} disabled={busy}
            style={[styles.guideCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={choice.kind === 'product' ? 'package-variant' : 'account-outline'} size={20} color={colors.primary} />
            <View style={styles.guideText}><Text variant="bodyStrong">{choice.name}</Text>
              {choice.detail ? <Text variant="caption" tone="muted">{choice.detail}</Text> : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
          </Pressable>
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
