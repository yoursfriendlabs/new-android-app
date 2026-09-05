import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { INITIAL_NEPSE_COMPANIES, NepseCompany } from '../lib/nepse-scrip-list';
import { computeMarketSummary, MarketSummary, simulateMarketTick } from '../lib/nepse-data';

export function useMarketData() {
  const [currentCompanies, setCurrentCompanies] = useState<NepseCompany[]>(INITIAL_NEPSE_COMPANIES);

  const {
    data: marketSummary,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<MarketSummary>({
    queryKey: ['nepse', 'market-summary', currentCompanies],
    queryFn: async () => {
      return computeMarketSummary(currentCompanies);
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  const refreshMarket = useCallback(async () => {
    // Generate tick variation for live feel
    const updated = simulateMarketTick(currentCompanies);
    setCurrentCompanies(updated);
    await refetch();
  }, [currentCompanies, refetch]);

  const companyMap = useMemo(() => {
    const map = new Map<string, NepseCompany>();
    for (const c of currentCompanies) {
      map.set(c.symbol.toUpperCase(), c);
    }
    return map;
  }, [currentCompanies]);

  return {
    marketSummary: marketSummary || computeMarketSummary(currentCompanies),
    companies: currentCompanies,
    companyMap,
    isLoading,
    isRefetching,
    refreshMarket,
  };
}
