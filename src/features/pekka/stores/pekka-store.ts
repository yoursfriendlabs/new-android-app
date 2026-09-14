import { create } from 'zustand';

interface PekkaState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * Tiny store so the floating button — and later, onboarding — can open Pekka
 * from anywhere. The conversation itself lives locally in the chat sheet.
 */
export const usePekkaStore = create<PekkaState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
