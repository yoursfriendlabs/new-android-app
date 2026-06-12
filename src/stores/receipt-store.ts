import { create } from 'zustand';

interface ReceiptState {
  title: string;
  subtitle: string;
  html: string;
  setReceipt: (input: { title: string; subtitle: string; html: string }) => void;
  clearReceipt: () => void;
}

export const useReceiptStore = create<ReceiptState>((set) => ({
  title: '',
  subtitle: '',
  html: '',
  setReceipt: ({ html, subtitle, title }) => set({ html, subtitle, title }),
  clearReceipt: () => set({ html: '', subtitle: '', title: '' }),
}));
