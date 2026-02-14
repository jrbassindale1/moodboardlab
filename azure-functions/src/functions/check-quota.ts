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

  // Admin users get unlimited credits
  if (isAdminUser(user.email)) {
    return {
      status: 200,
      body: JSON.stringify({
        canGenerate: true,
        remaining: 999999,
        limit: 999999,
        used: 0,
        yearMonth,
        isAdmin: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const usageContainer = getContainer('usage');

    let totalUsed = 0;

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

    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - totalUsed);

    return {
      status: 200,
      body: JSON.stringify({
        canGenerate: remaining > 0,
        remaining,
        limit: FREE_MONTHLY_LIMIT,
        used: totalUsed,
        yearMonth,
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
