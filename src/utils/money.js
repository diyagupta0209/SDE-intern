import { AppError } from './AppError.js';

const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function canonicalize(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new AppError(
        'Amount must be a positive number with up to 2 decimal places',
        400,
        'VALIDATION_ERROR',
      );
    }
    const text = value.toString();
    if (/e/i.test(text)) {
      throw new AppError(
        'Amount must be a positive number with up to 2 decimal places',
        400,
        'VALIDATION_ERROR',
      );
    }
    return text;
  }
  return String(value ?? '').trim();
}

export function toCents(value) {
  const raw = canonicalize(value);
  if (!AMOUNT_PATTERN.test(raw)) {
    throw new AppError(
      'Amount must be a positive number with up to 2 decimal places',
      400,
      'VALIDATION_ERROR',
    );
  }
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_000) {
    throw new AppError('Amount is out of range', 400, 'VALIDATION_ERROR');
  }
  if (cents <= 0) {
    throw new AppError('Amount must be greater than zero', 400, 'VALIDATION_ERROR');
  }
  return cents;
}

export function fromCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export function signedCents(type, amountCents) {
  return type === 'income' ? amountCents : -amountCents;
}
