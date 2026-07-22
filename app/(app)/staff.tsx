import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { staffApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { StickyActionBar } from '@/src/components/ui/StickyActionBar';
import { SearchField } from '@/src/components/ui/SearchField';
import { useAuthStore } from '@/src/stores/auth-store';
import { palette, spacing, radius, typography, shadows, layout } from '@/src/theme';
import type { StaffMember } from '@/src/types/models';

interface StaffCategoryPreset {
  key: string;
  label: string;
  description: string;
  defaultPermissions: Record<string, string>;
}

export default function StaffDirectoryScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  
  const userRole = session?.role ?? user?.role ?? 'staff';
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  // Fetch full staff payload to get summary & meta
  const { data: staffData, isLoading, refetch } = useQuery({
    queryKey: ['staff-full'],
    queryFn: async () => {
      const res = await staffApi.list({ limit: 100 });
      return res as unknown as {
        summary: {
          totalUsers: number;
          maxUsers: number;
          isLimitReached: boolean;
          remainingSeats: number;
        };
        meta: {
          accessLevels: { key: string }[];
          features: { key: string; label: string; description: string }[];
          categories: StaffCategoryPreset[];
        };
        members: (StaffMember & {
          membershipId?: string;
          staffCategory?: string;
          jobTitle?: string;
          salary?: number;
          hasLogin?: boolean;
          category?: { key: string; label: string };
        })[];
      };
    },
  });

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [formSheetVisible, setFormSheetVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [staffCategory, setStaffCategory] = useState('general_staff');
  const [jobTitle, setJobTitle] = useState('');
  const [salary, setSalary] = useState('');
  const [hasLogin, setHasLogin] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [customPermissionsEnabled, setCustomPermissionsEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shiftStarted, setShiftStarted] = useState('09:00');
  const [shiftEnded, setShiftEnded] = useState('17:00');

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => staffApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-full'] });
      setFormSheetVisible(false);
      resetForm();
      Alert.alert('Success', 'Staff member added successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to add staff member');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => staffApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-full'] });
      setFormSheetVisible(false);
      resetForm();
      Alert.alert('Success', 'Staff member updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to update staff member');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-full'] });
      setActionSheetVisible(false);
      Alert.alert('Success', 'Staff member removed successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to delete staff member');
    },
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setRole('staff');
    setStaffCategory('general_staff');
    setJobTitle('');
    setSalary('');
    setHasLogin(false);
    setPermissions({});
    setCustomPermissionsEnabled(false);
    setIsEditing(false);
    setShiftStarted('09:00');
    setShiftEnded('17:00');
  };

  const handleOpenAdd = () => {
    if (staffData?.summary?.isLimitReached) {
      Alert.alert('Limit Reached', 'You have reached your staff seats limit. Please upgrade your subscription.');
      return;
    }
    resetForm();
    setIsEditing(false);
    // Initialize permissions based on general_staff category
    const generalPreset = staffData?.meta?.categories?.find(c => c.key === 'general_staff');
    if (generalPreset) {
      setPermissions(generalPreset.defaultPermissions || {});
    }
    setFormSheetVisible(true);
  };

  const handleOpenEdit = (member: any) => {
    resetForm();
    setIsEditing(true);
    setName(member.name || '');
    setEmail(member.email || '');
    setPhone(member.phone || '');
    setRole(member.role || 'staff');
    setStaffCategory(member.staffCategory || 'general_staff');
    setJobTitle(member.jobTitle || '');
    setSalary(member.salary ? String(member.salary) : '');
    setHasLogin(member.hasLogin !== false);
    setShiftStarted(member.shiftStarted || '09:00');
    setShiftEnded(member.shiftEnded || '17:00');
    
    // Check if the current permissions are different from preset default permissions
    const preset = staffData?.meta?.categories?.find(c => c.key === (member.staffCategory || 'general_staff'));
    const memberPerms = member.permissions || {};
    setPermissions(memberPerms);

    if (preset) {
      const isOverridden = Object.keys(preset.defaultPermissions || {}).some(
        key => preset.defaultPermissions[key] !== memberPerms[key]
      );
      setCustomPermissionsEnabled(isOverridden);
    } else {
      setCustomPermissionsEnabled(true);
    }

    setActionSheetVisible(false);
    setFormSheetVisible(true);
  };

  const handleCategoryChange = (catKey: string) => {
    setStaffCategory(catKey);
    const preset = staffData?.meta?.categories?.find(c => c.key === catKey);
    if (preset && !customPermissionsEnabled) {
      setPermissions(preset.defaultPermissions || {});
    }
  };

  const toggleCustomPermissions = (value: boolean) => {
    setCustomPermissionsEnabled(value);
    if (!value) {
      // Revert permissions to selected category defaults
      const preset = staffData?.meta?.categories?.find(c => c.key === staffCategory);
      if (preset) {
        setPermissions(preset.defaultPermissions || {});
      }
    }
  };

  const handlePermissionChange = (featureKey: string, level: string) => {
    setPermissions(prev => ({
      ...prev,
      [featureKey]: level,
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Staff Name is required');
      return;
    }
    if (hasLogin && !email.trim()) {
      Alert.alert('Required', 'Email is required when App Login is enabled');
      return;
    }
    if (hasLogin && !isEditing && !password.trim()) {
      Alert.alert('Required', 'Password is required when App Login is enabled');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        staffCategory,
        jobTitle: jobTitle.trim() || undefined,
        salary: salary ? Number(salary) : undefined,
        hasLogin,
        permissions,
        shiftStarted: shiftStarted.trim() || undefined,
        shiftEnded: shiftEnded.trim() || undefined,
      };

      if (!isEditing && hasLogin && password) {
        payload.password = password;
      }
      // Transition non-login to login
      if (isEditing && hasLogin && password) {
        payload.password = password;
      }

      if (isEditing && selectedMember) {
        const id = selectedMember.membershipId || selectedMember.id;
        await updateMutation.mutateAsync({ id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch {
      // Handled in mutation error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!selectedMember) return;
    const name = selectedMember.name;
    const id = selectedMember.membershipId || selectedMember.id;
    Alert.alert(
      'Remove Staff',
      `Are you sure you want to remove ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(id);
          },
        },
      ]
    );
  };

  const filteredMembers = useMemo(() => {
    if (!staffData?.members) return [];
    return staffData.members.filter(m =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
      m.phone?.toLowerCase().includes(search.toLowerCase())
    );
  }, [staffData?.members, search]);

  const summary = staffData?.summary || { totalUsers: 0, maxUsers: 5, remainingSeats: 5, isLimitReached: false };

  return (
    <Screen
      topBarTitle="Staff Directory"
      footer={
        isOwnerOrAdmin ? (
          <StickyActionBar
            primary={{
              label: 'Add Staff Member',
              onPress: handleOpenAdd,
            }}
          />
        ) : undefined
      }>
      
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.primary} size="large" />
          <Text style={styles.loadingText}>Loading staff details...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Capacity Banner */}
          <SurfaceCard style={styles.bannerCard}>
            <View style={styles.bannerHeader}>
              <Text style={styles.bannerTitle}>Staff Workspace Capacity</Text>
              <Text style={[styles.bannerBadge, summary.isLimitReached ? styles.badgeDanger : styles.badgeSuccess]}>
                {summary.remainingSeats} seats available
              </Text>
            </View>
            <Text style={styles.bannerSubtitle}>
              {summary.totalUsers} of {summary.maxUsers} seats filled
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, (summary.totalUsers / summary.maxUsers) * 100)}%`,
                    backgroundColor: summary.isLimitReached ? palette.danger : palette.primary,
                  },
                ]}
              />
            </View>
          </SurfaceCard>

          <SearchField
            placeholder="Search by name, title, or phone..."
            value={search}
            onChangeText={setSearch}
          />

          <Text style={styles.sectionHeader}>Staff Members ({filteredMembers.length})</Text>

          {filteredMembers.map((member) => {
            const presetLabel = member.category?.label || member.staffCategory || 'General Staff';
            return (
              <Pressable
                key={member.membershipId || member.id}
                style={styles.memberCard}
                onPress={() => {
                  setSelectedMember(member);
                  setActionSheetVisible(true);
                }}>
                <View style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {member.name?.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberTitle}>
                      {member.jobTitle || 'No Job Title'}
                      {member.shiftStarted && member.shiftEnded ? `  •  ${member.shiftStarted} - ${member.shiftEnded}` : ''}
                    </Text>
                    <View style={styles.tagWrap}>
                      <View style={styles.presetTag}>
                        <Text style={styles.presetTagText}>{presetLabel}</Text>
                      </View>
                      {member.hasLogin ? (
                        <View style={[styles.statusTag, styles.statusTagActive]}>
                          <Text style={styles.statusTagTextActive}>Login Active</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusTag, styles.statusTagInactive]}>
                          <Text style={styles.statusTagTextInactive}>No Login</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.memberRight}>
                    <Text style={styles.salaryLabel}>Salary</Text>
                    <Text style={styles.salaryText}>
                      रू {Number(member.salary || 0).toLocaleString()}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSoft} />
                  </View>
                </View>
              </Pressable>
            );
          })}

          {filteredMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-search-outline" size={48} color={palette.textSoft} />
              <Text style={styles.emptyText}>No staff members found matching search.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Action sheet for selecting staff operations */}
      <BottomSheet
        visible={actionSheetVisible}
        title={selectedMember?.name || 'Staff Actions'}
        subtitle={selectedMember?.jobTitle || 'Choose an operation for this staff member'}
        onClose={() => setActionSheetVisible(false)}>
        <View style={styles.actionWrap}>
          {isOwnerOrAdmin ? (
            <Pressable style={styles.actionBtn} onPress={() => handleOpenEdit(selectedMember)}>
              <MaterialCommunityIcons name="account-edit-outline" size={22} color={palette.primary} />
              <Text style={styles.actionBtnText}>Edit Profile & Permissions</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              setActionSheetVisible(false);
              router.push({
                pathname: '/(app)/staff-salary',
                params: {
                  membershipId: selectedMember?.membershipId || selectedMember?.id,
                  name: selectedMember?.name,
                },
              });
            }}>
            <MaterialCommunityIcons name="book-open-outline" size={22} color={palette.success} />
            <Text style={styles.actionBtnText}>Salary & Advance Bookkeeping</Text>
          </Pressable>

          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              setActionSheetVisible(false);
              router.push({
                pathname: '/(app)/attendance',
                params: {
                  businessUserId: selectedMember?.membershipId || selectedMember?.id,
                  name: selectedMember?.name,
                },
              });
            }}>
            <MaterialCommunityIcons name="calendar-check-outline" size={22} color={palette.info} />
            <Text style={styles.actionBtnText}>Attendance History Logs</Text>
          </Pressable>

          {isOwnerOrAdmin && selectedMember?.role !== 'owner' ? (
            <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleDelete}>
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={palette.danger} />
              <Text style={[styles.actionBtnText, { color: palette.danger }]}>Delete Staff Member</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheet>

      {/* Add / Edit Form Bottom Sheet */}
      <BottomSheet
        visible={formSheetVisible}
        title={isEditing ? 'Edit Staff Member' : 'Invite Staff Member'}
        subtitle="Manage credentials, presets, and customized app access levels."
        onClose={() => setFormSheetVisible(false)}
        fullHeight
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>{isEditing ? 'Save Staff' : 'Invite Staff'}</Text>
            )}
          </Pressable>
        }>
        
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
          <FormField label="Staff Name *" value={name} onChangeText={setName} />
          
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="numeric" />
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <FormField label="Monthly Salary (रू)" value={salary} onChangeText={setSalary} keyboardType="numeric" />
            </View>
          </View>

          <FormField label="Job Title" value={jobTitle} onChangeText={setJobTitle} placeholder="e.g. Counter Billing Cashier" />

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <FormField label="Shift Starts (HH:MM)" value={shiftStarted} onChangeText={setShiftStarted} placeholder="e.g. 09:00" />
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <FormField label="Shift Ends (HH:MM)" value={shiftEnded} onChangeText={setShiftEnded} placeholder="e.g. 17:00" />
            </View>
          </View>

          {/* Preset Dropdown list */}
          <Text style={styles.fieldLabel}>Staff Role Preset</Text>
          <View style={styles.presetGrid}>
            {(staffData?.meta?.categories || []).map((cat) => {
              const selected = staffCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  style={[styles.presetChip, selected && styles.presetChipSelected]}
                  onPress={() => handleCategoryChange(cat.key)}>
                  <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Toggle Switch App Login */}
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Enable Mobile App Login</Text>
              <Text style={styles.toggleHelper}>Allows staff member to log in on their phone</Text>
            </View>
            <Switch
              value={hasLogin}
              onValueChange={setHasLogin}
              trackColor={{ false: palette.border, true: palette.primary }}
              thumbColor={palette.white}
            />
          </View>

          {hasLogin ? (
            <View style={styles.loginSection}>
              <FormField
                label="Email Address *"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <FormField
                label={isEditing ? 'Change Password (optional)' : 'Password *'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={isEditing ? 'Leave blank to keep current' : 'Enter login password'}
              />
            </View>
          ) : null}

          {/* Permission Editor overrides */}
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Manual Permission Overrides</Text>
              <Text style={styles.toggleHelper}>Customize permissions for this member</Text>
            </View>
            <Switch
              value={customPermissionsEnabled}
              onValueChange={toggleCustomPermissions}
              trackColor={{ false: palette.border, true: palette.primary }}
              thumbColor={palette.white}
            />
          </View>

          {customPermissionsEnabled && staffData?.meta?.features ? (
            <View style={styles.permissionsWrap}>
              <Text style={styles.permsHeading}>Feature Module Access Controls</Text>
              {staffData.meta.features.map((feat) => {
                const currentLevel = permissions[feat.key] || 'none';
                return (
                  <View key={feat.key} style={styles.permRow}>
                    <View style={styles.permCopy}>
                      <Text style={styles.permTitle}>{feat.label}</Text>
                      <Text style={styles.permDesc} numberOfLines={1}>{feat.description}</Text>
                    </View>
                    <View style={styles.permSelector}>
                      {(['none', 'view', 'manage'] as const).map((level) => {
                        const active = currentLevel === level;
                        return (
                          <Pressable
                            key={level}
                            style={[
                              styles.permOption,
                              active && styles.permOptionActive,
                              active && level === 'manage' && styles.permOptionActiveManage,
                            ]}
                            onPress={() => handlePermissionChange(feat.key, level)}>
                            <Text
                              style={[
                                styles.permOptionText,
                                active && styles.permOptionTextActive,
                              ]}>
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: typography.body,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  content: {
    gap: spacing.md,
    paddingBottom: layout.stickyBarOffset,
  },
  bannerCard: {
    padding: spacing.md,
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentMuted,
    borderWidth: 1,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  bannerTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  bannerSubtitle: {
    fontSize: typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  bannerBadge: {
    fontSize: typography.caption,
    fontWeight: '800',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  badgeSuccess: {
    color: palette.success,
    backgroundColor: palette.successSoft,
  },
  badgeDanger: {
    color: palette.danger,
    backgroundColor: palette.dangerSoft,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: palette.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  sectionHeader: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  memberCard: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    ...shadows.card,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  memberTitle: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  tagWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  presetTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: palette.backgroundAlt,
    borderRadius: radius.pill,
  },
  presetTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.text,
  },
  statusTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusTagActive: {
    backgroundColor: palette.successSoft,
  },
  statusTagTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.success,
  },
  statusTagInactive: {
    backgroundColor: palette.dangerSoft,
  },
  statusTagTextInactive: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.danger,
  },
  memberRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  salaryLabel: {
    fontSize: 9,
    color: palette.textSoft,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  salaryText: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
  },
  actionWrap: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
  },
  actionBtnDanger: {
    backgroundColor: palette.dangerSoft,
  },
  actionBtnText: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
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
  formScroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  formRow: {
    flexDirection: 'row',
  },
  fieldLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.textMuted,
    marginBottom: spacing.xxs,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  presetChipSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  presetChipText: {
    fontSize: typography.label,
    fontWeight: '600',
    color: palette.textMuted,
  },
  presetChipTextSelected: {
    color: palette.white,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  toggleLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  toggleHelper: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  loginSection: {
    backgroundColor: palette.accentSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.accentMuted,
    gap: spacing.md,
  },
  permissionsWrap: {
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  permsHeading: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.xxs,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxs,
  },
  permCopy: {
    flex: 1,
  },
  permTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  permDesc: {
    fontSize: 10,
    color: palette.textMuted,
  },
  permSelector: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    backgroundColor: palette.backgroundAlt,
    overflow: 'hidden',
  },
  permOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permOptionActive: {
    backgroundColor: palette.primary,
  },
  permOptionActiveManage: {
    backgroundColor: palette.success,
  },
  permOptionText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textMuted,
  },
  permOptionTextActive: {
    color: palette.white,
  },
});
