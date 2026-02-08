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
} from './cosmosClient';

export type GenerationType =
  | 'moodboard'
  | 'applyMaterials'
  | 'upscale'
  | 'materialIcon'
  | 'sustainabilityBriefing';

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
    // CosmosDB SDK may use 'code' (number or string) or 'statusCode'
    const err = error as { code?: number | string; statusCode?: number };
    const is404 = err.code === 404 || err.code === 'NotFound' || err.statusCode === 404;
    if (is404) {
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
        totalGenerations: existing.totalGenerations + 1,
        lastUpdatedAt: now,
      });
    }
  } catch (error: unknown) {
    // CosmosDB SDK may use 'code' (number or string) or 'statusCode'
    const err = error as { code?: number | string; statusCode?: number };
    const is404 = err.code === 404 || err.code === 'NotFound' || err.statusCode === 404;
    if (is404) {
      // Create new document
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
    } else {
      throw error;
    }
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

  const record: GenerationDocument = {
    id,
    userId, // Partition key
    type: generationType,
    prompt,
    blobUrl,
    materials,
    createdAt: now,
    metadata,
  };

  await generationsContainer.items.create(record);
  return id;
}
