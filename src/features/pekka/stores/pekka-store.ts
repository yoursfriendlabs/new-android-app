import { create } from 'zustand';

interface PekkaState {
  open: boolean;
  /** Extra space under the button, so it sits above a screen's own floating button. */
  lift: number;
  setOpen: (open: boolean) => void;
  setLift: (lift: number) => void;
  toggle: () => void;
}

/**
 * Tiny store so the floating button — and later, onboarding — can open Pekka
 * from anywhere. The conversation itself lives locally in the chat sheet.
 */
export const usePekkaStore = create<PekkaState>((set) => ({
  open: false,
  lift: 0,
  setOpen: (open) => set({ open }),
  setLift: (lift) => set({ lift }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
