/**
 * Save Material Icon Azure Function
 *
 * Saves generated material icons to blob storage as both PNG and WebP.
 * - Validates admin key for authorization
 * - Saves icon to Azure Blob Storage in material-icons container
 * - Returns URLs for both formats
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';

const BLOB_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const ICONS_CONTAINER = 'material-icons';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
let sharpLoader: Promise<unknown> | null = null;

async function getSharp(): Promise<any> {
  if (!sharpLoader) {
    sharpLoader = import('sharp');
  }
  const module = await sharpLoader as { default?: any };
  return module.default ?? module;
}

async function uploadIconToBlob(
  materialId: string,
  imageBase64: string,
  context: InvocationContext
): Promise<{ pngUrl: string; webpUrl: string }> {
  if (!BLOB_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(ICONS_CONTAINER);

  // Ensure container exists with public blob access
  await containerClient.createIfNotExists({ access: 'blob' });

  // Convert base64 to buffer
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const inputBuffer = Buffer.from(base64Data, 'base64');
  const sharp = await getSharp();

  // Save PNG
  const pngBlobName = `${materialId}.png`;
  const pngBlobClient = containerClient.getBlockBlobClient(pngBlobName);

  // Resize and optimize PNG
  const pngBuffer = await sharp(inputBuffer)
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 90 })
    .toBuffer();

  await pngBlobClient.upload(pngBuffer, pngBuffer.length, {
    blobHTTPHeaders: {
      blobContentType: 'image/png',
      blobCacheControl: 'public, max-age=31536000', // Cache for 1 year
    },
  });
  context.log(`Uploaded PNG: ${pngBlobName}`);

  // Save WebP
  const webpBlobName = `${materialId}.webp`;
  const webpBlobClient = containerClient.getBlockBlobClient(webpBlobName);

  // Convert to WebP with high quality
  const webpBuffer = await sharp(inputBuffer)
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  await webpBlobClient.upload(webpBuffer, webpBuffer.length, {
    blobHTTPHeaders: {
      blobContentType: 'image/webp',
      blobCacheControl: 'public, max-age=31536000',
    },
  });
  context.log(`Uploaded WebP: ${webpBlobName}`);

  return {
    pngUrl: pngBlobClient.url,
    webpUrl: webpBlobClient.url,
  };
}

export async function saveMaterialIcon(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing save-material-icon request');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  };

  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    // Validate admin key
    const adminKey = request.headers.get('X-Admin-Key');
    if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
      return {
        status: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or missing admin key' }),
      };
    }

    const body = await request.json() as {
      materialId?: string;
      imageBase64?: string;
    };

    const { materialId, imageBase64 } = body;

    if (!materialId) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({ error: 'Missing materialId' }),
      };
    }

    if (!imageBase64) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({ error: 'Missing imageBase64' }),
      };
    }

    // Upload both PNG and WebP versions
    const { pngUrl, webpUrl } = await uploadIconToBlob(materialId, imageBase64, context);

    context.log(`Material icon saved: ${materialId}`);

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        materialId,
        pngUrl,
        webpUrl,
      }),
    };
  } catch (error) {
    context.error('Save material icon error:', error);
    return {
      status: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to save material icon',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

app.http('save-material-icon', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: saveMaterialIcon,
});
