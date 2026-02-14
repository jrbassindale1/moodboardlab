/**
 * Consume Credits Function
 *
 * POST /api/consume-credits
 *
 * Decrements monthly quota by an arbitrary credit count.
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
import { incrementUsage, GenerationType } from '../shared/usageHelpers';

const MAX_CREDIT_CHARGE = 5;

export async function consumeCredits(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Consume credits function processed a request.');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      body: authResult.body,
      headers,
    };
  }

  const user = authResult as ValidatedUser;

  try {
    const body = await req.json() as {
      generationType?: GenerationType;
      credits?: number;
      reason?: string;
    };

    const generationType = body.generationType || 'materialIcon';
    const rawCredits = Number.isFinite(body.credits) ? Number(body.credits) : 1;
    const credits = Math.max(1, Math.min(MAX_CREDIT_CHARGE, Math.round(rawCredits)));

    const yearMonth = getCurrentYearMonth();
    const documentId = getUsageDocumentId(user.userId, yearMonth);
    const usageContainer = getContainer('usage');

    let totalUsed = 0;
    try {
      const { resource } = await usageContainer.item(documentId, user.userId).read<UsageDocument>();
      if (resource) {
        totalUsed = resource.totalGenerations || 0;
      }
    } catch (error: unknown) {
      if (!isCosmosNotFound(error)) {
        throw error;
      }
    }

    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - totalUsed);
    const userIsAdmin = isAdminUser(user.email);

    if (!userIsAdmin && remaining < credits) {
      return {
        status: 429,
        headers,
        body: JSON.stringify({
          error: 'Monthly generation limit reached.',
          remaining,
          limit: FREE_MONTHLY_LIMIT,
          used: totalUsed,
          yearMonth,
        }),
      };
    }

    await incrementUsage(user.userId, generationType, credits);

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        remaining: Math.max(0, remaining - credits),
        limit: FREE_MONTHLY_LIMIT,
        used: totalUsed + credits,
        yearMonth,
      }),
    };
  } catch (error) {
    context.error('Error consuming credits:', error);
    return {
      status: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

app.http('consume-credits', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: consumeCredits,
});
