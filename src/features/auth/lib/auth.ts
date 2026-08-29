export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 60;
export const PASSWORD_MIN_LENGTH = 8;
export const PHONE_MIN_DIGITS = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export type PasswordIssue = 'length' | 'lowercase' | 'uppercase' | 'number';

export function getPasswordIssues(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push('length');
  if (!/[a-z]/.test(password)) issues.push('lowercase');
  if (!/[A-Z]/.test(password)) issues.push('uppercase');
  if (!/\d/.test(password)) issues.push('number');
  return issues;
}

export function isStrongPassword(password: string) {
  return getPasswordIssues(password).length === 0;
}

export function getPasswordHint(password: string) {
  if (!password) return '';
  const issues = getPasswordIssues(password);
  if (issues.includes('length')) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (issues.includes('uppercase')) return 'Add an uppercase letter.';
  if (issues.includes('lowercase')) return 'Add a lowercase letter.';
  if (issues.includes('number')) return 'Add a number.';
  return '';
}

export function getLoginError(email: string, password: string) {
  if (!normalizeEmail(email)) return 'Enter your email address.';
  if (!isValidEmail(email)) return 'Enter a valid email address.';
  if (!password) return 'Enter your password.';
  return '';
}

export function getRegisterAccountError(form: {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}) {
  if (form.name.trim().length < 2) return 'Enter your full name.';
  if (!isValidEmail(form.email)) return 'Enter a valid email address.';
  if (digitsOnly(form.phone).length < PHONE_MIN_DIGITS) {
    return `Phone number needs at least ${PHONE_MIN_DIGITS} digits.`;
  }
  if (!isStrongPassword(form.password)) return getPasswordHint(form.password) || 'Choose a stronger password.';
  if (form.password !== form.confirmPassword) return 'Passwords do not match.';
  return '';
}

export function getWorkspaceError(form: {
  accountKind: 'personal' | 'business';
  businessName: string;
  businessType: string;
}) {
  if (form.accountKind === 'personal') return '';
  if (!form.businessName.trim()) return 'Enter your business name.';
  if (!form.businessType) return 'Choose a business type.';
  return '';
}

export function resolveAuthMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return fallback;
  if (/email already in use/i.test(message)) return 'This email already has an account. Sign in or reset your password.';
  if (/invalid credentials|incorrect password|invalid email or password/i.test(message)) {
    return 'Email or password is incorrect.';
  }
  if (/invalid or expired/i.test(message)) return 'That code is invalid or has expired. Request a new one.';
  if (/too many requests|cooldown|try again later/i.test(message)) {
    return 'Please wait a moment before requesting another code.';
  }
  return message;
}
