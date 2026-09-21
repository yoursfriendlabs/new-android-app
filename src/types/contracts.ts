import type {
  AccessControl,
  BankAccount,
  BusinessSummary,
  BusinessSettings,
  BusinessTypeOption,
  Category,
  DashboardSummary,
  ExpenseAnalytics,
  EntryType,
  InventorySummary,
  OrderAttribute,
  Party,
  PartyDetailReport,
  PartyReportItem,
  PartyTransaction,
  PaginatedResponse,
  PaymentMethod,
  PopularCategoryInsight,
  ProfitLossAnalytics,
  Product,
  Purchase,
  Sale,
  StaffMember,
  Subscription,
  SubscriptionPaymentSetup,
  SequenceMap,
  Service,
  Unit,
  UploadResult,
  User,
  Attendance,
  StaffSalaryRecord,
  WorkspaceMembership,
} from '@/src/types/models';

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  /** Not needed when signing up with Google. */
  password?: string;
  businessName: string;
  businessType: string;
  /** From verifying the sign-up code or from Google; the account is created already verified. */
  signupToken?: string;
}

export interface SignupCodeResponse {
  message?: string;
  retryAfterSeconds?: number;
  devCode?: string;
}

export interface SignupVerifyResponse {
  verified: boolean;
  email: string;
  signupToken: string;
}

export interface GoogleSignInPayload {
  idToken: string;
}

export interface GoogleSignInResponse extends AuthResponseShape {
  /** A new Google account: finish with register() and this signupToken. */
  needsSignup?: boolean;
  signupToken?: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

export interface CreateBusinessPayload {
  name: string;
  type: 'retail' | 'cafe' | string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateMePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
}

export interface UpdateBusinessSettingsPayload extends BusinessSettings {}

export interface OtpRequestPayload {
  email: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}

export interface ResetPasswordPayload extends VerifyOtpPayload {
  newPassword: string;
}

export interface AccountDeletionWorkspace {
  id: string;
  name: string;
  type?: string | null;
  role?: string | null;
  staffCount: number;
  /** 'delete': the user is the only owner, so it goes with all its data. 'leave': only their access goes. */
  outcome: 'delete' | 'leave';
}

export interface AccountDeletionPlan {
  workspaces: AccountDeletionWorkspace[];
}

export interface DeleteAccountPayload {
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ProductCreatePayload {
  name: string;
  companyName?: string;
  categoryId?: string;
  sku?: string;
  itemType?: string;
  metalType?: string;
  purity?: string;
  salePrice: number;
  purchasePrice?: number;
  secondarySalePrice?: number;
  mrpPrice?: number;
  wholesalePrice?: number;
  minWholesaleQuantity?: number;
  primaryUnit: string;
  primaryUnitId?: string;
  unitId?: string;
  secondaryUnit?: string;
  secondaryUnitId?: string;
  secondaryConversionRate?: number;
  conversionRate?: number;
  taxRate?: number;
  openingStock?: number;
  expiryDate?: string;
  batchNumber?: string;
  lowStockAlert?: boolean;
  imageUrl?: string | null;
}

export type ProductUpdatePayload = Partial<ProductCreatePayload>;

export interface ProductRestockPayload {
  quantity: number;
  action?: 'add' | 'remove';
  unitType?: string;
  notes?: string;
  note?: string;
  expiryDate?: string;
  batchNumber?: string;
}

export interface ProductBatchUpdatePayload {
  expiryDate?: string | null;
  batchNumber?: string | null;
}

export interface ProductBatchExchangePayload {
  batchNumber: string;
  expiryDate: string;
  quantity?: number;
  note?: string;
}

export interface ProductBatchDestroyPayload {
  quantity?: number;
  note?: string;
}

export interface ProductStats {
  lowStockCount: number;
  nearExpiryCount: number;
  expiredCount: number;
  popularCount?: number;
  leastPopularCount?: number;
}

export interface CategoryCreatePayload {
  name: string;
}

export type CategoryUpdatePayload = Partial<CategoryCreatePayload>;

export interface UnitCreatePayload {
  name: string;
  symbol: string;
}

export type UnitUpdatePayload = Partial<UnitCreatePayload>;

export type SaleCreatePayload = Omit<Sale, 'id'>;
export type SaleUpdatePayload = Partial<Omit<Sale, 'id'>> & {
  items?: Array<
    | Sale['items'][number]
    | {
        id: string;
        _delete: true;
      }
  >;
};

export type PurchaseCreatePayload = Omit<Purchase, 'id'>;
export type PurchaseUpdatePayload = Partial<Omit<Purchase, 'id'>> & {
  items?: Array<
    | Purchase['items'][number]
    | {
        id: string;
        _delete: true;
      }
  >;
};

export type ServiceCreatePayload = Omit<Service, 'id'>;
export type ServiceUpdatePayload = Partial<Omit<Service, 'id'>>;

export interface PartyCreatePayload {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type: string;
  avatarUrl?: string | null;
  openingBalance?: number;
  asOfDate?: string;
  balanceType?: string;
}

export type PartyUpdatePayload = Partial<PartyCreatePayload>;

export type PartyTransactionCreatePayload = Omit<PartyTransaction, 'id'>;

export interface BankCreatePayload extends Omit<BankAccount, 'id'> {}
export type BankUpdatePayload = Partial<BankCreatePayload>;

export interface StaffCreatePayload {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  pin?: string;
  permissions?: string[] | Record<string, string>;
  password?: string;
  staffCategory?: string;
  jobTitle?: string;
  salary?: number;
  hasLogin?: boolean;
}

export type StaffUpdatePayload = Partial<StaffCreatePayload>;

export type SubscriptionUpdatePayload = Partial<Subscription>;

export interface OrderAttributeCreatePayload {
  entityType: 'sale' | 'service' | string;
  key: string;
  label: string;
  fieldType: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
  options?: string[];
  sortOrder?: number;
}

export type OrderAttributeUpdatePayload = Partial<OrderAttributeCreatePayload>;

export interface ListQuery {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  partyId?: string;
  supplierId?: string;
  createdBy?: string;
  entryType?: EntryType;
  type?: string;
  direction?: string;
  isActive?: boolean;
  from?: string;
  to?: string;
  groupBy?: string;
  categoryKey?: string;
  category?: string;
  entityType?: string;
  productId?: string;
  kind?: 'expense' | 'income' | string;
  period?: 'weekly' | 'monthly' | 'yearly' | string;
  /** Purchases: `date` orders by purchase date, newest first. Products: name | quantity | … */
  sort?: string;
  /** Products: in | out | low | nearexpiry | expired */
  stock?: string;
  categoryId?: string;
  /** Purchases and sales: due | paid */
  payment?: 'due' | 'paid' | string;
  /** Services: open | overdue | closed */
  stage?: 'open' | 'overdue' | 'closed' | string;
}

export interface ServiceStatsResponse {
  totalOrders?: number;
  closedCount?: number;
  inProgressCount?: number;
  pendingCollection?: number;
  /** Newer servers only. */
  finishedCount?: number;
  overdueCount?: number;
}

export interface SaleStatsResponse {
  totalCount?: number;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  avgOrderValue?: number;
  /** Newer servers only. */
  dueCount?: number;
  paidCount?: number;
}

export interface PurchaseStatsResponse {
  purchaseCount?: number;
  expenseCount?: number;
  incomeCount?: number;
  totalPurchases?: number;
  totalExpenses?: number;
  totalIncome?: number;
  totalPaid?: number;
  totalDue?: number;
  /** Newer servers only. */
  purchaseDueCount?: number;
  purchaseDue?: number;
  expenseDueCount?: number;
  expenseDue?: number;
}

export interface AuthResponseShape {
  token?: string;
  accessToken?: string;
  businessId?: string;
  business?: BusinessSummary;
  businesses?: WorkspaceMembership[];
  canCreateBusiness?: boolean;
  businessProfile?: Record<string, unknown>;
  subscription?: Subscription;
  role?: string;
  accessControl?: AccessControl;
  requireVerification?: boolean;
  verificationRequired?: boolean;
  message?: string;
  user?: User;
  data?: {
    token?: string;
    accessToken?: string;
    businessId?: string;
    business?: BusinessSummary;
    businesses?: WorkspaceMembership[];
    canCreateBusiness?: boolean;
    businessProfile?: Record<string, unknown>;
    subscription?: Subscription;
    role?: string;
    accessControl?: AccessControl;
    requireVerification?: boolean;
    verificationRequired?: boolean;
    message?: string;
    user?: User;
  };
  [key: string]: unknown;
}

export interface BootstrapBundle {
  me: User;
  settings: BusinessSettings;
  summary: DashboardSummary;
  nextSequences: SequenceMap;
  products: Product[];
  categories: Category[];
  units: Unit[];
  parties: Party[];
  banks: BankAccount[];
}

export interface PaymentRuleInput {
  amount: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
}

export interface BusinessBootstrapBundle {
  businessTypes?: BusinessTypeOption[];
  businessProfile?: Record<string, unknown>;
  businessSettings?: BusinessSettings;
  nextSequences?: SequenceMap;
  dashboardSummary?: DashboardSummary;
}

export interface PartyReportResponse extends PaginatedResponse<PartyReportItem> {}
export interface InventorySummaryResponse extends InventorySummary {}
export interface PartyDetailResponse extends PartyDetailReport {}
export interface SubscriptionPaymentSetupResponse extends SubscriptionPaymentSetup {}
export interface UploadAttachmentResponse extends UploadResult {}
export interface UploadAttachmentsResponse {
  items?: UploadResult[];
  urls?: string[];
  [key: string]: unknown;
}
export interface OrderAttributeListResponse extends PaginatedResponse<OrderAttribute> {}
export interface StaffListResponse extends PaginatedResponse<StaffMember> {
  members?: StaffMember[];
  summary?: {
    totalUsers: number;
    maxUsers: number;
    isLimitReached: boolean;
    remainingSeats: number;
  };
  meta?: {
    accessLevels: { key: string }[];
    features: { key: string; label: string; description: string }[];
    categories: any[];
  };
}
export interface ProfitLossAnalyticsResponse extends ProfitLossAnalytics {}
export interface ExpenseAnalyticsResponse extends ExpenseAnalytics {}
export interface PopularCategoriesResponse extends PaginatedResponse<PopularCategoryInsight> {}

export interface QuickExpenseCreatePayload {
  name: string;
  kind?: 'expense' | 'income';
}

export type QuickExpenseUpdatePayload = Partial<QuickExpenseCreatePayload>;

export interface BudgetCreatePayload {
  name: string;
  scope: 'category' | 'total' | 'savings';
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  categoryKey?: string | null;
  categoryName?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export type BudgetUpdatePayload = Partial<BudgetCreatePayload>;

export interface TaskCreatePayload {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string; // YYYY-MM-DD
  assigneeUserIds?: string[];
}

export type TaskUpdatePayload = Partial<TaskCreatePayload>;

export interface NoteCreatePayload {
  kind: 'note' | 'reminder';
  title: string;
  body?: string | null;
  remindAt?: string | null; // ISO datetime, reminders only
  status?: 'open' | 'done';
}

export type NoteUpdatePayload = Partial<NoteCreatePayload>;

export interface TaskCommentPayload {
  content: string;
}

export interface StaffSalaryCreatePayload {
  amount: number;
  type: 'salary' | 'advance';
  date: string;
  monthYear: string;
  note?: string;
}

export interface SalaryRecordsResponse {
  records: StaffSalaryRecord[];
}

export interface AttendanceResponse {
  attendance: Attendance | null;
}

export interface AttendanceHistoryResponse {
  history: Attendance[];
}

export interface TableCreatePayload {
  name: string;
  capacity?: number | null;
  status?: string;
  isActive?: boolean;
  categoryId?: string | null;
}

export interface TableUpdatePayload extends Partial<TableCreatePayload> {}

export type CoinAwardReason = 'money' | 'note' | 'reminder' | 'complete' | 'checkin';

export interface CoinAwardPayload {
  claimId: string;
  reason: CoinAwardReason;
  label?: string;
}

export interface CoinRedeemPayload {
  itemId: string;
}

export interface CoinImportPayload {
  claims: Array<{
    claimId: string;
    reason: CoinAwardReason;
    label?: string;
    at?: string;
  }>;
}

export interface CoinHistoryItem {
  id: string;
  claimId?: string;
  reason: string;
  amount: number;
  label: string;
  at?: string;
  createdAt?: string;
}

export interface CoinSnapshotResponse {
  enabled?: boolean;
  balance: number;
  rewards?: Partial<Record<CoinAwardReason, number>>;
  merch?: Array<{ id: string; title: string; hint: string; cost: number }>;
  history?: CoinHistoryItem[];
  redemptions?: Array<{
    id: string;
    itemId: string;
    title: string;
    cost: number;
    status?: string;
    at?: string;
    createdAt?: string;
  }>;
  importedAt?: string | null;
  imported?: number;
  skipped?: boolean;
}

export interface CoinAwardResponse {
  awarded: number;
  duplicate?: boolean;
  /** Set when the server refused the coin, e.g. 'overspending'. */
  blocked?: 'overspending' | string;
  message?: string;
  balance: number;
  event?: CoinHistoryItem;
}

export interface CoinRedeemResponse {
  ok: boolean;
  remaining: number;
  redemption?: {
    id: string;
    itemId: string;
    title: string;
    cost: number;
    status?: string;
    at?: string;
  };
}


