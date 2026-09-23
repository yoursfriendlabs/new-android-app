import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { partiesApi } from '@/src/api';
import { askPekka, askPekkaChat, type PekkaChoice, type PekkaReply } from '@/src/api/pekka';
import { PekkaIntroduction } from './PekkaIntroduction';
import { PekkaComposer } from './PekkaComposer';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { Text } from '@/src/shared/ui/Text';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { formatCurrency, getRangeForPeriod, localIsoDate, prettyDate, type DatePeriod } from '@/src/shared/lib/format';
import { useDashboardSummary } from '@/src/shared/hooks/useAppQueries';
import type { DashboardSummary } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { useLanguageStore } from '@/src/stores/language-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, spacing } from '@/src/theme';

import { usePekkaAi } from '../hooks/usePekkaAi';
import { usePekkaNudges } from '../hooks/usePekkaNudges';
import { usePekkaWorkspace } from '../hooks/usePekkaWorkspace';
import { computeStreak } from '@/src/features/habits/lib/habits';
import { COIN_REWARDS } from '@/src/features/habits/lib/coins';
import { useHabitStore } from '@/src/stores/habit-store';
import { buildCollectMessage, phoneForLinks, whatsappUrl } from '../lib/collect';
import { buildDayClose, todayRange } from '../lib/day-close';
import { canAskAi } from '../lib/quota';
import { buildShareSummary } from '../lib/share-summary';
import { buildMorningBrief, yesterdayRange } from '../lib/morning';
import { usePekkaStore } from '../stores/pekka-store';
import { PekkaDailyCards } from './PekkaDailyCards';
import { guideForWorkspace } from '../lib/guide';
import { prepareMoney, prepareSale, type PreparedReply } from '../lib/entry-draft';
import { parseEntry } from '../lib/entry-parser';
import { matchPekkaConversation } from '../lib/conversation';
import { matchPekkaIntent } from '../lib/intent';
import { usePekkaHandoff } from '../stores/pekka-handoff';
import { questionsForWorkspace, type PekkaQuestion } from '../lib/questions';
import { speakPekka, stopPekkaSpeech } from '../lib/speech';
import { PekkaMessage, type PekkaChatMessage, type PekkaMessageAction } from './PekkaMessage';

const PERIOD_ORDER: DatePeriod[] = ['today', 'this_week', 'this_month', 'this_year'];

export function PekkaChatSheet() {
  const colors = usePalette();
  const { t } = useTranslation();
  const open = usePekkaStore((state) => state.open);
  const setOpen = usePekkaStore((state) => state.setOpen);
  const language = useLanguageStore((state) => state.language);
  const speechLang = language === 'ne' ? 'ne-NP' : 'en-US';

  const user = useAuthStore((state) => state.user);
  const { isPersonal, currency } = usePekkaWorkspace();
  const briefRequested = usePekkaStore((state) => state.briefRequested);
  const closeRequested = usePekkaStore((state) => state.closeRequested);
  const tipsRequested = usePekkaStore((state) => state.tipsRequested);
  const closeDays = usePekkaStore((state) => state.closeDays);
  const aiUsage = usePekkaStore((state) => state.aiUsage);
  // The AI is a paid, counted thing; everything Pekka works out on the phone stays free.
  // The server has the final say on both, so staff see the same allowance as the owner.
  const { on: aiOn, limit: aiLimit } = usePekkaAi();
  const businessName = useAuthStore((state) => String(state.businessProfile?.businessName ?? ''));

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

  // Yesterday's summary: from the chip, or straight in from the morning notification.
  const [briefPending, setBriefPending] = useState(false);
  const briefRange = useMemo(() => yesterdayRange(), [briefPending]);
  const briefQuery = useDashboardSummary(briefRange, open && briefPending);

  // Closing today's book: today's numbers, the streak, and a coin for keeping it up.
  const [closePending, setClosePending] = useState(false);
  const closeRange = useMemo(() => todayRange(), [closePending]);
  const closeQuery = useDashboardSummary(closeRange, open && closePending);

  // Tips share the floating button's query, so opening Pekka costs no extra requests.
  const tips = usePekkaNudges(open);
  const [tipsPending, setTipsPending] = useState(false);

  const counter = useRef(0);
  const nextId = () => `m${counter.current++}`;

  const greetingName = user?.name?.split(' ')[0] || t('pekka.friend');

  // Asked out loud → answered out loud. Typed questions and chips stay silent.
  const draftFromVoice = useRef(false);
  const answerAloud = useRef(false);
  useEffect(() => { if (!open) stopPekkaSpeech(); }, [open]);

  const pushMessage = (
    role: PekkaChatMessage['role'],
    text: string,
    action?: PekkaChatMessage['action'],
    shareText?: string,
  ) => {
    setMessages((prev) => [...prev, { id: nextId(), role, text, action, shareText }]);
    if (role === 'pekka' && answerAloud.current) {
      answerAloud.current = false;
      speakPekka(text, speechLang);
    }
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

  // Runs a totals question, asking for the period only when it wasn't said.
  const runQuestion = (question: PekkaQuestion, saidPeriod: DatePeriod | null = null) => {
    if (question.needsPeriod && !saidPeriod) {
      setAwaiting(question);
      return;
    }
    if (saidPeriod) setPeriod(saidPeriod);
    setPending(question);
  };

  const askBrief = (fromNotification = false) => {
    if (!fromNotification) void Haptics.selectionAsync();
    answerAloud.current = false;
    setAwaiting(null);
    pushMessage('user', t('pekka.morning.question'));
    setBriefPending(true);
  };

  useEffect(() => {
    if (!open || !briefRequested) return;
    usePekkaStore.getState().consumeBrief();
    if (!briefPending) askBrief(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, briefRequested]);

  useEffect(() => {
    if (!briefPending || briefQuery.isLoading || briefQuery.isFetching) return;
    setBriefPending(false);
    if (briefQuery.isError || !briefQuery.data) {
      pushMessage('pekka', t('pekka.noData'));
      return;
    }
    const brief = buildMorningBrief(briefQuery.data, {
      isPersonal,
      t,
      currency,
      streak: computeStreak(closeDays, localIsoDate()),
    });
    pushMessage(
      'pekka',
      brief.lines.join('\n'),
      brief.action ? { label: t(brief.action.labelKey), route: brief.action.route } : undefined,
      buildShareSummary(briefQuery.data, {
        isPersonal,
        t,
        currency,
        title: businessName,
        dateLabel: prettyDate(briefRange.from),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefPending, briefQuery.data, briefQuery.isLoading, briefQuery.isFetching, briefQuery.isError]);

  const askDayClose = (fromNotification = false) => {
    if (!fromNotification) void Haptics.selectionAsync();
    answerAloud.current = false;
    setAwaiting(null);
    pushMessage('user', t('pekka.close.question'));
    setClosePending(true);
  };

  useEffect(() => {
    if (!open || !closeRequested) return;
    usePekkaStore.getState().consumeDayClose();
    if (!closePending) askDayClose(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closeRequested]);

  // Closing the book records the day, keeps the streak and pays a coin for it.
  const finishDayClose = async (summary: DashboardSummary) => {
    const today = localIsoDate();
    const days = await usePekkaStore.getState().recordDayClose(today);
    const streak = computeStreak(days, today);
    const brief = buildDayClose(summary, { isPersonal, t, currency, streak });
    const coins = await useHabitStore.getState().awardCoins(COIN_REWARDS.checkin, {
      claimId: `pekka-close:${today}`,
      reason: 'checkin',
      label: t('pekka.close.cardTitle'),
    });
    const lines = coins ? [...brief.lines, t('pekka.close.coins', { count: coins })] : brief.lines;
    pushMessage(
      'pekka',
      lines.join('\n'),
      brief.action ? { label: t(brief.action.labelKey), route: brief.action.route } : undefined,
      buildShareSummary(summary, { isPersonal, t, currency, title: businessName, dateLabel: prettyDate(today) }),
    );
  };

  useEffect(() => {
    if (!closePending || closeQuery.isLoading || closeQuery.isFetching) return;
    setClosePending(false);
    if (closeQuery.isError || !closeQuery.data) {
      pushMessage('pekka', t('pekka.noData'));
      return;
    }
    void finishDayClose(closeQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closePending, closeQuery.data, closeQuery.isLoading, closeQuery.isFetching, closeQuery.isError]);

  const askTips = () => {
    void Haptics.selectionAsync();
    answerAloud.current = false;
    setAwaiting(null);
    pushMessage('user', t('pekka.tips.question'));
    setTipsPending(true);
  };

  useEffect(() => {
    if (!open || !tipsRequested) return;
    usePekkaStore.getState().consumeTips();
    if (!tipsPending) askTips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipsRequested]);

  useEffect(() => {
    if (!tipsPending || tips.isLoading) return;
    setTipsPending(false);
    if (!tips.nudges.length) {
      pushMessage('pekka', t('pekka.tips.none'));
      return;
    }
    for (const nudge of tips.nudges) {
      // Money owed comes with an offer to write the reminder, not just a link.
      const action = nudge.party
        ? { label: t('pekka.collect.button'), collectId: nudge.party.id }
        : nudge.action;
      pushMessage('pekka', nudge.text, action);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipsPending, tips.isLoading]);

  const handleQuestion = (question: PekkaQuestion) => {
    void Haptics.selectionAsync();
    answerAloud.current = false;
    pushMessage('user', t(question.labelKey));
    runQuestion(question);
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
    answerAloud.current = false;
    stopPekkaSpeech();
    setAsking(false);
    setChoices([]);
    setDraft('');
    setMessages([]);
    setAwaiting(null);
    setPending(null);
    setBriefPending(false);
    setClosePending(false);
    setTipsPending(false);
    usePekkaHandoff.getState().clear();
  };

  // Sending the day's numbers to WhatsApp, Viber or anywhere else the phone offers.
  const handleShare = (text: string) => {
    void Haptics.selectionAsync();
    void Share.share({ message: text }).catch(() => undefined);
  };

  const handleGuide = (route?: string) => {
    if (!route) return;
    void Haptics.selectionAsync();
    setOpen(false);
    router.push(route as never);
  };

  /** Fetches the person's number, then offers the message ready to send. */
  const writeReminder = async (partyId: string) => {
    const overdue = tips.nudges.find((nudge) => nudge.party?.id === partyId)?.party;
    if (!overdue) return;
    const message = buildCollectMessage(overdue, { t, currency });
    let phone = '';
    try {
      const party = await partiesApi.get(partyId);
      phone = phoneForLinks(typeof party?.phone === 'string' ? party.phone : '');
    } catch {
      // Offline or no access: the message can still be shared by hand.
    }
    pushMessage(
      'pekka',
      message,
      phone ? { label: t('pekka.collect.whatsapp'), url: whatsappUrl(phone, message) } : undefined,
      message,
    );
    if (!phone) pushMessage('pekka', t('pekka.collect.noPhone', { name: overdue.name }));
  };

  const handleAction = (action: PekkaMessageAction) => {
    if (action.collectId) {
      void Haptics.selectionAsync();
      void writeReminder(action.collectId);
      return;
    }
    if (action.url) {
      void Haptics.selectionAsync();
      void Linking.openURL(action.url).catch(() => pushMessage('pekka', t('pekka.collect.failed')));
      return;
    }
    if (!action.handoffId) {
      handleGuide(action.route);
      return;
    }
    const type = usePekkaHandoff.getState().arm(action.handoffId);
    if (!type) return;
    void Haptics.selectionAsync();
    setOpen(false);
    // The sale opens in POS; money opens the quick form over the current screen.
    if (type === 'sale') router.navigate('/(app)/(tabs)/pos' as never);
  };

  // "sold 2 coke to Ram" / "spent 250 on tea": prepare a draft, never save it.
  const replyWithEntry = (reply: PreparedReply) => {
    if (reply.handoff) {
      const handoffId = nextId();
      const { label: _label, ...handoff } = reply.handoff;
      usePekkaHandoff.getState().prepare(handoffId, handoff);
      pushMessage('pekka', reply.text, { label: reply.handoff.label, handoffId });
    } else {
      pushMessage('pekka', reply.text, reply.route);
    }
  };

  function replyText(reply: PekkaReply) {
    if (reply.status === 'choose') return t('pekka.chooseMatch');
    if (reply.status === 'not-found') return t('pekka.noMatch');
    if (reply.status === 'personal') return t('pekka.personalLookup');
    if (reply.status !== 'answer') return t(isPersonal ? 'pekka.lookupHelpPersonal' : 'pekka.lookupHelp', { name: greetingName });
    const value = formatCurrency(reply.amount ?? 0, reply.currency || currency);
    if (reply.kind === 'product') return t('pekka.productAnswer', { name: reply.name || '', value, unit: reply.unit ? ` / ${reply.unit}` : '' });
    return t(`pekka.partyAnswer.${reply.direction || 'settled'}`, { name: reply.name || '', value });
  }

  async function handleAsk(choice?: PekkaChoice) {
    if (inFlight.current || pending) return;
    const question = choice ? lastQuestion.current : draft.trim();
    if (!question) return;
    inFlight.current = true;
    answerAloud.current = !choice && draftFromVoice.current;
    draftFromVoice.current = false;
    const version = ++requestVersion.current;
    setAsking(true);
    setAwaiting(null);
    setChoices([]);
    pushMessage('user', choice ? choice.name : question);
    if (!choice) { setDraft(''); lastQuestion.current = question; }

    const conversation = choice ? null : matchPekkaConversation(question);
    if (conversation) {
      const key = conversation === 'capabilities'
        ? (isPersonal ? 'pekka.introPersonal' : 'pekka.introBusiness')
        : `pekka.conversation.${conversation}`;
      pushMessage('pekka', t(key, { name: greetingName }));
      inFlight.current = false;
      setAsking(false);
      return;
    }

    const entry = choice ? null : parseEntry(question);
    if (entry && entry.type === 'sale' && isPersonal) {
      pushMessage('pekka', t('pekka.entry.saleInPersonal'));
      inFlight.current = false;
      setAsking(false);
      return;
    }
    if (entry) {
      try {
        const reply = entry.type === 'sale'
          ? await prepareSale(entry, { t, currency })
          : await prepareMoney(entry, { t, currency });
        if (requestVersion.current === version) replyWithEntry(reply);
      } catch {
        // Offline or an older server without name matching: say so plainly.
        if (requestVersion.current === version) pushMessage('pekka', t('pekka.entry.failed'));
      } finally {
        if (requestVersion.current === version) { inFlight.current = false; setAsking(false); }
      }
      return;
    }

    // Totals and "how do I…" are answered on the phone; only lookups go to the server.
    const intent = choice ? null : matchPekkaIntent(question, isPersonal);
    const total = intent?.type === 'total' ? questions.find((item) => item.id === intent.id) : undefined;
    if (intent && (intent.type === 'help' || total)) {
      inFlight.current = false;
      setAsking(false);
      if (total && intent.type === 'total') runQuestion(total, intent.period);
      else if (intent.type === 'help') {
        pushMessage('pekka', t(`pekka.help.${intent.topic.id}`), { label: t('pekka.openFeature'), route: intent.topic.route });
      }
      return;
    }

    // Anything left over goes to the AI, when the plan includes it and the day's
    // allowance is not spent. Otherwise the server's own lookup answers.
    if (!choice && aiOn) {
      if (!canAskAi(aiUsage, aiLimit)) {
        pushMessage('pekka', t('pekka.ai.limitReached', { limit: aiLimit, name: greetingName }), {
          label: t('pekka.ai.seePlans'),
          route: '/(app)/pricing',
        });
        inFlight.current = false;
        setAsking(false);
        return;
      }
      try {
        const history = messages.slice(-6).map((message) => ({ role: message.role, text: message.text }));
        const reply = await askPekkaChat(question, history);
        await usePekkaStore.getState().countAiQuestion(reply.usage);
        if (requestVersion.current !== version) return;
        pushMessage('pekka', reply.answer, reply.action);
        inFlight.current = false;
        setAsking(false);
        return;
      } catch {
        // No AI on this server yet, or it failed: fall back to the lookup below.
      }
    }

    try {
      const reply = await askPekka(question, choice ? { id: choice.id, kind: choice.kind } : undefined);
      if (requestVersion.current !== version) return;
      pushMessage('pekka', replyText(reply));
      setChoices(reply.candidates ?? []);
    } catch {
      // Plumbing errors ("Request failed with status 404") help nobody here.
      if (requestVersion.current === version) pushMessage('pekka', t('pekka.noData'));
    } finally {
      if (requestVersion.current === version) { inFlight.current = false; setAsking(false); }
    }
  }

  const busy = Boolean(pending) || asking || briefPending || closePending || tipsPending;
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
      stickToBottom
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
              <Pressable
                onPress={() => askDayClose()}
                disabled={busy}
                style={[styles.chip, { backgroundColor: colors.accentSoft, opacity: busy ? 0.6 : 1 }]}>
                <MaterialCommunityIcons name="weather-night" size={15} color={colors.primaryText} />
                <Text variant="label" style={styles.chipLabel}>
                  {t('pekka.close.question')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => askBrief()}
                disabled={busy}
                style={[styles.chip, { backgroundColor: colors.accentSoft, opacity: busy ? 0.6 : 1 }]}>
                <MaterialCommunityIcons name="weather-sunset-up" size={15} color={colors.primaryText} />
                <Text variant="label" style={styles.chipLabel}>
                  {t('pekka.morning.question')}
                </Text>
              </Pressable>
              <Pressable
                onPress={askTips}
                disabled={busy}
                style={[styles.chip, { backgroundColor: colors.accentSoft, opacity: busy ? 0.6 : 1 }]}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={15} color={colors.primaryText} />
                <Text variant="label" style={styles.chipLabel}>
                  {t('pekka.tips.question')}
                </Text>
                {tips.nudges.length ? (
                  <View style={[styles.count, { backgroundColor: colors.primary }]}>
                    <Text variant="caption" color={colors.onPrimary} style={styles.countText}>
                      {tips.nudges.length}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
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
          <PekkaComposer
            value={draft}
            onChange={setDraft}
            onVoiceInput={() => { draftFromVoice.current = true; }}
            onSend={() => void handleAsk()}
            open={open}
            busy={busy}
          />
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
          <>
            <PekkaIntroduction personal={isPersonal} topics={guideTopics} onOpen={handleGuide} />
            <PekkaDailyCards />
          </>
        ) : null}

        {messages.map((message) => (
          <PekkaMessage
            key={message.id}
            message={message}
            onSpeak={(text) => speakPekka(text, speechLang)}
            onAction={handleAction}
            onShare={handleShare}
          />
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
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontWeight: '700',
    lineHeight: 14,
  },
  chipLabel: {
    maxWidth: 220,
  },
});
