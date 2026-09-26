import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { todayIso } from '@/src/shared/lib/format';
import type { AppPalette } from '@/src/theme/app-palette';
import type { Party, Service } from '@/src/types/models';

export type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

export interface ServiceDisplay {
  label: string;
  tone: StatusTone;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}

export function dueAmount(total: number, paid: number) {
  return Math.max(0, Number(total || 0) - Number(paid || 0));
}

export function isClosedStatus(status: string) {
  return ['closed', 'completed', 'delivered', 'cancelled'].includes(String(status || '').toLowerCase());
}

/** Overdue once the delivery day has passed; a job due today is not late yet. */
export function isOverdue(service: Service) {
  if (isClosedStatus(service.status) || !service.deliveryDate || !service.deliveryDate.trim()) return false;
  return service.deliveryDate.slice(0, 10) < todayIso();
}

export function getServiceDisplay(service: Service, isGym: boolean): ServiceDisplay {
  if (isClosedStatus(service.status)) {
    return {
      label: isGym ? 'Completed' : 'Closed',
      tone: 'muted',
      icon: 'check-circle-outline',
    };
  }
  if (isOverdue(service)) {
    return {
      label: isGym ? 'Expired' : 'Overdue',
      tone: 'danger',
      icon: 'alert-circle-outline',
    };
  }
  return {
    label: isGym ? 'Active' : 'In Progress',
    tone: 'warning',
    icon: 'progress-wrench',
  };
}

export function getToneColors(tone: StatusTone, colors: AppPalette) {
  if (tone === 'danger') return { bg: colors.dangerSoft, text: colors.danger, border: colors.danger };
  if (tone === 'success') return { bg: colors.successSoft, text: colors.success, border: colors.success };
  if (tone === 'warning') return { bg: colors.warningSoft, text: colors.warning, border: colors.warning };
  if (tone === 'info') return { bg: colors.accentSoft, text: colors.accent, border: colors.accent };
  return { bg: colors.backgroundAlt, text: colors.textMuted, border: colors.border };
}

export function resolveServiceCustomer(service: Service, partyMap?: Map<string, Party>) {
  const directParty = (service as any).party || (service as any).Party || (service as any).customer;
  const directName = service.partyName || directParty?.name || (service as any).customerName;
  const directPhone = directParty?.phone || (service as any).customerPhone || (service as any).phone;

  if (service.partyId && partyMap?.has(service.partyId)) {
    const matched = partyMap.get(service.partyId)!;
    return {
      name: directName || matched.name || 'Customer',
      phone: directPhone || matched.phone || '',
      address: matched.address || '',
      party: matched,
    };
  }

  return {
    name: directName || 'Walk-in Customer',
    phone: directPhone || '',
    address: directParty?.address || '',
    party: directParty,
  };
}

export function getServiceDeviceOrProblem(service: Service): string {
  const attrs = service.attributes || {};
  const candidates = [
    attrs.device,
    attrs.deviceName,
    attrs.model,
    attrs.brand,
    attrs.vehicleNo,
    attrs.problem,
    attrs.issue,
    attrs.serviceType,
    service.notes,
  ].filter(Boolean);

  if (candidates.length) {
    return String(candidates.slice(0, 2).join(' · '));
  }

  if (service.items?.length) {
    const customItems = service.items
      .map((i) => i.description || i.productName || i.itemType)
      .filter((desc) => desc && desc !== 'labor' && desc !== 'part');
    if (customItems.length) {
      return customItems.slice(0, 2).join(', ');
    }
  }

  return '';
}

export function getServiceAttachments(service?: Service | null): string[] {
  if (!service) return [];
  const list = service.attachments?.length
    ? service.attachments
    : service.attachment
      ? [service.attachment]
      : [];
  return list.filter(Boolean).map((uri) => String(uri));
}
