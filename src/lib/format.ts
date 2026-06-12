import { endOfMonth, endOfWeek, endOfYear, format, parseISO, startOfMonth, startOfWeek, startOfYear, subWeeks } from 'date-fns';

export function formatCurrency(value: number, currency = 'NPR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `Rs ${Math.round(value || 0).toLocaleString('en-IN')}`;
  }
}

export function formatCompactNumber(value: number) {
  try {
    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${Math.round(value || 0)}`;
  }
}

export function todayIso() {
  return localIsoDate();
}

export function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function prettyDate(isoDate?: string) {
  if (!isoDate) return 'Today';

  try {
    return format(parseISO(isoDate), 'dd MMM yyyy');
  } catch {
    return isoDate;
  }
}

export function toInputNumber(value: string) {
  const normalized = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(normalized) ? normalized : 0;
}

export function pluralize(label: string, value: number) {
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

export function relativeSyncTime(isoDate?: string) {
  if (!isoDate) return 'now';

  const deltaMs = Date.now() - new Date(isoDate).getTime();
  const deltaMinutes = Math.max(0, Math.floor(deltaMs / 60000));

  if (deltaMinutes < 1) return 'now';
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  return `${Math.floor(deltaHours / 24)}d ago`;
}

export type DatePeriod = 'today' | 'this_week' | 'previous_week' | 'this_month' | 'this_year' | 'previous_year';

export function getRangeForPeriod(period: DatePeriod): { from: string; to: string } {
  const now = new Date();
  let fromDate: Date;
  let toDate: Date = now;

  switch (period) {
    case 'today':
      fromDate = now;
      toDate = now;
      break;
    case 'this_week':
      fromDate = startOfWeek(now, { weekStartsOn: 0 });
      toDate = endOfWeek(now, { weekStartsOn: 0 });
      break;
    case 'previous_week':
      const prevWeek = subWeeks(now, 1);
      fromDate = startOfWeek(prevWeek, { weekStartsOn: 0 });
      toDate = endOfWeek(prevWeek, { weekStartsOn: 0 });
      break;
    case 'this_month':
      fromDate = startOfMonth(now);
      toDate = endOfMonth(now);
      break;
    case 'this_year':
      fromDate = startOfYear(now);
      toDate = endOfYear(now);
      break;
    case 'previous_year':
      const prevYear = new Date();
      prevYear.setFullYear(now.getFullYear() - 1);
      fromDate = startOfYear(prevYear);
      toDate = endOfYear(prevYear);
      break;
    default:
      fromDate = now;
      toDate = now;
  }

  return {
    from: localIsoDate(fromDate),
    to: localIsoDate(toDate),
  };
}
