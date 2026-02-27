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
  getPaidCreditBalance,
  consumePaidCredits,
} from '../shared/cosmosClient';
import { incrementUsage, GenerationType, FREE_GENERATION_TYPES } from '../shared/usageHelpers';

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

    const userIsAdmin = isAdminUser(user.email, user.userId);
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - totalUsed);
    const paidCredits = userIsAdmin ? 999999 : await getPaidCreditBalance(user.userId);
    const availableCredits = freeRemaining + paidCredits;
    const isFreeGeneration = FREE_GENERATION_TYPES.includes(generationType);
    const paidCreditsToConsume =
      !userIsAdmin && !isFreeGeneration
        ? Math.max(0, credits - freeRemaining)
        : 0;

    // Skip quota check for free generation types (e.g., materialIcon)
    if (!userIsAdmin && !isFreeGeneration && availableCredits < credits) {
      return {
        status: 429,
        headers,
        body: JSON.stringify({
          error: 'Not enough credits available.',
          remaining: availableCredits,
          limit: FREE_MONTHLY_LIMIT,
          used: totalUsed,
          freeRemaining,
          paidCredits,
          availableCredits,
          yearMonth,
        }),
      };
    }

    await incrementUsage(user.userId, generationType, credits);
    let paidCreditsRemaining: number | null = null;
    if (paidCreditsToConsume > 0) {
      const debitResult = await consumePaidCredits(user.userId, paidCreditsToConsume);
      if (debitResult.success) {
        paidCreditsRemaining = debitResult.balance;
      }
    }

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        // Free generation types don't affect the remaining count
        remaining: isFreeGeneration ? availableCredits : Math.max(0, availableCredits - credits),
        limit: FREE_MONTHLY_LIMIT,
        used: isFreeGeneration ? totalUsed : totalUsed + credits,
        freeRemaining: isFreeGeneration
          ? freeRemaining
          : Math.max(0, FREE_MONTHLY_LIMIT - (totalUsed + credits)),
        paidCredits: paidCreditsRemaining ?? paidCredits,
        availableCredits: isFreeGeneration
          ? availableCredits
          : Math.max(0, availableCredits - credits),
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
