import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateBrokerCommission,
  calculateSebonFee,
  calculateOrderDetails,
  computeHoldingsFromTransactions,
  computePortfolioMetrics,
} from '../src/features/shares/lib/portfolio-calc.ts';
import { INITIAL_NEPSE_COMPANIES } from '../src/features/shares/lib/nepse-scrip-list.ts';

test('calculateBrokerCommission applies NEPSE tiered commission slabs correctly', () => {
  // Up to 50k: 0.40%
  assert.equal(calculateBrokerCommission(10000), 40);
  assert.equal(calculateBrokerCommission(50000), 200);

  // 50k to 500k: 0.37%
  assert.equal(calculateBrokerCommission(100000), 370);

  // 500k to 2M: 0.34%
  assert.equal(calculateBrokerCommission(1000000), 3400);

  // Minimum commission rule (Rs 10)
  assert.equal(calculateBrokerCommission(1000), 10);
});

test('calculateSebonFee calculates 0.015% regulatory charge', () => {
  assert.equal(calculateSebonFee(100000), 15);
  assert.equal(calculateSebonFee(50000), 7.5);
});

test('calculateOrderDetails adds broker fees and DP on BUY and deducts on SELL', () => {
  // Buy 100 shares at Rs 500 = 50,000 gross
  // Commission: 200, SEBON: 7.50, DP: 25 -> Total Payable: 50,232.50
  const buy = calculateOrderDetails('BUY', 100, 500);
  assert.equal(buy.grossAmount, 50000);
  assert.equal(buy.brokerCommission, 200);
  assert.equal(buy.sebonFee, 7.5);
  assert.equal(buy.dpFee, 25);
  assert.equal(buy.totalPayableOrReceivable, 50232.5);
  assert.equal(buy.effectiveRate, 502.32);

  // Sell 100 shares at Rs 600 = 60,000 gross
  // Commission (0.37%): 222, SEBON: 9, DP: 25 -> Total Receivable: 60000 - 222 - 9 - 25 = 59,744
  const sell = calculateOrderDetails('SELL', 100, 600);
  assert.equal(sell.grossAmount, 60000);
  assert.equal(sell.brokerCommission, 222);
  assert.equal(sell.sebonFee, 9);
  assert.equal(sell.dpFee, 25);
  assert.equal(sell.totalPayableOrReceivable, 59744);
});

test('computeHoldingsFromTransactions accurately computes WACC, units, and unrealized profit/loss', () => {
  const companyMap = new Map();
  for (const c of INITIAL_NEPSE_COMPANIES) {
    companyMap.set(c.symbol, c);
  }

  const transactions = [
    {
      id: 'tx-1',
      symbol: 'NABIL',
      type: 'BUY',
      units: 100,
      pricePerUnit: 500,
      totalCost: 50232.5,
      date: '2026-01-10',
      brokerCommission: 200,
      sebonFee: 7.5,
      dpFee: 25,
      createdAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'tx-2',
      symbol: 'NABIL',
      type: 'BUY',
      units: 50,
      pricePerUnit: 520,
      totalCost: 26120.9,
      date: '2026-02-15',
      brokerCommission: 96.2,
      sebonFee: 3.9,
      dpFee: 25,
      createdAt: '2026-02-15T10:00:00Z',
    },
  ];

  const holdings = computeHoldingsFromTransactions(transactions, companyMap);
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].symbol, 'NABIL');
  assert.equal(holdings[0].totalUnits, 150);
  assert.equal(holdings[0].totalInvestment, 76353.4);
  assert.equal(holdings[0].avgBuyPrice, 509.02);

  const metrics = computePortfolioMetrics(holdings);
  assert.equal(metrics.holdingsCount, 1);
  assert.equal(metrics.totalUnits, 150);
  assert.ok(metrics.currentValue > 0);
});
