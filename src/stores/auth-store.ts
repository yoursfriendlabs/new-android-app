import { create } from 'zustand';

import { authApi, metaApi, subscriptionApi } from '@/src/api';
import { isInvalidSessionError } from '@/src/api/client';
import {
  normalizeAccessControl,
  normalizeBusinessProfile,
  normalizeSubscription,
  normalizeUser,
  unwrapEntity,
} from '@/src/api/normalize';
import { clearAllCacheRecords, clearAllLocalData, countQueuedMutations } from '@/src/data/database';
import { hasAccessControlPayload, resolveStoredPermissions } from '@/src/features/staff/lib/access-control';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { firstNonEmptyId } from '@/src/shared/lib/workspace';
import {
  clearSessionStorage,
  loadBusinessProfile,
  loadBusinessSettings,
  loadSession,
  persistBusinessProfile,
  persistBusinessSettings,
  persistSession,
} from '@/src/shared/lib/session';
import { useHabitStore } from '@/src/stores/habit-store';
import type {
  ChangePasswordPayload,
  CreateBusinessPayload,
  LoginPayload,
  RegisterPayload,
  UpdateMePayload,
  VerifyOtpPayload,
} from '@/src/types/contracts';
import type { AuthResponseShape } from '@/src/types/contracts';
import type {
  AccessControl,
  BusinessProfile,
  BusinessSettings,
  SessionData,
  Subscription,
  User,
  WorkspaceMembership,
} from '@/src/types/models';

type AuthStatus = 'booting' | 'signed-out' | 'signed-in';
type AuthActionResult = 'signed-in' | 'verify-email';

interface PendingVerificationState {
  email: string;
}

interface AuthState {
  status: AuthStatus;
  session: SessionData | null;
  user: User | null;
  businessProfile: BusinessProfile | null;
  businessSettings: BusinessSettings | null;
  subscription: Subscription | null;
  accessControl: AccessControl | null;
  businesses: WorkspaceMembership[];
  canCreateBusiness: boolean;
  pendingVerification: PendingVerificationState | null;
  bootstrap: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<AuthActionResult>;
  register: (payload: RegisterPayload) => Promise<AuthActionResult>;
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (payload: VerifyOtpPayload) => Promise<AuthActionResult>;
  hydrateRemoteData: (options?: { refreshSession?: boolean }) => Promise<void>;
  switchWorkspace: (businessId: string) => Promise<void>;
  createBusiness: (payload: CreateBusinessPayload) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  updateProfile: (payload: UpdateMePayload) => Promise<User>;
  updateSettings: (settings: BusinessSettings) => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
  clearPendingVerification: () => void;
  signOut: () => Promise<void>;
}

interface ParsedAuthResponse {
  session: SessionData | null;
  user: User | null;
  businessProfile: BusinessProfile | null;
  subscription: Subscription | null;
  accessControl: AccessControl | null;
  businesses: WorkspaceMembership[];
  canCreateBusiness: boolean;
  requiresVerification: boolean;
  verificationEmail: string;
}

function parseWorkspaceList(
  source: AuthResponseShape,
  fallback: WorkspaceMembership[] = [],
): WorkspaceMembership[] {
  const raw = source.businesses;
  if (!Array.isArray(raw)) return fallback;
  const items = raw.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const id = String(item.id ?? item.businessId ?? '').trim();
      if (!id) return [];
      const workspace: WorkspaceMembership = {
        id,
        businessId: String(item.businessId ?? item.id ?? id),
        name: String(item.name || 'Workspace'),
        type: String(item.type || ''),
        label: String(item.label || item.type || ''),
        role: String(item.role ?? ''),
        isOwner: Boolean(item.isOwner),
        isPersonal: Boolean(item.isPersonal),
        membershipId: item.membershipId ? String(item.membershipId) : null,
        isActive: item.isActive !== false,
      };
      return [workspace];
    });
  return items.length ? items : fallback;
}

function parseCanCreateBusiness(source: AuthResponseShape, fallback = false, businesses?: WorkspaceMembership[]) {
  if (businesses && businesses.length) {
    const ownedBusinesses = businesses.filter((item) => !item.isPersonal && (item.isOwner || item.role === 'owner'));
    if (ownedBusinesses.length >= 1) return false;
  }
  if (typeof source.canCreateBusiness === 'boolean') return source.canCreateBusiness;
  return fallback;
}

function attachWorkspaceFields(session: SessionData | null, parsed: ParsedAuthResponse): SessionData | null {
  if (!session) return null;
  return {
    ...session,
    businesses: parsed.businesses.length ? parsed.businesses : session.businesses ?? [],
    canCreateBusiness: parsed.canCreateBusiness,
  };
}

async function assertQueueEmpty(action: 'switch' | 'create') {
  const pending = await countQueuedMutations();
  if (pending > 0) {
    throw new Error(
      action === 'switch'
        ? 'Finish syncing unsaved changes before switching workspaces.'
        : 'Finish syncing unsaved changes before adding a business.',
    );
  }
}

function parseAuthResponse(
  response: AuthResponseShape | User,
  fallbackEmail = '',
  fallbackSession: SessionData | null = null,
): ParsedAuthResponse {
  const responseRecord =
    typeof response === 'object' && response !== null ? (response as AuthResponseShape) : {};
  const source = (responseRecord.data ?? responseRecord) as AuthResponseShape;
  const rawUser =
    source.user ??
    responseRecord.user ??
    ('name' in responseRecord || 'email' in responseRecord ? responseRecord : null);
  const accessControl = normalizeAccessControl(
    source.accessControl ??
      responseRecord.accessControl ??
      (rawUser && typeof rawUser === 'object' && rawUser !== null && 'accessControl' in rawUser
        ? rawUser.accessControl
        : null),
  );
  const rawBusinessProfile = source.businessProfile ?? responseRecord.businessProfile ?? null;
  const businessProfile = rawBusinessProfile ? normalizeBusinessProfile(rawBusinessProfile) : null;
  const rawSubscription = source.subscription ?? responseRecord.subscription ?? fallbackSession?.subscription ?? null;
  const subscription = rawSubscription ? normalizeSubscription(rawSubscription) : null;
  const role =
    source.role ??
    responseRecord.role ??
    (typeof rawUser === 'object' && rawUser !== null && 'role' in rawUser ? rawUser.role : null) ??
    fallbackSession?.role ??
    null;
  const baseUser = rawUser ? normalizeUser(rawUser) : fallbackSession?.user ?? null;
  const user = baseUser
    ? {
        ...baseUser,
        role: String(role ?? baseUser.role ?? ''),
        permissions: resolveStoredPermissions(accessControl, baseUser.permissions),
      }
    : null;
  const business = source.business ?? responseRecord.business ?? fallbackSession?.business ?? null;
  const businessId =
    firstNonEmptyId(
      business,
      source.businessId,
      responseRecord.business,
      responseRecord.businessId,
      rawBusinessProfile,
      businessProfile,
      user?.businessId,
      fallbackSession?.businessId,
    ) || undefined;
  const token = source.token ?? source.accessToken ?? responseRecord.token ?? responseRecord.accessToken ?? fallbackSession?.token;
  const requiresVerification = Boolean(
    source.requireVerification ??
      source.verificationRequired ??
      responseRecord.requireVerification ??
      responseRecord.verificationRequired,
  );
  const verificationEmail = user?.email ?? fallbackEmail;
  const businesses = parseWorkspaceList(source, parseWorkspaceList(responseRecord, fallbackSession?.businesses ?? []));
  const canCreateBusiness = parseCanCreateBusiness(
    source,
    parseCanCreateBusiness(responseRecord, fallbackSession?.canCreateBusiness ?? false, businesses),
    businesses,
  );

  if (!token || !businessId) {
    return {
      session: null,
      user,
      businessProfile,
      subscription,
      accessControl: hasAccessControlPayload(accessControl) ? accessControl : null,
      businesses,
      canCreateBusiness,
      requiresVerification,
      verificationEmail,
    };
  }

  return {
    session: {
      token,
      businessId,
      user,
      business,
      businesses,
      canCreateBusiness,
      role: typeof role === 'string' && role.trim() ? role : user?.role ?? null,
      accessControl: hasAccessControlPayload(accessControl) ? accessControl : null,
      subscription,
    },
    user,
    businessProfile,
    subscription,
    accessControl: hasAccessControlPayload(accessControl) ? accessControl : null,
    businesses,
    canCreateBusiness,
    requiresVerification,
    verificationEmail,
  };
}

async function persistResolvedState(parsed: ParsedAuthResponse) {
  if (parsed.session) {
    await persistSession(attachWorkspaceFields(parsed.session, parsed));
  }
  if (parsed.businessProfile) {
    await persistBusinessProfile(parsed.businessProfile);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  session: null,
  user: null,
  businessProfile: null,
  businessSettings: null,
  subscription: null,
  accessControl: null,
  businesses: [],
  canCreateBusiness: false,
  pendingVerification: null,
  bootstrap: async () => {
    let session: SessionData | null = null;
    let businessProfile: BusinessProfile | null = null;
    let businessSettings: BusinessSettings | null = null;

    try {
      [session, businessProfile, businessSettings] = await Promise.all([
        loadSession(),
        loadBusinessProfile(),
        loadBusinessSettings(),
      ]);
    } catch (error) {
      console.warn('[bootstrap] session load failed', error);
      set({
        status: 'signed-out',
        session: null,
        user: null,
        businessProfile: null,
        businessSettings: null,
        subscription: null,
        accessControl: null,
        businesses: [],
        canCreateBusiness: false,
      });
      return;
    }

    if (!session?.token) {
      set({
        status: 'signed-out',
        session: null,
        user: null,
        businessProfile,
        businessSettings,
        subscription: session?.subscription ?? null,
        accessControl: null,
        businesses: session?.businesses ?? [],
        canCreateBusiness: session?.canCreateBusiness ?? false,
      });
      return;
    }

    try {
      const response = await authApi.me();
      const parsed = parseAuthResponse(response, session.user?.email ?? '', session);
      const resolvedSession = parsed.session ?? session;
      const resolvedProfile = parsed.businessProfile ?? businessProfile;

      await persistResolvedState({
        ...parsed,
        session: resolvedSession,
        businessProfile: resolvedProfile,
      });

      set({
        status: 'signed-in',
        session: resolvedSession,
        user: parsed.user ?? resolvedSession.user ?? null,
        businessProfile: resolvedProfile,
        businessSettings,
        subscription: parsed.subscription ?? resolvedSession.subscription ?? null,
        accessControl: parsed.accessControl ?? resolvedSession.accessControl ?? null,
        businesses: parsed.businesses.length ? parsed.businesses : resolvedSession.businesses ?? [],
        canCreateBusiness: parsed.canCreateBusiness,
        pendingVerification: null,
      });
      await get().hydrateRemoteData({ refreshSession: false });
    } catch (error) {
      if (isInvalidSessionError(error)) {
        await Promise.all([clearSessionStorage(), clearAllLocalData()]);
        set({
          status: 'signed-out',
          session: null,
          user: null,
          businessProfile: null,
          businessSettings: null,
          subscription: null,
          accessControl: null,
          businesses: [],
          canCreateBusiness: false,
          pendingVerification: null,
        });
        return;
      }

      set({
        status: 'signed-in',
        session,
        user: session.user ?? null,
        businessProfile,
        businessSettings,
        subscription: session.subscription ?? null,
        accessControl: session.accessControl ?? null,
        businesses: session.businesses ?? [],
        canCreateBusiness: session.canCreateBusiness ?? false,
        pendingVerification: null,
      });
    }
  },
  login: async (payload) => {
    const email = payload.email.trim();
    const cleanPayload = { ...payload, email };
    const response = await authApi.login(cleanPayload);
    const parsed = parseAuthResponse(response, email);

    if (!parsed.session) {
      set({
        status: 'signed-out',
        accessControl: null,
        businesses: parsed.businesses,
        canCreateBusiness: parsed.canCreateBusiness,
        pendingVerification: parsed.requiresVerification ? { email: parsed.verificationEmail || email } : null,
      });
      return parsed.requiresVerification ? 'verify-email' : 'signed-in';
    }

    await persistResolvedState(parsed);
    set({
      status: 'signed-in',
      session: parsed.session,
      user: parsed.user,
      businessProfile: parsed.businessProfile,
      subscription: parsed.subscription,
      accessControl: parsed.accessControl,
      businesses: parsed.businesses,
      canCreateBusiness: parsed.canCreateBusiness,
      pendingVerification: null,
    });
    await get().hydrateRemoteData({ refreshSession: false });
    return 'signed-in';
  },
  register: async (payload) => {
    const email = payload.email.trim();
    const cleanPayload = { ...payload, email };
    const response = await authApi.register(cleanPayload);
    const parsed = parseAuthResponse(response, email);

    if (!parsed.session) {
      set({
        status: 'signed-out',
        accessControl: null,
        businesses: parsed.businesses,
        canCreateBusiness: parsed.canCreateBusiness,
        pendingVerification: { email: parsed.verificationEmail || email },
      });
      return 'verify-email';
    }

    await persistResolvedState(parsed);
    set({
      status: 'signed-in',
      session: parsed.session,
      user: parsed.user,
      businessProfile: parsed.businessProfile,
      subscription: parsed.subscription,
      accessControl: parsed.accessControl,
      businesses: parsed.businesses,
      canCreateBusiness: parsed.canCreateBusiness,
      pendingVerification: null,
    });
    await get().hydrateRemoteData({ refreshSession: false });
    return 'signed-in';
  },
  requestEmailOtp: async (email) => {
    const cleanEmail = email.trim();
    await authApi.requestEmailOtp({ email: cleanEmail });
    set({ pendingVerification: { email: cleanEmail } });
  },
  verifyEmailOtp: async (payload) => {
    const email = payload.email.trim();
    const cleanPayload = { ...payload, email };
    const response = await authApi.verifyEmailOtp(cleanPayload);
    const parsed = parseAuthResponse(response as AuthResponseShape, email);

    if (!parsed.session) {
      set({ pendingVerification: { email } });
      return 'verify-email';
    }

    await persistResolvedState(parsed);
    set({
      status: 'signed-in',
      session: parsed.session,
      user: parsed.user,
      businessProfile: parsed.businessProfile,
      subscription: parsed.subscription,
      accessControl: parsed.accessControl,
      businesses: parsed.businesses,
      canCreateBusiness: parsed.canCreateBusiness,
      pendingVerification: null,
    });
    await get().hydrateRemoteData({ refreshSession: false });
    return 'signed-in';
  },
  hydrateRemoteData: async (options) => {
    const refreshSession = options?.refreshSession ?? true;
    const requests = await Promise.allSettled([
      refreshSession ? authApi.me() : Promise.resolve(null),
      metaApi.businessProfile(),
      metaApi.businessSettings(),
      subscriptionApi.get(),
    ]);
    const [userResult, profileResult, settingsResult, subscriptionResult] = requests;

    if (
      refreshSession &&
      userResult.status === 'rejected' &&
      isInvalidSessionError(userResult.reason)
    ) {
      await get().signOut();
      return;
    }

    const nextState: Partial<AuthState> = {};

    if (refreshSession && userResult.status === 'fulfilled' && userResult.value) {
      const parsed = parseAuthResponse(
        userResult.value as AuthResponseShape | User,
        get().user?.email ?? '',
        get().session,
      );
      const nextSession = attachWorkspaceFields(parsed.session ?? get().session, parsed);
      nextState.user = parsed.user ?? get().user;
      nextState.session = nextSession;
      nextState.accessControl = parsed.accessControl ?? get().accessControl;
      nextState.businesses = parsed.businesses.length ? parsed.businesses : get().businesses;
      nextState.canCreateBusiness = parsed.canCreateBusiness;
      if (parsed.businessProfile) {
        nextState.businessProfile = parsed.businessProfile;
        await persistBusinessProfile(parsed.businessProfile);
      }
      if (nextSession) {
        await persistSession(nextSession);
      }
    }

    if (profileResult.status === 'fulfilled') {
      const businessProfile = normalizeBusinessProfile(profileResult.value);
      nextState.businessProfile = businessProfile;
      await persistBusinessProfile(businessProfile);
      const profileBusinessId = firstNonEmptyId(businessProfile);
      const currentSession = nextState.session ?? get().session;
      if (profileBusinessId && currentSession && currentSession.businessId !== profileBusinessId) {
        const nextSession = { ...currentSession, businessId: profileBusinessId };
        nextState.session = nextSession;
        await persistSession(nextSession);
      }
    }

    if (settingsResult.status === 'fulfilled') {
      const businessSettings = unwrapEntity<BusinessSettings>(settingsResult.value);
      nextState.businessSettings = businessSettings;
      await persistBusinessSettings(businessSettings);
    }

    if (subscriptionResult.status === 'fulfilled') {
      const subscription = normalizeSubscription(subscriptionResult.value);
      nextState.subscription = subscription;
      const existingSession = nextState.session ?? get().session;
      if (existingSession) {
        const nextSession = { ...existingSession, subscription };
        nextState.session = nextSession;
        await persistSession(nextSession);
      }
    }

    set(nextState as Partial<AuthState>);

    const profile = nextState.businessProfile ?? get().businessProfile;
    const session = nextState.session ?? get().session;
    const user = nextState.user ?? get().user;
    void useHabitStore.getState().syncRemote({
      userId: user?.id,
      businessId: session?.businessId,
      personal: isPersonalWorkspace({
        businessType: String(profile?.businessType ?? ''),
      }),
    });
  },
  switchWorkspace: async (businessId) => {
    const id = String(businessId || '').trim();
    const current = get().session;
    if (!current?.token || !id || id === current.businessId) return;

    await assertQueueEmpty('switch');
    const nextSession = { ...current, businessId: id };
    await persistSession(nextSession);
    await clearAllCacheRecords();
    set({ session: nextSession });
    await get().hydrateRemoteData({ refreshSession: true });
  },
  createBusiness: async (payload) => {
    await assertQueueEmpty('create');
    const response = await authApi.createBusiness(payload);
    const parsed = parseAuthResponse(response, get().user?.email ?? '', get().session);
    if (!parsed.session) {
      throw new Error('Could not open the new business.');
    }
    await persistResolvedState(parsed);
    await clearAllCacheRecords();
    set({
      status: 'signed-in',
      session: parsed.session,
      user: parsed.user,
      businessProfile: parsed.businessProfile,
      subscription: parsed.subscription,
      accessControl: parsed.accessControl,
      businesses: parsed.businesses,
      canCreateBusiness: parsed.canCreateBusiness,
      pendingVerification: null,
    });
    await get().hydrateRemoteData({ refreshSession: true });
  },
  refreshWorkspaces: async () => {
    const response = await authApi.listBusinesses();
    const items = Array.isArray(response.items) ? response.items : [];
    const current = get();
    const canCreateBusiness =
      typeof response.canCreateBusiness === 'boolean' ? response.canCreateBusiness : current.canCreateBusiness;
    const nextSession = current.session
      ? { ...current.session, businesses: items.length ? items : current.session.businesses ?? [], canCreateBusiness }
      : current.session;
    if (nextSession) {
      await persistSession(nextSession);
    }
    set({
      businesses: items.length ? items : current.businesses,
      canCreateBusiness,
      session: nextSession,
    });
  },
  updateProfile: async (payload) => {
    const response = await authApi.updateMe(payload);
    const updatedUser = normalizeUser(unwrapEntity(response));
    const currentUser = get().user;
    const mergedUser: User = {
      ...(currentUser ?? {}),
      ...updatedUser,
      role: updatedUser.role || currentUser?.role || '',
      permissions: updatedUser.permissions?.length ? updatedUser.permissions : currentUser?.permissions ?? [],
      businessId: updatedUser.businessId || currentUser?.businessId || '',
    };

    const existingSession = get().session;
    const nextSession: SessionData | null = existingSession
      ? {
          ...existingSession,
          user: mergedUser,
        }
      : null;

    if (nextSession) {
      await persistSession(nextSession);
    }

    set({
      user: mergedUser,
      session: nextSession,
    });
    return mergedUser;
  },
  updateSettings: async (settings) => {
    await persistBusinessSettings(settings);
    set({ businessSettings: settings });
  },
  changePassword: async (payload) => {
    await authApi.changePassword(payload);
  },
  clearPendingVerification: () => set({ pendingVerification: null }),
  signOut: async () => {
    await Promise.all([clearSessionStorage(), clearAllLocalData()]);
    set({
      status: 'signed-out',
      session: null,
      user: null,
      businessProfile: null,
      businessSettings: null,
      subscription: null,
      accessControl: null,
      businesses: [],
      canCreateBusiness: false,
      pendingVerification: null,
    });
  },
}));
