/**
 * Save PDF Azure Function
 *
 * Saves PDF documents to blob storage and tracks them for authenticated users.
 * - Validates JWT token for authenticated requests
 * - Saves PDF to Azure Blob Storage
 * - Records in CosmosDB for user history
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { validateToken } from './shared/validateToken';
import { saveGenerationRecord, GenerationType } from './shared/usageHelpers';
import { getContainer, GenerationDocument } from './shared/cosmosClient';
import { getSasUrlForBlob } from './shared/blobSas';

const BLOB_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const BLOB_CONTAINER = process.env.BLOB_CONTAINER || 'generations';

type BoardItemLike = {
  id?: string;
  name?: string;
  finish?: string;
};

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

const getBoardKey = (materials?: unknown): string | null => {
  if (!materials || typeof materials !== 'object') return null;
  const board = (materials as { board?: BoardItemLike[] }).board;
  if (!Array.isArray(board) || board.length === 0) return null;
  const parts = board
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const id = String(item.id || '');
      const name = String(item.name || '');
      const finish = String(item.finish || '');
      return `${id}|${name}|${finish}`;
    })
    .filter(Boolean)
    .sort();
  if (!parts.length) return null;
  return parts.join('::');
};

const getPdfBlobName = (
  userId: string,
  pdfType: 'sustainabilityBriefing' | 'materialsSheet',
  boardKey?: string | null
): string => {
  if (!boardKey) {
    return `${uuidv4()}.pdf`;
  }
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '') || 'user';
  const hash = createHash('sha256').update(boardKey).digest('hex').slice(0, 24);
  return `pdf/${safeUserId}/${pdfType}-${hash}.pdf`;
};

async function uploadPdfToBlob(
  pdfBase64: string,
  blobName: string
): Promise<string> {
  if (!BLOB_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER);

  // Ensure container exists (no public access - storage account doesn't allow it)
  await containerClient.createIfNotExists();

  // Convert base64 to buffer (handle data URI format)
  const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Upload blob
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: 'application/pdf' },
  });

  return blockBlobClient.url;
}

async function deleteBlobIfExists(blobUrl: string): Promise<void> {
  if (!BLOB_CONNECTION_STRING) return;
  try {
    const parsed = new URL(blobUrl);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const containerName = pathParts.shift();
    if (!containerName || pathParts.length === 0) return;
    const blobName = decodeURIComponent(pathParts.join('/'));
    const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.getBlockBlobClient(blobName).deleteIfExists();
  } catch (error) {
    // Ignore delete errors to avoid failing the request after a successful upload
    console.warn('Failed to delete previous PDF blob:', error);
  }
}

export async function savePdf(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing save-pdf request');

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
    // Require authentication for PDF saves
    const validatedUser = await validateToken(request);
    if (!validatedUser) {
      return {
        status: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required' }),
      };
    }

    const userId = validatedUser.userId;

    const body = await request.json() as {
      pdfBase64?: string;
      pdfType?: 'sustainabilityBriefing' | 'materialsSheet';
      materials?: unknown;
    };

    const { pdfBase64, pdfType, materials } = body;

    if (!pdfBase64) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({ error: 'Missing pdfBase64' }),
      };
    }

    if (!pdfType || !['sustainabilityBriefing', 'materialsSheet'].includes(pdfType)) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid pdfType' }),
      };
    }

    const sanitizedMaterials = stripDataUrls(materials);
    const boardKey = getBoardKey(sanitizedMaterials);

    // Upload to blob storage
    const blobName = getPdfBlobName(userId, pdfType, boardKey);
    const blobUrl = await uploadPdfToBlob(pdfBase64, blobName);
    const blobUrlWithSas = getSasUrlForBlob(blobUrl);

    // Map pdfType to generationType for recording
    const generationType: GenerationType = pdfType === 'sustainabilityBriefing'
      ? 'sustainabilityBriefing'
      : 'materialIcon'; // Using materialIcon for materials sheet as a close fit

    // Save to user's generation history (but don't increment usage - PDFs are free)
    const promptDescription = pdfType === 'sustainabilityBriefing'
      ? 'Sustainability Briefing PDF'
      : 'Materials Sheet PDF';

    const generationsContainer = getContainer('generations');
    let existingRecord: GenerationDocument | null = null;

    if (boardKey) {
      const querySpec = {
        query: `
          SELECT c.id, c.userId, c.type, c.prompt, c.blobUrl, c.materials, c.metadata, c.createdAt
          FROM c
          WHERE c.userId = @userId AND c.type = @type AND c.prompt = @prompt
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@type', value: generationType },
          { name: '@prompt', value: promptDescription },
        ],
      };

      const { resources } = await generationsContainer.items
        .query<GenerationDocument>(querySpec, { partitionKey: userId })
        .fetchAll();

      existingRecord = resources.find((record) => {
        const recordKey =
          typeof record.metadata?.boardKey === 'string'
            ? record.metadata.boardKey
            : getBoardKey(record.materials);
        return Boolean(recordKey && recordKey === boardKey);
      }) || null;
    }

    const metadata = {
      ...(existingRecord?.metadata ?? {}),
      pdfType,
      boardKey,
      isPdf: true,
    };

    if (existingRecord) {
      const previousBlobUrl = existingRecord.blobUrl;
      await generationsContainer.item(existingRecord.id, userId).replace({
        ...existingRecord,
        blobUrl,
        materials: sanitizedMaterials,
        metadata,
        createdAt: new Date().toISOString(),
      });
      if (previousBlobUrl && previousBlobUrl !== blobUrl) {
        await deleteBlobIfExists(previousBlobUrl);
      }
    } else {
      await saveGenerationRecord(
        userId,
        generationType,
        promptDescription,
        blobUrl,
        sanitizedMaterials,
        metadata
      );
    }

    context.log(`Saved PDF for user ${userId}: ${pdfType}`);

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        blobUrl: blobUrlWithSas,
        pdfType,
      }),
    };
  } catch (error) {
    context.error('Save PDF error:', error);
    return {
      status: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to save PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

app.http('save-pdf', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: savePdf,
});
