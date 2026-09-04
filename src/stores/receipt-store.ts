import { create } from 'zustand';
import type { ReceiptInput } from '@/src/shared/lib/receipt';

interface ReceiptState {
  title: string;
  subtitle: string;
  html: string;
  data?: ReceiptInput;
  setReceipt: (input: { title: string; subtitle: string; html: string; data?: ReceiptInput }) => void;
  clearReceipt: () => void;
}

export const useReceiptStore = create<ReceiptState>((set) => ({
  title: '',
  subtitle: '',
  html: '',
  data: undefined,
  setReceipt: ({ data, html, subtitle, title }) => set({ data, html, subtitle, title }),
  clearReceipt: () => set({ data: undefined, html: '', subtitle: '', title: '' }),
}));
