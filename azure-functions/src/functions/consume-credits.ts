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
  isCosmosPreconditionFailed,
} from '../shared/cosmosClient';
import { incrementUsage, GenerationType, FREE_GENERATION_TYPES } from '../shared/usageHelpers';

const MAX_CREDIT_CHARGE = CREDIT_COSTS.FOUR_K_GENERATION; // 5 credits max (for 4K)
const MAX_CREDIT_MUTATION_RETRIES = 3;

type UsageSnapshot = {
  yearMonth: string;
  totalUsed: number;
  freeRemaining: number;
};

async function readUsageSnapshot(userId: string): Promise<UsageSnapshot> {
  const yearMonth = getCurrentYearMonth();
  const documentId = getUsageDocumentId(userId, yearMonth);
  const usageContainer = getContainer('usage');

  try {
    const { resource } = await usageContainer.item(documentId, userId).read<UsageDocument>();
    const totalUsed = resource?.totalGenerations || 0;

    return {
      yearMonth,
      totalUsed,
      freeRemaining: Math.max(0, FREE_MONTHLY_LIMIT - totalUsed),
    };
  } catch (error: unknown) {
    if (!isCosmosNotFound(error)) {
      throw error;
    }

    return {
      yearMonth,
      totalUsed: 0,
      freeRemaining: FREE_MONTHLY_LIMIT,
    };
  }
}

async function readPurchasedCredits(userId: string): Promise<{
  creditsDoc: CreditsDocument | null;
  purchasedCredits: number;
}> {
  const creditsContainer = getContainer('credits');

  try {
    const { resource } = await creditsContainer.item(userId, userId).read<CreditsDocument>();
    return {
      creditsDoc: resource || null,
      purchasedCredits: resource?.purchasedCredits || 0,
    };
  } catch (error: unknown) {
    if (!isCosmosNotFound(error)) {
      throw error;
    }

    return {
      creditsDoc: null,
      purchasedCredits: 0,
    };
  }
}

function getPurchasedCreditsCondition(minimumBalance: number): string {
  return `from c where IS_DEFINED(c.purchasedCredits) AND c.purchasedCredits >= ${minimumBalance}`;
}

async function deductPurchasedCreditsAtomic(
  userId: string,
  purchasedToUse: number
): Promise<number> {
  const creditsContainer = getContainer('credits');
  const now = new Date().toISOString();

  const { resource } = await creditsContainer.item(userId, userId).patch<CreditsDocument>({
    condition: getPurchasedCreditsCondition(purchasedToUse),
    operations: [
      {
        op: 'incr',
        path: '/purchasedCredits',
        value: -purchasedToUse,
      },
      {
        op: 'set',
        path: '/updatedAt',
        value: now,
      },
    ],
  });

  return resource?.purchasedCredits ?? 0;
}

async function restorePurchasedCreditsAtomic(
  userId: string,
  purchasedToRestore: number,
  context: InvocationContext
): Promise<void> {
  const creditsContainer = getContainer('credits');
  const now = new Date().toISOString();

  try {
    await creditsContainer.item(userId, userId).patch<CreditsDocument>([
      {
        op: 'incr',
        path: '/purchasedCredits',
        value: purchasedToRestore,
      },
      {
        op: 'set',
        path: '/updatedAt',
        value: now,
      },
    ]);
  } catch (error) {
    context.error(`Failed to restore ${purchasedToRestore} purchased credits for user ${userId}:`, error);
  }
}

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
    const transactionsContainer = getContainer('credit_transactions');
    const userIsAdmin = isAdminUser(user.email, user.userId);
    const isFreeGeneration = FREE_GENERATION_TYPES.includes(generationType);
    const usageSnapshot = await readUsageSnapshot(user.userId);

    if (userIsAdmin) {
      return {
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          remaining: 999999,
          freeRemaining: 999999,
          purchasedCredits: 0,
          limit: 999999,
          used: usageSnapshot.totalUsed,
          yearMonth,
          generationMode,
          creditsCharged: 0,
          creditsUsed: {
            purchased: 0,
            free: 0,
          },
          isAdmin: true,
        }),
      };
    }

    let concurrencyConflict = false;

    for (let attempt = 0; attempt < MAX_CREDIT_MUTATION_RETRIES; attempt += 1) {
      const currentUsage = attempt === 0 ? usageSnapshot : await readUsageSnapshot(user.userId);
      const { creditsDoc, purchasedCredits } = await readPurchasedCredits(user.userId);
      const freeRemaining = currentUsage.freeRemaining;
      const totalUsed = currentUsage.totalUsed;
      const totalRemaining = freeRemaining + purchasedCredits;

      // 4K generation requires paid user status
      if (generationMode === '4k' && !canGenerate4K(creditsDoc, userIsAdmin)) {
        return {
          status: 403,
          headers,
          body: JSON.stringify({
            error: '4K generation requires at least 5 purchased credits. Free monthly credits do not unlock 4K.',
            code: '4K_REQUIRES_PAID',
            remaining: totalRemaining,
            freeRemaining,
            purchasedCredits,
          }),
        };
      }

      // Skip quota check for free generation types (e.g., materialIcon)
      if (!isFreeGeneration && totalRemaining < credits) {
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
            yearMonth: currentUsage.yearMonth,
          }),
        };
      }

      let purchasedToUse = 0;
      let freeToUse = 0;
      let newPurchasedCredits = purchasedCredits;
      let consumeTransactionId: string | null = null;

      if (!isFreeGeneration) {
        freeToUse = Math.min(credits, freeRemaining);
        purchasedToUse = credits - freeToUse;
      }

      try {
        if (purchasedToUse > 0) {
          newPurchasedCredits = await deductPurchasedCreditsAtomic(user.userId, purchasedToUse);

          const now = new Date().toISOString();
          consumeTransactionId = `consume_${user.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await transactionsContainer.items.create<CreditTransactionDocument>({
            id: consumeTransactionId,
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

        // Tracks all generations, even if paid from purchased credits.
        await incrementUsage(user.userId, generationType, credits);
      } catch (error) {
        const isConcurrentMutation =
          purchasedToUse > 0 &&
          (isCosmosPreconditionFailed(error) || isCosmosNotFound(error));

        if (isConcurrentMutation) {
          concurrencyConflict = true;
          continue;
        }

        if (purchasedToUse > 0) {
          await restorePurchasedCreditsAtomic(user.userId, purchasedToUse, context);

          if (consumeTransactionId) {
            try {
              await transactionsContainer.item(consumeTransactionId, user.userId).delete();
            } catch (deleteError) {
              if (!isCosmosNotFound(deleteError)) {
                context.warn(`Failed to remove consume transaction ${consumeTransactionId}:`, deleteError);
              }
            }
          }
        }

        throw error;
      }

      const newFreeRemaining = isFreeGeneration ? freeRemaining : Math.max(0, freeRemaining - freeToUse);
      const newTotalRemaining = newFreeRemaining + newPurchasedCredits;

      return {
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          remaining: isFreeGeneration ? totalRemaining : newTotalRemaining,
          freeRemaining: newFreeRemaining,
          purchasedCredits: newPurchasedCredits,
          limit: FREE_MONTHLY_LIMIT,
          used: isFreeGeneration ? totalUsed : totalUsed + credits,
          yearMonth: currentUsage.yearMonth,
          generationMode,
          creditsCharged: credits,
          creditsUsed: {
            purchased: purchasedToUse,
            free: freeToUse,
          },
          isAdmin: false,
        }),
      };
    }

    const latestUsage = await readUsageSnapshot(user.userId);
    const latestCredits = await readPurchasedCredits(user.userId);
    const latestRemaining = latestUsage.freeRemaining + latestCredits.purchasedCredits;

    return {
      status: concurrencyConflict ? 409 : 500,
      headers,
      body: JSON.stringify({
        error: concurrencyConflict
          ? 'Credits changed while this request was processing. Please try again.'
          : 'Internal server error',
        remaining: latestRemaining,
        freeRemaining: latestUsage.freeRemaining,
        purchasedCredits: latestCredits.purchasedCredits,
        limit: FREE_MONTHLY_LIMIT,
        used: latestUsage.totalUsed,
        yearMonth: latestUsage.yearMonth,
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
