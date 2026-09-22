import { useMemo } from 'react';

import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';

/** Whether Pekka is in a Personal workspace, and which currency to speak in. */
export function usePekkaWorkspace() {
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);

  const isPersonal = useMemo(
    () =>
      isPersonalWorkspace({
        role: session?.role ?? user?.role ?? undefined,
        permissions: accessControl?.permissions ?? user?.permissions,
        accessControl,
        enabledModules: businessProfile?.enabledModules,
        businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
      }),
    [accessControl, businessProfile, session, user],
  );

  return { isPersonal, currency: businessProfile?.currencyCode || 'NPR' };
}
