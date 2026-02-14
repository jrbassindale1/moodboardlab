/**
 * Usage Helper Functions
 *
 * Helper functions for tracking and updating user generation usage.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  getContainer,
  getUsageDocumentId,
  getCurrentYearMonth,
  FREE_MONTHLY_LIMIT,
  UsageDocument,
  GenerationDocument,
  isCosmosNotFound,
  isCosmosConflict,
} from './cosmosClient';

export type GenerationType =
  | 'moodboard'
  | 'applyMaterials'
  | 'upscale'
  | 'materialIcon'
  | 'sustainabilityBriefing';

function stripDataUrls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDataUrls);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === 'string' && val.startsWith('data:')) {
        continue;
      }
      result[key] = stripDataUrls(val);
    }
    return result;
  }
  return value;
}

/**
 * Check if user can generate (has remaining quota)
 */
export async function canUserGenerate(userId: string): Promise<{
  canGenerate: boolean;
  remaining: number;
  used: number;
}> {
  const yearMonth = getCurrentYearMonth();
  const documentId = getUsageDocumentId(userId, yearMonth);
  const usageContainer = getContainer('usage');

  try {
    // Partition key is userId, document id is "userId:YYYY-MM"
    const { resource } = await usageContainer.item(documentId, userId).read<UsageDocument>();
    const totalUsed = resource?.totalGenerations || 0;
    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - totalUsed);

    return {
      canGenerate: remaining > 0,
      remaining,
      used: totalUsed,
    };
  } catch (error: unknown) {
    if (isCosmosNotFound(error)) {
      return {
        canGenerate: true,
        remaining: FREE_MONTHLY_LIMIT,
        used: 0,
      };
    }
    throw error;
  }
}

/**
 * Increment usage count for a specific generation type
 */
export async function incrementUsage(
  userId: string,
  generationType: GenerationType,
  count = 1
): Promise<void> {
  const incrementBy = Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
  const yearMonth = getCurrentYearMonth();
  const documentId = getUsageDocumentId(userId, yearMonth);
  const usageContainer = getContainer('usage');

  const now = new Date().toISOString();

  try {
    // Atomic patch when the document already exists
    await usageContainer.item(documentId, userId).patch([
      {
        op: 'incr',
        path: `/generationCounts/${generationType}`,
        value: incrementBy,
      },
      {
        op: 'incr',
        path: '/totalGenerations',
        value: incrementBy,
      },
      {
        op: 'set',
        path: '/lastUpdatedAt',
        value: now,
      },
    ]);
    return;
  } catch (error: unknown) {
    if (!isCosmosNotFound(error)) {
      throw error;
    }
  }

  // Create new document if read returned nothing or item was not found.
  const newUsage: UsageDocument = {
    id: documentId,
    userId,
    yearMonth,
    generationCounts: {
      moodboard: generationType === 'moodboard' ? incrementBy : 0,
      applyMaterials: generationType === 'applyMaterials' ? incrementBy : 0,
      upscale: generationType === 'upscale' ? incrementBy : 0,
      materialIcon: generationType === 'materialIcon' ? incrementBy : 0,
      sustainabilityBriefing: generationType === 'sustainabilityBriefing' ? incrementBy : 0,
    },
    totalGenerations: incrementBy,
    lastUpdatedAt: now,
  };

  try {
    await usageContainer.items.create(newUsage);
  } catch (error: unknown) {
    if (!isCosmosConflict(error)) {
      throw error;
    }
    // Another request created the document; retry the atomic patch.
    await usageContainer.item(documentId, userId).patch([
      {
        op: 'incr',
        path: `/generationCounts/${generationType}`,
        value: incrementBy,
      },
      {
        op: 'incr',
        path: '/totalGenerations',
        value: incrementBy,
      },
      {
        op: 'set',
        path: '/lastUpdatedAt',
        value: now,
      },
    ]);
  }
}

/**
 * Save a generation record for the user's history
 */
export async function saveGenerationRecord(
  userId: string,
  generationType: GenerationType,
  prompt: string,
  blobUrl?: string,
  materials?: unknown,
  metadata?: Record<string, unknown>
): Promise<string> {
  const generationsContainer = getContainer('generations');
  const id = uuidv4();
  const now = new Date().toISOString();
  const sanitizedMaterials = materials ? stripDataUrls(materials) : materials;

  const record: GenerationDocument = {
    id,
    userId, // Partition key
    type: generationType,
    prompt,
    blobUrl,
    materials: sanitizedMaterials,
    createdAt: now,
    metadata,
  };

  await generationsContainer.items.create(record);
  return id;
}
