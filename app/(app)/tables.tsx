import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { tablesApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { SearchField } from '@/src/components/ui/SearchField';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { useTables, useCategories } from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography, shadows } from '@/src/theme';
import type { Table } from '@/src/types/models';

export default function TableManagementScreen() {
  const queryClient = useQueryClient();
  const { data: tables = [], isLoading } = useTables();
  const { data: categories = [] } = useCategories();
  const [localTables, setLocalTables] = useState<Table[]>([]);
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const floors = useMemo(() => {
    return categories.filter((cat: any) => cat.type === 'table');
  }, [categories]);

  // Synchronize local state with remote query data
  useEffect(() => {
    if (tables && tables.length > 0) {
      setLocalTables(tables);
    }
  }, [tables]);

  // Form states
  const [formSheetVisible, setFormSheetVisible] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [status, setStatus] = useState('vacant');
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredTables = useMemo(() => {
    return localTables.filter((t) => {
      if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (floorFilter !== 'all') {
        if (floorFilter === 'unassigned') {
          if (t.categoryId) return false;
        } else {
          if (t.categoryId !== floorFilter) return false;
        }
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'vacant' && t.status !== 'vacant') return false;
        if (statusFilter === 'occupied' && t.status !== 'occupied') return false;
      }
      return true;
    });
  }, [localTables, search, floorFilter, statusFilter]);

  const resetForm = () => {
    setName('');
    setCapacity('');
    setCategoryId(null);
    setStatus('vacant');
    setIsActive(true);
    setEditingTable(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setFormSheetVisible(true);
  };

  const handleOpenEdit = (table: Table) => {
    setEditingTable(table);
    setName(table.name || '');
    setCapacity(table.capacity ? String(table.capacity) : '');
    setStatus(table.status || 'vacant');
    setIsActive(table.isActive !== false);
    setCategoryId(table.categoryId || null);
    setFormSheetVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required field', 'Table name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        capacity: capacity ? Number(capacity) : null,
        status,
        isActive,
        categoryId,
      };

      if (editingTable) {
        const matchedCategory = floors.find((f) => f.id === categoryId);
        const updatedTable = { ...editingTable, ...payload, category: matchedCategory };
        await tablesApi.update(editingTable.id, payload);
        setLocalTables((prev) =>
          prev.map((t) => (t.id === editingTable.id ? updatedTable : t))
        );
        Alert.alert('Success', 'Table updated successfully.');
      } else {
        const newTable = await tablesApi.create(payload);
        setLocalTables((prev) => [...prev, newTable]);
        Alert.alert('Success', 'Table created successfully.');
      }

      void queryClient.invalidateQueries({ queryKey: ['tables-list'] });
      setFormSheetVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Save table failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (table: Table) => {
    Alert.alert(
      'Remove Table',
      `Are you sure you want to remove "${table.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await tablesApi.remove(table.id);
              setLocalTables((prev) => prev.filter((t) => t.id !== table.id));
              void queryClient.invalidateQueries({ queryKey: ['tables-list'] });
              Alert.alert('Success', 'Table deleted successfully.');
            } catch (error) {
              Alert.alert(
                'Delete Failed',
                error instanceof Error ? error.message : 'Cannot delete table with active unpaid orders.'
              );
            }
          },
        },
      ]
    );
  };

  const topBarRight = (
    <Pressable style={styles.topBarBtn} onPress={handleOpenAdd}>
      <MaterialCommunityIcons color={palette.primary} name="plus" size={24} />
    </Pressable>
  );

  return (
    <Screen topBarTitle="Table Seating Setup" topBarLeading="back" topBarRight={topBarRight}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <PageHeading
          title="Table Seating"
          subtitle="Manage tables, seating capacity, and occupancy status for dining order workflows."
        />

        <SearchField
          placeholder="Search tables by name..."
          value={search}
          onChangeText={setSearch}
        />

        <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
          {/* Floor Chips Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <Pressable
              style={[styles.filterChip, floorFilter === 'all' && styles.filterChipActive]}
              onPress={() => setFloorFilter('all')}
            >
              <Text style={[styles.filterChipLabel, floorFilter === 'all' && styles.filterChipLabelActive]}>
                All Floors
              </Text>
            </Pressable>
            {floors.map((floor) => (
              <Pressable
                key={floor.id}
                style={[styles.filterChip, floorFilter === floor.id && styles.filterChipActive]}
                onPress={() => setFloorFilter(floor.id)}
              >
                <Text style={[styles.filterChipLabel, floorFilter === floor.id && styles.filterChipLabelActive]}>
                  {floor.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.filterChip, floorFilter === 'unassigned' && styles.filterChipActive]}
              onPress={() => setFloorFilter('unassigned')}
            >
              <Text style={[styles.filterChipLabel, floorFilter === 'unassigned' && styles.filterChipLabelActive]}>
                Unassigned
              </Text>
            </Pressable>
          </ScrollView>

          {/* Status Chips Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <Pressable
              style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.filterChipLabel, statusFilter === 'all' && styles.filterChipLabelActive]}>
                All Statuses
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, statusFilter === 'vacant' && styles.filterChipActive]}
              onPress={() => setStatusFilter('vacant')}
            >
              <Text style={[styles.filterChipLabel, statusFilter === 'vacant' && styles.filterChipLabelActive]}>
                Vacant
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, statusFilter === 'occupied' && styles.filterChipActive]}
              onPress={() => setStatusFilter('occupied')}
            >
              <Text style={[styles.filterChipLabel, statusFilter === 'occupied' && styles.filterChipLabelActive]}>
                Occupied
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        <SurfaceCard title="Seating Layout" subtitle="Currently configured cafe tables.">
          {isLoading && localTables.length === 0 ? (
            <ActivityIndicator color={palette.primary} size="large" style={styles.loader} />
          ) : (
            <View style={styles.list}>
              {filteredTables.map((table) => {
                const occupied = table.status === 'occupied';
                const matchedFloor = floors.find((f) => f.id === table.categoryId);
                const floorName = table.category?.name || matchedFloor?.name || 'No Floor';

                return (
                  <View key={table.id} style={styles.row}>
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text style={styles.tableName}>{table.name}</Text>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: occupied ? '#f59e0b' : '#10b981' },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: occupied ? '#d97706' : '#10b981' }]}>
                          {occupied ? 'Occupied' : 'Vacant'}
                        </Text>
                      </View>
                      <Text style={styles.metaText}>
                        Capacity: {table.capacity ?? 'Unspecified'} seats  •  Floor: {floorName}
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      <Pressable style={styles.actionIconBtn} onPress={() => handleOpenEdit(table)}>
                        <MaterialCommunityIcons color={palette.primary} name="pencil-outline" size={20} />
                      </Pressable>
                      <Pressable style={styles.actionIconBtn} onPress={() => handleDelete(table)}>
                        <MaterialCommunityIcons color={palette.danger} name="trash-can-outline" size={20} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {filteredTables.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialCommunityIcons color={palette.textSoft} name="table-off" size={32} />
                  <Text style={styles.emptyText}>No tables found.</Text>
                </View>
              ) : null}
            </View>
          )}
        </SurfaceCard>
      </ScrollView>

      {/* Add / Edit Sheet */}
      <BottomSheet
        visible={formSheetVisible}
        title={editingTable ? 'Edit Seating Table' : 'Add New Table'}
        subtitle="Set seating name, guest capacity, and state."
        onClose={() => setFormSheetVisible(false)}
        fullHeight
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>
                {editingTable ? 'Save Table' : 'Create Table'}
              </Text>
            )}
          </Pressable>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
          <FormField
            label="Table Name *"
            value={name}
            placeholder="e.g. Table 4, VIP Cabin 1"
            onChangeText={setName}
          />
          <FormField
            label="Seating Capacity"
            value={capacity}
            placeholder="e.g. 4, 6"
            keyboardType="numeric"
            onChangeText={setCapacity}
          />

          <Text style={styles.fieldLabel}>Floor / Dining Area</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.floorSelectRow}
            style={{ marginBottom: spacing.md }}
          >
            <Pressable
              style={[
                styles.floorSelectChip,
                categoryId === null && styles.floorSelectChipActive
              ]}
              onPress={() => setCategoryId(null)}
            >
              <Text style={[styles.floorSelectChipLabel, categoryId === null && styles.floorSelectChipLabelActive]}>
                Unassigned
              </Text>
            </Pressable>
            {floors.map((floor) => {
              const active = categoryId === floor.id;
              return (
                <Pressable
                  key={floor.id}
                  style={[
                    styles.floorSelectChip,
                    active && styles.floorSelectChipActive
                  ]}
                  onPress={() => setCategoryId(floor.id)}
                >
                  <Text style={[styles.floorSelectChipLabel, active && styles.floorSelectChipLabelActive]}>
                    {floor.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>Occupancy Status</Text>
          <SegmentedTabs
            value={status}
            onChange={setStatus}
            options={[
              { label: 'Vacant', value: 'vacant' },
              { label: 'Occupied', value: 'occupied' },
            ]}
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Active for Seating</Text>
              <Text style={styles.toggleHelper}>
                Show this table on Seating maps & orders entry
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: palette.border, true: palette.primary }}
              thumbColor={palette.white}
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  topBarBtn: {
    padding: spacing.xs,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tableName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  metaText: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  formScroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  toggleHelper: {
    fontSize: typography.label,
    color: palette.textMuted,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  floorSelectRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  floorSelectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  floorSelectChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  floorSelectChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSoft,
  },
  floorSelectChipLabelActive: {
    color: palette.white,
    fontWeight: '700',
  },
  chipsScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSoft,
  },
  filterChipLabelActive: {
    color: palette.white,
    fontWeight: '700',
  },
});
