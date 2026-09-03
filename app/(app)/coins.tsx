import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/shared/layout/Screen';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import {
  coinLabel,
  coinReasonLabel,
  minusCoins,
  plusCoins,
  type CoinEvent,
  type CoinMerch,
} from '@/src/features/habits/lib/coins';
import { prettyDate } from '@/src/shared/lib/format';
import { useHabitStore } from '@/src/stores/habit-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type Tab = 'history' | 'redeem';

function stamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return prettyDate(iso);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${prettyDate(iso.slice(0, 10))} · ${hours}:${minutes}`;
}

export default function CoinsScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const coins = useHabitStore((state) => state.coins);
  const history = useHabitStore((state) => state.history);
  const redemptions = useHabitStore((state) => state.redemptions);
  const merch = useHabitStore((state) => state.merch);
  const [tab, setTab] = useState<Tab>('history');

  const requested = useMemo(() => new Set(redemptions.map((item) => item.itemId)), [redemptions]);

  const redeem = (item: CoinMerch) => {
    if (coins < item.cost) {
      Alert.alert('Need more coins', `This is ${coinLabel(item.cost)}. You have ${coinLabel(coins)}.`);
      return;
    }
    Alert.alert(
      `Redeem ${item.title}?`,
      `${minusCoins(item.cost)}. We'll mark it requested and follow up on merch.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: () => {
            void useHabitStore
              .getState()
              .spendCoins(item.cost, item.title, item.id)
              .then((result) => {
                if (!result.ok) {
                  Alert.alert('Need more coins', `You have ${coinLabel(result.remaining)}.`);
                  return;
                }
                Alert.alert('Requested', `${item.title} is in your redeem list. ${coinLabel(result.remaining)} left.`);
              });
          },
        },
      ],
    );
  };

  const renderHistory = ({ item }: { item: CoinEvent }) => {
    const earned = item.amount >= 0;
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: earned ? colors.warningSoft : colors.dangerSoft }]}>
          <MaterialCommunityIcons
            color={earned ? colors.warning : colors.danger}
            name={earned ? 'circle-multiple' : 'gift-outline'}
            size={18}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{item.label}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {coinReasonLabel(item.reason)} · {stamp(item.at)}
          </Text>
        </View>
        <Text style={[styles.delta, { color: earned ? colors.success : colors.danger }]}>
          {earned ? plusCoins(item.amount) : minusCoins(Math.abs(item.amount))}
        </Text>
      </View>
    );
  };

  return (
    <Screen scrollable={false} padded={false} topBarTitle="Coins" topBarLeading="back">
      <View style={styles.heroWrap}>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.balance, { color: colors.text }]}>{coinLabel(coins)}</Text>
          <Text style={[styles.heroCopy, { color: colors.textMuted }]}>
            Earn by logging money, writing notes, and finishing reminders. Redeem for merch.
          </Text>
        </View>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { label: 'History', value: 'history' },
            { label: 'Redeem', value: 'redeem' },
          ]}
        />
      </View>

      {tab === 'history' ? (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderHistory}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>No coin movement yet. Log money or capture a note.</Text>
          }
        />
      ) : (
        <FlatList
          data={merch}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const enough = coins >= item.cost;
            const already = requested.has(item.id);
            return (
              <Pressable
                onPress={() => redeem(item)}
                style={[styles.merch, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.icon, { backgroundColor: colors.warningSoft }]}>
                  <MaterialCommunityIcons color={colors.warning} name={item.icon} size={22} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{item.hint}</Text>
                </View>
                <View style={styles.merchCost}>
                  <Text style={[styles.cost, { color: enough ? colors.warning : colors.textSoft }]}>{item.cost}</Text>
                  <Text style={[styles.costHint, { color: already ? colors.success : colors.textMuted }]}>
                    {already ? 'Requested' : 'coins'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    heroWrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
    },
    hero: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
      gap: spacing.xs,
      ...shadows.card,
    },
    balance: {
      fontSize: typography.hero,
      fontWeight: '800',
    },
    heroCopy: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    list: {
      padding: spacing.lg,
      gap: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    row: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    merch: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      ...shadows.card,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    meta: {
      fontSize: 11,
    },
    delta: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    merchCost: {
      alignItems: 'flex-end',
    },
    cost: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    costHint: {
      fontSize: 10,
      fontWeight: '700',
    },
    empty: {
      textAlign: 'center',
      paddingVertical: 48,
      fontSize: typography.caption,
      lineHeight: 18,
    },
  });
