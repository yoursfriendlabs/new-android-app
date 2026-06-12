import { readCacheRecords, replaceCacheRecords, searchCacheRecords, upsertCacheRecord } from '@/src/data/database';
import type { BankAccount, LedgerEntry, Party, Product, Purchase, Sale, Service, QuickExpense } from '@/src/types/models';
import { generateId } from '@/src/lib/id';

export const cacheKeys = {
  products: 'products',
  categories: 'categories',
  parties: 'parties',
  banks: 'banks',
  recentSales: 'recent-sales',
  recentPurchases: 'recent-purchases',
  recentServices: 'recent-services',
  ledger: 'ledger',
  quickExpenses: 'quick-expenses',
} as const;

export async function cacheProducts(products: Product[]) {
  await replaceCacheRecords(cacheKeys.products, products, {
    getId: (product) => product.id,
    getTitle: (product) => product.name,
    getSubtitle: (product) => product.categoryName,
    getSearchText: (product) =>
      [product.name, product.categoryName, product.primaryUnit, product.sku, product.barcode].filter(Boolean).join(' '),
  });
}

export async function readProductsFromCache(search?: string, limit = 500) {
  if (search?.trim()) {
    return searchCacheRecords<Product>(cacheKeys.products, search, limit);
  }

  const records = await readCacheRecords<Product>(cacheKeys.products);
  return records.slice(0, limit);
}

export async function cacheParties(parties: Party[]) {
  await replaceCacheRecords(cacheKeys.parties, parties, {
    getId: (party) => party.id,
    getTitle: (party) => party.name,
    getSubtitle: (party) => party.phone,
    getSearchText: (party) =>
      [party.name, party.phone, party.type, party.address, party.email].filter(Boolean).join(' '),
  });
}

export async function readPartiesFromCache(search?: string, limit = 100) {
  if (search?.trim()) {
    return searchCacheRecords<Party>(cacheKeys.parties, search, limit);
  }

  const records = await readCacheRecords<Party>(cacheKeys.parties);
  return records.slice(0, limit);
}

export async function cacheBanks(banks: BankAccount[]) {
  await replaceCacheRecords(cacheKeys.banks, banks, {
    getId: (bank) => bank.id,
    getTitle: (bank) => bank.name,
    getSubtitle: (bank) => bank.accountNumber,
    getSearchText: (bank) =>
      [bank.name, bank.accountName, bank.accountNumber, bank.branchName, bank.notes].filter(Boolean).join(' '),
  });
}

export async function readBanksFromCache(search?: string, limit = 50) {
  if (search?.trim()) {
    return searchCacheRecords<BankAccount>(cacheKeys.banks, search, limit);
  }

  const records = await readCacheRecords<BankAccount>(cacheKeys.banks);
  return records.slice(0, limit);
}

export async function cacheRecentSales(records: Sale[]) {
  await replaceCacheRecords(cacheKeys.recentSales, records, {
    getId: (sale) => sale.id,
    getTitle: (sale) => sale.invoiceNo,
    getSubtitle: (sale) => sale.saleDate,
    getSearchText: (sale) => [sale.invoiceNo, sale.notes, sale.saleDate].filter(Boolean).join(' '),
  });
}

export async function readRecentSalesFromCache(limit = 20) {
  const records = await readCacheRecords<Sale>(cacheKeys.recentSales);
  return records.slice(0, limit);
}

export async function cacheRecentPurchases(records: Purchase[]) {
  await replaceCacheRecords(cacheKeys.recentPurchases, records, {
    getId: (purchase) => purchase.id,
    getTitle: (purchase) => purchase.invoiceNo ?? purchase.entryType,
    getSubtitle: (purchase) => purchase.purchaseDate,
    getSearchText: (purchase) =>
      [purchase.invoiceNo, purchase.partyName, purchase.entryType, purchase.purchaseDate].filter(Boolean).join(' '),
  });
}

export async function readRecentPurchasesFromCache(limit = 20) {
  const records = await readCacheRecords<Purchase>(cacheKeys.recentPurchases);
  return records.slice(0, limit);
}

export async function cacheRecentServices(records: Service[]) {
  await replaceCacheRecords(cacheKeys.recentServices, records, {
    getId: (service) => service.id,
    getTitle: (service) => service.orderNo,
    getSubtitle: (service) => service.status,
    getSearchText: (service) =>
      [service.orderNo, service.status, service.notes, service.deliveryDate].filter(Boolean).join(' '),
  });
}

export async function readRecentServicesFromCache(limit = 20) {
  const records = await readCacheRecords<Service>(cacheKeys.recentServices);
  return records.slice(0, limit);
}

export async function cacheLedgerEntries(records: LedgerEntry[]) {
  await replaceCacheRecords(cacheKeys.ledger, records, {
    getId: (entry) => entry.id,
    getTitle: (entry) => entry.refNo ?? entry.description ?? entry.entryDate,
    getSubtitle: (entry) => entry.entryDate,
    getSearchText: (entry) =>
      [entry.refNo, entry.description, entry.entryDate, entry.balanceDirection].filter(Boolean).join(' '),
  });
}

export async function readLedgerEntriesFromCache(limit = 100) {
  const records = await readCacheRecords<LedgerEntry>(cacheKeys.ledger);
  return records.slice(0, limit);
}

export async function cacheBankRecord(record: BankAccount) {
  await upsertCacheRecord(cacheKeys.banks, record, {
    getId: (bank) => bank.id,
    getTitle: (bank) => bank.name,
    getSubtitle: (bank) => bank.accountNumber,
    getSearchText: (bank) =>
      [bank.name, bank.accountName, bank.accountNumber, bank.branchName, bank.notes].filter(Boolean).join(' '),
  });
}

export async function cachePartyRecord(record: Party) {
  await upsertCacheRecord(cacheKeys.parties, record, {
    getId: (party) => party.id,
    getTitle: (party) => party.name,
    getSubtitle: (party) => party.phone,
    getSearchText: (party) =>
      [party.name, party.phone, party.type, party.address, party.email].filter(Boolean).join(' '),
  });
}

export async function cacheQuickExpenses(records: QuickExpense[]) {
  await replaceCacheRecords(cacheKeys.quickExpenses, records, {
    getId: (item) => item.id,
    getTitle: (item) => item.name,
    getSearchText: (item) => item.name,
  });
}

export async function readQuickExpensesFromCache(search?: string, limit = 250) {
  if (search?.trim()) {
    return searchCacheRecords<QuickExpense>(cacheKeys.quickExpenses, search, limit);
  }

  const records = await readCacheRecords<QuickExpense>(cacheKeys.quickExpenses);
  return records.slice(0, limit);
}

export async function addQuickExpenseLocally(categoryName: string): Promise<QuickExpense> {
  const record: QuickExpense = {
    id: generateId('quick-expense'),
    businessId: '',
    name: categoryName,
  };
  await upsertCacheRecord(cacheKeys.quickExpenses, record, {
    getId: (item) => item.id,
    getTitle: (item) => item.name,
    getSearchText: (item) => item.name,
  });
  return record;
}
