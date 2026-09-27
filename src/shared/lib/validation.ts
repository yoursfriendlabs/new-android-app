/**
 * Field checks shared by every create and edit form.
 *
 * Each returns the sentence to show under the field, or '' when the value is
 * fine, so a form builds its whole error map in one object and passes each entry
 * straight to FormField's `error`. Keeping them here means "enter an amount
 * greater than zero" reads the same on a bill, an expense and a salary.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

/** True when any field in the map carries a message. */
export function hasFieldError(errors: FieldErrors) {
  return Object.values(errors).some((message) => Boolean(message));
}

/** The first message in the map, for a summary line or a toast. */
export function firstFieldError(errors: FieldErrors) {
  return Object.values(errors).find((message) => Boolean(message)) ?? '';
}

export function digitsOnly(value: string) {
  return String(value ?? '').replace(/\D/g, '');
}

export function requiredText(value: string, message: string) {
  return String(value ?? '').trim() ? '' : message;
}

export function minLengthText(value: string, min: number, message: string) {
  return String(value ?? '').trim().length >= min ? '' : message;
}

/** Empty is allowed; a typed address has to look like one. */
export function optionalEmail(value: string, message = 'Enter a valid email address.') {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return EMAIL_PATTERN.test(trimmed.toLowerCase()) ? '' : message;
}

export function requiredEmail(value: string) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'Enter an email address.';
  return optionalEmail(trimmed);
}

/** Empty is allowed; a typed number needs enough digits to dial. */
export function optionalPhone(value: string, minDigits = 7) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const digits = digitsOnly(trimmed);
  if (!digits) return 'A phone number is only digits.';
  return digits.length >= minDigits ? '' : `A phone number needs at least ${minDigits} digits.`;
}

export function requiredPhone(value: string, minDigits = 10) {
  if (!String(value ?? '').trim()) return 'Enter a phone number.';
  return optionalPhone(value, minDigits);
}

/**
 * Nepal issues 9-digit PAN and VAT numbers. A shorter one is usually a typo but
 * not always, so the length is a hint under the field and only letters in the
 * number are treated as a mistake.
 */
export function optionalPanVat(value: string) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/[^\d\s-]/.test(trimmed)) return 'A PAN or VAT number is only digits.';
  return '';
}

export function panVatHint(value: string) {
  const digits = digitsOnly(value);
  if (!digits || digits.length === 9) return '';
  return 'Nepal PAN and VAT numbers are 9 digits — check this one.';
}

/** For money and quantity fields typed as text. */
export function positiveNumber(value: string | number, message = 'Enter an amount greater than zero.') {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) return 'Enter a number.';
  return parsed > 0 ? '' : message;
}

export function nonNegativeNumber(value: string | number, message = 'Enter zero or more.') {
  const trimmed = typeof value === 'number' ? value : String(value ?? '').trim();
  if (trimmed === '') return '';
  const parsed = typeof trimmed === 'number' ? trimmed : Number(trimmed);
  if (!Number.isFinite(parsed)) return 'Enter a number.';
  return parsed >= 0 ? '' : message;
}

/** An optional number field: blank is fine, nonsense is not. */
export function optionalNumber(value: string, message = 'Enter a number.') {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return Number.isFinite(Number(trimmed)) ? '' : message;
}

export function atMost(value: string | number, ceiling: number, message: string) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) return '';
  return parsed <= ceiling ? '' : message;
}
