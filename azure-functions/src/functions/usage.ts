/**
 * Usage Function
 *
 * GET /api/usage
 *
 * Returns the user's detailed usage breakdown for the current month.
 * Requires authentication.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, ValidatedUser } from '../shared/validateToken';
import {
  getContainer,
  getUsageDocumentId,
  getCurrentYearMonth,
  UsageDocument,
  isCosmosNotFound,
} from '../shared/cosmosClient';

export async function usage(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Usage function processed a request.');

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

  try {
    const usageContainer = getContainer('usage');

    let usageData: UsageDocument['generationCounts'] = {
      moodboard: 0,
      applyMaterials: 0,
      upscale: 0,
      materialIcon: 0,
      sustainabilityBriefing: 0,
    };
    let total = 0;

    try {
      // Partition key is userId, document id is "userId:YYYY-MM"
      const { resource } = await usageContainer.item(documentId, user.userId).read<UsageDocument>();
      if (resource) {
        usageData = resource.generationCounts || usageData;
        total = resource.totalGenerations || 0;
      }
    } catch (error: unknown) {
      // If document doesn't exist, return zeros
      if (!isCosmosNotFound(error)) {
        throw error;
      }
    }

    return {
      status: 200,
      body: JSON.stringify({
        ...usageData,
        total,
        yearMonth,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.error('Error fetching usage:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

app.http('usage', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: usage,
});
