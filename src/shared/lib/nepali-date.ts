import { adToBs, bsToAd } from '@sbmdkl/nepali-date-converter';

export const BS_MONTHS = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत्र',
];

export const BS_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Ashoj',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

export const BS_DAYS_SHORT = ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'];
export const BS_DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Converts an AD ISO date string (YYYY-MM-DD) to a BS date string.
 * Returns the BS date formatted as "DD MonthName YYYY" (e.g. "15 Jestha 2081" or "15 बैशाख 2081").
 * If conversion fails, returns the original date.
 */
export function adDateToBs(isoDate: string, useNepaliMonthNames = false): string {
  try {
    const rawIso = String(isoDate).slice(0, 10);
    const bsDate = adToBs(rawIso); // returns "YYYY-MM-DD"
    const [year, month, day] = bsDate.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = useNepaliMonthNames
      ? BS_MONTHS[monthIndex] ?? BS_MONTHS_EN[monthIndex] ?? month
      : BS_MONTHS_EN[monthIndex] ?? month;
    return `${parseInt(day, 10)} ${monthName} ${year}`;
  } catch {
    return isoDate;
  }
}

/**
 * Converts an AD ISO date string to a short BS date string (YYYY-MM-DD format).
 */
export function adDateToBsRaw(isoDate: string): string {
  try {
    const rawIso = String(isoDate).slice(0, 10);
    return adToBs(rawIso);
  } catch {
    return isoDate;
  }
}

/**
 * Converts a BS date string (YYYY-MM-DD format) to an AD ISO date string.
 */
export function bsDateToAd(bsIsoDate: string): string {
  try {
    const rawBs = String(bsIsoDate).slice(0, 10);
    return bsToAd(rawBs);
  } catch {
    return bsIsoDate;
  }
}

/**
 * Returns today's date in BS as a raw "YYYY-MM-DD" string.
 */
export function todayBsRaw(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return adDateToBsRaw(`${year}-${month}-${day}`);
}

/**
 * Get calendar grid info for a given BS year and month (1-12).
 */
export function getBsMonthInfo(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  try {
    const d1Ad = bsToAd(`${year}-${pad(month)}-01`);
    const d1Obj = new Date(`${d1Ad}T00:00:00Z`);
    const firstDayOfWeek = d1Obj.getUTCDay(); // 0 = Sunday, 6 = Saturday

    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextD1Ad = bsToAd(`${nextYear}-${pad(nextMonth)}-01`);
    const nextD1Obj = new Date(`${nextD1Ad}T00:00:00Z`);
    const daysInMonth = Math.round((nextD1Obj.getTime() - d1Obj.getTime()) / (1000 * 60 * 60 * 24));
    return { firstDayOfWeek, daysInMonth: Math.max(28, Math.min(32, daysInMonth)) };
  } catch {
    return { firstDayOfWeek: 0, daysInMonth: 30 };
  }
}
