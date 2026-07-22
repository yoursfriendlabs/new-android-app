import { apiRequest, uploadMultipart } from '@/src/api/client';
import type {
  AuthResponseShape,
  BankCreatePayload,
  BankUpdatePayload,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  ChangePasswordPayload,
  ExpenseAnalyticsResponse,
  InventorySummaryResponse,
  ListQuery,
  LoginPayload,
  OrderAttributeCreatePayload,
  OrderAttributeListResponse,
  OrderAttributeUpdatePayload,
  OtpRequestPayload,
  PartyCreatePayload,
  PartyDetailResponse,
  PartyTransactionCreatePayload,
  PartyUpdatePayload,
  PopularCategoriesResponse,
  ProfitLossAnalyticsResponse,
  ProductCreatePayload,
  ProductRestockPayload,
  ProductUpdatePayload,
  PurchaseCreatePayload,
  PurchaseUpdatePayload,
  QuickExpenseCreatePayload,
  QuickExpenseUpdatePayload,
  RegisterPayload,
  ResetPasswordPayload,
  SaleCreatePayload,
  SaleUpdatePayload,
  ServiceCreatePayload,
  ServiceUpdatePayload,
  StaffCreatePayload,
  StaffListResponse,
  StaffUpdatePayload,
  SubscriptionPaymentSetupResponse,
  SubscriptionUpdatePayload,
  UnitCreatePayload,
  UnitUpdatePayload,
  UpdateBusinessSettingsPayload,
  UpdateMePayload,
  UploadAttachmentResponse,
  UploadAttachmentsResponse,
  VerifyOtpPayload,
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskCommentPayload,
  StaffSalaryCreatePayload,
  SalaryRecordsResponse,
  AttendanceResponse,
  AttendanceHistoryResponse,
  TableCreatePayload,
  TableUpdatePayload,
} from '@/src/types/contracts';
import type {
  BankAccount,
  BusinessProfile,
  BusinessSettings,
  BusinessTypeOption,
  Category,
  DashboardSummary,
  InventorySummary,
  LedgerEntry,
  OrderAttribute,
  PaginatedResponse,
  Party,
  PartyReportItem,
  PartyTransaction,
  Product,
  Purchase,
  QuickExpense,
  Sale,
  SequenceMap,
  Service,
  StaffMember,
  Subscription,
  SubscriptionPaymentSetup,
  Unit,
  UploadResult,
  User,
  Task,
  TaskActivity,
  TaskMetadata,
  TaskNotificationSummary,
  Attendance,
  StaffSalaryRecord,
  Table,
} from '@/src/types/models';


export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<AuthResponseShape, RegisterPayload>({
      method: 'POST',
      path: '/api/auth/register',
      auth: false,
      businessScoped: false,
      body: payload,
    }),
  login: (payload: LoginPayload) =>
    apiRequest<AuthResponseShape, LoginPayload>({
      method: 'POST',
      path: '/api/auth/login',
      auth: false,
      businessScoped: false,
      body: payload,
    }),
  me: () => apiRequest<AuthResponseShape | User>({ path: '/api/auth/me', businessScoped: false }),
  updateMe: (payload: UpdateMePayload) =>
    apiRequest<AuthResponseShape | User, UpdateMePayload>({
      method: 'PATCH',
      path: '/api/auth/me',
      body: payload,
      businessScoped: false,
    }),
  requestEmailOtp: (payload: OtpRequestPayload) =>
    apiRequest<AuthResponseShape | { success: boolean; message?: string }, OtpRequestPayload>({
      method: 'POST',
      path: '/api/auth/request-email-otp',
      auth: false,
      businessScoped: false,
      body: payload,
    }),
  verifyEmailOtp: (payload: VerifyOtpPayload) =>
    apiRequest<AuthResponseShape | { success: boolean; message?: string }, VerifyOtpPayload>({
      method: 'POST',
      path: '/api/auth/verify-email-otp',
      auth: false,
      businessScoped: false,
      body: payload,
    }),
  requestPasswordReset: (payload: OtpRequestPayload) =>
    apiRequest<{ success: boolean; message?: string }, OtpRequestPayload>({
      method: 'POST',
      path: '/api/auth/request-password-reset',
      auth: false,
      businessScoped: false,
      body: payload,
    }),
  verifyPasswordResetOtp: (payload: VerifyOtpPayload) =>
    apiRequest<{ success: boolean; message?: string }, VerifyOtpPayload>({
      method: 'POST',
      path: '/api/auth/verify-password-reset-otp',
      auth: false,
      businessScoped: false,
      body: payload,
    }),
  resetPassword: (payload: ResetPasswordPayload) =>
    apiRequest<{ success: boolean; message?: string }, ResetPasswordPayload>({
      method: 'POST',
      path: '/api/auth/reset-password',
      auth: false,
      businessScoped: false,
      body: payload,
    }),
  changePassword: (payload: ChangePasswordPayload) =>
    apiRequest<{ success: boolean; message?: string }, ChangePasswordPayload>({
      method: 'POST',
      path: '/api/auth/change-password',
      body: payload,
      businessScoped: false,
    }),
};

export const metaApi = {
  businessTypes: () =>
    apiRequest<PaginatedResponse<BusinessTypeOption> | BusinessTypeOption[]>({
      path: '/api/meta/business-types',
      auth: false,
      businessScoped: false,
    }),
  businessProfile: () => apiRequest<BusinessProfile>({ path: '/api/meta/business-profile' }),
  businessSettings: () => apiRequest<BusinessSettings>({ path: '/api/business-settings' }),
  updateBusinessSettings: (payload: UpdateBusinessSettingsPayload) =>
    apiRequest<BusinessSettings, UpdateBusinessSettingsPayload>({
      method: 'PUT',
      path: '/api/business-settings',
      body: payload,
    }),
  nextSequences: () => apiRequest<SequenceMap>({ path: '/api/meta/next-sequences' }),
  dashboardSummary: (query: { from: string; to: string }) =>
    apiRequest<DashboardSummary>({ path: '/api/dashboard/summary', query }),
};

export const subscriptionApi = {
  get: () => apiRequest<Subscription>({ path: '/api/subscription' }),
  update: (payload: SubscriptionUpdatePayload) =>
    apiRequest<Subscription, SubscriptionUpdatePayload>({
      method: 'PATCH',
      path: '/api/subscription',
      body: payload,
    }),
  paymentSetup: () =>
    apiRequest<SubscriptionPaymentSetupResponse | SubscriptionPaymentSetup>({
      path: '/api/subscription/payment-setup',
    }),
};

export const staffApi = {
  list: (query: ListQuery = {}) => apiRequest<StaffListResponse>({ path: '/api/staff', query }),
  create: (payload: StaffCreatePayload) =>
    apiRequest<StaffMember, StaffCreatePayload>({
      method: 'POST',
      path: '/api/staff',
      body: payload,
    }),
  update: (id: string, payload: StaffUpdatePayload) =>
    apiRequest<StaffMember, StaffUpdatePayload>({
      method: 'PATCH',
      path: `/api/staff/${id}`,
      body: payload,
    }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/staff/${id}` }),
  listSalaryRecords: (membershipId: string) =>
    apiRequest<SalaryRecordsResponse>({ path: `/api/staff/${membershipId}/salary-records` }),
  createSalaryRecord: (membershipId: string, payload: StaffSalaryCreatePayload) =>
    apiRequest<{ success: boolean; record: StaffSalaryRecord }, StaffSalaryCreatePayload>({
      method: 'POST',
      path: `/api/staff/${membershipId}/salary-records`,
      body: payload,
    }),
  deleteSalaryRecord: (membershipId: string, recordId: string) =>
    apiRequest<{ success: boolean }>({
      method: 'DELETE',
      path: `/api/staff/${membershipId}/salary-records/${recordId}`,
    }),
  getTodayAttendance: () =>
    apiRequest<AttendanceResponse>({ path: '/api/staff/attendance/today' }),
  punchIn: (payload: { latitude?: number; longitude?: number }) =>
    apiRequest<{ message: string; attendance: Attendance }, { latitude?: number; longitude?: number }>({
      method: 'POST',
      path: '/api/staff/attendance/punch-in',
      body: payload,
    }),
  punchOut: (payload: { latitude?: number; longitude?: number }) =>
    apiRequest<{ message: string; attendance: Attendance }, { latitude?: number; longitude?: number }>({
      method: 'POST',
      path: '/api/staff/attendance/punch-out',
      body: payload,
    }),
  getAttendanceHistory: (query: { from?: string; to?: string; businessUserId?: string } = {}) =>
    apiRequest<AttendanceHistoryResponse>({ path: '/api/staff/attendance/history', query }),
};

export const productsApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Product>>({ path: '/api/products', query }),
  lookup: (query: { search?: string; limit?: number }) =>
    apiRequest<PaginatedResponse<Product>>({ path: '/api/products/lookup', query }),
  get: (id: string) => apiRequest<Product>({ path: `/api/products/${id}` }),
  create: (payload: ProductCreatePayload) =>
    apiRequest<Product, ProductCreatePayload>({
      method: 'POST',
      path: '/api/products',
      body: payload,
    }),
  replace: (id: string, payload: ProductCreatePayload) =>
    apiRequest<Product, ProductCreatePayload>({
      method: 'PUT',
      path: `/api/products/${id}`,
      body: payload,
    }),
  update: (id: string, payload: ProductUpdatePayload) =>
    apiRequest<Product, ProductUpdatePayload>({
      method: 'PATCH',
      path: `/api/products/${id}`,
      body: payload,
    }),
  restock: (id: string, payload: ProductRestockPayload) =>
    apiRequest<Product, ProductRestockPayload>({
      method: 'POST',
      path: `/api/products/${id}/restock`,
      body: payload,
    }),
};

export const categoriesApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Category>>({ path: '/api/categories', query }),
  get: (id: string) => apiRequest<Category>({ path: `/api/categories/${id}` }),
  create: (payload: CategoryCreatePayload) =>
    apiRequest<Category, CategoryCreatePayload>({
      method: 'POST',
      path: '/api/categories',
      body: payload,
    }),
  replace: (id: string, payload: CategoryCreatePayload) =>
    apiRequest<Category, CategoryCreatePayload>({
      method: 'PUT',
      path: `/api/categories/${id}`,
      body: payload,
    }),
  update: (id: string, payload: CategoryUpdatePayload) =>
    apiRequest<Category, CategoryUpdatePayload>({
      method: 'PATCH',
      path: `/api/categories/${id}`,
      body: payload,
    }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/categories/${id}` }),
};

export const unitsApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Unit>>({ path: '/api/units', query }),
  get: (id: string) => apiRequest<Unit>({ path: `/api/units/${id}` }),
  create: (payload: UnitCreatePayload) =>
    apiRequest<Unit, UnitCreatePayload>({
      method: 'POST',
      path: '/api/units',
      body: payload,
    }),
  replace: (id: string, payload: UnitCreatePayload) =>
    apiRequest<Unit, UnitCreatePayload>({
      method: 'PUT',
      path: `/api/units/${id}`,
      body: payload,
    }),
  update: (id: string, payload: UnitUpdatePayload) =>
    apiRequest<Unit, UnitUpdatePayload>({
      method: 'PATCH',
      path: `/api/units/${id}`,
      body: payload,
    }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/units/${id}` }),
};

export const salesApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Sale>>({ path: '/api/sales', query }),
  get: (id: string) => apiRequest<Sale>({ path: `/api/sales/${id}` }),
  create: (payload: SaleCreatePayload) =>
    apiRequest<Sale, SaleCreatePayload>({ method: 'POST', path: '/api/sales', body: payload }),
  replace: (id: string, payload: SaleCreatePayload) =>
    apiRequest<Sale, SaleCreatePayload>({ method: 'PUT', path: `/api/sales/${id}`, body: payload }),
  update: (id: string, payload: SaleUpdatePayload) =>
    apiRequest<Sale, SaleUpdatePayload>({ method: 'PATCH', path: `/api/sales/${id}`, body: payload }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/sales/${id}` }),
};

export const purchasesApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Purchase>>({ path: '/api/purchases', query }),
  get: (id: string) => apiRequest<Purchase>({ path: `/api/purchases/${id}` }),
  create: (payload: PurchaseCreatePayload) =>
    apiRequest<Purchase, PurchaseCreatePayload>({ method: 'POST', path: '/api/purchases', body: payload }),
  replace: (id: string, payload: PurchaseCreatePayload) =>
    apiRequest<Purchase, PurchaseCreatePayload>({ method: 'PUT', path: `/api/purchases/${id}`, body: payload }),
  update: (id: string, payload: PurchaseUpdatePayload) =>
    apiRequest<Purchase, PurchaseUpdatePayload>({ method: 'PATCH', path: `/api/purchases/${id}`, body: payload }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/purchases/${id}` }),
};

export const servicesApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Service>>({ path: '/api/services', query }),
  get: (id: string) => apiRequest<Service>({ path: `/api/services/${id}` }),
  create: (payload: ServiceCreatePayload) =>
    apiRequest<Service, ServiceCreatePayload>({ method: 'POST', path: '/api/services', body: payload }),
  update: (id: string, payload: ServiceUpdatePayload) =>
    apiRequest<Service, ServiceUpdatePayload>({ method: 'PATCH', path: `/api/services/${id}`, body: payload }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/services/${id}` }),
};

export const partiesApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Party>>({ path: '/api/parties', query }),
  lookup: (query: { search?: string; type?: string; limit?: number }) =>
    apiRequest<PaginatedResponse<Party>>({ path: '/api/parties/lookup', query }),
  get: (id: string) => apiRequest<Party>({ path: `/api/parties/${id}` }),
  create: (payload: PartyCreatePayload) =>
    apiRequest<Party, PartyCreatePayload>({ method: 'POST', path: '/api/parties', body: payload }),
  replace: (id: string, payload: PartyCreatePayload) =>
    apiRequest<Party, PartyCreatePayload>({ method: 'PUT', path: `/api/parties/${id}`, body: payload }),
  update: (id: string, payload: PartyUpdatePayload) =>
    apiRequest<Party, PartyUpdatePayload>({ method: 'PATCH', path: `/api/parties/${id}`, body: payload }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/parties/${id}` }),
};

export const partyTransactionsApi = {
  list: (query: ListQuery = {}) =>
    apiRequest<PaginatedResponse<PartyTransaction>>({ path: '/api/party-transactions', query }),
  create: (payload: PartyTransactionCreatePayload) =>
    apiRequest<PartyTransaction, PartyTransactionCreatePayload>({
      method: 'POST',
      path: '/api/party-transactions',
      body: payload,
    }),
  replace: (id: string, payload: PartyTransactionCreatePayload) =>
    apiRequest<PartyTransaction, PartyTransactionCreatePayload>({
      method: 'PUT',
      path: `/api/party-transactions/${id}`,
      body: payload,
    }),
  update: (id: string, payload: Partial<PartyTransactionCreatePayload>) =>
    apiRequest<PartyTransaction, Partial<PartyTransactionCreatePayload>>({
      method: 'PATCH',
      path: `/api/party-transactions/${id}`,
      body: payload,
    }),
};

export const banksApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<BankAccount>>({ path: '/api/banks', query }),
  get: (id: string) => apiRequest<BankAccount>({ path: `/api/banks/${id}` }),
  create: (payload: BankCreatePayload) =>
    apiRequest<BankAccount, BankCreatePayload>({ method: 'POST', path: '/api/banks', body: payload }),
  replace: (id: string, payload: BankCreatePayload) =>
    apiRequest<BankAccount, BankCreatePayload>({ method: 'PUT', path: `/api/banks/${id}`, body: payload }),
  update: (id: string, payload: BankUpdatePayload) =>
    apiRequest<BankAccount, BankUpdatePayload>({ method: 'PATCH', path: `/api/banks/${id}`, body: payload }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/banks/${id}` }),
};

export const orderAttributesApi = {
  list: (entityType: string) =>
    apiRequest<OrderAttributeListResponse | PaginatedResponse<OrderAttribute>>({
      path: '/api/order-attributes',
      query: { entityType },
    }),
  create: (payload: OrderAttributeCreatePayload) =>
    apiRequest<OrderAttribute, OrderAttributeCreatePayload>({
      method: 'POST',
      path: '/api/order-attributes',
      body: payload,
    }),
  update: (id: string, payload: OrderAttributeUpdatePayload) =>
    apiRequest<OrderAttribute, OrderAttributeUpdatePayload>({
      method: 'PATCH',
      path: `/api/order-attributes/${id}`,
      body: payload,
    }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/order-attributes/${id}` }),
};

export const uploadsApi = {
  attachment: (formData: FormData) =>
    uploadMultipart<UploadAttachmentResponse>({
      path: '/api/uploads/attachment',
      formData,
    }),
  attachments: (formData: FormData) =>
    uploadMultipart<UploadAttachmentsResponse>({
      path: '/api/uploads/attachments',
      formData,
    }),
};

export const reportsApi = {
  lowStock: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Product>>({ path: '/api/reports/low-stock', query }),
  inventorySummary: (query: ListQuery = {}) =>
    apiRequest<InventorySummaryResponse | InventorySummary>({ path: '/api/reports/inventory-summary', query }),
  partyReport: (query: ListQuery = {}) =>
    apiRequest<PaginatedResponse<PartyReportItem>>({ path: '/api/reports/party-report', query }),
  partyStatement: (query: ListQuery) =>
    apiRequest<PaginatedResponse<LedgerEntry>>({ path: '/api/reports/party-statement', query }),
  partyDetail: (partyId: string) =>
    apiRequest<PartyDetailResponse>({ path: `/api/reports/party-detail/${partyId}` }),
  ledger: (query: ListQuery) => apiRequest<PaginatedResponse<LedgerEntry>>({ path: '/api/reports/ledger', query }),
  salesReport: (query: ListQuery) => apiRequest<PaginatedResponse<Sale>>({ path: '/api/reports/sales-report', query }),
  purchaseReport: (query: ListQuery) =>
    apiRequest<PaginatedResponse<Purchase>>({ path: '/api/reports/purchase-report', query }),
  serviceReport: (query: ListQuery) =>
    apiRequest<PaginatedResponse<Service>>({ path: '/api/reports/service-report', query }),
};

export const analyticsApi = {
  summary: (query: ListQuery) => apiRequest<Record<string, unknown>>({ path: '/api/analytics/summary', query }),
  profitLoss: (query: ListQuery) => apiRequest<ProfitLossAnalyticsResponse>({ path: '/api/analytics/profit-loss', query }),
  expenses: (query: ListQuery) => apiRequest<ExpenseAnalyticsResponse>({ path: '/api/analytics/expenses', query }),
  popularCategories: (query: ListQuery) =>
    apiRequest<PopularCategoriesResponse>({ path: '/api/analytics/popular-categories', query }),
};

export const quickExpensesApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<QuickExpense>>({ path: '/api/quick-expenses', query }),
  get: (id: string) => apiRequest<QuickExpense>({ path: `/api/quick-expenses/${id}` }),
  create: (payload: QuickExpenseCreatePayload) =>
    apiRequest<QuickExpense, QuickExpenseCreatePayload>({
      method: 'POST',
      path: '/api/quick-expenses',
      body: payload,
    }),
  update: (id: string, payload: QuickExpenseUpdatePayload) =>
    apiRequest<QuickExpense, QuickExpenseUpdatePayload>({
      method: 'PATCH',
      path: `/api/quick-expenses/${id}`,
      body: payload,
    }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/quick-expenses/${id}` }),
};

export const tasksApi = {
  meta: () => apiRequest<TaskMetadata>({ path: '/api/tasks/meta' }),
  list: (query: Record<string, unknown> = {}) =>
    apiRequest<PaginatedResponse<Task>>({ path: '/api/tasks', query }),
  get: (id: string) => apiRequest<Task>({ path: `/api/tasks/${id}` }),
  create: (payload: TaskCreatePayload) =>
    apiRequest<Task, TaskCreatePayload>({ method: 'POST', path: '/api/tasks', body: payload }),
  update: (id: string, payload: TaskUpdatePayload) =>
    apiRequest<Task, TaskUpdatePayload>({ method: 'PATCH', path: `/api/tasks/${id}`, body: payload }),
  addComment: (id: string, content: string) =>
    apiRequest<TaskActivity, TaskCommentPayload>({
      method: 'POST',
      path: `/api/tasks/${id}/comments`,
      body: { content },
    }),
  notificationsSummary: () => apiRequest<TaskNotificationSummary>({ path: '/api/tasks/notifications/summary' }),
  markNotificationsRead: () => apiRequest<void>({ method: 'POST', path: '/api/tasks/notifications/read' }),
};

export const tablesApi = {
  list: (query: ListQuery = {}) => apiRequest<PaginatedResponse<Table>>({ path: '/api/tables', query }),
  get: (id: string) => apiRequest<Table>({ path: `/api/tables/${id}` }),
  create: (payload: TableCreatePayload) =>
    apiRequest<Table, TableCreatePayload>({ method: 'POST', path: '/api/tables', body: payload }),
  update: (id: string, payload: TableUpdatePayload) =>
    apiRequest<Table, TableUpdatePayload>({ method: 'PATCH', path: `/api/tables/${id}`, body: payload }),
  remove: (id: string) => apiRequest<void>({ method: 'DELETE', path: `/api/tables/${id}` }),
};



