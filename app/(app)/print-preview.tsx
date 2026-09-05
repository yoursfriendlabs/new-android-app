import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useReceiptStore } from '@/src/stores/receipt-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function PrintPreviewScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const title = useReceiptStore((state) => state.title);
  const subtitle = useReceiptStore((state) => state.subtitle);
  const html = useReceiptStore((state) => state.html);
  const data = useReceiptStore((state) => state.data);
  const [busy, setBusy] = useState(false);

  async function printNow() {
    if (!html) return;

    setBusy(true);
    try {
      await Print.printAsync({ html });
    } finally {
      setBusy(false);
    }
  }

  async function sharePdf() {
    if (!html) return;

    setBusy(true);
    try {
      const result = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      }
    } finally {
      setBusy(false);
    }
  }

  const due =
    data && data.amountReceived !== undefined
      ? Math.max(data.grandTotal - data.amountReceived, 0)
      : undefined;

  return (
    <Screen scrollable>
      <PageHeading
        title="Bill & Print Preview"
        subtitle="Review the bill, print directly, or export PDF to share."
      />

      {html ? (
        <View style={styles.billPaper}>
          {/* Header */}
          <View style={styles.billHeader}>
            <View style={styles.storeLogoBox}>
              <MaterialCommunityIcons name="storefront" size={24} color={colors.primary} />
            </View>
            <Text style={styles.storeName}>
              {String(businessProfile?.businessName || businessProfile?.name || 'PM')}
            </Text>
            {businessProfile?.address ? (
              <Text style={styles.storeMeta}>{String(businessProfile.address)}</Text>
            ) : null}
            {businessProfile?.phone ? (
              <Text style={styles.storeMeta}>Phone: {String(businessProfile.phone)}</Text>
            ) : null}
            {(businessProfile?.panNumber || businessProfile?.pan || businessProfile?.vatNumber || businessProfile?.vat || businessProfile?.taxNumber) ? (
              <Text style={[styles.storeMeta, { fontWeight: '700', color: colors.primary }]}>
                PAN / VAT No: {String(businessProfile.panNumber || businessProfile.pan || businessProfile.vatNumber || businessProfile.vat || businessProfile.taxNumber)}
              </Text>
            ) : null}
            {businessProfile?.email ? (
              <Text style={styles.storeMeta}>Email: {String(businessProfile.email)}</Text>
            ) : null}
          </View>

          <View style={styles.dividerDashed} />

          {/* Invoice & Customer Info */}
          <View style={styles.invoiceMetaSection}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice No:</Text>
              <Text style={styles.metaValue}>{title || data?.reference || 'N/A'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>
                {data?.date ? prettyDate(data.date) : prettyDate(new Date().toISOString())}
              </Text>
            </View>
            {subtitle || data?.subtitle ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Customer:</Text>
                <Text style={styles.metaValue}>{subtitle || data?.subtitle}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.dividerSolid} />

          {/* Items Table */}
          {data?.lines && data.lines.length > 0 ? (
            <View style={styles.itemsSection}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.colItem, styles.tableHeadText]}>Item</Text>
                <Text style={[styles.colQty, styles.tableHeadText]}>Qty</Text>
                <Text style={[styles.colTotal, styles.tableHeadText]}>Amount</Text>
              </View>
              {data.lines.map((line, idx) => (
                <View key={`${line.name}-${idx}`} style={styles.itemRow}>
                  <View style={styles.colItem}>
                    <Text style={styles.itemName}>{line.name}</Text>
                    <Text style={styles.itemRate}>@ {formatCurrency(line.unitPrice)}</Text>
                  </View>
                  <Text style={[styles.colQty, styles.itemQty]}>{line.quantity}</Text>
                  <Text style={[styles.colTotal, styles.itemTotal]}>
                    {formatCurrency(line.lineTotal)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.printableNoticeBox}>
              <MaterialCommunityIcons name="file-document-check-outline" size={28} color={colors.primary} />
              <Text style={styles.printableNoticeText}>
                Document formatted and ready for high-resolution print or PDF export.
              </Text>
            </View>
          )}

          <View style={styles.dividerDashed} />

          {/* Financials & Dues */}
          {data ? (
            <View style={styles.financialSection}>
              <View style={styles.finRow}>
                <Text style={styles.finLabel}>Subtotal</Text>
                <Text style={styles.finValue}>{formatCurrency(data.subTotal)}</Text>
              </View>
              {data.taxTotal > 0 ? (
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>VAT / Tax</Text>
                  <Text style={styles.finValue}>{formatCurrency(data.taxTotal)}</Text>
                </View>
              ) : null}
              {data.discountTotal > 0 ? (
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>Discount</Text>
                  <Text style={[styles.finValue, { color: colors.danger }]}>
                    -{formatCurrency(data.discountTotal)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.finRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total Amount</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(data.grandTotal)}</Text>
              </View>

              {data.amountReceived !== undefined ? (
                <>
                  <View style={styles.finRow}>
                    <Text style={styles.finLabel}>Paid / Received</Text>
                    <Text style={styles.finValue}>{formatCurrency(data.amountReceived)}</Text>
                  </View>
                  <View
                    style={[
                      styles.dueBanner,
                      {
                        backgroundColor: (due ?? 0) > 0 ? colors.dangerSoft : colors.successSoft,
                        borderColor: (due ?? 0) > 0 ? colors.danger : colors.success,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.dueBannerLabel,
                        { color: (due ?? 0) > 0 ? colors.danger : colors.success },
                      ]}>
                      {(due ?? 0) > 0 ? 'Balance Due' : 'Payment Status'}
                    </Text>
                    <Text
                      style={[
                        styles.dueBannerValue,
                        { color: (due ?? 0) > 0 ? colors.danger : colors.success },
                      ]}>
                      {(due ?? 0) > 0 ? formatCurrency(due ?? 0) : 'Fully Paid'}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {/* Footer note */}
          <View style={styles.billFooter}>
            <Text style={styles.footerNote}>Thank you for your business!</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="receipt" size={48} color={colors.textSoft} />
          <Text style={styles.emptyTitle}>No Prepared Receipt</Text>
          <Text style={styles.emptySubtitle}>
            Save a transaction or tap receipt from detailed sales to build the preview.
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtonsWrap}>
        <Pressable
          style={[styles.primaryButton, (!html || busy) && styles.btnDisabled]}
          onPress={printNow}
          disabled={busy || !html}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="printer" size={20} color={colors.white} />
              <Text style={styles.primaryLabel}>Print Bill Now</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, (!html || busy) && styles.btnDisabled]}
          onPress={sharePdf}
          disabled={busy || !html}>
          <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.text} />
          <Text style={styles.secondaryLabel}>Export & Share PDF</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    billPaper: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadows.card,
    },
    billHeader: {
      alignItems: 'center',
      gap: 3,
    },
    storeLogoBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    storeName: {
      fontSize: typography.heading,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    storeMeta: {
      fontSize: typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    dividerDashed: {
      height: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      marginVertical: spacing.xs,
    },
    dividerSolid: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    },
    invoiceMetaSection: {
      gap: spacing.xxs,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metaLabel: {
      fontSize: typography.label,
      color: colors.textMuted,
      fontWeight: '600',
    },
    metaValue: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    itemsSection: {
      gap: spacing.xs,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      borderBottomWidth: 1.5,
      borderBottomColor: colors.primary,
      paddingBottom: spacing.xs,
    },
    tableHeadText: {
      fontSize: typography.caption,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
    },
    colItem: {
      flex: 1,
    },
    colQty: {
      width: 44,
      textAlign: 'center',
    },
    colTotal: {
      width: 80,
      textAlign: 'right',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceMuted,
    },
    itemName: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    itemRate: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    itemQty: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    itemTotal: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.text,
    },
    printableNoticeBox: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    printableNoticeText: {
      fontSize: typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    financialSection: {
      gap: spacing.xs,
    },
    finRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    finLabel: {
      fontSize: typography.body,
      color: colors.textMuted,
    },
    finValue: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    grandTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.xs,
      marginTop: spacing.xs,
    },
    grandTotalLabel: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.text,
    },
    grandTotalValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.primary,
    },
    dueBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: spacing.xs,
    },
    dueBannerLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    dueBannerValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    billFooter: {
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    footerNote: {
      fontSize: typography.caption,
      color: colors.textSoft,
      fontStyle: 'italic',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.text,
    },
    emptySubtitle: {
      fontSize: typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
    actionButtonsWrap: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    secondaryButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    primaryLabel: {
      color: colors.white,
      fontSize: typography.body,
      fontWeight: '800',
    },
    secondaryLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
