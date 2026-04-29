/**
 * Get Precedents Function
 *
 * GET /api/get-precedents
 *
 * Retrieves all saved precedent collections for the authenticated user.
 * Requires authentication via Bearer token.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer, SavedPrecedentDocument } from '../shared/cosmosClient';
import { validateToken } from '../shared/validateToken';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function getPrecedents(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Get precedents function processed a request.');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return { status: 204, headers: CORS_HEADERS };
  }

  try {
    // Validate authentication
    const user = await validateToken(req);
    if (!user) {
      return {
        status: 401,
        body: JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired token' }),
        headers: CORS_HEADERS,
      };
    }

    // Query Cosmos DB for user's precedent collections
    const container = getContainer('precedents');
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@userId', value: user.userId }]
    };

    const { resources } = await container.items
      .query<SavedPrecedentDocument>(querySpec)
      .fetchAll();

    return {
      status: 200,
      body: JSON.stringify({
        success: true,
        collections: resources,
        count: resources.length,
      }),
      headers: CORS_HEADERS,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Get precedents error:', errorMessage);

    return {
      status: 500,
      body: JSON.stringify({
        error: 'internal_error',
        message: 'Failed to retrieve precedents',
      }),
      headers: CORS_HEADERS,
    };
  }
}

app.http('get-precedents', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getPrecedents,
});
