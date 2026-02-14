/**
 * Materials Function
 *
 * GET /api/materials
 * PUT /api/materials
 *
 * GET returns materials from Cosmos DB (public).
 * PUT updates a material in Cosmos DB (admin-only).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer, isAdminUser, MaterialDocument } from './shared/cosmosClient';
import { getSasUrlForBlob } from './shared/blobSas';
import { getMaterialIconId } from './shared/materialIconMapping';
import { requireAuth, ValidatedUser } from './shared/validateToken';

const MATERIAL_ICON_CONTAINER = process.env.MATERIAL_ICON_BLOB_CONTAINER || 'material-icons';
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getIconBaseUrl(): string | null {
  const explicitBase = process.env.MATERIAL_ICON_BLOB_BASE_URL;
  if (explicitBase) return explicitBase.replace(/\/+$/, '');

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (!connectionString) return null;
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/i);
  if (!accountNameMatch?.[1]) return null;
  return `https://${accountNameMatch[1]}.blob.core.windows.net/${MATERIAL_ICON_CONTAINER}`;
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean);
}

function toNullableStringArray(value: unknown, fallback: string[] | null): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean);
  return normalized;
}

function toNullableString(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNullableInteger(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function normalizeColorOptions(
  value: unknown,
  fallback: Array<{ label: string; tone: string }> | undefined
): Array<{ label: string; tone: string }> | undefined {
  if (value === null) return undefined;
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const tone = typeof record.tone === 'string' ? record.tone.trim() : '';
      if (!label || !tone) return null;
      return { label, tone };
    })
    .filter((item): item is { label: string; tone: string } => Boolean(item));
  return normalized.length ? normalized : [];
}

function normalizeRisks(
  value: unknown,
  fallback: Array<{ risk: string; mitigation: string }> | null
): Array<{ risk: string; mitigation: string }> | null {
  if (value === null) return null;
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const risk = typeof record.risk === 'string' ? record.risk.trim() : '';
      const mitigation = typeof record.mitigation === 'string' ? record.mitigation.trim() : '';
      if (!risk && !mitigation) return null;
      return { risk, mitigation };
    })
    .filter((item): item is { risk: string; mitigation: string } => Boolean(item));
  return normalized;
}

function toStringOrDefault(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }
  return fallback;
}

async function listMaterials(): Promise<HttpResponseInit> {
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
    headers: CORS_HEADERS,
  };
}

async function updateMaterial(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      body: authResult.body,
      headers: CORS_HEADERS,
    };
  }

  const user = authResult as ValidatedUser;
  if (!isAdminUser(user.email)) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }),
      headers: CORS_HEADERS,
    };
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
      headers: CORS_HEADERS,
    };
  }

  const materialId = typeof body.id === 'string' ? body.id.trim() : '';
  if (!materialId) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Material id is required' }),
      headers: CORS_HEADERS,
    };
  }

  const materialsContainer = getContainer('materials');
  const querySpec = {
    query: `
      SELECT TOP 1 *
      FROM c
      WHERE c.id = @id AND c.docType = "material"
    `,
    parameters: [{ name: '@id', value: materialId }],
  };

  const { resources } = await materialsContainer.items
    .query<MaterialDocument>(querySpec, { enableCrossPartitionQuery: true })
    .fetchAll();

  const existing = resources[0];
  if (!existing) {
    return {
      status: 404,
      body: JSON.stringify({ error: `Material "${materialId}" not found` }),
      headers: CORS_HEADERS,
    };
  }

  const requestedCategory = toNullableString(body.category, null) || toNullableString(body.pk, null);
  const category = requestedCategory || existing.category || existing.pk;

  const rawSortOrder = body.sortOrder;
  const sortOrder =
    (typeof rawSortOrder === 'number' && Number.isFinite(rawSortOrder))
      ? Math.round(rawSortOrder)
      : existing.sortOrder;

  const next: MaterialDocument = {
    ...existing,
    ...body,
    id: materialId,
    pk: category,
    category,
    docType: 'material',
    sortOrder,
    name: toStringOrDefault(body.name, existing.name),
    tone: toStringOrDefault(body.tone, existing.tone),
    finish: toStringOrDefault(body.finish, existing.finish),
    description: toStringOrDefault(body.description, existing.description),
    keywords: toStringArray(body.keywords, existing.keywords || []),
    tags: toNullableStringArray(body.tags, existing.tags || null) || undefined,
    finishOptions: toNullableStringArray(body.finishOptions, existing.finishOptions || null) || undefined,
    treePaths: toNullableStringArray(body.treePaths, existing.treePaths || null) || undefined,
    colorOptions: normalizeColorOptions(body.colorOptions, existing.colorOptions),
    supportsColor: toBoolean(body.supportsColor, existing.supportsColor),
    carbonIntensity: (body.carbonIntensity === 'low' || body.carbonIntensity === 'medium' || body.carbonIntensity === 'high')
      ? body.carbonIntensity
      : existing.carbonIntensity,
    materialType: toNullableString(body.materialType, existing.materialType || null) || undefined,
    materialForm: toNullableStringArray(body.materialForm, existing.materialForm || null) || undefined,
    materialFunction: toNullableStringArray(body.materialFunction, existing.materialFunction || null) || undefined,
    manufacturingProcess: toNullableStringArray(body.manufacturingProcess, existing.manufacturingProcess || null) || undefined,
    finishIds: toStringArray(body.finishIds, existing.finishIds || []),
    primaryFinishId: toNullableString(body.primaryFinishId, existing.primaryFinishId),
    finishSetIds: toStringArray(body.finishSetIds, existing.finishSetIds || []),
    primaryFinishSetId: toNullableString(body.primaryFinishSetId, existing.primaryFinishSetId),
    lifecycleProfileId: toNullableString(body.lifecycleProfileId, existing.lifecycleProfileId),
    insight: toNullableString(body.insight, existing.insight),
    actions: toNullableStringArray(body.actions, existing.actions),
    healthRiskLevel: (body.healthRiskLevel === 'low' || body.healthRiskLevel === 'medium' || body.healthRiskLevel === 'high' || body.healthRiskLevel === null)
      ? body.healthRiskLevel
      : existing.healthRiskLevel,
    healthConcerns: toNullableStringArray(body.healthConcerns, existing.healthConcerns),
    healthNote: toNullableString(body.healthNote, existing.healthNote),
    risks: normalizeRisks(body.risks, existing.risks),
    serviceLife: toNullableInteger(body.serviceLife, existing.serviceLife),
  };

  if (existing.pk === next.pk) {
    await materialsContainer.item(materialId, existing.pk).replace(next);
  } else {
    await materialsContainer.items.upsert(next);
    try {
      await materialsContainer.item(materialId, existing.pk).delete();
    } catch (deleteError) {
      context.warn('Updated material with new partition key but could not delete prior partition copy.', deleteError);
    }
  }

  return {
    status: 200,
    body: JSON.stringify({ success: true, item: next }),
    headers: CORS_HEADERS,
  };
}

export async function materials(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Materials function processed a request.');

  try {
    if (req.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS };
    }

    if (req.method === 'GET') {
      return await listMaterials();
    }

    if (req.method === 'PUT') {
      return await updateMaterial(req, context);
    }

    return {
      status: 405,
      body: JSON.stringify({ error: `Method ${req.method} not allowed` }),
      headers: CORS_HEADERS,
    };
  } catch (error) {
    context.error('Error fetching materials:', error);
    return {
      status: 500,
      body: JSON.stringify({
        error: 'Failed to process materials request',
      }),
      headers: CORS_HEADERS,
    };
  }
}

app.http('materials', {
  methods: ['GET', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: materials,
});
