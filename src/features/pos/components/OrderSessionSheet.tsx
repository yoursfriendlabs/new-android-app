import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { haptics } from '@/src/shared/lib/haptics';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { PosOrderType } from '@/src/features/pos/components/PosContextBar';

interface TableOption {
  id: string;
  name: string;
  capacity?: number | null;
  status?: string | null;
}

interface OrderSessionSheetProps {
  visible: boolean;
  onClose: () => void;
  orderType: PosOrderType;
  activeTableId: string | null;
  tables: TableOption[];
  showTables: boolean;
  onSelect: (tableId: string | null, orderType: PosOrderType) => void;
}

/** Where a cafe bill is going: takeaway, delivery, or a specific table. */
export function OrderSessionSheet({
  activeTableId,
  onClose,
  onSelect,
  orderType,
  showTables,
  tables,
  visible,
}: OrderSessionSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  function pick(tableId: string | null, type: PosOrderType) {
    haptics.selection();
    onSelect(tableId, type);
  }

  return (
    <BottomSheet
      visible={visible}
      title="Order session"
      subtitle="Choose a table for dine-in, or keep it takeaway or delivery."
      onClose={onClose}
      fullHeight>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text variant="overline" tone="soft">
          Standard
        </Text>
        <View style={styles.standardRow}>
          {(
            [
              { type: 'takeaway' as const, icon: 'shopping-outline' as const, label: 'Walk-in / Takeaway' },
              { type: 'delivery' as const, icon: 'truck-delivery-outline' as const, label: 'Home delivery' },
            ]
          ).map((option) => {
            const active = orderType === option.type;
            return (
              <Pressable
                key={option.type}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.standardCard, active && styles.cardSelected]}
                onPress={() => pick(null, option.type)}>
                <MaterialCommunityIcons
                  name={option.icon}
                  size={24}
                  color={active ? colors.primary : colors.textSoft}
                />
                <Text variant="label" tone={active ? 'primary' : 'default'} align="center">
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {showTables ? (
          <>
            <Text variant="overline" tone="soft">
              Tables
            </Text>
            {tables.length ? (
              <View style={styles.tableGrid}>
                {tables.map((table) => {
                  const selected = activeTableId === table.id;
                  const occupied = table.status === 'occupied';
                  return (
                    <Pressable
                      key={table.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.tableCard,
                        selected && styles.cardSelected,
                        occupied && !selected && styles.tableCardOccupied,
                      ]}
                      onPress={() => pick(table.id, 'dine_in')}>
                      <Text variant="bodyStrong" tone={selected ? 'primary' : 'default'}>
                        {table.name}
                      </Text>
                      <Text variant="caption" tone={occupied ? 'warning' : 'muted'}>
                        {table.capacity ?? 4} seats{occupied ? ' · Busy' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                icon="table-furniture"
                title="No tables yet"
                message="Add tables in Owner tools to seat dine-in orders."
              />
            )}
          </>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    content: {
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    standardRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    standardCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardSelected: {
      borderColor: colors.primary,
      borderWidth: 1.5,
      backgroundColor: colors.accentSoft,
    },
    tableGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    tableCard: {
      width: '31%',
      flexGrow: 1,
      minWidth: 100,
      gap: 2,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tableCardOccupied: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
    },
  });
