import { useQuery } from '@tanstack/react-query';

import {
  authApi,
  analyticsApi,
  banksApi,
  categoriesApi,
  metaApi,
  orderAttributesApi,
  partiesApi,
  partyTransactionsApi,
  productsApi,
  purchasesApi,
  quickExpensesApi,
  reportsApi,
  servicesApi,
  staffApi,
  subscriptionApi,
  unitsApi,
} from '@/src/api';
import {
  extractListItems,
  normalizeBank,
  normalizeBusinessProfile,
  normalizeBusinessTypeOption,
  normalizeCategory,
  normalizeDashboardSummary,
  normalizeExpenseAnalytics,
  normalizeInventorySummary,
  normalizeLedgerEntry,
  normalizeOrderAttribute,
  normalizeParty,
  normalizePartyReportItem,
  normalizePopularCategoryInsight,
  normalizeProfitLossAnalytics,
  normalizeProduct,
  normalizePurchase,
  normalizeQuickExpense,
  normalizeSale,
  normalizeSequenceMap,
  normalizeService,
  normalizeStaffMember,
  normalizeSubscription,
  normalizeUnit,
  normalizeUser,
  unwrapEntity,
} from '@/src/api/normalize';
import {
  cacheBanks,
  cacheLedgerEntries,
  cacheParties,
  cacheProducts,
  cacheRecentPurchases,
  cacheRecentServices,
  cacheQuickExpenses,
  readBanksFromCache,
  readLedgerEntriesFromCache,
  readPartiesFromCache,
  readProductsFromCache,
  readRecentPurchasesFromCache,
  readRecentServicesFromCache,
  readQuickExpensesFromCache,
} from '@/src/data/cache';
import { todayIso } from '@/src/lib/format';
import type {
  BankAccount,
  BusinessProfile,
  BusinessSettings,
  BusinessTypeOption,
  Category,
  DashboardSummary,
  ExpenseAnalytics,
  InventorySummary,
  LedgerEntry,
  OrderAttribute,
  Party,
  PartyReportItem,
  PartyTransaction,
  PopularCategoryInsight,
  Product,
  ProfitLossAnalytics,
  Purchase,
  QuickExpense,
  Sale,
  SequenceMap,
  Service,
  StaffMember,
  Subscription,
  Unit,
  User,
} from '@/src/types/models';

async function withFallback<T>(loader: () => Promise<T>, fallback: () => Promise<T>) {
  try {
    return await loader();
  } catch {
    return fallback();
  }
}

function filterProducts(items: Product[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return items;

  return items.filter((item) =>
    [
      item.name,
      item.categoryName,
      item.primaryUnit,
      item.secondaryUnit,
      item.sku,
      item.barcode,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
}

function filterParties(items: Party[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return items;

  return items.filter((item) =>
    [item.name, item.phone, item.type, item.address, item.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
}

function todayRange() {
  const today = todayIso();
  return { from: today, to: today };
}

export function useDashboardSummary(initialRange?: { from: string; to: string }) {
  const range = initialRange || todayRange();

  return useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary', range.from, range.to],
    queryFn: async () => normalizeDashboardSummary(await metaApi.dashboardSummary(range)),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useBusinessTypes() {
  return useQuery<BusinessTypeOption[]>({
    queryKey: ['business-types'],
    queryFn: async () => {
      try {
        const response = await metaApi.businessTypes();
        const items = extractListItems<BusinessTypeOption>(response)
          .map(normalizeBusinessTypeOption)
          .filter((item) => item.value);
        if (items.length) {
          return items;
        }
      } catch {
        // Fall through to defaults.
      }

      return [
        { value: 'retail', label: 'Retail / Grocery', description: 'Fast counter billing first' },
        { value: 'cafe', label: 'Cafe', description: 'POS-style flow with quick service' },
        { value: 'jewellery', label: 'Jewellery', description: 'Detailed sales and services' },
      ];
    },
    staleTime: 5 * 60_000,
  });
}

export function useBusinessProfileQuery() {
  return useQuery<BusinessProfile>({
    queryKey: ['business-profile'],
    queryFn: async () => normalizeBusinessProfile(await metaApi.businessProfile()),
    staleTime: 60_000,
  });
}

export function useBusinessSettingsQuery() {
  return useQuery<BusinessSettings>({
    queryKey: ['business-settings'],
    queryFn: async () => unwrapEntity<BusinessSettings>(await metaApi.businessSettings()),
    staleTime: 60_000,
  });
}

export function useNextSequences() {
  return useQuery<SequenceMap>({
    queryKey: ['next-sequences'],
    queryFn: async () => normalizeSequenceMap(await metaApi.nextSequences()),
    staleTime: 30_000,
  });
}

export function useProducts(search = '') {
  return useQuery<Product[]>({
    queryKey: ['products', search],
    queryFn: async () =>
      withFallback(
        async () => {
          if (search.trim()) {
            try {
              const lookupResponse = await productsApi.lookup({ search, limit: 60 });
              const lookupItems = extractListItems<Product>(lookupResponse)
                .map(normalizeProduct)
                .filter((item) => item.id);
              if (lookupItems.length) {
                return lookupItems;
              }
            } catch {
              // Fall back to the list endpoint below.
            }
          }

          const response = await productsApi.list({ limit: 500 });
          const items = extractListItems<Product>(response).map(normalizeProduct).filter((item) => item.id);
          await cacheProducts(items);
          if (!search.trim()) {
            return items;
          }
          return filterProducts(items, search).slice(0, 60);
        },
        async () => readProductsFromCache(search, search.trim() ? 60 : 500),
      ),
    staleTime: 30_000,
  });
}

export function useProductById(productId?: string) {
  return useQuery<Product | null>({
    queryKey: ['product', productId],
    enabled: Boolean(productId),
    queryFn: async () => {
      if (!productId) return null;
      return normalizeProduct(await productsApi.get(productId));
    },
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.list({ limit: 250 });
      return extractListItems<Category>(response).map(normalizeCategory).filter((item) => item.id);
    },
    staleTime: 60_000,
  });
}

export function useQuickExpenses(search = '') {
  return useQuery<QuickExpense[]>({
    queryKey: ['quick-expenses', search],
    queryFn: async () =>
      withFallback(
        async () => {
          const response = await quickExpensesApi.list({ search, limit: 250 });
          const items = extractListItems<QuickExpense>(response)
            .map(normalizeQuickExpense)
            .filter((item) => item.id);
          await cacheQuickExpenses(items);
          return items;
        },
        async () => {
          const cached = await readQuickExpensesFromCache(search, 250);
          if (cached.length) {
            return cached;
          }
          const defaults = [
            { id: 'def-1', businessId: '', name: 'Rent' },
            { id: 'def-2', businessId: '', name: 'Utilities' },
            { id: 'def-3', businessId: '', name: 'Salary' },
            { id: 'def-4', businessId: '', name: 'Tea & Snacks' },
            { id: 'def-5', businessId: '', name: 'Office Supplies' },
            { id: 'def-6', businessId: '', name: 'Travel' },
            { id: 'def-7', businessId: '', name: 'Marketing' },
            { id: 'def-8', businessId: '', name: 'Maintenance' },
            { id: 'def-9', businessId: '', name: 'Other Expenses' },
          ];
          return defaults.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
        }
      ),
    staleTime: 30_000,
  });
}


export function useUnits() {
  return useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: async () => {
      const response = await unitsApi.list({ limit: 250 });
      return extractListItems<Unit>(response).map(normalizeUnit).filter((item) => item.id);
    },
    staleTime: 60_000,
  });
}

export function useParties(search = '', type = 'customer') {
  return useQuery<Party[]>({
    queryKey: ['parties', search, type],
    queryFn: async () =>
      withFallback(
        async () => {
          const normalizedType = type === 'both' ? undefined : type;

          if (search.trim()) {
            try {
              const lookupResponse = await partiesApi.lookup({ search, type: normalizedType, limit: 80 });
              const lookupItems = extractListItems<Party>(lookupResponse).map(normalizeParty).filter((item) => item.id);
              if (lookupItems.length) {
                return lookupItems;
              }
            } catch {
              // Fall back to the list endpoint below.
            }
          }

          const response = await partiesApi.list({ limit: 250, type: normalizedType });
          const items = extractListItems<Party>(response).map(normalizeParty).filter((item) => item.id);
          await cacheParties(items);
          if (!search.trim()) {
            return items;
          }
          return filterParties(items, search).slice(0, 80);
        },
        () => readPartiesFromCache(search, 80),
      ),
    staleTime: 30_000,
  });
}

export function usePartyById(partyId?: string) {
  return useQuery<Party | null>({
    queryKey: ['party', partyId],
    enabled: Boolean(partyId),
    queryFn: async () => {
      if (!partyId) return null;
      return normalizeParty(await partiesApi.get(partyId));
    },
    staleTime: 30_000,
  });
}

export function useBanks(search = '') {
  return useQuery<BankAccount[]>({
    queryKey: ['banks', search],
    queryFn: async () =>
      withFallback(
        async () => {
          const response = await banksApi.list({ limit: 100, search });
          const items = extractListItems<BankAccount>(response).map(normalizeBank).filter((item) => item.id);
          await cacheBanks(items);
          if (!search.trim()) {
            return items;
          }
          const query = search.trim().toLowerCase();
          return items.filter((item) =>
            [item.name, item.accountName, item.accountNumber, item.branchName, item.notes]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(query),
          );
        },
        () => readBanksFromCache(search, 60),
      ),
    staleTime: 60_000,
  });
}

export function useBankById(bankId?: string) {
  return useQuery<BankAccount | null>({
    queryKey: ['bank', bankId],
    enabled: Boolean(bankId),
    queryFn: async () => {
      if (!bankId) return null;
      return normalizeBank(await banksApi.get(bankId));
    },
    staleTime: 30_000,
  });
}

export function useRecentSales() {
  return useQuery<Sale[]>({
    queryKey: ['recent-sales'],
    queryFn: async () => {
      const response = await reportsApi.salesReport({ limit: 20 });
      return extractListItems<Sale>(response).map(normalizeSale).filter((item) => item.id);
    },
    staleTime: 30_000,
  });
}

export function useRecentPurchases() {
  return useQuery<Purchase[]>({
    queryKey: ['recent-purchases'],
    queryFn: async () =>
      withFallback(
        async () => {
          const response = await purchasesApi.list({ limit: 20 });
          const items = extractListItems<Purchase>(response).map(normalizePurchase).filter((item) => item.id);
          await cacheRecentPurchases(items);
          return items;
        },
        () => readRecentPurchasesFromCache(20),
      ),
  });
}

export function usePurchases(entryType?: 'purchase' | 'expense') {
  return useQuery<Purchase[]>({
    queryKey: ['purchases', entryType ?? 'all'],
    queryFn: async () => {
      const response = await purchasesApi.list({ limit: 80, entryType });
      return extractListItems<Purchase>(response).map(normalizePurchase).filter((item) => item.id);
    },
    staleTime: 30_000,
  });
}

export function usePurchaseById(purchaseId?: string) {
  return useQuery<Purchase | null>({
    queryKey: ['purchase', purchaseId],
    enabled: Boolean(purchaseId),
    queryFn: async () => {
      if (!purchaseId) return null;
      return normalizePurchase(await purchasesApi.get(purchaseId));
    },
    staleTime: 30_000,
  });
}

export function useRecentServices() {
  return useQuery<Service[]>({
    queryKey: ['recent-services'],
    queryFn: async () =>
      withFallback(
        async () => {
          const response = await servicesApi.list({ limit: 20 });
          const items = extractListItems<Service>(response).map(normalizeService).filter((item) => item.id);
          await cacheRecentServices(items);
          return items;
        },
        () => readRecentServicesFromCache(20),
      ),
  });
}

export function useServicesList(status?: string) {
  return useQuery<Service[]>({
    queryKey: ['services-list', status ?? 'all'],
    queryFn: async () => {
      const response = await servicesApi.list({ limit: 80, status });
      return extractListItems<Service>(response).map(normalizeService).filter((item) => item.id);
    },
    staleTime: 30_000,
  });
}

export function useServiceById(serviceId?: string) {
  return useQuery<Service | null>({
    queryKey: ['service', serviceId],
    enabled: Boolean(serviceId),
    queryFn: async () => {
      if (!serviceId) return null;
      return normalizeService(await servicesApi.get(serviceId));
    },
    staleTime: 30_000,
  });
}

export function useLedger(partyId?: string) {
  return useQuery<LedgerEntry[]>({
    queryKey: ['ledger', partyId ?? 'all'],
    queryFn: async () =>
      withFallback(
        async () => {
          const response = await reportsApi.ledger({ limit: 80, partyId });
          const items = extractListItems<LedgerEntry>(response).map(normalizeLedgerEntry).filter((item) => item.id);
          await cacheLedgerEntries(items);
          return items;
        },
        () => readLedgerEntriesFromCache(80),
      ),
  });
}

export function usePartyStatement(partyId?: string, type?: string) {
  return useQuery<LedgerEntry[]>({
    queryKey: ['party-statement', partyId ?? 'all', type ?? 'all'],
    enabled: Boolean(partyId),
    queryFn: async () => {
      if (!partyId) return [];
      const response = await reportsApi.partyStatement({ partyId, limit: 80, type });
      return extractListItems<LedgerEntry>(response).map(normalizeLedgerEntry).filter((item) => item.id);
    },
    staleTime: 30_000,
  });
}

export function usePartyDetailReport(partyId?: string) {
  return useQuery<Record<string, unknown> | null>({
    queryKey: ['party-detail-report', partyId],
    enabled: Boolean(partyId),
    queryFn: async () => {
      if (!partyId) return null;
      return unwrapEntity<Record<string, unknown>>(await reportsApi.partyDetail(partyId));
    },
    staleTime: 30_000,
  });
}

export function usePartyTransactions(partyId?: string, direction?: string) {
  return useQuery<PartyTransaction[]>({
    queryKey: ['party-transactions', partyId ?? 'all', direction ?? 'all'],
    enabled: Boolean(partyId),
    queryFn: async () => {
      if (!partyId) return [];
      const response = await partyTransactionsApi.list({ partyId, direction, limit: 80 });
      return extractListItems<PartyTransaction>(response).map((item) => ({
        ...item,
        id: item.id ? String(item.id) : '',
        partyId: String(item.partyId ?? partyId),
        direction: String(item.direction ?? 'receive') as PartyTransaction['direction'],
        amount: Number(item.amount ?? 0),
        txDate: String(item.txDate ?? item.createdAt ?? ''),
        paymentMethod: String(item.paymentMethod ?? 'cash') as PartyTransaction['paymentMethod'],
        bankId: item.bankId ? String(item.bankId) : undefined,
        note: item.note ? String(item.note) : '',
      })).filter((item) => item.id);
    },
    staleTime: 30_000,
  });
}

export function usePartyReport() {
  return useQuery<PartyReportItem[]>({
    queryKey: ['party-report'],
    queryFn: async () => {
      const response = await reportsApi.partyReport({ limit: 100 });
      return extractListItems<PartyReportItem>(response)
        .map(normalizePartyReportItem)
        .filter((item) => item.name);
    },
    staleTime: 60_000,
  });
}

export function useInventorySummary() {
  return useQuery<InventorySummary>({
    queryKey: ['inventory-summary'],
    queryFn: async () =>
      withFallback(
        async () => normalizeInventorySummary(await reportsApi.inventorySummary()),
        async () => {
          const cachedProducts = await readProductsFromCache(undefined, 500);
          const lowStockCount = cachedProducts.filter((product) => Number(product.stockOnHand ?? 0) <= 5).length;
          return {
            totalProducts: cachedProducts.length,
            lowStockCount,
            outOfStockCount: cachedProducts.filter((product) => Number(product.stockOnHand ?? 0) <= 0).length,
            totalStockValue: cachedProducts.reduce(
              (sum, product) => sum + Number(product.stockOnHand ?? 0) * Number(product.purchasePrice ?? 0),
              0,
            ),
          };
        },
      ),
    staleTime: 60_000,
  });
}

export function useLowStockProducts() {
  return useQuery<Product[]>({
    queryKey: ['low-stock-products'],
    queryFn: async () =>
      withFallback(
        async () => {
          const response = await reportsApi.lowStock({ limit: 50 });
          return extractListItems<Product>(response).map(normalizeProduct).filter((item) => item.id);
        },
        async () => {
          const cachedProducts = await readProductsFromCache(undefined, 500);
          return cachedProducts.filter((product) => Number(product.stockOnHand ?? 0) <= 5).slice(0, 50);
        },
      ),
    staleTime: 60_000,
  });
}

export function useOrderAttributes(entityType: 'sale' | 'service') {
  return useQuery<OrderAttribute[]>({
    queryKey: ['order-attributes', entityType],
    queryFn: async () => {
      const response = await orderAttributesApi.list(entityType);
      return extractListItems<OrderAttribute>(response)
        .map(normalizeOrderAttribute)
        .filter((item) => item.id || item.key)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    },
    staleTime: 60_000,
  });
}

export function useSubscription() {
  return useQuery<Subscription | null>({
    queryKey: ['subscription'],
    queryFn: async () => normalizeSubscription(await subscriptionApi.get()),
    staleTime: 60_000,
  });
}

export function useStaff() {
  return useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const response = await staffApi.list({ limit: 100 });
      return extractListItems<StaffMember>(response).map(normalizeStaffMember).filter((item) => item.id);
    },
    staleTime: 30_000,
  });
}

export function useSubscriptionPaymentSetup() {
  return useQuery<Record<string, unknown> | null>({
    queryKey: ['subscription-payment-setup'],
    queryFn: async () =>
      unwrapEntity<Record<string, unknown>>(await subscriptionApi.paymentSetup()),
    staleTime: 60_000,
  });
}

export function useAnalyticsSummary(range = todayRange()) {
  return useQuery<Record<string, unknown>>({
    queryKey: ['analytics-summary', range.from, range.to],
    queryFn: async () => unwrapEntity<Record<string, unknown>>(await analyticsApi.summary(range)),
    staleTime: 60_000,
  });
}

export function useProfitLossAnalytics(range = todayRange()) {
  return useQuery<ProfitLossAnalytics>({
    queryKey: ['analytics-profit-loss', range.from, range.to],
    queryFn: async () => normalizeProfitLossAnalytics(await analyticsApi.profitLoss(range)),
    staleTime: 60_000,
  });
}

export function useExpenseInsights(range = todayRange(), filters: Partial<Record<'groupBy' | 'partyId' | 'supplierId' | 'categoryKey' | 'category', string>> = {}) {
  return useQuery<ExpenseAnalytics>({
    queryKey: ['analytics-expenses', range.from, range.to, filters.groupBy ?? '', filters.partyId ?? '', filters.supplierId ?? '', filters.categoryKey ?? '', filters.category ?? ''],
    queryFn: async () =>
      normalizeExpenseAnalytics(
        await analyticsApi.expenses({
          ...range,
          ...filters,
        }),
      ),
    staleTime: 60_000,
  });
}

export function usePopularCategories(range = todayRange()) {
  return useQuery<PopularCategoryInsight[]>({
    queryKey: ['analytics-popular-categories', range.from, range.to],
    queryFn: async () => {
      const response = await analyticsApi.popularCategories(range);
      return extractListItems<PopularCategoryInsight>(response)
        .map(normalizePopularCategoryInsight)
        .filter((item): item is PopularCategoryInsight => Boolean(item));
    },
    staleTime: 60_000,
  });
}

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const response = await authApi.me();
      const record = unwrapEntity<Record<string, unknown>>(response);
      return normalizeUser(record.user ?? response);
    },
    staleTime: 30_000,
  });
}
