/**
 * Generations Function
 *
 * GET /api/generations
 *
 * Returns the user's generation history with pagination.
 * Requires authentication.
 *
 * Query parameters:
 * - limit: Number of items to return (default: 20, max: 100)
 * - offset: Number of items to skip (default: 0)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, ValidatedUser } from '../shared/validateToken';
import { getContainer, GenerationDocument } from '../shared/cosmosClient';
import { getSasUrlForBlob } from '../shared/blobSas';

function hydrateBlobUrlsWithSas(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => hydrateBlobUrlsWithSas(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(source)) {
    if (typeof val === 'string' && (key === 'blobUrl' || key.endsWith('BlobUrl'))) {
      next[key] = getSasUrlForBlob(val);
      continue;
    }
    next[key] = hydrateBlobUrlsWithSas(val);
  }
  return next;
}

export async function generations(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Generations function processed a request.');

  // Require authentication
  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      body: authResult.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const user = authResult as ValidatedUser;

  // Parse pagination parameters
  const limitParam = req.query.get('limit');
  const offsetParam = req.query.get('offset');
  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

  try {
    const generationsContainer = getContainer('generations');

    // Query for user's generations, ordered by createdAt descending
      const querySpec = {
        query: `
        SELECT c.id, c.type, c.blobUrl, c.createdAt, c.prompt, c.materials, c.metadata
        FROM c
        WHERE c.userId = @userId
        ORDER BY c.createdAt DESC
        OFFSET @offset LIMIT @limit
      `,
      parameters: [
        { name: '@userId', value: user.userId },
        { name: '@offset', value: offset },
        { name: '@limit', value: limit + 1 }, // Fetch one extra to check if there are more
      ],
    };

    const { resources } = await generationsContainer.items
      .query<GenerationDocument>(querySpec, {
        partitionKey: user.userId,
      })
      .fetchAll();

    // Check if there are more items
    const hasMore = resources.length > limit;
    const items = hasMore ? resources.slice(0, limit) : resources;
    const itemsWithSas = items.map((item) => ({
      ...item,
      blobUrl: item.blobUrl ? getSasUrlForBlob(item.blobUrl) : item.blobUrl,
      materials: hydrateBlobUrlsWithSas(item.materials),
      metadata: hydrateBlobUrlsWithSas(item.metadata),
    }));

    return {
      status: 200,
      body: JSON.stringify({
        items: itemsWithSas,
        hasMore,
        offset,
        limit,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.error('Error fetching generations:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

app.http('generations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: generations,
});
