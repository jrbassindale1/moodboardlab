import { createHash } from 'crypto';
import type { ValidatedUser } from './validateToken';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 32);
}

/**
 * Returns a stable key for quota usage across account recreation.
 *
 * - Preferred: hash of normalized email (stable if user re-registers with same email)
 * - Fallback: auth provider userId (when email is unavailable)
 */
export function getBillingIdentityKey(user: Pick<ValidatedUser, 'userId' | 'email'>): string {
  const email = typeof user.email === 'string' ? normalizeEmail(user.email) : '';
  if (email) {
    return `email_${hashEmail(email)}`;
  }

  return user.userId;
}
