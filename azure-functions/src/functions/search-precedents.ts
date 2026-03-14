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
const SERPER_IMAGES_URL = 'https://google.serper.dev/images';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};


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

interface SerperImageResult {
  title: string;
  imageUrl: string;
  link: string;
  position?: number;
}

interface SerperImagesResponse {
  images?: SerperImageResult[];
}

// URL patterns to filter out (category pages, tag pages, pagination, news indexes)
const EXCLUDED_URL_PATTERNS = [
  /\/tag\//i,
  /\/tags\//i,
  /\/page\/\d+/i,
  /\/page-\d+/i,
  /\/category\//i,
  /\/categories\//i,
  /\/search\?/i,
  /\/news$/i,
  /\/news\/$/i,
  /\/architecture$/i,
  /\/projects$/i,
  /\?page=/i,
  /\?p=/i,
];

/**
 * Check if URL is a specific project page (not a category or list page)
 */
function isProjectUrl(url: string): boolean {
  // Reject URLs matching excluded patterns
  for (const pattern of EXCLUDED_URL_PATTERNS) {
    if (pattern.test(url)) {
      return false;
    }
  }

  // Check for ArchDaily project URLs (they have numeric IDs in path)
  if (url.includes('archdaily.com')) {
    // Valid: /123456/project-name or /us/123456/project-name
    return /archdaily\.com\/(?:[a-z]{2}\/)?(\d{4,})\//i.test(url);
  }

  // Check for Dezeen project URLs (year/month/day pattern for articles)
  if (url.includes('dezeen.com')) {
    // Valid: /2024/01/15/project-name
    return /dezeen\.com\/\d{4}\/\d{2}\/\d{2}\//i.test(url);
  }

  // Check for Architizer project URLs
  if (url.includes('architizer.com')) {
    // Valid: /projects/project-name
    return /architizer\.com\/projects\//i.test(url);
  }

  // Check for Designboom project URLs
  if (url.includes('designboom.com')) {
    // Valid: /architecture/firm-name/project-name-date
    return /designboom\.com\/architecture\/[^/]+\/[^/]+-\d{2}-\d{2}-\d{4}/i.test(url);
  }

  // For other sources, be more permissive but still filter common patterns
  return true;
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
 * Build an optimized search query to find buildings using specific materials
 * Note: Serper API has limitations on query complexity - avoid OR operators and parentheses
 */
function buildSearchQuery(materials: MaterialInput[]): string {
  // Extract unique material types (e.g., timber, steel, concrete, glass)
  const materialTypes = new Set<string>();
  materials.forEach((m) => {
    if (m.materialType) {
      materialTypes.add(m.materialType.toLowerCase());
    }
  });

  // Extract key material descriptors
  // e.g., "CLT" from "CLT Panel", "exposed concrete" from material name
  const materialDescriptors: string[] = [];
  materials.forEach((m) => {
    const name = m.name.toLowerCase();

    // Extract meaningful terms
    if (name.includes('clt') || name.includes('cross-laminated')) {
      materialDescriptors.push('CLT');
    }
    if (name.includes('exposed')) {
      materialDescriptors.push('exposed');
    }
    if (name.includes('polished')) {
      materialDescriptors.push('polished');
    }
    if (name.includes('brick')) {
      materialDescriptors.push('brick');
    }
    if (name.includes('glazing') || name.includes('glazed')) {
      materialDescriptors.push('glazing');
    }
    if (name.includes('curtain wall')) {
      materialDescriptors.push('curtain wall');
    }
    if (name.includes('corten') || name.includes('weathering')) {
      materialDescriptors.push('corten steel');
    }
    if (name.includes('terrazzo')) {
      materialDescriptors.push('terrazzo');
    }
  });

  // Build a simple query - Serper doesn't handle complex OR/parentheses well
  const queryParts: string[] = [];

  // Primary material types (limit to top 2 to keep query simple)
  const typeList = Array.from(materialTypes).slice(0, 2);
  if (typeList.length > 0) {
    queryParts.push(typeList.join(' '));
  }

  // Add one special descriptor if present
  const uniqueDescriptors = [...new Set(materialDescriptors)].slice(0, 1);
  if (uniqueDescriptors.length > 0) {
    queryParts.push(uniqueDescriptors[0]);
  }

  // Simple architecture keyword
  queryParts.push('architecture building');

  // Use just one primary site filter to keep query simple
  // The image search will still return results from other sites
  queryParts.push('site:archdaily.com');

  return queryParts.join(' ');
}

/**
 * Call Serper Images API to search for precedent images
 */
async function searchSerperImages(
  query: string,
  maxResults: number,
  context: InvocationContext
): Promise<SerperImagesResponse> {
  // Request more results than needed since we'll filter some out
  const numToRequest = Math.min(maxResults * 3, 50);

  const response = await fetch(SERPER_IMAGES_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: numToRequest,
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
 * Process Serper image results into normalized precedent results
 */
function processResults(
  serperResponse: SerperImagesResponse,
  maxResults: number,
  context: InvocationContext
): PrecedentResult[] {
  const results: PrecedentResult[] = [];
  const seenUrls = new Set<string>();

  // Process image results
  for (const item of serperResponse.images || []) {
    // Stop if we have enough results
    if (results.length >= maxResults) break;

    // Skip duplicate URLs
    if (seenUrls.has(item.link)) continue;

    // Filter out non-project URLs
    if (!isProjectUrl(item.link)) {
      context.log(`Filtered out non-project URL: ${item.link}`);
      continue;
    }

    seenUrls.add(item.link);
    const { source, sourceName } = getSourceFromUrl(item.link);

    // Clean up title (remove site name suffix if present)
    let cleanTitle = item.title;
    const siteSuffixes = ['| ArchDaily', '- Dezeen', '| Architizer', '- designboom'];
    for (const suffix of siteSuffixes) {
      if (cleanTitle.includes(suffix)) {
        cleanTitle = cleanTitle.replace(suffix, '').trim();
      }
    }

    results.push({
      id: `precedent-${results.length}`,
      title: cleanTitle,
      description: '', // Image search doesn't return descriptions
      url: item.link,
      imageUrl: item.imageUrl,
      source,
      sourceName,
    });
  }

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

    // Call Serper Images API
    let serperResponse: SerperImagesResponse;
    try {
      serperResponse = await searchSerperImages(query, maxResults, context);
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
    const results = processResults(serperResponse, maxResults, context);

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
