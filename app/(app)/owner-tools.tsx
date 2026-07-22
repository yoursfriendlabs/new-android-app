import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { orderAttributesApi, staffApi, subscriptionApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { StickyActionBar } from '@/src/components/ui/StickyActionBar';
import {
  useOrderAttributes,
  useStaff,
  useSubscription,
  useSubscriptionPaymentSetup,
} from '@/src/hooks/useAppQueries';
import {
  capabilityDefinitions,
  formatPermissionTokens,
  getCapabilitySummary,
  hasAppCapability,
  parsePermissionTokens,
} from '@/src/lib/business';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import type { OrderAttribute, StaffMember } from '@/src/types/models';

function createStaffForm() {
  return {
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    pin: '',
    isActive: true,
    permissionsText: '',
  };
}

function createAttributeForm(entityType: 'sale' | 'service') {
  return {
    entityType,
    key: '',
    label: '',
    fieldType: 'text',
    placeholder: '',
    options: '',
    required: false,
    defaultValue: '',
    sortOrder: '0',
  };
}

export default function OwnerToolsScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
  };
  const canManageOwnerTools = hasAppCapability(accessContext, 'owner-tools');
  const { data: subscription } = useSubscription();
  const { data: paymentSetup } = useSubscriptionPaymentSetup();
  const { data: staff } = useStaff();
  const { data: saleAttributes } = useOrderAttributes('sale');
  const { data: serviceAttributes } = useOrderAttributes('service');
  const [staffSheetVisible, setStaffSheetVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffForm, setStaffForm] = useState(createStaffForm());
  const [attributeSheetVisible, setAttributeSheetVisible] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<OrderAttribute | null>(null);
  const [attributeForm, setAttributeForm] = useState(createAttributeForm('sale'));
  const [subscriptionSheetVisible, setSubscriptionSheetVisible] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    status: String(subscription?.status ?? ''),
    planName: String(subscription?.planName ?? ''),
    billingCycle: String(subscription?.billingCycle ?? ''),
    seatLimit: String(subscription?.seatLimit ?? 0),
  });
  const [message, setMessage] = useState('');

  const groupedAttributes = useMemo(
    () => ({
      sale: saleAttributes ?? [],
      service: serviceAttributes ?? [],
    }),
    [saleAttributes, serviceAttributes],
  );

  function openStaffSheet(member?: StaffMember) {
    setEditingStaff(member ?? null);
    setStaffForm({
      name: member?.name ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
      role: member?.role ?? 'staff',
      pin: member?.pin ?? '',
      isActive: member?.isActive ?? true,
      permissionsText: formatPermissionTokens(member?.permissions ?? []),
    });
    setStaffSheetVisible(true);
  }

  function openAttributeSheet(entityType: 'sale' | 'service', attribute?: OrderAttribute) {
    setEditingAttribute(attribute ?? null);
    setAttributeForm({
      entityType,
      key: attribute?.key ?? '',
      label: attribute?.label ?? '',
      fieldType: attribute?.fieldType ?? 'text',
      placeholder: String(attribute?.placeholder ?? ''),
      options: Array.isArray(attribute?.options) ? attribute?.options.join(', ') : '',
      required: Boolean(attribute?.required),
      defaultValue: String(attribute?.defaultValue ?? ''),
      sortOrder: String(attribute?.sortOrder ?? 0),
    });
    setAttributeSheetVisible(true);
  }

  async function saveStaff() {
    setMessage('');
    const permissions = parsePermissionTokens(staffForm.permissionsText);
    const payload = {
      name: staffForm.name,
      email: staffForm.email || undefined,
      phone: staffForm.phone || undefined,
      role: staffForm.role || undefined,
      pin: staffForm.pin || undefined,
      isActive: staffForm.isActive,
      permissions: permissions.length ? permissions : undefined,
    };
    if (editingStaff?.id) {
      await staffApi.update(editingStaff.id, payload);
    } else {
      await staffApi.create(payload);
    }
    await queryClient.invalidateQueries({ queryKey: ['staff'] });
    setStaffSheetVisible(false);
    setMessage(editingStaff ? 'Staff member updated.' : 'Staff member created.');
  }

  const selectedStaffPermissions = parsePermissionTokens(staffForm.permissionsText);

  function toggleStaffPermission(permission: string) {
    const nextPermissions = new Set(selectedStaffPermissions);
    if (nextPermissions.has(permission)) {
      nextPermissions.delete(permission);
    } else {
      nextPermissions.add(permission);
    }

    setStaffForm((current) => ({
      ...current,
      permissionsText: Array.from(nextPermissions).join(', '),
    }));
  }

  async function removeStaff(member: StaffMember) {
    setMessage('');
    await staffApi.remove(member.id);
    await queryClient.invalidateQueries({ queryKey: ['staff'] });
    setMessage('Staff member removed.');
  }

  async function saveAttribute() {
    setMessage('');
    const payload = {
      entityType: attributeForm.entityType,
      key: attributeForm.key,
      label: attributeForm.label,
      fieldType: attributeForm.fieldType,
      placeholder: attributeForm.placeholder || undefined,
      options: attributeForm.options
        ? attributeForm.options.split(',').map((entry) => entry.trim()).filter(Boolean)
        : undefined,
      required: attributeForm.required,
      defaultValue: attributeForm.defaultValue || undefined,
      sortOrder: Number(attributeForm.sortOrder || 0),
    };
    if (editingAttribute?.id) {
      await orderAttributesApi.update(editingAttribute.id, payload);
    } else {
      await orderAttributesApi.create(payload);
    }
    await queryClient.invalidateQueries({ queryKey: ['order-attributes', attributeForm.entityType] });
    setAttributeSheetVisible(false);
    setMessage(editingAttribute ? 'Custom field updated.' : 'Custom field created.');
  }

  async function removeAttribute(attribute: OrderAttribute) {
    setMessage('');
    await orderAttributesApi.remove(attribute.id);
    await queryClient.invalidateQueries({ queryKey: ['order-attributes', attribute.entityType] });
    setMessage('Custom field removed.');
  }

  async function saveSubscription() {
    setMessage('');
    await subscriptionApi.update({
      status: subscriptionForm.status || undefined,
      planName: subscriptionForm.planName || undefined,
      billingCycle: subscriptionForm.billingCycle || undefined,
      seatLimit: Number(subscriptionForm.seatLimit || 0),
    });
    await queryClient.invalidateQueries({ queryKey: ['subscription'] });
    setSubscriptionSheetVisible(false);
    setMessage('Subscription updated.');
  }

  if (!canManageOwnerTools) {
    return (
      <Screen>
        <PageHeading title="Owner tools" subtitle="This area needs owner tools access." />
        <SurfaceCard>
          <Text style={styles.helperText}>Your account does not have access to staff, subscription, or custom order field administration.</Text>
        </SurfaceCard>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <StickyActionBar
          secondary={{ label: 'New sale field', onPress: () => openAttributeSheet('sale') }}
          primary={{ label: 'Add staff', onPress: () => openStaffSheet() }}
        />
      }>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <PageHeading title="Owner tools" subtitle="Subscription, staff, and dynamic sale/service fields stay out of the counter flow for non-owners." />

        {message ? (
          <SurfaceCard>
            <Text style={styles.message}>{message}</Text>
          </SurfaceCard>
        ) : null}

        <SurfaceCard
          title="Subscription"
          subtitle={subscription?.status || 'No subscription details returned'}
          right={
            <Pressable onPress={() => {
              setSubscriptionForm({
                status: String(subscription?.status ?? ''),
                planName: String(subscription?.planName ?? ''),
                billingCycle: String(subscription?.billingCycle ?? ''),
                seatLimit: String(subscription?.seatLimit ?? 0),
              });
              setSubscriptionSheetVisible(true);
            }}>
              <Text style={styles.link}>Edit</Text>
            </Pressable>
          }>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Plan</Text>
              <Text style={styles.summaryValue}>{subscription?.planName || 'Unknown'}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Cycle</Text>
              <Text style={styles.summaryValue}>{subscription?.billingCycle || 'Unknown'}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Seats</Text>
              <Text style={styles.summaryValue}>{String(subscription?.seatLimit ?? 0)}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Renews</Text>
              <Text style={styles.summaryValue}>{String(subscription?.renewalDate ?? subscription?.expiryDate ?? 'Unknown')}</Text>
            </View>
          </View>

          {(() => {
            const totalStaff = staff?.length ?? 0;
            const seatLimit = Number(subscription?.seatLimit ?? 0);
            const availableSlots = Math.max(0, seatLimit - totalStaff);
            const pricingModel = String(subscription?.pricingModel ?? 'Flat Rate / Seat-based');

            return (
              <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: spacing.md, gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: typography.label, fontWeight: '700', color: palette.textSoft }}>
                    Staff Seats Usage
                  </Text>
                  <Text style={{ fontSize: typography.caption, fontWeight: '800', color: availableSlots > 0 ? palette.success : palette.danger }}>
                    {availableSlots} {availableSlots === 1 ? 'slot' : 'slots'} available
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: typography.body, fontWeight: '800', color: palette.text }}>
                    {totalStaff} of {seatLimit} Seats Filled
                  </Text>
                  <Text style={{ fontSize: typography.caption, color: palette.textMuted }}>
                    Pricing Model: {pricingModel}
                  </Text>
                </View>

                <View style={{ height: 6, backgroundColor: palette.backgroundAlt, borderRadius: radius.pill, overflow: 'hidden', marginTop: 4 }}>
                  <View
                    style={{
                      height: '100%',
                      backgroundColor: availableSlots > 0 ? palette.primary : palette.danger,
                      width: `${Math.min(100, seatLimit > 0 ? (totalStaff / seatLimit) * 100 : 0)}%`,
                    }}
                  />
                </View>
              </View>
            );
          })()}
        </SurfaceCard>

        <SurfaceCard title="Payment setup" subtitle="Reference details returned by the backend for subscription payments.">
          <Text style={styles.helperText}>
            {[
              paymentSetup?.contactName,
              paymentSetup?.bankName,
              paymentSetup?.accountName,
              paymentSetup?.accountNumber,
              paymentSetup?.phone,
            ]
              .filter(Boolean)
              .join('  •  ') || 'No payment setup details returned yet.'}
          </Text>
          {paymentSetup?.paymentInstructions ? <Text style={styles.helperText}>{String(paymentSetup.paymentInstructions)}</Text> : null}
        </SurfaceCard>

        <SurfaceCard title="Staff" subtitle="Owner-only staff accounts with role and quick status control.">
          <View style={styles.list}>
            {(staff ?? []).map((member) => (
                <View key={member.id} style={styles.row}>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{member.name}</Text>
                    <Text style={styles.meta}>{[member.role, member.email || member.phone].filter(Boolean).join('  •  ')}</Text>
                    {member.permissions?.length ? (
                      <Text style={styles.permissionMeta}>{getCapabilitySummary(member).slice(0, 3).join('  •  ')}</Text>
                    ) : null}
                  </View>
                  <View style={styles.rowActions}>
                    <Text style={styles.meta}>{member.isActive ? 'Active' : 'Inactive'}</Text>
                  <Pressable onPress={() => openStaffSheet(member)}>
                    <Text style={styles.link}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => void removeStaff(member)}>
                    <Text style={styles.dangerLink}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {!staff?.length ? <Text style={styles.helperText}>No staff accounts yet.</Text> : null}
          </View>
        </SurfaceCard>

        {(['sale', 'service'] as const).map((entityType) => (
          <SurfaceCard
            key={entityType}
            title={entityType === 'sale' ? 'Sale custom fields' : 'Service custom fields'}
            subtitle="Dynamic order attributes returned by the backend and rendered in the mobile forms.">
            <View style={styles.list}>
              {groupedAttributes[entityType].map((attribute) => (
                <View key={attribute.id || attribute.key} style={styles.row}>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{attribute.label}</Text>
                    <Text style={styles.meta}>
                      {[attribute.key, attribute.fieldType, attribute.required ? 'Required' : 'Optional'].join('  •  ')}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => openAttributeSheet(entityType, attribute)}>
                      <Text style={styles.link}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => void removeAttribute(attribute)}>
                      <Text style={styles.dangerLink}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable style={styles.secondaryButton} onPress={() => openAttributeSheet(entityType)}>
                <Text style={styles.secondaryButtonLabel}>
                  Add {entityType === 'sale' ? 'sale' : 'service'} field
                </Text>
              </Pressable>
            </View>
          </SurfaceCard>
        ))}
      </ScrollView>

      <BottomSheet
        visible={staffSheetVisible}
        title={editingStaff ? 'Edit staff member' : 'Add staff member'}
        subtitle="Name, role, contact, and mobile permissions are sent directly to the backend."
        onClose={() => setStaffSheetVisible(false)}
        fullHeight
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void saveStaff()}>
            <Text style={styles.primaryButtonLabel}>{editingStaff ? 'Save staff' : 'Create staff'}</Text>
          </Pressable>
        }>
        <FormField label="Name" value={staffForm.name} onChangeText={(name) => setStaffForm((current) => ({ ...current, name }))} />
        <FormField label="Email" value={staffForm.email} onChangeText={(email) => setStaffForm((current) => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" />
        <FormField label="Phone" value={staffForm.phone} onChangeText={(phone) => setStaffForm((current) => ({ ...current, phone }))} keyboardType="numeric" />
        <FormField label="Role" value={staffForm.role} onChangeText={(role) => setStaffForm((current) => ({ ...current, role }))} />
        <FormField label="PIN" value={staffForm.pin} onChangeText={(pin) => setStaffForm((current) => ({ ...current, pin }))} keyboardType="numeric" />
        <View style={styles.permissionEditor}>
          <Text style={styles.permissionEditorLabel}>Suggested mobile permissions</Text>
          <View style={styles.permissionChipWrap}>
            {capabilityDefinitions.map((capability) => {
              const active = selectedStaffPermissions.includes(capability.key);
              return (
                <Pressable
                  key={capability.key}
                  style={[styles.permissionChip, active && styles.permissionChipActive]}
                  onPress={() => toggleStaffPermission(capability.key)}>
                  <Text style={[styles.permissionChipText, active && styles.permissionChipTextActive]}>
                    {capability.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <FormField
          label="Permissions"
          value={staffForm.permissionsText}
          onChangeText={(permissionsText) => setStaffForm((current) => ({ ...current, permissionsText }))}
          placeholder="pos, quick-entry, ledger"
          multiline
        />
        <Text style={styles.helperText}>
          Use comma-separated tokens for backend compatibility. The chips above fill the common mobile access values.
        </Text>
      </BottomSheet>

      <BottomSheet
        visible={attributeSheetVisible}
        title={editingAttribute ? 'Edit custom field' : 'Add custom field'}
        subtitle="These fields are rendered in sale or service forms and submitted as attributes."
        onClose={() => setAttributeSheetVisible(false)}
        fullHeight
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void saveAttribute()}>
            <Text style={styles.primaryButtonLabel}>{editingAttribute ? 'Save field' : 'Create field'}</Text>
          </Pressable>
        }>
        <SegmentedTabs
          value={attributeForm.entityType}
          onChange={(entityType) => setAttributeForm((current) => ({ ...current, entityType }))}
          options={[
            { label: 'Sale', value: 'sale' },
            { label: 'Service', value: 'service' },
          ]}
        />
        <FormField label="Key" value={attributeForm.key} onChangeText={(key) => setAttributeForm((current) => ({ ...current, key }))} />
        <FormField label="Label" value={attributeForm.label} onChangeText={(label) => setAttributeForm((current) => ({ ...current, label }))} />
        <FormField label="Field type" value={attributeForm.fieldType} onChangeText={(fieldType) => setAttributeForm((current) => ({ ...current, fieldType }))} />
        <FormField label="Placeholder" value={attributeForm.placeholder} onChangeText={(placeholder) => setAttributeForm((current) => ({ ...current, placeholder }))} />
        <FormField label="Default value" value={attributeForm.defaultValue} onChangeText={(defaultValue) => setAttributeForm((current) => ({ ...current, defaultValue }))} />
        <FormField label="Options (comma separated)" value={attributeForm.options} onChangeText={(options) => setAttributeForm((current) => ({ ...current, options }))} />
        <FormField label="Sort order" value={attributeForm.sortOrder} onChangeText={(sortOrder) => setAttributeForm((current) => ({ ...current, sortOrder }))} keyboardType="numeric" />
      </BottomSheet>

      <BottomSheet
        visible={subscriptionSheetVisible}
        title="Edit subscription"
        subtitle="This writes a partial PATCH payload back to the subscription endpoint."
        onClose={() => setSubscriptionSheetVisible(false)}
        fullHeight
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void saveSubscription()}>
            <Text style={styles.primaryButtonLabel}>Save subscription</Text>
          </Pressable>
        }>
        <FormField label="Status" value={subscriptionForm.status} onChangeText={(status) => setSubscriptionForm((current) => ({ ...current, status }))} />
        <FormField label="Plan name" value={subscriptionForm.planName} onChangeText={(planName) => setSubscriptionForm((current) => ({ ...current, planName }))} />
        <FormField label="Billing cycle" value={subscriptionForm.billingCycle} onChangeText={(billingCycle) => setSubscriptionForm((current) => ({ ...current, billingCycle }))} />
        <FormField label="Seat limit" value={subscriptionForm.seatLimit} onChangeText={(seatLimit) => setSubscriptionForm((current) => ({ ...current, seatLimit }))} keyboardType="numeric" />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  message: {
    color: palette.success,
    fontWeight: '700',
    fontSize: typography.body,
  },
  link: {
    color: palette.primary,
    fontWeight: '700',
  },
  dangerLink: {
    color: palette.danger,
    fontWeight: '700',
  },
  helperText: {
    fontSize: typography.body,
    color: palette.textMuted,
    lineHeight: 22,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryTile: {
    width: '48%',
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  summaryLabel: {
    fontSize: typography.caption,
    color: palette.textSoft,
  },
  summaryValue: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  meta: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  permissionMeta: {
    fontSize: typography.caption,
    color: palette.success,
    fontWeight: '700',
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  permissionEditor: {
    gap: spacing.sm,
  },
  permissionEditorLabel: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permissionChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  permissionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
  },
  permissionChipActive: {
    backgroundColor: palette.primary,
  },
  permissionChipText: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  permissionChipTextActive: {
    color: palette.white,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: palette.text,
    fontWeight: '700',
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
    fontWeight: '800',
    fontSize: typography.body,
  },
});
