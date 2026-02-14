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
import { incrementUsage, saveGenerationRecord, GenerationType } from '../shared/usageHelpers';
import { getSasUrlForBlob } from '../shared/blobSas';

const BLOB_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const BLOB_CONTAINER = process.env.BLOB_CONTAINER || 'generations';

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
    };

    const { prompt, imageBase64, mimeType, materials, generationType } = body;

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
        materials
      );
      await incrementUsage(userId, generationType);
      context.log(`Saved generation record and incremented usage for ${userId}`);
    }

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        blobUrl: blobUrlWithSas,
        userId,
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
