/**
 * Save Precedents Function
 *
 * POST /api/save-precedents
 *
 * Saves the user's selected precedent collection to the database.
 * Requires authentication via Bearer token.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer, SavedPrecedentDocument } from '../shared/cosmosClient';
import { validateToken } from '../shared/validateToken';

interface PrecedentInput {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: 'archdaily' | 'dezeen' | 'architizer' | 'designboom' | 'divisare' | 'other';
  sourceName: string;
}

interface MaterialInput {
  id: string;
  name: string;
  category?: string;
  keywords?: string[];
  finish?: string;
  materialType?: string;
}

interface SavePrecedentsRequest {
  precedents: PrecedentInput[];
  materials: MaterialInput[];
  title?: string;
  description?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function savePrecedents(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Save precedents function processed a request.');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return { status: 204, headers: CORS_HEADERS };
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return {
        status: 401,
        body: JSON.stringify({ error: 'unauthorized', message: 'Missing authorization header' }),
        headers: CORS_HEADERS,
      };
    }

    const tokenResult = await validateToken(authHeader);
    if (!tokenResult.valid || !tokenResult.userId) {
      return {
        status: 401,
        body: JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired token' }),
        headers: CORS_HEADERS,
      };
    }

    // Parse request body
    let body: SavePrecedentsRequest;
    try {
      body = (await req.json()) as SavePrecedentsRequest;
    } catch {
      return {
        status: 400,
        body: JSON.stringify({ error: 'invalid_json', message: 'Invalid JSON body' }),
        headers: CORS_HEADERS,
      };
    }

    // Validate request
    if (!body.precedents || !Array.isArray(body.precedents) || body.precedents.length === 0) {
      return {
        status: 400,
        body: JSON.stringify({
          error: 'invalid_request',
          message: 'Precedents array is required and must not be empty',
        }),
        headers: CORS_HEADERS,
      };
    }

    if (!body.materials || !Array.isArray(body.materials)) {
      return {
        status: 400,
        body: JSON.stringify({
          error: 'invalid_request',
          message: 'Materials array is required',
        }),
        headers: CORS_HEADERS,
      };
    }

    // Create document
    const precedentDoc: SavedPrecedentDocument = {
      id: `precedent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: tokenResult.userId,
      title: body.title || `Precedent Collection - ${new Date().toLocaleDateString()}`,
      description: body.description,
      precedents: body.precedents,
      materials: body.materials,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Cosmos DB
    const container = getContainer('precedents');
    const response = await container.items.create(precedentDoc);

    return {
      status: 200,
      body: JSON.stringify({
        success: true,
        precedentId: precedentDoc.id,
        createdAt: precedentDoc.createdAt,
      }),
      headers: CORS_HEADERS,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Save precedents error:', errorMessage);

    return {
      status: 500,
      body: JSON.stringify({
        error: 'internal_error',
        message: 'Failed to save precedents',
      }),
      headers: CORS_HEADERS,
    };
  }
}

app.http('save-precedents', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: savePrecedents,
});
