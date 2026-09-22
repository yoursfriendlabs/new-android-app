import { create } from 'zustand';

import type { MoneyEntryKind } from '@/src/features/money/components/MoneyEntrySheet';
import type { CartLineDraft } from '@/src/types/forms';
import type { Party } from '@/src/types/models';

/** A sale Pekka prepared; the POS screen loads it for the user to check and save. */
export interface PekkaSaleHandoff {
  items: CartLineDraft[];
  party: Party | null;
  fullyPaid: boolean;
  amountReceived: number;
}

/** Starting values for the quick money form. */
export interface PekkaMoneyHandoff {
  kind: MoneyEntryKind;
  amount: number;
  category: string | null;
}

type Handoff = { type: 'sale'; draft: PekkaSaleHandoff } | { type: 'money'; draft: PekkaMoneyHandoff };

interface HandoffState {
  /** Drafts shown in chat, waiting for the user to tap "Open to check". */
  prepared: Record<string, Handoff>;
  /** The one draft the user asked to open; the target screen takes it once. */
  sale: PekkaSaleHandoff | null;
  money: PekkaMoneyHandoff | null;
  prepare: (id: string, handoff: Handoff) => void;
  arm: (id: string) => Handoff['type'] | null;
  takeSale: () => PekkaSaleHandoff | null;
  takeMoney: () => PekkaMoneyHandoff | null;
  clear: () => void;
}

/**
 * Nothing Pekka prepares reaches a form until the user taps the button in
 * chat, and every form still needs the user to press Save.
 */
export const usePekkaHandoff = create<HandoffState>((set, get) => ({
  prepared: {},
  sale: null,
  money: null,
  prepare: (id, handoff) => set((state) => ({ prepared: { ...state.prepared, [id]: handoff } })),
  arm: (id) => {
    const handoff = get().prepared[id];
    if (!handoff) return null;
    if (handoff.type === 'sale') set({ sale: handoff.draft, money: null });
    else set({ money: handoff.draft, sale: null });
    return handoff.type;
  },
  takeSale: () => {
    const sale = get().sale;
    if (sale) set({ sale: null });
    return sale;
  },
  takeMoney: () => {
    const money = get().money;
    if (money) set({ money: null });
    return money;
  },
  clear: () => set({ prepared: {}, sale: null, money: null }),
}));
