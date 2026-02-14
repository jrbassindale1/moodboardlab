/**
 * Clerk Authentication Configuration
 *
 * Required environment variables:
 * - VITE_CLERK_PUBLISHABLE_KEY: Your Clerk publishable key
 */

export const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
export const isAuthBypassEnabled = String(import.meta.env.VITE_DISABLE_AUTH || '').toLowerCase() === 'true';
export const isClerkAuthEnabled = !isAuthBypassEnabled && Boolean(clerkPubKey);

if (!clerkPubKey) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}

if (isAuthBypassEnabled && import.meta.env.DEV) {
  console.warn('Authentication bypass is enabled (VITE_DISABLE_AUTH=true)');
}
