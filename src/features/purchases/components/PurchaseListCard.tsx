import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { partyInitials } from '@/src/features/parties/lib/party';
import { purchaseDue, purchaseStatusView, type PurchaseSupplier, type StatusTone } from '@/src/features/purchases/lib/purchase-view';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Purchase } from '@/src/types/models';

export function statusToneColors(tone: StatusTone, colors: AppPalette) {
  if (tone === 'danger') return { bg: colors.dangerSoft, text: colors.danger };
  if (tone === 'success') return { bg: colors.successSoft, text: colors.success };
  if (tone === 'warning') return { bg: colors.warningSoft, text: colors.warning };
  if (tone === 'info') return { bg: colors.accentSoft, text: colors.accent };
  return { bg: colors.backgroundAlt, text: colors.textMuted };
}

interface PurchaseListCardProps {
  item: Purchase;
  supplier: PurchaseSupplier;
  currency: string;
  onOpen: (purchaseId: string) => void;
  onCall: (phone: string) => void;
}

/** One purchase bill in the list: who, when, how much, and what is still owed. */
export const PurchaseListCard = memo(function PurchaseListCard({
  currency,
  item,
  onCall,
  onOpen,
  supplier,
}: PurchaseListCardProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const status = purchaseStatusView(item);
  const tone = statusToneColors(status.tone, colors);
  const due = purchaseDue(item);

  return (
    <Pressable
      onPress={() => onOpen(item.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text variant="bodyStrong" tone="onPrimary">
            {partyInitials(supplier.name)}
          </Text>
        </View>
        <View style={styles.headerCopy}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {supplier.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[item.invoiceNo ? `#${item.invoiceNo}` : null, prettyDate(item.purchaseDate)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <MaterialCommunityIcons color={tone.text} name={status.icon} size={12} />
          <Text variant="overline" color={tone.text} numberOfLines={1}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.amounts}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            Bill {formatCurrency(item.grandTotal, currency)}
            {item.items?.length ? ` · ${item.items.length} ${item.items.length === 1 ? 'item' : 'items'}` : ''}
          </Text>
          <Text variant="numeric" tone={due > 0 ? 'danger' : 'success'} numberOfLines={1}>
            {due > 0 ? `To pay ${formatCurrency(due, currency)}` : 'Settled'}
          </Text>
        </View>

        <View style={styles.actions}>
          {due > 0 ? (
            <Pressable style={[styles.payButton, { backgroundColor: colors.accentSoft }]} onPress={() => onOpen(item.id)}>
              <Text variant="label" tone="primary">
                Pay
              </Text>
            </Pressable>
          ) : null}
          {supplier.phone ? (
            <Pressable
              accessibilityLabel={`Call ${supplier.name}`}
              style={[styles.callButton, { backgroundColor: colors.backgroundAlt }]}
              onPress={() => onCall(supplier.phone)}>
              <MaterialCommunityIcons color={colors.primary} name="phone-outline" size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadows.card,
    },
    cardPressed: {
      opacity: 0.94,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    badge: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      maxWidth: 120,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    amounts: {
      flex: 1,
      minWidth: 140,
      gap: 2,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    payButton: {
      paddingHorizontal: spacing.md,
      minHeight: 34,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    callButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
