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
} from '@/src/types/models';

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  businessName: string;
  businessType: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateMePayload {
  name?: string;
  phone?: string;
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

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ProductCreatePayload {
  name: string;
  categoryId?: string;
  salePrice: number;
  purchasePrice?: number;
  primaryUnit: string;
  primaryUnitId?: string;
  secondaryUnit?: string;
  secondaryUnitId?: string;
  secondaryConversionRate?: number;
  taxRate?: number;
  itemType?: string;
}

export type ProductUpdatePayload = Partial<ProductCreatePayload>;

export interface ProductRestockPayload {
  quantity: number;
  unitType: string;
  notes?: string;
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
  permissions?: string[];
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
}

export interface AuthResponseShape {
  token?: string;
  accessToken?: string;
  businessId?: string;
  business?: BusinessSummary;
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
export interface StaffListResponse extends PaginatedResponse<StaffMember> {}
export interface ProfitLossAnalyticsResponse extends ProfitLossAnalytics {}
export interface ExpenseAnalyticsResponse extends ExpenseAnalytics {}
export interface PopularCategoriesResponse extends PaginatedResponse<PopularCategoryInsight> {}

export interface QuickExpenseCreatePayload {
  name: string;
}

export type QuickExpenseUpdatePayload = Partial<QuickExpenseCreatePayload>;

export interface TaskCreatePayload {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string; // YYYY-MM-DD
  assigneeUserIds?: string[];
}

export type TaskUpdatePayload = Partial<TaskCreatePayload>;

export interface TaskCommentPayload {
  content: string;
}


