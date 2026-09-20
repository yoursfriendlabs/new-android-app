import { banksApi } from '@/src/api';
import { normalizeBank } from '@/src/api/normalize';
import { usePagedList, type Page } from '@/src/shared/hooks/usePagedList';
import { useAuthStore } from '@/src/stores/auth-store';
import type { BankAccount } from '@/src/types/models';

type BankPage = Page<BankAccount> & { totalBalance: number };

export function useBankAccounts() {
  const businessId = useAuthStore((state) => state.session?.businessId);
  const list = usePagedList<BankAccount>({
    queryKey: ['banks', 'paged', businessId],
    enabled: Boolean(businessId),
    fetchPage: async ({ limit, offset }): Promise<BankPage> => {
      const response = await banksApi.list({ limit, offset });
      return {
        items: (response.items ?? []).map(normalizeBank),
        total: Number(response.total ?? 0),
        totalBalance: Number(response.totalBalance ?? 0),
      };
    },
  });
  return { ...list, totalBalance: (list.data?.pages[0] as BankPage | undefined)?.totalBalance };
}
