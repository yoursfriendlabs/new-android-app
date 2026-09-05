import { create } from 'zustand';
import { readLocalJson, writeLocalJson } from '@/src/shared/lib/local-json-store';
import { generateId } from '@/src/shared/lib/id';
import { StockTransaction } from '@/src/features/shares/lib/portfolio-calc';

const PORTFOLIO_DRAFT_KEY = 'persist.nepse_portfolio';
const WATCHLIST_DRAFT_KEY = 'persist.nepse_watchlist';

interface PersistedPortfolio {
  transactions: StockTransaction[];
  watchlist: string[];
}

interface PortfolioState {
  transactions: StockTransaction[];
  watchlist: string[];
  isLoaded: boolean;
  loadPortfolio: () => Promise<void>;
  addTransaction: (tx: Omit<StockTransaction, 'id' | 'createdAt'>) => Promise<StockTransaction>;
  deleteTransaction: (id: string) => Promise<void>;
  toggleWatchlist: (symbol: string) => Promise<void>;
  isWatchlisted: (symbol: string) => boolean;
  resetPortfolio: () => Promise<void>;
}

const DEFAULT_WATCHLIST = ['NABIL', 'CHCL', 'HDL', 'NLIC', 'CIT'];

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  transactions: [],
  watchlist: DEFAULT_WATCHLIST,
  isLoaded: false,

  loadPortfolio: async () => {
    try {
      const persisted = await readLocalJson<PersistedPortfolio>(PORTFOLIO_DRAFT_KEY);
      const watchlistPersisted = await readLocalJson<string[]>(WATCHLIST_DRAFT_KEY);

      const transactions = persisted?.transactions || [];
      const watchlist = watchlistPersisted || persisted?.watchlist || DEFAULT_WATCHLIST;

      set({
        transactions,
        watchlist,
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  addTransaction: async (txInput) => {
    const id = generateId();
    const newTx: StockTransaction = {
      ...txInput,
      id,
      symbol: txInput.symbol.toUpperCase().trim(),
      createdAt: new Date().toISOString(),
    };

    const nextTransactions = [newTx, ...get().transactions];
    set({ transactions: nextTransactions });

    await writeLocalJson(PORTFOLIO_DRAFT_KEY, {
      transactions: nextTransactions,
      watchlist: get().watchlist,
    });

    return newTx;
  },

  deleteTransaction: async (id: string) => {
    const nextTransactions = get().transactions.filter((tx) => tx.id !== id);
    set({ transactions: nextTransactions });

    await writeLocalJson(PORTFOLIO_DRAFT_KEY, {
      transactions: nextTransactions,
      watchlist: get().watchlist,
    });
  },

  toggleWatchlist: async (symbol: string) => {
    const sym = symbol.toUpperCase().trim();
    const current = get().watchlist;
    const exists = current.includes(sym);
    const nextWatchlist = exists ? current.filter((s) => s !== sym) : [...current, sym];

    set({ watchlist: nextWatchlist });

    await writeLocalJson(WATCHLIST_DRAFT_KEY, nextWatchlist);
    await writeLocalJson(PORTFOLIO_DRAFT_KEY, {
      transactions: get().transactions,
      watchlist: nextWatchlist,
    });
  },

  isWatchlisted: (symbol: string) => {
    return get().watchlist.includes(symbol.toUpperCase().trim());
  },

  resetPortfolio: async () => {
    set({ transactions: [], watchlist: DEFAULT_WATCHLIST });
    await writeLocalJson(PORTFOLIO_DRAFT_KEY, {
      transactions: [],
      watchlist: DEFAULT_WATCHLIST,
    });
  },
}));
