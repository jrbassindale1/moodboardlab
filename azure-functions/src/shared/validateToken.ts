/**
 * Clerk Token Validation Middleware
 *
 * This module validates JWT tokens from Clerk for authenticated API requests.
 *
 * Optional environment variables:
 * - CLERK_SECRET_KEY: Clerk secret key (used to resolve user email when JWT omits it)
 *
 * Optional (recommended) environment variables:
 * - CLERK_ISSUER: Expected JWT issuer (iss)
 * - CLERK_AUDIENCE: Expected JWT audience (aud), comma-separated for multiple
 */

import { HttpRequest } from '@azure/functions';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Clerk's JWKS endpoint
const CLERK_JWKS_URL = 'https://clerk.moodboardlab.com/.well-known/jwks.json';
const CLERK_API_BASE_URL = (process.env.CLERK_API_BASE_URL || 'https://api.clerk.com').replace(/\/+$/, '');

const emailCache = new Map<string, { email: string; expiresAt: number }>();
const EMAIL_CACHE_TTL_MS = 10 * 60 * 1000;

// Initialize JWKS client for fetching Clerk signing keys
let client: ReturnType<typeof jwksClient> | null = null;

function getClient(): ReturnType<typeof jwksClient> {
  if (!client) {
    // Use the Clerk instance URL from environment or default
    const clerkUrl = process.env.CLERK_JWKS_URL || CLERK_JWKS_URL;
    client = jwksClient({
      jwksUri: clerkUrl,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }
  return client;
}

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    getClient().getSigningKey(header.kid!, (err, key) => {
      if (err) {
        reject(err);
        return;
      }
      if (!key) {
        reject(new Error('Signing key not found'));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

function getVerifyOptions(): jwt.VerifyOptions {
  const issuer = process.env.CLERK_ISSUER || process.env.CLERK_JWT_ISSUER;
  const audienceRaw = process.env.CLERK_AUDIENCE || process.env.CLERK_JWT_AUDIENCE;
  const audiences = audienceRaw
    ? audienceRaw.split(',').map((value) => value.trim()).filter(Boolean)
    : [];

  const options: jwt.VerifyOptions = {
    algorithms: ['RS256'],
  };

  if (issuer) {
    options.issuer = issuer;
  }

  if (audiences.length === 1) {
    options.audience = audiences[0];
  } else if (audiences.length > 1) {
    options.audience = audiences as [string, ...string[]];
  }

  return options;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown): string {
  const normalized = asString(value).toLowerCase();
  return normalized.includes('@') ? normalized : '';
}

function extractEmailFromJwtPayload(payload: jwt.JwtPayload & Record<string, unknown>): string {
  const directCandidates: unknown[] = [
    payload.email,
    payload.email_address,
    payload.primary_email_address,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeEmail(candidate);
    if (normalized) return normalized;
  }

  const emailAddresses = payload.email_addresses;
  if (Array.isArray(emailAddresses)) {
    for (const entry of emailAddresses) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const normalized = normalizeEmail(record.email_address || record.email);
      if (normalized) return normalized;
    }
  }

  return '';
}

async function fetchClerkPrimaryEmail(userId: string): Promise<string> {
  const normalizedUserId = asString(userId);
  if (!normalizedUserId) return '';

  const now = Date.now();
  const cached = emailCache.get(normalizedUserId);
  if (cached && cached.expiresAt > now) {
    return cached.email;
  }

  const secretKey = asString(process.env.CLERK_SECRET_KEY);
  if (!secretKey) return '';

  try {
    const response = await fetch(`${CLERK_API_BASE_URL}/v1/users/${encodeURIComponent(normalizedUserId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to load Clerk user ${normalizedUserId}. Status: ${response.status}`);
      return '';
    }

    const data = await response.json() as {
      primary_email_address_id?: string;
      email_addresses?: Array<{ id?: string; email_address?: string }>;
    };

    let resolved = '';
    if (Array.isArray(data.email_addresses)) {
      if (data.primary_email_address_id) {
        const primaryMatch = data.email_addresses.find((entry) => entry?.id === data.primary_email_address_id);
        resolved = normalizeEmail(primaryMatch?.email_address);
      }
      if (!resolved) {
        resolved = normalizeEmail(data.email_addresses[0]?.email_address);
      }
    }

    if (resolved) {
      emailCache.set(normalizedUserId, {
        email: resolved,
        expiresAt: now + EMAIL_CACHE_TTL_MS,
      });
    }

    return resolved;
  } catch (error) {
    console.warn(`Failed to fetch Clerk primary email for ${normalizedUserId}:`, error);
    return '';
  }
}

export interface ValidatedUser {
  userId: string;
  email: string;
  displayName: string;
}

/**
 * Validates the Authorization header and extracts user information from Clerk JWT
 * Returns null if no valid token is found (allows anonymous access)
 */
export async function validateToken(req: HttpRequest): Promise<ValidatedUser | null> {
  const authHeader = req.headers.get('authorization');

  // No auth header - anonymous user
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header) {
      console.error('Failed to decode token header');
      return null;
    }

    // Get signing key from Clerk's JWKS
    const signingKey = await getSigningKey(decoded.header);

    // Verify token
    const verified = jwt.verify(token, signingKey, getVerifyOptions()) as jwt.JwtPayload & Record<string, unknown>;
    const userId = asString(verified.sub) || 'unknown';
    const emailFromToken = extractEmailFromJwtPayload(verified);
    const email = emailFromToken || (userId !== 'unknown' ? await fetchClerkPrimaryEmail(userId) : '');
    const displayName = asString(verified.name) || asString(verified.firstName) || '';
    if (!email && userId !== 'unknown') {
      console.warn(`Validated token for ${userId} without resolvable email claim.`);
    }

    // Extract user info from Clerk token claims
    // Clerk tokens have 'sub' as user ID and may have additional claims
    return {
      userId,
      email,
      displayName,
    };
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}

/**
 * Requires authentication - returns error response if not authenticated
 */
export async function requireAuth(req: HttpRequest): Promise<ValidatedUser | { status: number; body: string }> {
  const user = await validateToken(req);
  if (!user) {
    return {
      status: 401,
      body: JSON.stringify({ error: 'Unauthorized', message: 'Valid authentication required' }),
    };
  }
  return user;
}
