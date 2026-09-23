/**
 * Who the bill is from — the block printed at the top of every invoice.
 *
 * The details live in business settings (`business_settings`: companyName,
 * address, phone, email, panVat, logoUrl), which is the same record the web
 * app's invoice header reads. The business profile only carries the workspace
 * name and type, so it is a fallback, never the source.
 *
 * A personal workspace bills as a person: name and phone, no PAN/VAT.
 */
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';
import type { BusinessProfile, BusinessSettings, User } from '@/src/types/models';

export interface InvoiceIdentity {
  name: string;
  address: string;
  phone: string;
  email: string;
  panVat: string;
  logoUrl: string;
  personal: boolean;
}

function text(...candidates: unknown[]) {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function buildInvoiceIdentity(input: {
  settings?: BusinessSettings | null;
  profile?: BusinessProfile | null;
  user?: User | null;
}): InvoiceIdentity {
  const settings = (input.settings ?? {}) as Record<string, unknown>;
  const profile = (input.profile ?? {}) as Record<string, unknown>;
  const user = input.user ?? null;
  const personal = isPersonalWorkspace({ businessType: text(profile.businessType, profile.type) });

  if (personal) {
    return {
      name: text(user?.name, settings.companyName, profile.businessName, 'My book'),
      address: text(settings.address, profile.address),
      phone: text(user?.phone, settings.phone, profile.phone),
      email: text(user?.email, settings.email, profile.email),
      panVat: '',
      logoUrl: text(settings.logoUrl),
      personal: true,
    };
  }

  return {
    name: text(settings.companyName, profile.businessName, profile.name, 'PasalManager'),
    address: text(settings.address, profile.address),
    phone: text(settings.phone, profile.phone, user?.phone),
    email: text(settings.email, profile.email, user?.email),
    // Older records and other shapes spelled this a few different ways.
    panVat: text(settings.panVat, settings.panNumber, settings.vatNumber, profile.panVat, profile.panNumber, profile.vatNumber, profile.taxNumber),
    logoUrl: text(settings.logoUrl, profile.logoUrl),
    personal: false,
  };
}

/** For receipt builders, which run outside React. */
export function resolveInvoiceIdentity(profileOverride?: BusinessProfile | null): InvoiceIdentity {
  const state = useAuthStore.getState();
  return buildInvoiceIdentity({
    settings: state.businessSettings,
    profile: profileOverride ?? state.businessProfile,
    user: state.user,
  });
}

export function useInvoiceIdentity(): InvoiceIdentity {
  const settings = useAuthStore((state) => state.businessSettings);
  const profile = useAuthStore((state) => state.businessProfile);
  const user = useAuthStore((state) => state.user);
  return buildInvoiceIdentity({ settings, profile, user });
}

export function isInvoiceIdentity(value: unknown): value is InvoiceIdentity {
  return Boolean(value && typeof value === 'object' && 'panVat' in (value as object) && 'personal' in (value as object));
}
