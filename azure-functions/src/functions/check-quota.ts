/**
 * Check Quota Function
 *
 * GET /api/check-quota
 *
 * Returns the user's current quota status for the month.
 * Requires authentication.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, ValidatedUser } from '../shared/validateToken';
import {
  getContainer,
  getUsageDocumentId,
  getCurrentYearMonth,
  FREE_MONTHLY_LIMIT,
  UsageDocument,
  CreditsDocument,
  isCosmosNotFound,
  isAdminUser,
} from '../shared/cosmosClient';

export async function checkQuota(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Check quota function processed a request.');

  // Require authentication
  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      body: authResult.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const user = authResult as ValidatedUser;
  const yearMonth = getCurrentYearMonth();
  const documentId = getUsageDocumentId(user.userId, yearMonth);

  const userIsAdmin = isAdminUser(user.email, user.userId);

  try {
    const usageContainer = getContainer('usage');
    const creditsContainer = getContainer('credits');

    let totalUsed = 0;
    let purchasedCredits = 0;

    // Get monthly usage
    try {
      // Partition key is userId, document id is "userId:YYYY-MM"
      const { resource } = await usageContainer.item(documentId, user.userId).read<UsageDocument>();
      if (resource) {
        totalUsed = resource.totalGenerations || 0;
      }
    } catch (error: unknown) {
      // If document doesn't exist, user has 0 usage
      if (!isCosmosNotFound(error)) {
        throw error;
      }
    }

    // Get purchased credits (non-expiring)
    try {
      const { resource: creditsDoc } = await creditsContainer
        .item(user.userId, user.userId)
        .read<CreditsDocument>();
      if (creditsDoc) {
        purchasedCredits = creditsDoc.purchasedCredits || 0;
      }
    } catch (error: unknown) {
      if (!isCosmosNotFound(error)) {
        throw error;
      }
    }

    // Free monthly credits remaining
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - totalUsed);
    // Total available = free + purchased
    const totalRemaining = freeRemaining + purchasedCredits;

    // Admin users get unlimited free credits but still show purchased credits
    const effectiveRemaining = userIsAdmin ? 999999 : totalRemaining;
    const effectiveFreeRemaining = userIsAdmin ? 999999 : freeRemaining;

    return {
      status: 200,
      body: JSON.stringify({
        canGenerate: userIsAdmin || totalRemaining > 0,
        remaining: effectiveRemaining,
        limit: userIsAdmin ? 999999 : FREE_MONTHLY_LIMIT,
        used: totalUsed,
        yearMonth,
        freeRemaining: effectiveFreeRemaining,
        purchasedCredits,
        isAdmin: userIsAdmin,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.error('Error checking quota:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

app.http('check-quota', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: checkQuota,
});
