export type BusinessType = 'retail' | 'cafe' | 'jewellery' | string;
export type PaymentMethod = 'cash' | 'bank';
export type PartyType = 'customer' | 'supplier' | 'both' | string;
export type EntryType = 'purchase' | 'expense';
export type ServiceStatus = 'open' | 'in_progress' | 'ready' | 'delivered' | 'closed' | string;
export type PaymentDirection = 'receive' | 'give';
export type QueueMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type OrderAttributeFieldType = 'text' | 'number' | 'date' | 'select' | 'toggle' | 'textarea' | string;

export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

export interface User {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  permissions?: string[] | Record<string, string>;
  businessId?: string;
  [key: string]: unknown;
}

export interface AccessControl {
  permissions?: string[] | Record<string, string>;
  [key: string]: unknown;
}


export interface BusinessSummary {
  id?: string;
  businessId?: string;
  name?: string;
  businessName?: string;
  businessType?: BusinessType;
  [key: string]: unknown;
}

export interface BusinessProfile {
  id?: string;
  businessId?: string;
  businessName?: string;
  businessType: BusinessType;
  enabledModules?: string[];
  salesRoute?: string;
  servicesRoute?: string;
  currencyCode?: string;
  [key: string]: unknown;
}

export interface BusinessSettings {
  businessName?: string;
  quickEntryDefaults?: Record<string, unknown>;
  counterMode?: boolean;
  taxEnabled?: boolean;
  lowStockAlert?: boolean;
  [key: string]: unknown;
}

export interface SequenceMap {
  sale?: string;
  purchase?: string;
  service?: string;
  [key: string]: string | undefined;
}

export interface DashboardSummary {
  range?: { from: string; to: string };
  cashReceived?: number;
  cashPaid?: number;
  pendingAmount?: number;
  pendingReceivable?: number;
  pendingPayable?: number;
  salesTotal?: number;
  directSalesTotal?: number;
  purchaseTotal?: number;
  serviceTotal?: number;
  expenseTotal?: number;
  profitOrLoss?: number;
  profitOrLossStatus?: 'profit' | 'loss' | string;
  productCount?: number;
  lowStockCount?: number;
  lowStockItems?: Array<{
    id: string;
    name: string;
    sku?: string;
    stockOnHand: number;
    threshold: number;
  }>;
  recentSales?: Sale[];
  recentPurchases?: Purchase[];
  upcomingServiceDeliveries?: Service[];
  breakdown?: {
    revenue?: { sales: number; directSales: number; services: number };
    cashReceived?: { sales: number; directSales: number; services: number };
    cashPaid?: { purchases: number; expenses: number; total: number };
    pending?: { sales: number; directSales: number; services: number; purchases: number; expenses: number; total: number };
  };
  // Legacy fields (kept for compatibility)
  salesToday?: number;
  cashIn?: number;
  cashOut?: number;
  dueToReceive?: number;
  dueToGive?: number;
  purchaseToday?: number;
  serviceOpen?: number;
  summaryCards?: Array<{ label: string; value: number; tone?: 'primary' | 'success' | 'warning' }>;
  [key: string]: unknown;
}

export interface ProfitLossSeriesPoint {
  label: string;
  amount: number;
  status?: string;
  date?: string;
  [key: string]: unknown;
}

export interface ProfitLossAnalytics {
  summary: {
    profitLoss: {
      amount: number;
      status: string;
    };
    current?: Record<string, unknown>;
    [key: string]: unknown;
  };
  series: {
    profitLoss: ProfitLossSeriesPoint[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ExpenseCategoryInsight {
  rank: number;
  categoryKey: string;
  categoryName: string;
  expenseCount: number;
  lineCount: number;
  lineDescriptions: string[];
  supplierNames: string[];
  total: number;
  cashPaid: number;
  pending: number;
  averageExpenseTotal: number;
  shareOfTotal: number;
  lastExpenseDate?: string;
  [key: string]: unknown;
}

export interface ExpenseAnalytics {
  categories: {
    summary?: Record<string, unknown>;
    breakdown: ExpenseCategoryInsight[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PopularCategoryInsight {
  rank: number;
  categoryId?: string;
  categoryName: string;
  lineCount: number;
  productNames: string[];
  orderCount: number;
  saleQuantity: number;
  serviceQuantity: number;
  totalQuantity: number;
  salesRevenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  [key: string]: unknown;
}

export interface BusinessTypeOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  [key: string]: unknown;
}

export interface Category {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Unit {
  id: string;
  name: string;
  symbol?: string;
  [key: string]: unknown;
}

export interface Product {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  salePrice: number;
  purchasePrice?: number;
  primaryUnit: string;
  primaryUnitId?: string;
  secondaryUnit?: string;
  secondaryUnitId?: string;
  secondaryUnitSymbol?: string;
  secondaryConversionRate?: number;
  taxRate?: number;
  stockOnHand?: number;
  itemType?: string;
  barcode?: string;
  sku?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface Party {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type: PartyType;
  openingBalance?: number;
  balanceType?: PaymentDirection;
  receiveBalance?: number;
  giveBalance?: number;
  balance?: number;
  [key: string]: unknown;
}

export interface BankAccount {
  id: string;
  name: string;
  accountName?: string;
  accountNumber?: string;
  branchName?: string;
  openingBalance?: number;
  currentBalance?: number;
  isActive: boolean;
  notes?: string;
  [key: string]: unknown;
}

export interface Subscription {
  id?: string;
  status?: string;
  planName?: string;
  planCode?: string;
  billingCycle?: string;
  price?: number;
  renewalDate?: string;
  expiryDate?: string;
  isActive?: boolean;
  seatLimit?: number;
  features?: string[];
  role?: string;
  [key: string]: unknown;
}

export interface SubscriptionPaymentSetup {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  qrCodeUrl?: string;
  paymentInstructions?: string;
  contactName?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  pin?: string;
  permissions?: string[] | Record<string, string>;
  [key: string]: unknown;
}

export interface SaleItem {
  id?: string;
  productId: string;
  quantity: number;
  unitType: string;
  conversionRate?: number;
  unitPrice: number;
  taxRate?: number;
  lineTotal: number;
  [key: string]: unknown;
}

export interface Sale {
  id: string;
  partyId?: string | null;
  invoiceNo: string;
  saleDate: string;
  status: string;
  notes?: string;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
  paymentNote?: string;
  attachment?: string;
  attachments?: string[];
  attributes?: Record<string, unknown>;
  subTotal: number;
  taxTotal: number;
  discount?: number;
  discountTotal?: number;
  grandTotal: number;
  createdBy?: string;
  items: SaleItem[];
  [key: string]: unknown;
}

export interface PurchaseItem {
  id?: string;
  productId?: string;
  quantity: number;
  unitType: string;
  conversionRate?: number;
  unitPrice: number;
  taxRate?: number;
  lineTotal: number;
  itemType?: string;
  description?: string;
  [key: string]: unknown;
}

export interface Purchase {
  id: string;
  entryType: EntryType;
  partyId?: string | null;
  partyName?: string | null;
  invoiceNo?: string;
  purchaseDate: string;
  status: string;
  notes?: string;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
  paymentNote?: string;
  subTotal: number;
  taxTotal: number;
  discount?: number;
  discountTotal?: number;
  grandTotal: number;
  items: PurchaseItem[];
  [key: string]: unknown;
}

export interface ServiceItem {
  id?: string;
  itemType: 'labor' | 'part' | string;
  description?: string;
  productId?: string;
  quantity: number;
  unitType: string;
  conversionRate?: number;
  unitPrice: number;
  taxRate?: number;
  lineTotal: number;
  [key: string]: unknown;
}

export interface Service {
  id: string;
  partyId?: string;
  orderNo: string;
  status: ServiceStatus;
  notes?: string;
  deliveryDate?: string;
  paymentMethod?: PaymentMethod;
  bankId?: string;
  paymentNote?: string;
  attachment?: string;
  attachments?: string[];
  attributes?: Record<string, unknown>;
  laborTotal: number;
  partsTotal: number;
  subTotal: number;
  taxTotal: number;
  discount?: number;
  discountTotal?: number;
  grandTotal: number;
  receivedTotal: number;
  createdBy?: string;
  items: ServiceItem[];
  [key: string]: unknown;
}

export interface PartyTransaction {
  id?: string;
  partyId: string;
  direction: PaymentDirection;
  amount: number;
  txDate: string;
  paymentMethod: PaymentMethod;
  bankId?: string;
  note?: string;
  [key: string]: unknown;
}

export interface OrderAttribute {
  id: string;
  entityType: 'sale' | 'service' | string;
  key: string;
  label: string;
  fieldType: OrderAttributeFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
  options?: string[];
  sortOrder?: number;
  [key: string]: unknown;
}

export interface UploadResult {
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
  [key: string]: unknown;
}

export interface LedgerEntry {
  id: string;
  partyId?: string;
  refType?: string;
  refNo?: string;
  entryDate: string;
  description?: string;
  debit?: number;
  credit?: number;
  runningBalance?: number;
  balanceDirection?: PaymentDirection;
  [key: string]: unknown;
}

export interface InventorySummary {
  totalProducts?: number;
  totalStockValue?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  [key: string]: unknown;
}

export interface PartyReportItem {
  id?: string;
  name: string;
  type?: string;
  receiveBalance?: number;
  giveBalance?: number;
  totalSales?: number;
  totalPurchases?: number;
  totalServices?: number;
  [key: string]: unknown;
}

export interface PartyDetailReport {
  party?: Party;
  summary?: Record<string, unknown>;
  items?: LedgerEntry[];
  entries?: LedgerEntry[];
  transactions?: LedgerEntry[];
  [key: string]: unknown;
}

export interface SessionData {
  token: string;
  businessId: string;
  user?: User | null;
  business?: BusinessSummary | null;
  role?: string | null;
  accessControl?: AccessControl | null;
  subscription?: Subscription | null;
}

export interface QueuedMutation {
  id: string;
  method: QueueMethod;
  path: string;
  entityType: string;
  body?: Record<string, unknown>;
  createdAt: string;
  lastError?: string | null;
}

export interface QuickExpense {
  id: string;
  businessId: string;
  name: string;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  status: string;
  readAt?: string | null;
  assignedAt: string;
  completedAt?: string | null;
  assignee: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  assignedBy: {
    id: string;
    name: string;
  };
}

export interface TaskActivity {
  id: string;
  taskId: string;
  businessId: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
  };
  taskTitle?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  lastActivityAt?: string | null;
  lastActivityType?: string | null;
  assigneeCount?: number;
  creator?: {
    id: string;
    name: string;
  } | null;
  completedBy?: {
    id: string;
    name: string;
  } | null;
  lastActivityBy?: {
    id: string;
    name: string;
  } | null;
  assignments?: TaskAssignment[];
  activities?: TaskActivity[];
}

export interface TaskMetadata {
  statuses: Array<{ key: string; label: string; tone?: string }>;
  priorities: Array<{ key: string; label: string; tone?: string }>;
  activityTypes: Array<{ key: string; label: string }>;
}

export interface TaskNotificationSummary {
  lastSeenAt?: string | null;
  unreadActivityCount: number;
  counters: {
    assignedToMeOpen: number;
    assignedToMeOverdue: number;
    createdByMeOpen: number;
  };
  recentActivities: TaskActivity[];
}


