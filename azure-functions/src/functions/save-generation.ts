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
const BLOB_UPLOAD_CONTAINER = process.env.BLOB_UPLOAD_CONTAINER || BLOB_CONTAINER;

type UploadArchiveCandidate = {
  id?: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalSizeBytes?: number;
  width?: number;
  height?: number;
  dataUrl?: string;
};

type UploadArchiveRecord = Omit<UploadArchiveCandidate, 'dataUrl'> & {
  id: string;
  mimeType: string;
  blobUrl: string;
  archivedAt: string;
};

type UploadToBlobOptions = {
  containerName?: string;
  blobName?: string;
};

function getExtensionFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('avif')) return 'avif';
  return 'jpg';
}

function extractBase64Data(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.includes('base64,')) return trimmed;
  return trimmed.split('base64,').pop() || '';
}

function sanitizePathSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalized.replace(/^-+|-+$/g, '').slice(0, 80);
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function uploadToBlob(
  imageBase64: string,
  mimeType: string,
  options?: UploadToBlobOptions
): Promise<string> {
  if (!BLOB_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
  const containerName = options?.containerName || BLOB_CONTAINER;
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Ensure container exists (no public access - storage account doesn't allow it)
  await containerClient.createIfNotExists();

  // Generate unique blob name
  const extension = getExtensionFromMime(mimeType);
  const blobName = options?.blobName || `${uuidv4()}.${extension}`;

  // Convert base64 to buffer
  const base64Data = extractBase64Data(imageBase64);
  const buffer = Buffer.from(base64Data, 'base64');

  // Upload blob
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return blockBlobClient.url;
}

async function archiveUploadImages(
  materials: unknown,
  userId: string,
  generationType: GenerationType | undefined,
  context: InvocationContext
): Promise<unknown> {
  if (!isObject(materials)) return materials;

  const rawUploads = materials.uploads;
  if (!Array.isArray(rawUploads) || rawUploads.length === 0) {
    return materials;
  }

  const generationLabel = generationType || 'generation';
  const safeUserId = sanitizePathSegment(userId) || 'user';
  const batchId = uuidv4();
  const archivedUploads: UploadArchiveRecord[] = [];

  for (let index = 0; index < rawUploads.length; index += 1) {
    const item = rawUploads[index];
    if (!isObject(item)) continue;

    const candidate: UploadArchiveCandidate = item as UploadArchiveCandidate;
    const dataUrl = asString(candidate.dataUrl);
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      continue;
    }

    const detectedMime = asString(candidate.mimeType);
    const mimeFromDataUrlMatch = dataUrl.match(/^data:([^;]+);base64,/i);
    const mimeType = (detectedMime || mimeFromDataUrlMatch?.[1] || 'image/png').toLowerCase();
    const extension = getExtensionFromMime(mimeType);
    const safeId = sanitizePathSegment(asString(candidate.id) || `upload-${index + 1}`) || `upload-${index + 1}`;
    const blobName = `uploads/${safeUserId}/${generationLabel}/${batchId}/${safeId}.${extension}`;

    try {
      const blobUrl = await uploadToBlob(dataUrl, mimeType, {
        containerName: BLOB_UPLOAD_CONTAINER,
        blobName,
      });
      archivedUploads.push({
        id: asString(candidate.id) || `upload-${index + 1}`,
        name: asString(candidate.name),
        mimeType,
        sizeBytes: asFiniteNumber(candidate.sizeBytes),
        originalSizeBytes: asFiniteNumber(candidate.originalSizeBytes),
        width: asFiniteNumber(candidate.width),
        height: asFiniteNumber(candidate.height),
        blobUrl,
        archivedAt: new Date().toISOString(),
      });
    } catch (err) {
      context.warn('Failed to archive uploaded source image', {
        userId,
        generationType: generationLabel,
        uploadId: candidate.id || `upload-${index + 1}`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const nextMaterials: Record<string, unknown> = { ...materials };
  nextMaterials.uploads = archivedUploads;
  nextMaterials.uploadArchive = {
    container: BLOB_UPLOAD_CONTAINER,
    path: `uploads/${safeUserId}/${generationLabel}/${batchId}/`,
    count: archivedUploads.length,
  };
  return nextMaterials;
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
    const materialsWithArchivedUploads = await archiveUploadImages(
      materials,
      userId,
      generationType,
      context
    );

    // Save to their history and increment usage when generation type is provided
    if (generationType) {
      await saveGenerationRecord(
        userId,
        generationType,
        prompt || '',
        blobUrl,
        materialsWithArchivedUploads
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
