/**
 * Save Generation Azure Function
 *
 * Saves generated images to blob storage and tracks them for authenticated users.
 * - Validates JWT token for authenticated requests
 * - Saves image to Azure Blob Storage
 * - Records generation in CosmosDB for user history
 * - Increments usage count
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, ValidatedUser } from '../shared/validateToken';
import { incrementUsage, saveGenerationRecord, GenerationType, FREE_GENERATION_TYPES } from '../shared/usageHelpers';
import {
  getContainer,
  getCurrentYearMonth,
  getUsageDocumentId,
  UsageDocument,
  isCosmosNotFound,
  FREE_MONTHLY_LIMIT,
  isAdminUser,
  consumePaidCredits,
  getPaidCreditBalance,
} from '../shared/cosmosClient';
import { getSasUrlForBlob } from '../shared/blobSas';

const BLOB_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const BLOB_CONTAINER = process.env.BLOB_CONTAINER || 'generations';
const MAX_CREDIT_CHARGE = 20;
const PRO_MODEL_CREDIT_COST = 10;

type ImageQuality = 'low' | 'medium' | 'high';
type ModelVariant = 'nano-banana' | 'nano-banana-pro';

const QUALITY_CREDIT_COST: Record<ImageQuality, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const clampCreditCharge = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_CREDIT_CHARGE, Math.round(parsed)));
};

const normalizeImageQuality = (value: unknown): ImageQuality | null => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'low') return 'low';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'high') return 'high';
  return null;
};

const normalizeModelVariant = (value: unknown): ModelVariant | null => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'nano-banana') return 'nano-banana';
  if (normalized === 'nano-banana-pro') return 'nano-banana-pro';
  return null;
};

const resolveCreditsToCharge = (params: {
  generationType: GenerationType;
  requestedCredits: unknown;
  imageQuality: unknown;
  modelVariant: unknown;
  moodboardCreditsUsed: number;
}): number => {
  const quality = normalizeImageQuality(params.imageQuality);
  const modelVariant = normalizeModelVariant(params.modelVariant);
  const fallbackCredits = clampCreditCharge(params.requestedCredits);

  if (modelVariant === 'nano-banana-pro') {
    return PRO_MODEL_CREDIT_COST;
  }

  if (!quality) {
    return fallbackCredits;
  }

  // Quality-based pricing applies to image render generation types.
  if (
    params.generationType !== 'moodboard' &&
    params.generationType !== 'applyMaterials' &&
    params.generationType !== 'upscale'
  ) {
    return fallbackCredits;
  }

  // First moodboard at medium is discounted to 1 credit.
  if (
    params.generationType === 'moodboard' &&
    quality === 'medium' &&
    params.moodboardCreditsUsed <= 0
  ) {
    return 1;
  }

  return QUALITY_CREDIT_COST[quality];
};

async function uploadToBlob(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  if (!BLOB_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER);

  // Ensure container exists (no public access - storage account doesn't allow it)
  await containerClient.createIfNotExists();

  // Generate unique blob name
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const blobName = `${uuidv4()}.${extension}`;

  // Convert base64 to buffer
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Upload blob
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return blockBlobClient.url;
}

export async function saveGeneration(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing save-generation request');

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    const body = await request.json() as {
      prompt?: string;
      imageBase64?: string;
      mimeType?: string;
      materials?: unknown;
      generationType?: GenerationType;
      credits?: number;
      imageQuality?: ImageQuality;
      modelVariant?: ModelVariant;
    };

    const { prompt, imageBase64, mimeType, materials, generationType, credits, imageQuality, modelVariant } = body;

    if (!imageBase64) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({ error: 'Missing imageBase64' }),
      };
    }

    const authResult = await requireAuth(request);
    if ('status' in authResult) {
      return {
        status: authResult.status,
        headers,
        body: authResult.body,
      };
    }

    const user = authResult as ValidatedUser;
    const userId = user.userId;
    context.log(`Authenticated user: ${userId}`);

    let creditsToCharge = 1;
    let usageBefore: UsageDocument | null = null;
    let paidCreditsToConsume = 0;
    let paidCreditsRemaining: number | null = null;

    if (generationType) {
      const yearMonth = getCurrentYearMonth();
      const documentId = getUsageDocumentId(userId, yearMonth);
      const usageContainer = getContainer('usage');

      try {
        const { resource } = await usageContainer.item(documentId, userId).read<UsageDocument>();
        usageBefore = resource || null;
      } catch (readError: unknown) {
        if (!isCosmosNotFound(readError)) {
          throw readError;
        }
      }

      const moodboardCreditsUsed = usageBefore?.generationCounts?.moodboard || 0;
      creditsToCharge = resolveCreditsToCharge({
        generationType,
        requestedCredits: credits,
        imageQuality,
        modelVariant,
        moodboardCreditsUsed,
      });

      const userIsAdmin = isAdminUser(user.email, user.userId);
      const isFreeGeneration = FREE_GENERATION_TYPES.includes(generationType);
      const totalUsed = usageBefore?.totalGenerations || 0;
      const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - totalUsed);
      const paidCredits = userIsAdmin ? 999999 : await getPaidCreditBalance(userId);
      const availableCredits = freeRemaining + paidCredits;
      paidCreditsToConsume =
        !userIsAdmin && !isFreeGeneration
          ? Math.max(0, creditsToCharge - freeRemaining)
          : 0;

      if (!userIsAdmin && !isFreeGeneration && availableCredits < creditsToCharge) {
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
            creditsRequired: creditsToCharge,
            yearMonth,
          }),
        };
      }
    }

    // Upload to blob storage
    const blobUrl = await uploadToBlob(imageBase64, mimeType || 'image/png');
    const blobUrlWithSas = getSasUrlForBlob(blobUrl);

    // Save to their history and increment usage when generation type is provided
    if (generationType) {
      await saveGenerationRecord(
        userId,
        generationType,
        prompt || '',
        blobUrl,
        materials,
        {
          imageQuality: normalizeImageQuality(imageQuality) || undefined,
          modelVariant: normalizeModelVariant(modelVariant) || undefined,
          creditsCharged: creditsToCharge,
        }
      );
      await incrementUsage(userId, generationType, creditsToCharge);
      context.log(`Saved generation record and incremented usage by ${creditsToCharge} for ${userId}`);

      if (paidCreditsToConsume > 0) {
        try {
          const consumeResult = await consumePaidCredits(userId, paidCreditsToConsume);
          if (!consumeResult.success) {
            context.warn(
              `Generation saved for ${userId} but paid credit debit failed. Needed ${paidCreditsToConsume}.`
            );
          } else {
            paidCreditsRemaining = consumeResult.balance;
          }
        } catch (creditError) {
          context.warn('Failed to debit paid credits after successful generation save', creditError);
        }
      }
    }

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        blobUrl: blobUrlWithSas,
        userId,
        creditsCharged: generationType ? creditsToCharge : 0,
        paidCreditsDebited: paidCreditsToConsume,
        ...(paidCreditsRemaining !== null ? { paidCreditsRemaining } : {}),
      }),
    };
  } catch (error) {
    context.error('Save generation error:', error);
    return {
      status: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to save generation',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

app.http('save-generation', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: saveGeneration,
});
