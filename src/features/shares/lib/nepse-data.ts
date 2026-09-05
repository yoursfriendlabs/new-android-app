import { INITIAL_NEPSE_COMPANIES, NepseCompany } from './nepse-scrip-list';

export interface NepseIndex {
  current: number;
  change: number;
  percentChange: number;
  turnover: number;
  totalVolume: number;
  totalTransactions: number;
  status: 'OPEN' | 'CLOSED';
  lastUpdated: string;
}

export interface SectorSummary {
  name: string;
  index: number;
  change: number;
  percentChange: number;
}

export interface MarketSummary {
  nepseIndex: NepseIndex;
  sensitiveIndex: { current: number; change: number; percentChange: number };
  floatIndex: { current: number; change: number; percentChange: number };
  companies: NepseCompany[];
  topGainers: NepseCompany[];
  topLosers: NepseCompany[];
  topTurnover: NepseCompany[];
  sectorSummaries: SectorSummary[];
}

export function isNepseMarketOpen(): boolean {
  // NEPSE trading hours: Sunday to Thursday, 11:00 AM to 3:00 PM Nepal Time (UTC+5:45)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const npt = new Date(utc + 5.75 * 3600000);
  const day = npt.getDay(); // 0 is Sunday, 4 is Thursday, 5 is Friday, 6 is Saturday
  const hours = npt.getHours();
  const minutes = npt.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Trading days: Sun(0), Mon(1), Tue(2), Wed(3), Thu(4)
  const isTradingDay = day >= 0 && day <= 4;
  // Trading hours: 11:00 (660 min) to 15:00 (900 min)
  const isTradingHour = timeInMinutes >= 660 && timeInMinutes <= 900;

  return isTradingDay && isTradingHour;
}

export function computeMarketSummary(companies: NepseCompany[]): MarketSummary {
  const isOpen = isNepseMarketOpen();
  
  // Sort copies for gainers, losers, turnover
  const sortedByPercent = [...companies].sort((a, b) => b.percentChange - a.percentChange);
  const topGainers = sortedByPercent.filter((c) => c.percentChange > 0).slice(0, 5);
  const topLosers = [...sortedByPercent].reverse().filter((c) => c.percentChange < 0).slice(0, 5);
  const topTurnover = [...companies].sort((a, b) => b.turnover - a.turnover).slice(0, 5);

  // Aggregates
  const totalTurnover = companies.reduce((sum, c) => sum + c.turnover, 0);
  const totalVolume = companies.reduce((sum, c) => sum + c.volume, 0);

  // Sector stats
  const sectorMap = new Map<string, { totalTurnover: number; count: number; avgChange: number }>();
  for (const c of companies) {
    const s = sectorMap.get(c.sector) || { totalTurnover: 0, count: 0, avgChange: 0 };
    s.totalTurnover += c.turnover;
    s.count += 1;
    s.avgChange += c.percentChange;
    sectorMap.set(c.sector, s);
  }

  const sectorSummaries: SectorSummary[] = Array.from(sectorMap.entries()).map(([name, val]) => {
    const avgChange = val.count ? +(val.avgChange / val.count).toFixed(2) : 0;
    // Base index estimates for sectors
    const base = name === 'Commercial Banks' ? 1420 : name === 'Hydropower' ? 2680 : name === 'Life Insurance' ? 10450 : 1850;
    const current = +(base * (1 + avgChange / 100)).toFixed(2);
    const change = +(current - base).toFixed(2);
    return {
      name,
      index: current,
      change,
      percentChange: avgChange,
    };
  });

  const nepseCurrent = 2482.65;
  const nepseChange = 18.42;
  const nepsePercentChange = 0.75;

  return {
    nepseIndex: {
      current: nepseCurrent,
      change: nepseChange,
      percentChange: nepsePercentChange,
      turnover: totalTurnover,
      totalVolume,
      totalTransactions: 38450,
      status: isOpen ? 'OPEN' : 'CLOSED',
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    sensitiveIndex: {
      current: 442.18,
      change: 3.12,
      percentChange: 0.71,
    },
    floatIndex: {
      current: 168.95,
      change: 1.05,
      percentChange: 0.63,
    },
    companies,
    topGainers,
    topLosers,
    topTurnover,
    sectorSummaries,
  };
}

/**
 * Generates slight live variations to simulate market ticks when refreshed
 */
export function simulateMarketTick(companies: NepseCompany[]): NepseCompany[] {
  return companies.map((c) => {
    // 60% chance of price fluctuation
    if (Math.random() > 0.4) {
      const deltaPercent = (Math.random() * 0.8 - 0.38); // -0.38% to +0.42%
      const rawPrice = c.ltp * (1 + deltaPercent / 100);
      const newLtp = +(Math.round(rawPrice * 10) / 10).toFixed(1);
      const change = +(newLtp - c.previousClose).toFixed(1);
      const percentChange = +((change / c.previousClose) * 100).toFixed(2);
      const high = Math.max(c.high, newLtp);
      const low = Math.min(c.low, newLtp);
      const addedVolume = Math.floor(Math.random() * 300) * 10;
      const volume = c.volume + addedVolume;
      const turnover = c.turnover + addedVolume * newLtp;

      return {
        ...c,
        ltp: newLtp,
        change,
        percentChange,
        high,
        low,
        volume,
        turnover,
      };
    }
    return c;
  });
}
