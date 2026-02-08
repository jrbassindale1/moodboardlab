/**
 * Clerk Token Validation Middleware
 *
 * This module validates JWT tokens from Clerk for authenticated API requests.
 *
 * Required environment variables:
 * - CLERK_SECRET_KEY: Your Clerk secret key (for verifying tokens)
 */

import { HttpRequest } from '@azure/functions';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Clerk's JWKS endpoint
const CLERK_JWKS_URL = 'https://clerk.moodboardlab.com/.well-known/jwks.json';

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
    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    // Extract user info from Clerk token claims
    // Clerk tokens have 'sub' as user ID and may have additional claims
    return {
      userId: verified.sub || 'unknown',
      email: verified.email as string || '',
      displayName: verified.name as string || verified.firstName as string || '',
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
