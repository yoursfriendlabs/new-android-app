import type {
  AccessControl,
  BankAccount,
  BusinessProfile,
  BusinessTypeOption,
  Category,
  DashboardSummary,
  ExpenseAnalytics,
  ExpenseCategoryInsight,
  InventorySummary,
  LedgerEntry,
  OrderAttribute,
  PaginatedResponse,
  Party,
  PartyReportItem,
  PopularCategoryInsight,
  ProfitLossAnalytics,
  ProfitLossSeriesPoint,
  Product,
  Purchase,
  QuickExpense,
  Sale,
  SequenceMap,
  Service,
  StaffMember,
  Subscription,
  Unit,
  UploadResult,
  User,
  Task,
  TaskAssignment,
  TaskActivity,
  TaskMetadata,
  TaskNotificationSummary,
} from '@/src/types/models';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

function firstDefined<T>(...values: T[]) {
  return values.find((value) => value !== undefined && value !== null);
}

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }

  return undefined;
}

export function unwrapEntity<T>(payload: unknown): T {
  const record = asRecord(payload);
  if (record && 'data' in record && record.data !== undefined) {
    return record.data as T;
  }
  return payload as T;
}

export function extractListItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  const entity = unwrapEntity<UnknownRecord | UnknownRecord[] | null>(payload);
  if (Array.isArray(entity)) {
    return entity as T[];
  }

  const record = asRecord(entity);
  if (!record) return [];

  const candidates = [
    record.items,
    record.results,
    record.rows,
    record.list,
    record.docs,
    record.products,
    record.parties,
    record.banks,
    record.sales,
    record.purchases,
    record.services,
    record.entries,
    record.transactions,
    record.categories,
    record.units,
    record.staff,
    record.attributes,
    record.types,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }

  return [];
}

export function normalizeUser(raw: unknown): User {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as User),
    id: asString(firstDefined(record.id, record._id, record.userId), ''),
    name: asString(firstDefined(record.name, record.fullName), 'User'),
    email: asString(record.email, ''),
    phone: asString(record.phone, ''),
    role: asString(firstDefined(record.role, record.userRole), ''),
    permissions: asStringArray(record.permissions),
    businessId: asString(firstDefined(record.businessId, record.business_id), ''),
  };
}

export function normalizeAccessControl(raw: unknown): AccessControl {
  const record = asRecord(raw) ?? {};
  const rawPermissions = firstDefined(record.permissions, record.allowedPermissions);
  let permissions: string[] | Record<string, string> = [];
  if (Array.isArray(rawPermissions)) {
    permissions = asStringArray(rawPermissions);
  } else if (rawPermissions && typeof rawPermissions === 'object') {
    permissions = {};
    for (const [key, val] of Object.entries(rawPermissions)) {
      permissions[key] = String(val);
    }
  }
  return {
    ...(record as AccessControl),
    permissions,
  };
}

export function normalizeBusinessProfile(raw: unknown): BusinessProfile {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as BusinessProfile),
    id: asString(firstDefined(record.id, record._id), ''),
    businessId: asString(firstDefined(record.businessId, record.business_id, record.id), ''),
    businessName: asString(firstDefined(record.businessName, record.name), ''),
    businessType: asString(firstDefined(record.businessType, record.type), 'retail'),
    enabledModules: asStringArray(firstDefined(record.enabledModules, record.modules)),
    salesRoute: asString(record.salesRoute, ''),
    servicesRoute: asString(record.servicesRoute, ''),
    currencyCode: asString(firstDefined(record.currencyCode, record.currency), ''),
  };
}

export function normalizeBusinessTypeOption(raw: unknown): BusinessTypeOption {
  const record = asRecord(raw) ?? {};
  const value = asString(firstDefined(record.value, record.code, record.slug, record.id), '');
  return {
    ...(record as BusinessTypeOption),
    value,
    label: asString(firstDefined(record.label, record.name, value), value || 'Business type'),
    description: asString(record.description, ''),
    icon: asString(record.icon, ''),
  };
}

function findSummaryMetric(cards: unknown[], matcher: (label: string) => boolean) {
  for (const card of cards) {
    const record = asRecord(card);
    if (!record) continue;

    const label = asString(
      firstDefined(record.key, record.label, record.title, record.name),
      '',
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    if (!label || !matcher(label)) continue;

    return asNumber(
      firstDefined(record.value, record.amount, record.total, record.count),
    );
  }

  return undefined;
}

export function normalizeDashboardSummary(raw: unknown): DashboardSummary {
  const entity = unwrapEntity<unknown>(raw);
  const record = asRecord(entity) ?? {};
  const nestedSummary =
    asRecord(firstDefined(record.summary, record.stats, record.totals, record.dashboard)) ?? {};
  const summaryCards = Array.isArray(
    firstDefined(record.summaryCards, record.cards, record.kpis, nestedSummary.summaryCards, nestedSummary.cards),
  )
    ? (firstDefined(record.summaryCards, record.cards, record.kpis, nestedSummary.summaryCards, nestedSummary.cards) as unknown[])
    : [];

  const salesToday = firstFiniteNumber(
    firstDefined(record.salesToday, nestedSummary.salesToday),
    firstDefined(record.todaySales, nestedSummary.todaySales),
    firstDefined(record.totalSales, nestedSummary.totalSales, record.salesTotal),
    findSummaryMetric(summaryCards, (label) => label.includes('sales') && label.includes('today')),
    findSummaryMetric(summaryCards, (label) => label === 'sales' || label === 'total sales'),
  );
  const cashIn = firstFiniteNumber(
    firstDefined(record.cashIn, nestedSummary.cashIn, record.cashReceived),
    firstDefined(record.todayCashIn, nestedSummary.todayCashIn),
    firstDefined(record.receivedAmount, nestedSummary.receivedAmount),
    findSummaryMetric(summaryCards, (label) => label.includes('cash in')),
    findSummaryMetric(summaryCards, (label) => label.includes('received')),
  );
  const cashOut = firstFiniteNumber(
    firstDefined(record.cashOut, nestedSummary.cashOut, record.cashPaid),
    firstDefined(record.expenseTotal, nestedSummary.expenseTotal, record.expenseTotal),
    findSummaryMetric(summaryCards, (label) => label.includes('cash out')),
    findSummaryMetric(summaryCards, (label) => label.includes('expense') || label.includes('paid')),
  );
  const dueToReceive = firstFiniteNumber(
    firstDefined(record.dueToReceive, nestedSummary.dueToReceive, record.pendingReceivable),
    firstDefined(record.totalReceivable, nestedSummary.totalReceivable),
    firstDefined(record.receivable, nestedSummary.receivable),
    findSummaryMetric(summaryCards, (label) => label.includes('receive') || label.includes('receivable')),
  );
  const dueToGive = firstFiniteNumber(
    firstDefined(record.dueToGive, nestedSummary.dueToGive, record.pendingPayable),
    firstDefined(record.totalPayable, nestedSummary.totalPayable),
    firstDefined(record.payable, nestedSummary.payable),
    findSummaryMetric(summaryCards, (label) => label.includes('give') || label.includes('payable')),
  );
  const purchaseToday = firstFiniteNumber(
    firstDefined(record.purchaseToday, nestedSummary.purchaseToday),
    firstDefined(record.totalPurchases, nestedSummary.totalPurchases),
    firstDefined(record.purchaseTotal, nestedSummary.purchaseTotal, record.purchaseTotal),
    findSummaryMetric(summaryCards, (label) => label.includes('purchase')),
  );
  const serviceOpen = firstFiniteNumber(
    firstDefined(record.serviceOpen, nestedSummary.serviceOpen),
    firstDefined(record.openServices, nestedSummary.openServices),
    firstDefined(record.serviceTotal, record.serviceCount, nestedSummary.serviceCount),
    findSummaryMetric(summaryCards, (label) => label.includes('service') && label.includes('open')),
    findSummaryMetric(summaryCards, (label) => label.includes('open service')),
  );

  const recentSales = Array.isArray(record.recentSales)
    ? record.recentSales.map(normalizeSale)
    : [];
  const recentPurchases = Array.isArray(record.recentPurchases)
    ? record.recentPurchases.map(normalizePurchase)
    : [];
  const upcomingServiceDeliveries = Array.isArray(record.upcomingServiceDeliveries)
    ? record.upcomingServiceDeliveries.map(normalizeService)
    : [];

  return {
    ...(record as DashboardSummary),
    cashReceived: asNumber(firstDefined(record.cashReceived, cashIn)),
    cashPaid: asNumber(firstDefined(record.cashPaid, cashOut)),
    pendingAmount: asNumber(record.pendingAmount),
    pendingReceivable: asNumber(firstDefined(record.pendingReceivable, dueToReceive)),
    pendingPayable: asNumber(firstDefined(record.pendingPayable, dueToGive)),
    salesTotal: asNumber(firstDefined(record.salesTotal, salesToday)),
    purchaseTotal: asNumber(firstDefined(record.purchaseTotal, purchaseToday)),
    serviceTotal: asNumber(record.serviceTotal),
    expenseTotal: asNumber(record.expenseTotal),
    profitOrLoss: asNumber(record.profitOrLoss),
    profitOrLossStatus: asString(record.profitOrLossStatus, 'neutral'),
    productCount: asNumber(record.productCount),
    lowStockCount: asNumber(record.lowStockCount),
    lowStockItems: Array.isArray(record.lowStockItems) ? record.lowStockItems : [],
    recentSales,
    recentPurchases,
    upcomingServiceDeliveries,

    // Legacy fields
    salesToday: Number.isFinite(Number(salesToday)) ? Number(salesToday) : 0,
    cashIn: Number.isFinite(Number(cashIn)) ? Number(cashIn) : 0,
    cashOut: Number.isFinite(Number(cashOut)) ? Number(cashOut) : 0,
    dueToReceive: Number.isFinite(Number(dueToReceive)) ? Number(dueToReceive) : 0,
    dueToGive: Number.isFinite(Number(dueToGive)) ? Number(dueToGive) : 0,
    purchaseToday: Number.isFinite(Number(purchaseToday)) ? Number(purchaseToday) : 0,
    serviceOpen: Number.isFinite(Number(serviceOpen)) ? Number(serviceOpen) : 0,
    summaryCards: summaryCards
      .map((card) => {
        const summaryCard = asRecord(card);
        if (!summaryCard) return null;
        return {
          label: asString(firstDefined(summaryCard.label, summaryCard.title, summaryCard.name), 'Summary'),
          value: asNumber(firstDefined(summaryCard.value, summaryCard.amount, summaryCard.total, summaryCard.count)),
          tone: asString(firstDefined(summaryCard.tone, summaryCard.variant), '') as
            | 'primary'
            | 'success'
            | 'warning'
            | undefined,
        };
      })
      .filter((card): card is NonNullable<typeof card> => Boolean(card)),
  };
}

export function normalizeCategory(raw: unknown): Category {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as Category),
    id: asString(firstDefined(record.id, record._id), ''),
    name: asString(firstDefined(record.name, record.label), 'Category'),
  };
}

export function normalizeUnit(raw: unknown): Unit {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as Unit),
    id: asString(firstDefined(record.id, record._id), ''),
    name: asString(firstDefined(record.name, record.label), 'Unit'),
    symbol: asString(firstDefined(record.symbol, record.code), ''),
  };
}

export function normalizeQuickExpense(raw: unknown): QuickExpense {
  const record = asRecord(raw) ?? {};
  return {
    id: asString(firstDefined(record.id, record._id), ''),
    businessId: asString(record.businessId, ''),
    name: asString(firstDefined(record.name, record.label), 'Expense Category'),
  };
}


export function normalizeProduct(raw: unknown): Product {
  const record = asRecord(raw) ?? {};
  const category = asRecord(firstDefined(record.category, record.categoryId));
  const unit = asRecord(record.primaryUnit);
  const secondaryUnit = asRecord(firstDefined(record.secondaryUnit, record.secondary_unit));

  return {
    ...(record as Product),
    id: asString(firstDefined(record.id, record._id, record.productId), ''),
    name: asString(firstDefined(record.name, record.title), 'Unnamed product'),
    categoryId: asString(firstDefined(record.categoryId, category?.id, category?._id), ''),
    categoryName: asString(firstDefined(record.categoryName, category?.name, record.category), ''),
    salePrice: asNumber(firstDefined(record.salePrice, record.price, record.unitPrice)),
    purchasePrice: asNumber(firstDefined(record.purchasePrice, record.costPrice)),
    primaryUnit: asString(firstDefined(unit?.name, unit?.symbol, record.primaryUnit, record.unit), 'unit'),
    primaryUnitId: asString(firstDefined(record.primaryUnitId, unit?.id, unit?._id), ''),
    secondaryUnit: asString(firstDefined(secondaryUnit?.name, secondaryUnit?.symbol, record.secondaryUnitName, record.secondaryUnit), ''),
    secondaryUnitId: asString(firstDefined(record.secondaryUnitId, secondaryUnit?.id, secondaryUnit?._id), ''),
    secondaryUnitSymbol: asString(firstDefined(record.secondaryUnitSymbol, secondaryUnit?.symbol), ''),
    secondaryConversionRate: asNumber(
      firstDefined(record.secondaryConversionRate, record.conversionRate, record.secondaryToPrimaryRate),
    ),
    taxRate: asNumber(firstDefined(record.taxRate, record.tax)),
    stockOnHand: asNumber(firstDefined(record.stockOnHand, record.currentStock, record.stock, record.quantity)),
    itemType: asString(firstDefined(record.itemType, record.type), 'goods'),
    barcode: asString(record.barcode, ''),
    sku: asString(record.sku, ''),
    isActive: Boolean(firstDefined(record.isActive, true)),
  };
}

export function normalizeParty(raw: unknown): Party {
  const record = asRecord(raw) ?? {};

  return {
    ...(record as Party),
    id: asString(firstDefined(record.id, record._id, record.partyId), ''),
    name: asString(firstDefined(record.name, record.partyName, record.title), 'Unnamed party'),
    phone: asString(record.phone, ''),
    email: asString(record.email, ''),
    address: asString(record.address, ''),
    type: asString(firstDefined(record.type, record.partyType), 'customer'),
    openingBalance: asNumber(record.openingBalance),
    balanceType: asString(firstDefined(record.balanceType, record.direction), 'receive') as Party['balanceType'],
    receiveBalance: asNumber(firstDefined(record.receiveBalance, record.toReceive, record.receivable)),
    giveBalance: asNumber(firstDefined(record.giveBalance, record.toGive, record.payable)),
    balance: asNumber(firstDefined(record.balance, record.currentBalance)),
  };
}

export function normalizeBank(raw: unknown): BankAccount {
  const record = asRecord(raw) ?? {};

  return {
    ...(record as BankAccount),
    id: asString(firstDefined(record.id, record._id, record.bankId), ''),
    name: asString(firstDefined(record.name, record.bankName), 'Unnamed bank'),
    accountName: asString(record.accountName, ''),
    accountNumber: asString(record.accountNumber, ''),
    branchName: asString(record.branchName, ''),
    openingBalance: asNumber(record.openingBalance),
    currentBalance: asNumber(firstDefined(record.currentBalance, record.balance)),
    isActive: Boolean(firstDefined(record.isActive, true)),
    notes: asString(record.notes, ''),
  };
}

export function normalizeStaffMember(raw: unknown): StaffMember {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as StaffMember),
    id: asString(firstDefined(record.id, record._id, record.staffId), ''),
    name: asString(firstDefined(record.name, record.fullName), 'Staff'),
    email: asString(record.email, ''),
    phone: asString(record.phone, ''),
    role: asString(firstDefined(record.role, record.userRole), ''),
    isActive: Boolean(firstDefined(record.isActive, true)),
    pin: asString(record.pin, ''),
    permissions: asStringArray(record.permissions),
  };
}

export function normalizeSubscription(raw: unknown): Subscription {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as Subscription),
    id: asString(firstDefined(record.id, record._id), ''),
    status: asString(record.status, ''),
    planName: asString(firstDefined(record.planName, record.plan, record.name), ''),
    planCode: asString(firstDefined(record.planCode, record.code), ''),
    billingCycle: asString(firstDefined(record.billingCycle, record.interval), ''),
    price: asNumber(firstDefined(record.price, record.amount)),
    renewalDate: asString(firstDefined(record.renewalDate, record.nextBillingDate), ''),
    expiryDate: asString(firstDefined(record.expiryDate, record.endsAt), ''),
    isActive: Boolean(firstDefined(record.isActive, record.active, true)),
    seatLimit: asNumber(firstDefined(record.seatLimit, record.maxStaff)),
    features: asStringArray(record.features),
    role: asString(record.role, ''),
  };
}

export function normalizeSale(raw: unknown): Sale {
  const record = asRecord(raw) ?? {};

  return {
    ...(record as Sale),
    id: asString(firstDefined(record.id, record._id), ''),
    invoiceNo: asString(firstDefined(record.invoiceNo, record.billNo), ''),
    saleDate: asString(firstDefined(record.saleDate, record.createdAt), ''),
    partyId: asString(firstDefined(record.partyId, record.customerId), ''),
    subTotal: asNumber(record.subTotal),
    taxTotal: asNumber(record.taxTotal),
    grandTotal: asNumber(firstDefined(record.grandTotal, record.total)),
    amountReceived: asNumber(firstDefined(record.amountReceived, record.receivedAmount)),
    items: Array.isArray(record.items) ? (record.items as Sale['items']) : [],
    paymentMethod: asString(firstDefined(record.paymentMethod, 'cash')) as Sale['paymentMethod'],
    status: asString(firstDefined(record.status, 'unpaid')),
    paymentNote: asString(record.paymentNote, ''),
    attachment: asString(record.attachment, ''),
    attachments: Array.isArray(record.attachments) ? (record.attachments as string[]) : [],
    discount: asNumber(record.discount),
    discountTotal: asNumber(record.discountTotal),
  };
}

export function normalizePurchase(raw: unknown): Purchase {
  const record = asRecord(raw) ?? {};

  return {
    ...(record as Purchase),
    id: asString(firstDefined(record.id, record._id), ''),
    entryType: asString(firstDefined(record.entryType, 'purchase')) as Purchase['entryType'],
    invoiceNo: asString(firstDefined(record.invoiceNo, record.billNo), ''),
    purchaseDate: asString(firstDefined(record.purchaseDate, record.createdAt), ''),
    partyId: asString(firstDefined(record.partyId, record.supplierId), ''),
    partyName: asString(firstDefined(record.partyName, record.supplierName), ''),
    subTotal: asNumber(record.subTotal),
    taxTotal: asNumber(record.taxTotal),
    grandTotal: asNumber(firstDefined(record.grandTotal, record.total)),
    amountReceived: asNumber(firstDefined(record.amountReceived, record.paidAmount)),
    items: Array.isArray(record.items) ? (record.items as Purchase['items']) : [],
    paymentMethod: asString(firstDefined(record.paymentMethod, 'cash')) as Purchase['paymentMethod'],
    status: asString(firstDefined(record.status, 'received')),
  };
}

export function normalizeService(raw: unknown): Service {
  const record = asRecord(raw) ?? {};

  return {
    ...(record as Service),
    id: asString(firstDefined(record.id, record._id), ''),
    orderNo: asString(firstDefined(record.orderNo, record.invoiceNo), ''),
    status: asString(firstDefined(record.status, 'open')),
    partyId: asString(firstDefined(record.partyId, record.customerId), ''),
    deliveryDate: asString(firstDefined(record.deliveryDate, record.createdAt), ''),
    laborTotal: asNumber(record.laborTotal),
    partsTotal: asNumber(record.partsTotal),
    subTotal: asNumber(record.subTotal),
    taxTotal: asNumber(record.taxTotal),
    grandTotal: asNumber(firstDefined(record.grandTotal, record.total)),
    receivedTotal: asNumber(firstDefined(record.receivedTotal, record.amountReceived)),
    items: Array.isArray(record.items) ? (record.items as Service['items']) : [],
    attachments: Array.isArray(record.attachments) ? (record.attachments as string[]) : [],
  };
}

export function normalizeLedgerEntry(raw: unknown): LedgerEntry {
  const record = asRecord(raw) ?? {};

  return {
    ...(record as LedgerEntry),
    id: asString(firstDefined(record.id, record._id), ''),
    partyId: asString(record.partyId, ''),
    refType: asString(record.refType, ''),
    refNo: asString(record.refNo, ''),
    entryDate: asString(firstDefined(record.entryDate, record.txDate, record.createdAt), ''),
    description: asString(firstDefined(record.description, record.note), ''),
    debit: asNumber(record.debit),
    credit: asNumber(record.credit),
    runningBalance: asNumber(firstDefined(record.runningBalance, record.balance)),
    balanceDirection: asString(firstDefined(record.balanceDirection, record.direction), '') as LedgerEntry['balanceDirection'],
  };
}

export function normalizeOrderAttribute(raw: unknown): OrderAttribute {
  const record = asRecord(raw) ?? {};
  const key = asString(firstDefined(record.key, record.name, record.slug), '');
  return {
    ...(record as OrderAttribute),
    id: asString(firstDefined(record.id, record._id), ''),
    entityType: asString(firstDefined(record.entityType, record.type), 'sale'),
    key,
    label: asString(firstDefined(record.label, record.name, key), key || 'Custom field'),
    fieldType: asString(firstDefined(record.fieldType, record.inputType), 'text'),
    required: Boolean(firstDefined(record.required, false)),
    placeholder: asString(record.placeholder, ''),
    defaultValue: firstDefined(record.defaultValue, record.value, null) as OrderAttribute['defaultValue'],
    options: asStringArray(record.options),
    sortOrder: asNumber(firstDefined(record.sortOrder, record.order)),
  };
}

export function normalizeUploadResult(raw: unknown): UploadResult {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as UploadResult),
    url: asString(firstDefined(record.url, record.location, record.path), ''),
    name: asString(firstDefined(record.name, record.filename), ''),
    size: asNumber(record.size),
    mimeType: asString(firstDefined(record.mimeType, record.type), ''),
  };
}

export function normalizeInventorySummary(raw: unknown): InventorySummary {
  const entity = unwrapEntity<unknown>(raw);
  const record = asRecord(entity) ?? {};
  return {
    ...(record as InventorySummary),
    totalProducts: asNumber(firstDefined(record.totalProducts, record.productCount)),
    totalStockValue: asNumber(firstDefined(record.totalStockValue, record.stockValue)),
    lowStockCount: asNumber(firstDefined(record.lowStockCount, record.lowStock)),
    outOfStockCount: asNumber(firstDefined(record.outOfStockCount, record.outOfStock)),
  };
}

export function normalizeProfitLossAnalytics(raw: unknown): ProfitLossAnalytics {
  const entity = unwrapEntity<unknown>(raw);
  const record = asRecord(entity) ?? {};
  const summary = asRecord(record.summary) ?? {};
  const profitLoss = asRecord(firstDefined(summary.profitLoss, record.profitLoss)) ?? {};
  const series = asRecord(firstDefined(record.series, record.timeline, summary.series)) ?? {};
  const rawProfitLossSeries = Array.isArray(
    firstDefined(series.profitLoss, record.profitLossSeries, record.timelineData),
  )
    ? (firstDefined(series.profitLoss, record.profitLossSeries, record.timelineData) as unknown[])
    : [];

  const normalizedSeries = rawProfitLossSeries.flatMap((entry) => {
    const point = asRecord(entry);
    if (!point) return [];

    return [
      {
        ...(point as ProfitLossSeriesPoint),
        label: asString(
          firstDefined(point.label, point.periodLabel, point.date, point.day, point.month),
          'Point',
        ),
        amount: asNumber(firstDefined(point.amount, point.value, point.profitLoss, point.total)),
        status: asString(firstDefined(point.status, point.trend), ''),
        date: asString(firstDefined(point.date, point.periodStart), ''),
      } satisfies ProfitLossSeriesPoint,
    ];
  });

  return {
    ...(record as ProfitLossAnalytics),
    summary: {
      ...(summary as ProfitLossAnalytics['summary']),
      profitLoss: {
        amount: asNumber(firstDefined(profitLoss.amount, summary.amount, record.amount)),
        status: asString(firstDefined(profitLoss.status, summary.status, record.status), 'neutral'),
      },
      current: asRecord(firstDefined(summary.current, record.current)) ?? undefined,
    },
    series: {
      ...(series as ProfitLossAnalytics['series']),
      profitLoss: normalizedSeries,
    },
  };
}

function normalizeExpenseCategoryInsight(raw: unknown): ExpenseCategoryInsight | null {
  const record = asRecord(raw);
  if (!record) return null;

  return {
    ...(record as ExpenseCategoryInsight),
    rank: asNumber(record.rank),
    categoryKey: asString(firstDefined(record.categoryKey, record.key), ''),
    categoryName: asString(firstDefined(record.categoryName, record.name), 'Uncategorized'),
    expenseCount: asNumber(record.expenseCount),
    lineCount: asNumber(record.lineCount),
    lineDescriptions: asStringArray(record.lineDescriptions),
    supplierNames: asStringArray(record.supplierNames),
    total: asNumber(record.total),
    cashPaid: asNumber(record.cashPaid),
    pending: asNumber(record.pending),
    averageExpenseTotal: asNumber(record.averageExpenseTotal),
    shareOfTotal: asNumber(record.shareOfTotal),
    lastExpenseDate: asString(record.lastExpenseDate, ''),
  };
}

export function normalizeExpenseAnalytics(raw: unknown): ExpenseAnalytics {
  const entity = unwrapEntity<unknown>(raw);
  const record = asRecord(entity) ?? {};
  const categories = asRecord(firstDefined(record.categories, record.categoryBreakdown)) ?? {};
  const breakdown = Array.isArray(firstDefined(categories.breakdown, record.breakdown))
    ? (firstDefined(categories.breakdown, record.breakdown) as unknown[])
        .map(normalizeExpenseCategoryInsight)
        .filter((entry): entry is ExpenseCategoryInsight => Boolean(entry))
    : [];

  return {
    ...(record as ExpenseAnalytics),
    categories: {
      ...(categories as ExpenseAnalytics['categories']),
      summary: asRecord(firstDefined(categories.summary, record.summary)) ?? undefined,
      breakdown,
    },
  };
}

export function normalizePopularCategoryInsight(raw: unknown): PopularCategoryInsight | null {
  const record = asRecord(raw);
  if (!record) return null;

  return {
    ...(record as PopularCategoryInsight),
    rank: asNumber(record.rank),
    categoryId: asString(firstDefined(record.categoryId, record.id), ''),
    categoryName: asString(firstDefined(record.categoryName, record.name), 'Category'),
    lineCount: asNumber(record.lineCount),
    productNames: asStringArray(record.productNames),
    orderCount: asNumber(record.orderCount),
    saleQuantity: asNumber(record.saleQuantity),
    serviceQuantity: asNumber(record.serviceQuantity),
    totalQuantity: asNumber(record.totalQuantity),
    salesRevenue: asNumber(record.salesRevenue),
    serviceRevenue: asNumber(record.serviceRevenue),
    totalRevenue: asNumber(record.totalRevenue),
  };
}

export function normalizePartyReportItem(raw: unknown): PartyReportItem {
  const record = asRecord(raw) ?? {};
  return {
    ...(record as PartyReportItem),
    id: asString(firstDefined(record.id, record._id, record.partyId), ''),
    name: asString(firstDefined(record.name, record.partyName), 'Party'),
    type: asString(record.type, ''),
    receiveBalance: asNumber(firstDefined(record.receiveBalance, record.toReceive)),
    giveBalance: asNumber(firstDefined(record.giveBalance, record.toGive)),
    totalSales: asNumber(record.totalSales),
    totalPurchases: asNumber(record.totalPurchases),
    totalServices: asNumber(record.totalServices),
  };
}

export function normalizeSequenceMap(raw: unknown): SequenceMap {
  const record = asRecord(raw) ?? {};
  return {
    sale: asString(firstDefined(record.sale, record.saleInvoiceNo, record.nextSaleInvoiceNo), ''),
    purchase: asString(firstDefined(record.purchase, record.purchaseInvoiceNo, record.nextPurchaseInvoiceNo), ''),
    service: asString(firstDefined(record.service, record.serviceOrderNo, record.nextServiceOrderNo), ''),
  };
}

export function normalizePaginated<T>(payload: unknown, items: T[]): PaginatedResponse<T> {
  const record = asRecord(unwrapEntity<UnknownRecord>(payload)) ?? {};

  return {
    items,
    total: asNumber(firstDefined(record.total, items.length)),
    limit: asNumber(record.limit, items.length),
    offset: asNumber(record.offset, 0),
  };
}

export function normalizeTaskAssignment(raw: unknown): TaskAssignment {
  const record = asRecord(raw) ?? {};
  const assignee = asRecord(record.assignee) ?? {};
  const assignedBy = asRecord(record.assignedBy) ?? {};
  return {
    id: asString(firstDefined(record.id, record._id), ''),
    taskId: asString(record.taskId, ''),
    status: asString(record.status, 'open'),
    readAt: record.readAt ? asString(record.readAt) : null,
    assignedAt: asString(record.assignedAt, ''),
    completedAt: record.completedAt ? asString(record.completedAt) : null,
    assignee: {
      id: asString(assignee.id, ''),
      name: asString(assignee.name, 'Staff'),
      email: assignee.email ? asString(assignee.email) : undefined,
      phone: assignee.phone ? asString(assignee.phone) : undefined,
    },
    assignedBy: {
      id: asString(assignedBy.id, ''),
      name: asString(assignedBy.name, 'Owner'),
    },
  };
}

export function normalizeTaskActivity(raw: unknown): TaskActivity {
  const record = asRecord(raw) ?? {};
  const actor = asRecord(record.actor) ?? {};
  return {
    id: asString(firstDefined(record.id, record._id), ''),
    taskId: asString(record.taskId, ''),
    businessId: asString(record.businessId, ''),
    type: asString(record.type, 'system'),
    content: asString(record.content, ''),
    metadata: asRecord(record.metadata),
    createdAt: asString(record.createdAt, ''),
    actor: {
      id: asString(actor.id, ''),
      name: asString(actor.name, 'Actor'),
    },
    taskTitle: record.taskTitle ? asString(record.taskTitle) : undefined,
  };
}

export function normalizeTask(raw: unknown): Task {
  const record = asRecord(raw) ?? {};
  const creator = asRecord(record.creator);
  const completedBy = asRecord(record.completedBy);
  const lastActivityBy = asRecord(record.lastActivityBy);
  const assignments = Array.isArray(record.assignments)
    ? record.assignments.map(normalizeTaskAssignment)
    : [];
  const activities = Array.isArray(record.activities)
    ? record.activities.map(normalizeTaskActivity)
    : [];
  return {
    id: asString(firstDefined(record.id, record._id), ''),
    title: asString(record.title, 'Untitled Task'),
    description: record.description ? asString(record.description) : undefined,
    status: asString(record.status, 'open'),
    priority: asString(record.priority, 'medium'),
    dueDate: record.dueDate ? asString(record.dueDate) : null,
    createdAt: asString(record.createdAt, ''),
    updatedAt: asString(record.updatedAt, ''),
    completedAt: record.completedAt ? asString(record.completedAt) : null,
    lastActivityAt: record.lastActivityAt ? asString(record.lastActivityAt) : null,
    lastActivityType: record.lastActivityType ? asString(record.lastActivityType) : null,
    assigneeCount: asNumber(record.assigneeCount, assignments.length),
    creator: creator ? {
      id: asString(creator.id, ''),
      name: asString(creator.name, ''),
    } : null,
    completedBy: completedBy ? {
      id: asString(completedBy.id, ''),
      name: asString(completedBy.name, ''),
    } : null,
    lastActivityBy: lastActivityBy ? {
      id: asString(lastActivityBy.id, ''),
      name: asString(lastActivityBy.name, ''),
    } : null,
    assignments,
    activities,
  };
}

export function normalizeTaskMetadata(raw: unknown): TaskMetadata {
  const record = asRecord(unwrapEntity(raw)) ?? {};
  const statuses = Array.isArray(record.statuses)
    ? record.statuses.map((status: any) => ({
        key: asString(status.key, ''),
        label: asString(status.label, ''),
        tone: status.tone ? asString(status.tone) : undefined,
      }))
    : [];
  const priorities = Array.isArray(record.priorities)
    ? record.priorities.map((priority: any) => ({
        key: asString(priority.key, ''),
        label: asString(priority.label, ''),
        tone: priority.tone ? asString(priority.tone) : undefined,
      }))
    : [];
  const activityTypes = Array.isArray(record.activityTypes)
    ? record.activityTypes.map((type: any) => ({
        key: asString(type.key, ''),
        label: asString(type.label, ''),
      }))
    : [];
  return { statuses, priorities, activityTypes };
}

export function normalizeTaskNotificationSummary(raw: unknown): TaskNotificationSummary {
  const record = asRecord(unwrapEntity(raw)) ?? {};
  const counters = asRecord(record.counters) ?? {};
  const recentActivities = Array.isArray(record.recentActivities)
    ? record.recentActivities.map(normalizeTaskActivity)
    : [];
  return {
    lastSeenAt: record.lastSeenAt ? asString(record.lastSeenAt) : null,
    unreadActivityCount: asNumber(record.unreadActivityCount, 0),
    counters: {
      assignedToMeOpen: asNumber(counters.assignedToMeOpen, 0),
      assignedToMeOverdue: asNumber(counters.assignedToMeOverdue, 0),
      createdByMeOpen: asNumber(counters.createdByMeOpen, 0),
    },
    recentActivities,
  };
}

