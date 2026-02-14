/**
 * Materials Function
 *
 * GET /api/materials
 *
 * Returns materials from Cosmos DB.
 * Public endpoint (no auth required).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer, MaterialDocument } from './shared/cosmosClient';
import { getSasUrlForBlob } from './shared/blobSas';
import { getMaterialIconId } from './shared/materialIconMapping';

const MATERIAL_ICON_CONTAINER = process.env.MATERIAL_ICON_BLOB_CONTAINER || 'material-icons';

function getIconBaseUrl(): string | null {
  const explicitBase = process.env.MATERIAL_ICON_BLOB_BASE_URL;
  if (explicitBase) return explicitBase.replace(/\/+$/, '');

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (!connectionString) return null;
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/i);
  if (!accountNameMatch?.[1]) return null;
  return `https://${accountNameMatch[1]}.blob.core.windows.net/${MATERIAL_ICON_CONTAINER}`;
}

export async function materials(
  _req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Materials function processed a request.');

  try {
    const materialsContainer = getContainer('materials');
    const querySpec = {
      query: `
        SELECT *
        FROM c
        ORDER BY c.sortOrder ASC, c.name ASC
      `,
    };

    const { resources } = await materialsContainer.items
      .query<MaterialDocument>(querySpec, {
        enableCrossPartitionQuery: true,
      })
      .fetchAll();

    const iconBaseUrl = getIconBaseUrl();
    const itemsWithIcons = resources.map((item) => {
      if (!item.id || !iconBaseUrl) return item;
      const iconId = getMaterialIconId(item.id);
      const webpBlobUrl = `${iconBaseUrl}/${iconId}.webp`;
      const pngBlobUrl = `${iconBaseUrl}/${iconId}.png`;
      return {
        ...item,
        iconWebpUrl: getSasUrlForBlob(webpBlobUrl, 60 * 24),
        iconPngUrl: getSasUrlForBlob(pngBlobUrl, 60 * 24),
      };
    });

    return {
      status: 200,
      body: JSON.stringify({
        items: itemsWithIcons,
        count: itemsWithIcons.length,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.error('Error fetching materials:', error);
    return {
      status: 500,
      body: JSON.stringify({
        error: 'Failed to fetch materials from Cosmos DB',
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

app.http('materials', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: materials,
});
