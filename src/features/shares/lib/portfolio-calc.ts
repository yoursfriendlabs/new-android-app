import { NepseCompany } from './nepse-scrip-list';

export type TransactionType = 'BUY' | 'SELL';

export interface StockTransaction {
  id: string;
  symbol: string;
  type: TransactionType;
  units: number;
  pricePerUnit: number;
  totalCost: number; // Gross or net after fees
  date: string; // ISO date string YYYY-MM-DD
  brokerCommission: number;
  sebonFee: number;
  dpFee: number;
  capitalGainsTax?: number;
  notes?: string;
  createdAt: string;
}

export interface StockHolding {
  symbol: string;
  name: string;
  sector: string;
  totalUnits: number;
  avgBuyPrice: number;
  totalInvestment: number;
  currentLtp: number;
  currentValue: number;
  overallProfitLoss: number;
  overallProfitLossPercent: number;
  todayProfitLoss: number;
  todayProfitLossPercent: number;
}

export interface PortfolioMetrics {
  totalInvestment: number;
  currentValue: number;
  overallProfitLoss: number;
  overallProfitLossPercent: number;
  todayProfitLoss: number;
  todayProfitLossPercent: number;
  holdingsCount: number;
  totalUnits: number;
}

/**
 * Calculates NEPSE Broker Commission (SEBON standard tiered slabs):
 * Up to 50,000: 0.40%
 * 50,000 to 500,000: 0.37%
 * 500,000 to 2,000,000: 0.34%
 * 2,000,000 to 10,000,000: 0.30%
 * Above 10,000,000: 0.27%
 * Minimum commission: NPR 10
 */
export function calculateBrokerCommission(amount: number): number {
  if (amount <= 0) return 0;
  let rate = 0.004; // 0.40%
  if (amount > 10000000) {
    rate = 0.0027;
  } else if (amount > 2000000) {
    rate = 0.003;
  } else if (amount > 500000) {
    rate = 0.0034;
  } else if (amount > 50000) {
    rate = 0.0037;
  }
  const comm = amount * rate;
  return Math.max(10, Math.round(comm * 100) / 100);
}

/**
 * SEBON Regulatory Fee: 0.015%
 */
export function calculateSebonFee(amount: number): number {
  return +(amount * 0.00015).toFixed(2);
}

export const DP_FEE = 25.0; // Flat NPR 25 DP fee per trade transaction

export interface OrderCalculationResult {
  grossAmount: number;
  brokerCommission: number;
  sebonFee: number;
  dpFee: number;
  effectiveRate: number;
  totalPayableOrReceivable: number;
}

export function calculateOrderDetails(
  type: TransactionType,
  units: number,
  price: number
): OrderCalculationResult {
  const grossAmount = units * price;
  if (grossAmount <= 0) {
    return {
      grossAmount: 0,
      brokerCommission: 0,
      sebonFee: 0,
      dpFee: 0,
      effectiveRate: price,
      totalPayableOrReceivable: 0,
    };
  }

  const brokerCommission = calculateBrokerCommission(grossAmount);
  const sebonFee = calculateSebonFee(grossAmount);
  const dpFee = DP_FEE;

  if (type === 'BUY') {
    const totalPayable = +(grossAmount + brokerCommission + sebonFee + dpFee).toFixed(2);
    const effectiveRate = +(totalPayable / units).toFixed(2);
    return {
      grossAmount,
      brokerCommission,
      sebonFee,
      dpFee,
      effectiveRate,
      totalPayableOrReceivable: totalPayable,
    };
  } else {
    // SELL: fees are deducted from gross receivable
    const totalReceivable = +(grossAmount - brokerCommission - sebonFee - dpFee).toFixed(2);
    const effectiveRate = +(totalReceivable / units).toFixed(2);
    return {
      grossAmount,
      brokerCommission,
      sebonFee,
      dpFee,
      effectiveRate,
      totalPayableOrReceivable: Math.max(0, totalReceivable),
    };
  }
}

/**
 * Calculates current holdings and weighted average buy prices from all transactions
 */
export function computeHoldingsFromTransactions(
  transactions: StockTransaction[],
  companyMap: Map<string, NepseCompany>
): StockHolding[] {
  // Sort transactions chronologically (oldest to newest)
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const symbolMap = new Map<
    string,
    {
      units: number;
      totalInvested: number;
    }
  >();

  for (const tx of sorted) {
    const sym = tx.symbol.toUpperCase();
    const cur = symbolMap.get(sym) || { units: 0, totalInvested: 0 };

    if (tx.type === 'BUY') {
      cur.units += tx.units;
      cur.totalInvested += tx.totalCost;
    } else if (tx.type === 'SELL') {
      if (cur.units > 0) {
        // Average cost per unit before sell
        const costPerUnit = cur.totalInvested / cur.units;
        const sellUnits = Math.min(cur.units, tx.units);
        cur.units -= sellUnits;
        cur.totalInvested -= sellUnits * costPerUnit;
      }
    }
    symbolMap.set(sym, cur);
  }

  const holdings: StockHolding[] = [];

  for (const [symbol, data] of symbolMap.entries()) {
    if (data.units <= 0) continue;

    const company = companyMap.get(symbol) || {
      symbol,
      name: symbol,
      sector: 'Others',
      ltp: 100,
      change: 0,
      percentChange: 0,
    };

    const avgBuyPrice = data.units > 0 ? +(data.totalInvested / data.units).toFixed(2) : 0;
    const totalInvestment = +data.totalInvested.toFixed(2);
    const currentValue = +(data.units * company.ltp).toFixed(2);
    const overallProfitLoss = +(currentValue - totalInvestment).toFixed(2);
    const overallProfitLossPercent =
      totalInvestment > 0 ? +((overallProfitLoss / totalInvestment) * 100).toFixed(2) : 0;

    const todayProfitLoss = +(data.units * (company.change || 0)).toFixed(2);
    const prevDayValue = currentValue - todayProfitLoss;
    const todayProfitLossPercent =
      prevDayValue > 0 ? +((todayProfitLoss / prevDayValue) * 100).toFixed(2) : 0;

    holdings.push({
      symbol,
      name: company.name,
      sector: company.sector,
      totalUnits: data.units,
      avgBuyPrice,
      totalInvestment,
      currentLtp: company.ltp,
      currentValue,
      overallProfitLoss,
      overallProfitLossPercent,
      todayProfitLoss,
      todayProfitLossPercent,
    });
  }

  // Sort by currentValue desc
  return holdings.sort((a, b) => b.currentValue - a.currentValue);
}

export function computePortfolioMetrics(holdings: StockHolding[]): PortfolioMetrics {
  let totalInvestment = 0;
  let currentValue = 0;
  let todayProfitLoss = 0;
  let totalUnits = 0;

  for (const h of holdings) {
    totalInvestment += h.totalInvestment;
    currentValue += h.currentValue;
    todayProfitLoss += h.todayProfitLoss;
    totalUnits += h.totalUnits;
  }

  const overallProfitLoss = +(currentValue - totalInvestment).toFixed(2);
  const overallProfitLossPercent =
    totalInvestment > 0 ? +((overallProfitLoss / totalInvestment) * 100).toFixed(2) : 0;

  const prevValue = currentValue - todayProfitLoss;
  const todayProfitLossPercent =
    prevValue > 0 ? +((todayProfitLoss / prevValue) * 100).toFixed(2) : 0;

  return {
    totalInvestment: +totalInvestment.toFixed(2),
    currentValue: +currentValue.toFixed(2),
    overallProfitLoss,
    overallProfitLossPercent,
    todayProfitLoss: +todayProfitLoss.toFixed(2),
    todayProfitLossPercent,
    holdingsCount: holdings.length,
    totalUnits,
  };
}
