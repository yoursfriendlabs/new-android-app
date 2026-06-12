import type { Party, PaymentMethod, Product } from '@/src/types/models';

export type QuickEntryTab = 'expense' | 'purchase';

export interface CartLineDraft {
  productId: string;
  name: string;
  unit: string;
  unitType?: 'primary' | 'secondary';
  primaryUnit?: string;
  secondaryUnit?: string;
  secondaryConversionRate?: number;
  categoryName?: string;
  stockOnHand?: number;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface PosDraft {
  invoiceNo: string;
  saleDate: string;
  party?: Party | null;
  notes: string;
  attributes: Record<string, string>;
  attachments: string[];
  discount: number;
  taxOverride?: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
  paymentNote: string;
  amountReceived: number;
  fullyPaid: boolean;
  items: CartLineDraft[];
}

export interface QuickExpenseDraft {
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
  paymentNote: string;
  notes: string;
  date: string;
  party?: Party | null;
}

export interface QuickPurchaseDraft {
  supplier?: Party | null;
  description: string;
  invoiceNo: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
  paymentNote: string;
  notes: string;
  date: string;
}

export interface DraftPurchaseLine {
  id: string;
  product?: Product | null;
  description: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  taxRate: number;
  itemType: string;
}

export interface PurchaseDraft {
  supplier?: Party | null;
  invoiceNo: string;
  purchaseDate: string;
  status: string;
  notes: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
  paymentNote: string;
  discount: number;
  items: DraftPurchaseLine[];
}

export interface DraftServiceLine {
  id: string;
  itemType: 'labor' | 'part';
  product?: Product | null;
  description: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  taxRate: number;
}

export interface ServiceDraft {
  customer?: Party | null;
  orderNo: string;
  status: string;
  deliveryDate: string;
  notes: string;
  paymentMethod: PaymentMethod;
  bankId?: string;
  paymentNote: string;
  receivedTotal: number;
  discount: number;
  attributes: Record<string, string>;
  attachments: string[];
  items: DraftServiceLine[];
}
