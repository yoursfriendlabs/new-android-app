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
import { clearAllLocalData } from '@/src/data/database';
import {
  clearSessionStorage,
  loadBusinessProfile,
  loadBusinessSettings,
  loadSession,
  persistBusinessProfile,
  persistBusinessSettings,
  persistSession,
} from '@/src/lib/session';
import type {
  ChangePasswordPayload,
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
  pendingVerification: PendingVerificationState | null;
  bootstrap: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<AuthActionResult>;
  register: (payload: RegisterPayload) => Promise<AuthActionResult>;
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (payload: VerifyOtpPayload) => Promise<AuthActionResult>;
  hydrateRemoteData: (options?: { refreshSession?: boolean }) => Promise<void>;
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
  requiresVerification: boolean;
  verificationEmail: string;
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
        permissions: accessControl.permissions?.length
          ? accessControl.permissions
          : baseUser.permissions,
      }
    : null;
  const business = source.business ?? responseRecord.business ?? fallbackSession?.business ?? null;
  const businessId =
    source.businessId ??
    source.business?.businessId ??
    source.business?.id ??
    responseRecord.businessId ??
    responseRecord.business?.businessId ??
    responseRecord.business?.id ??
    user?.businessId ??
    businessProfile?.businessId ??
    businessProfile?.id ??
    fallbackSession?.businessId;
  const token = source.token ?? source.accessToken ?? responseRecord.token ?? responseRecord.accessToken ?? fallbackSession?.token;
  const requiresVerification = Boolean(
    source.requireVerification ??
      source.verificationRequired ??
      responseRecord.requireVerification ??
      responseRecord.verificationRequired,
  );
  const verificationEmail = user?.email ?? fallbackEmail;

  if (!token || !businessId) {
    return {
      session: null,
      user,
      businessProfile,
      subscription,
      accessControl: accessControl.permissions?.length ? accessControl : null,
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
      role: typeof role === 'string' && role.trim() ? role : user?.role ?? null,
      accessControl: accessControl.permissions?.length ? accessControl : null,
      subscription,
    },
    user,
    businessProfile,
    subscription,
    accessControl: accessControl.permissions?.length ? accessControl : null,
    requiresVerification,
    verificationEmail,
  };
}

async function persistResolvedState(parsed: ParsedAuthResponse) {
  if (parsed.session) {
    await persistSession(parsed.session);
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
  pendingVerification: null,
  bootstrap: async () => {
    const [session, businessProfile, businessSettings] = await Promise.all([
      loadSession(),
      loadBusinessProfile(),
      loadBusinessSettings(),
    ]);

    if (!session?.token) {
      set({
        status: 'signed-out',
        session: null,
        user: null,
        businessProfile,
        businessSettings,
        subscription: session?.subscription ?? null,
        accessControl: null,
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
        pendingVerification: null,
      });
    }
  },
  login: async (payload) => {
    const response = await authApi.login(payload);
    const parsed = parseAuthResponse(response, payload.email);

    if (!parsed.session) {
      set({
        status: 'signed-out',
        accessControl: null,
        pendingVerification: parsed.requiresVerification ? { email: parsed.verificationEmail || payload.email } : null,
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
      pendingVerification: null,
    });
    await get().hydrateRemoteData({ refreshSession: false });
    return 'signed-in';
  },
  register: async (payload) => {
    const response = await authApi.register(payload);
    const parsed = parseAuthResponse(response, payload.email);

    if (!parsed.session) {
      set({
        status: 'signed-out',
        accessControl: null,
        pendingVerification: { email: parsed.verificationEmail || payload.email },
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
      pendingVerification: null,
    });
    await get().hydrateRemoteData({ refreshSession: false });
    return 'signed-in';
  },
  requestEmailOtp: async (email) => {
    await authApi.requestEmailOtp({ email });
    set({ pendingVerification: { email } });
  },
  verifyEmailOtp: async (payload) => {
    const response = await authApi.verifyEmailOtp(payload);
    const parsed = parseAuthResponse(response as AuthResponseShape, payload.email);

    if (!parsed.session) {
      set({ pendingVerification: { email: payload.email } });
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
      const nextSession = parsed.session ?? get().session;
      nextState.user = parsed.user ?? get().user;
      nextState.session = nextSession;
      nextState.accessControl = parsed.accessControl ?? get().accessControl;
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
    }

    if (settingsResult.status === 'fulfilled') {
      const businessSettings = unwrapEntity<BusinessSettings>(settingsResult.value);
      nextState.businessSettings = businessSettings;
      await persistBusinessSettings(businessSettings);
    }

    if (subscriptionResult.status === 'fulfilled') {
      const subscription = normalizeSubscription(subscriptionResult.value);
      nextState.subscription = subscription;
      const existingSession = get().session;
      if (existingSession) {
        const nextSession = { ...existingSession, subscription };
        nextState.session = nextSession;
        await persistSession(nextSession);
      }
    }

    set(nextState as Partial<AuthState>);
  },
  updateProfile: async (payload) => {
    const response = await authApi.updateMe(payload);
    const parsed = parseAuthResponse(response as AuthResponseShape | User, get().user?.email ?? '', get().session);
    const user = parsed.user ?? normalizeUser(unwrapEntity(response));
    const existingSession = get().session;
    const nextSession = existingSession
      ? {
          ...existingSession,
          user,
          role: parsed.session?.role ?? existingSession.role,
          accessControl: parsed.accessControl ?? existingSession.accessControl ?? null,
        }
      : null;
    if (nextSession) {
      await persistSession(nextSession);
    }
    if (parsed.businessProfile) {
      await persistBusinessProfile(parsed.businessProfile);
    }
    set({
      user,
      session: nextSession,
      businessProfile: parsed.businessProfile ?? get().businessProfile,
      accessControl: parsed.accessControl ?? get().accessControl,
    });
    return user;
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
      pendingVerification: null,
    });
  },
}));
