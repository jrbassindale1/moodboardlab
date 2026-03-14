/**
 * Search Precedents Function
 *
 * POST /api/search-precedents
 *
 * Searches architectural sites (ArchDaily, Dezeen, etc.) for project precedents
 * based on materials from the user's moodboard.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const SERPER_API_URL = 'https://google.serper.dev/search';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Architecture-focused sites for precedent searches
const ARCHITECTURE_SITES = [
  'archdaily.com',
  'dezeen.com',
  'architizer.com',
  'designboom.com',
];

interface MaterialInput {
  id: string;
  name: string;
  category?: string;
  keywords?: string[];
  finish?: string;
  materialType?: string;
}

interface SearchPrecedentsRequest {
  materials: MaterialInput[];
  maxResults?: number;
}

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  imageUrl?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  images?: Array<{
    title: string;
    imageUrl: string;
    link: string;
  }>;
}

interface PrecedentResult {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: 'archdaily' | 'dezeen' | 'architizer' | 'designboom' | 'other';
  sourceName: string;
}

/**
 * Determine source from URL
 */
function getSourceFromUrl(url: string): { source: PrecedentResult['source']; sourceName: string } {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('archdaily.com')) {
    return { source: 'archdaily', sourceName: 'ArchDaily' };
  }
  if (urlLower.includes('dezeen.com')) {
    return { source: 'dezeen', sourceName: 'Dezeen' };
  }
  if (urlLower.includes('architizer.com')) {
    return { source: 'architizer', sourceName: 'Architizer' };
  }
  if (urlLower.includes('designboom.com')) {
    return { source: 'designboom', sourceName: 'Designboom' };
  }
  // Extract domain name for other sources
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return { source: 'other', sourceName: domain };
  } catch {
    return { source: 'other', sourceName: 'Unknown' };
  }
}

/**
 * Build an optimized search query from materials
 */
function buildSearchQuery(materials: MaterialInput[]): string {
  // Extract unique material types
  const materialTypes = new Set<string>();
  materials.forEach((m) => {
    if (m.materialType) {
      materialTypes.add(m.materialType.toLowerCase());
    }
  });

  // Get first word of material names (often the most relevant)
  const materialTerms: string[] = [];
  materials.slice(0, 3).forEach((m) => {
    const firstWord = m.name.split(' ')[0]?.toLowerCase();
    if (firstWord && firstWord.length > 2) {
      materialTerms.push(firstWord);
    }
  });

  // Extract unique keywords (limit to most common)
  const keywordCounts = new Map<string, number>();
  materials.forEach((m) => {
    m.keywords?.forEach((kw) => {
      const kwLower = kw.toLowerCase();
      keywordCounts.set(kwLower, (keywordCounts.get(kwLower) || 0) + 1);
    });
  });

  // Get top 2 keywords that appear in multiple materials
  const topKeywords = Array.from(keywordCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([kw]) => kw);

  // Build the query
  const queryParts = ['architecture project'];

  // Add material types (e.g., timber, steel, concrete)
  Array.from(materialTypes).slice(0, 2).forEach((type) => {
    queryParts.push(type);
  });

  // Add material terms
  materialTerms.forEach((term) => {
    if (!queryParts.includes(term)) {
      queryParts.push(term);
    }
  });

  // Add top keywords
  topKeywords.forEach((kw) => {
    if (!queryParts.includes(kw)) {
      queryParts.push(kw);
    }
  });

  // Build site filter
  const siteFilter = ARCHITECTURE_SITES.map((site) => `site:${site}`).join(' OR ');

  return `${queryParts.join(' ')} (${siteFilter})`;
}

/**
 * Call Serper API to search for precedents
 */
async function searchSerper(
  query: string,
  maxResults: number,
  context: InvocationContext
): Promise<SerperResponse> {
  const response = await fetch(SERPER_API_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: maxResults,
      gl: 'gb',
      hl: 'en',
    }),
  });

  if (!response.ok) {
    context.error(`Serper API error: ${response.status} ${response.statusText}`);
    throw new Error(`Serper API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Process Serper results into normalized precedent results
 */
function processResults(serperResponse: SerperResponse): PrecedentResult[] {
  const results: PrecedentResult[] = [];
  const seenUrls = new Set<string>();

  // Process organic results
  serperResponse.organic?.forEach((item, index) => {
    if (seenUrls.has(item.link)) return;
    seenUrls.add(item.link);

    const { source, sourceName } = getSourceFromUrl(item.link);

    results.push({
      id: `precedent-${index}`,
      title: item.title,
      description: item.snippet || '',
      url: item.link,
      imageUrl: item.imageUrl || null,
      source,
      sourceName,
    });
  });

  return results;
}

export async function searchPrecedents(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Search precedents function processed a request.');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return { status: 204, headers: CORS_HEADERS };
  }

  // Check for API key
  if (!SERPER_API_KEY) {
    context.error('SERPER_API_KEY is not configured');
    return {
      status: 500,
      body: JSON.stringify({
        error: 'configuration_error',
        message: 'Search service is not configured',
      }),
      headers: CORS_HEADERS,
    };
  }

  try {
    // Parse request body
    let body: SearchPrecedentsRequest;
    try {
      body = (await req.json()) as SearchPrecedentsRequest;
    } catch {
      return {
        status: 400,
        body: JSON.stringify({ error: 'invalid_json', message: 'Invalid JSON body' }),
        headers: CORS_HEADERS,
      };
    }

    // Validate materials
    if (!body.materials || !Array.isArray(body.materials) || body.materials.length === 0) {
      return {
        status: 400,
        body: JSON.stringify({
          error: 'invalid_request',
          message: 'Materials array is required',
        }),
        headers: CORS_HEADERS,
      };
    }

    const maxResults = Math.min(body.maxResults || 12, 20);

    // Build search query
    const query = buildSearchQuery(body.materials);
    context.log(`Search query: ${query}`);

    // Call Serper API
    let serperResponse: SerperResponse;
    try {
      serperResponse = await searchSerper(query, maxResults, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for rate limiting
      if (errorMessage.includes('429')) {
        return {
          status: 429,
          body: JSON.stringify({
            error: 'rate_limit',
            message: 'Search rate limit exceeded. Please try again later.',
          }),
          headers: CORS_HEADERS,
        };
      }

      return {
        status: 502,
        body: JSON.stringify({
          error: 'search_failed',
          message: 'Search service unavailable',
        }),
        headers: CORS_HEADERS,
      };
    }

    // Process and return results
    const results = processResults(serperResponse);

    return {
      status: 200,
      body: JSON.stringify({
        results,
        query,
        totalFound: results.length,
      }),
      headers: CORS_HEADERS,
    };
  } catch (error) {
    context.error('Search precedents error:', error);
    return {
      status: 500,
      body: JSON.stringify({
        error: 'internal_error',
        message: 'Search failed unexpectedly',
      }),
      headers: CORS_HEADERS,
    };
  }
}

app.http('search-precedents', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: searchPrecedents,
});
