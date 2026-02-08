/**
 * Clerk Authentication Configuration
 *
 * Required environment variables:
 * - VITE_CLERK_PUBLISHABLE_KEY: Your Clerk publishable key
 */

export const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

if (!clerkPubKey) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}
