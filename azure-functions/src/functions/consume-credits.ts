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
  CreditsDocument,
  CreditTransactionDocument,
  isCosmosNotFound,
  isAdminUser,
  GenerationMode,
  getGenerationCost,
  canGenerate4K,
  CREDIT_COSTS,
} from '../shared/cosmosClient';
import { incrementUsage, GenerationType, FREE_GENERATION_TYPES } from '../shared/usageHelpers';

const MAX_CREDIT_CHARGE = CREDIT_COSTS.FOUR_K_GENERATION; // 5 credits max (for 4K)

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
      generationMode?: GenerationMode;
      credits?: number;
      reason?: string;
    };

    const generationType = body.generationType || 'materialIcon';
    const generationMode: GenerationMode = body.generationMode || 'standard';

    // Calculate credits based on generation mode if not explicitly provided
    const modeCredits = getGenerationCost(generationMode);
    const rawCredits = Number.isFinite(body.credits) ? Number(body.credits) : modeCredits;
    const credits = Math.max(1, Math.min(MAX_CREDIT_CHARGE, Math.round(rawCredits)));

    const yearMonth = getCurrentYearMonth();
    const documentId = getUsageDocumentId(user.userId, yearMonth);
    const usageContainer = getContainer('usage');
    const creditsContainer = getContainer('credits');
    const transactionsContainer = getContainer('credit_transactions');

    let totalUsed = 0;
    let purchasedCredits = 0;
    let creditsDoc: CreditsDocument | null = null;

    // Get monthly usage
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

    // Get purchased credits
    try {
      const { resource } = await creditsContainer
        .item(user.userId, user.userId)
        .read<CreditsDocument>();
      if (resource) {
        creditsDoc = resource;
        purchasedCredits = resource.purchasedCredits || 0;
      }
    } catch (error: unknown) {
      if (!isCosmosNotFound(error)) {
        throw error;
      }
    }

    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - totalUsed);
    const totalRemaining = freeRemaining + purchasedCredits;
    const userIsAdmin = isAdminUser(user.email, user.userId);
    const isFreeGeneration = FREE_GENERATION_TYPES.includes(generationType);

    // 4K generation requires paid user status
    if (generationMode === '4k' && !canGenerate4K(creditsDoc, userIsAdmin)) {
      return {
        status: 403,
        headers,
        body: JSON.stringify({
          error: '4K generation is available to paid users only. Purchase credits to unlock 4K.',
          code: '4K_REQUIRES_PAID',
          remaining: totalRemaining,
          freeRemaining,
          purchasedCredits,
        }),
      };
    }

    // Skip quota check for free generation types (e.g., materialIcon)
    if (!userIsAdmin && !isFreeGeneration && totalRemaining < credits) {
      return {
        status: 429,
        headers,
        body: JSON.stringify({
          error: 'Generation limit reached. Purchase more credits to continue.',
          remaining: totalRemaining,
          freeRemaining,
          purchasedCredits,
          limit: FREE_MONTHLY_LIMIT,
          used: totalUsed,
          yearMonth,
        }),
      };
    }

    // Determine how to split the credit consumption
    // Priority: Use purchased credits first (they don't expire), then free monthly
    let purchasedToUse = 0;
    let freeToUse = 0;

    if (!isFreeGeneration && !userIsAdmin) {
      // First use purchased credits
      purchasedToUse = Math.min(credits, purchasedCredits);
      // Then use free credits for the remainder
      freeToUse = credits - purchasedToUse;

      // Deduct purchased credits if any were used
      if (purchasedToUse > 0 && creditsDoc) {
        const now = new Date().toISOString();
        await creditsContainer.item(user.userId, user.userId).replace<CreditsDocument>({
          ...creditsDoc,
          purchasedCredits: creditsDoc.purchasedCredits - purchasedToUse,
          updatedAt: now,
        });

        // Record the consumption transaction
        const txnId = `consume_${user.userId}_${Date.now()}`;
        await transactionsContainer.items.create<CreditTransactionDocument>({
          id: txnId,
          userId: user.userId,
          type: 'consume',
          credits: -purchasedToUse,
          amountPence: 0,
          stripeSessionId: null,
          stripePaymentIntentId: null,
          createdAt: now,
          metadata: { generationType, generationMode, reason: body.reason },
        });
      }
    }

    // Admin users have unlimited usage and should not accumulate monthly usage.
    if (!userIsAdmin) {
      // Tracks all generations, even if paid from purchased credits.
      await incrementUsage(user.userId, generationType, credits);
    }

    // Calculate new remaining values
    const newPurchasedCredits = purchasedCredits - purchasedToUse;
    const newFreeRemaining = isFreeGeneration ? freeRemaining : Math.max(0, freeRemaining - freeToUse);
    const newTotalRemaining = newFreeRemaining + newPurchasedCredits;
    const effectiveRemaining = userIsAdmin
      ? 999999
      : (isFreeGeneration ? totalRemaining : newTotalRemaining);
    const effectiveFreeRemaining = userIsAdmin ? 999999 : newFreeRemaining;

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        remaining: effectiveRemaining,
        freeRemaining: effectiveFreeRemaining,
        purchasedCredits: newPurchasedCredits,
        limit: userIsAdmin ? 999999 : FREE_MONTHLY_LIMIT,
        used: userIsAdmin ? totalUsed : (isFreeGeneration ? totalUsed : totalUsed + credits),
        yearMonth,
        generationMode,
        creditsCharged: userIsAdmin ? 0 : credits,
        creditsUsed: {
          purchased: purchasedToUse,
          free: freeToUse,
        },
        isAdmin: userIsAdmin,
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
