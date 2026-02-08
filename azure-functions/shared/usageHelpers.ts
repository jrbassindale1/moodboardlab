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
  generationType: GenerationType
): Promise<void> {
  const yearMonth = getCurrentYearMonth();
  const documentId = getUsageDocumentId(userId, yearMonth);
  const usageContainer = getContainer('usage');

  const now = new Date().toISOString();

  try {
    // Try to read existing document (partition key is userId)
    const { resource: existing } = await usageContainer
      .item(documentId, userId)
      .read<UsageDocument>();

    if (existing) {
      // Update existing document
      const updatedCounts = {
        ...existing.generationCounts,
        [generationType]: (existing.generationCounts[generationType] || 0) + 1,
      };

      await usageContainer.item(documentId, userId).replace({
        ...existing,
        generationCounts: updatedCounts,
        totalGenerations: (existing.totalGenerations || 0) + 1,
        lastUpdatedAt: now,
      });
      return;
    }
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
      moodboard: generationType === 'moodboard' ? 1 : 0,
      applyMaterials: generationType === 'applyMaterials' ? 1 : 0,
      upscale: generationType === 'upscale' ? 1 : 0,
      materialIcon: generationType === 'materialIcon' ? 1 : 0,
      sustainabilityBriefing: generationType === 'sustainabilityBriefing' ? 1 : 0,
    },
    totalGenerations: 1,
    lastUpdatedAt: now,
  };

  await usageContainer.items.create(newUsage);
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
