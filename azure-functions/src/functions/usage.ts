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
import { getBillingIdentityKey } from '../shared/billingIdentity';

type GenerationCounts = UsageDocument['generationCounts'];

function addGenerationCounts(base: GenerationCounts, next?: GenerationCounts): GenerationCounts {
  if (!next) return base;
  return {
    moodboard: base.moodboard + (next.moodboard || 0),
    applyMaterials: base.applyMaterials + (next.applyMaterials || 0),
    upscale: base.upscale + (next.upscale || 0),
    materialIcon: base.materialIcon + (next.materialIcon || 0),
    materialDetection: base.materialDetection + (next.materialDetection || 0),
    sustainabilityBriefing: base.sustainabilityBriefing + (next.sustainabilityBriefing || 0),
    precedentSearch: base.precedentSearch + (next.precedentSearch || 0),
  };
}

async function readUsageForIdentity(
  usageContainer: ReturnType<typeof getContainer>,
  identityKey: string,
  yearMonth: string
): Promise<{ counts: GenerationCounts; total: number }> {
  const empty: GenerationCounts = {
    moodboard: 0,
    applyMaterials: 0,
    upscale: 0,
    materialIcon: 0,
    materialDetection: 0,
    sustainabilityBriefing: 0,
    precedentSearch: 0,
  };

  const documentId = getUsageDocumentId(identityKey, yearMonth);

  try {
    const { resource } = await usageContainer.item(documentId, identityKey).read<UsageDocument>();
    return {
      counts: resource?.generationCounts || empty,
      total: resource?.totalGenerations || 0,
    };
  } catch (error: unknown) {
    if (!isCosmosNotFound(error)) {
      throw error;
    }
    return {
      counts: empty,
      total: 0,
    };
  }
}

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
  const billingIdentityKey = getBillingIdentityKey(user);
  const yearMonth = getCurrentYearMonth();

  try {
    const usageContainer = getContainer('usage');

    let usageData: UsageDocument['generationCounts'] = {
      moodboard: 0,
      applyMaterials: 0,
      upscale: 0,
      materialIcon: 0,
      materialDetection: 0,
      sustainabilityBriefing: 0,
      precedentSearch: 0,
    };
    let total = 0;

    const billingUsage = await readUsageForIdentity(usageContainer, billingIdentityKey, yearMonth);
    usageData = addGenerationCounts(usageData, billingUsage.counts);
    total += billingUsage.total;

    if (billingIdentityKey !== user.userId) {
      // Rollout safety: include legacy userId-keyed usage for the current month.
      const legacyUsage = await readUsageForIdentity(usageContainer, user.userId, yearMonth);
      usageData = addGenerationCounts(usageData, legacyUsage.counts);
      total += legacyUsage.total;
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
