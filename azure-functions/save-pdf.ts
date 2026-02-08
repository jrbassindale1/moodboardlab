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
import { v4 as uuidv4 } from 'uuid';
import { validateToken } from './shared/validateToken';
import { saveGenerationRecord, GenerationType } from './shared/usageHelpers';
import { getSasUrlForBlob } from './shared/blobSas';

const BLOB_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const BLOB_CONTAINER = process.env.BLOB_CONTAINER || 'generations';

async function uploadPdfToBlob(
  pdfBase64: string
): Promise<string> {
  if (!BLOB_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER);

  // Ensure container exists (no public access - storage account doesn't allow it)
  await containerClient.createIfNotExists();

  // Generate unique blob name
  const blobName = `${uuidv4()}.pdf`;

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

    // Upload to blob storage
    const blobUrl = await uploadPdfToBlob(pdfBase64);
    const blobUrlWithSas = getSasUrlForBlob(blobUrl);

    // Map pdfType to generationType for recording
    const generationType: GenerationType = pdfType === 'sustainabilityBriefing'
      ? 'sustainabilityBriefing'
      : 'materialIcon'; // Using materialIcon for materials sheet as a close fit

    // Save to user's generation history (but don't increment usage - PDFs are free)
    const promptDescription = pdfType === 'sustainabilityBriefing'
      ? 'Sustainability Briefing PDF'
      : 'Materials Sheet PDF';

    await saveGenerationRecord(
      userId,
      generationType,
      promptDescription,
      blobUrl,
      materials
    );

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
