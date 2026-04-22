/**
 * Enrich Precedent Images Function
 *
 * POST /api/enrich-precedent-images
 *
 * Lazy-loads og:image metadata for precedent URLs.
 * Called by frontend after initial text-first precedent cards are displayed.
 * Includes in-memory caching with 24h TTL.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// =============================================================================
// Configuration
// =============================================================================

const METADATA_FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// =============================================================================
// TypeScript Interfaces
// =============================================================================

interface EnrichRequest {
  urls: string[];
}

interface CachedMetadata {
  imageUrl: string | null;
  fetchedAt: number;
}

interface EnrichResult {
  url: string;
  imageUrl: string | null;
  cached: boolean;
}

// =============================================================================
// In-Memory Cache
// =============================================================================

const metadataCache = new Map<string, CachedMetadata>();

function getCachedImage(url: string): CachedMetadata | null {
  const cached = metadataCache.get(url);
  if (!cached) return null;

  // Check if cache is still valid
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    metadataCache.delete(url);
    return null;
  }

  return cached;
}

function setCachedImage(url: string, imageUrl: string | null): void {
  metadataCache.set(url, {
    imageUrl,
    fetchedAt: Date.now(),
  });
}

// =============================================================================
// Image URL Filtering
// =============================================================================

const LOGO_PATTERNS = [
  /logo/i,
  /dezeen-logo/i,
  /dezeen-sq/i,
  /archdaily-logo/i,
  /designboom-logo/i,
  /default-image/i,
  /placeholder/i,
  /avatar/i,
  /icon/i,
  /favicon/i,
  /share-image/i,
  /social-share/i,
];

function isLikelyLogo(imageUrl: string): boolean {
  return LOGO_PATTERNS.some((pattern) => pattern.test(imageUrl));
}

// =============================================================================
// Metadata Fetching
// =============================================================================

async function fetchImageUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MoodboardBot/1.0)',
        Accept: 'text/html',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Try multiple image sources in priority order
    const imageCandidates: (string | null)[] = [];

    // 1. og:image
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImageMatch?.[1]) imageCandidates.push(ogImageMatch[1]);

    // 2. twitter:image
    const twitterImageMatch =
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twitterImageMatch?.[1]) imageCandidates.push(twitterImageMatch[1]);

    // 3. article:image
    const articleImageMatch =
      html.match(/<meta[^>]+property=["']article:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:image["']/i);
    if (articleImageMatch?.[1]) imageCandidates.push(articleImageMatch[1]);

    // 4. First large image in content (for sites like Dezeen)
    const contentImgMatch = html.match(
      /<(?:article|main|div[^>]*class=["'][^"']*(?:content|article|post|entry)[^"']*["'])[^>]*>[\s\S]{0,3000}?<img[^>]+src=["']([^"']+)["']/i
    );
    if (contentImgMatch?.[1]) imageCandidates.push(contentImgMatch[1]);

    // Select first non-logo image
    for (const candidate of imageCandidates) {
      if (candidate && !isLikelyLogo(candidate)) {
        return candidate;
      }
    }

    // If all images look like logos, use the first one anyway
    if (imageCandidates.length > 0 && imageCandidates[0]) {
      return imageCandidates[0];
    }

    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// Main Handler
// =============================================================================

export async function enrichPrecedentImages(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Enrich precedent images function processed a request.');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return { status: 204, headers: CORS_HEADERS };
  }

  try {
    // Parse request body
    let body: EnrichRequest;
    try {
      body = (await req.json()) as EnrichRequest;
    } catch {
      return {
        status: 400,
        body: JSON.stringify({ error: 'invalid_json', message: 'Invalid JSON body' }),
        headers: CORS_HEADERS,
      };
    }

    // Validate URLs
    if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
      return {
        status: 400,
        body: JSON.stringify({
          error: 'invalid_request',
          message: 'URLs array is required',
        }),
        headers: CORS_HEADERS,
      };
    }

    // Limit to 10 URLs per request
    const urls = body.urls.slice(0, 10);
    context.log(`Enriching images for ${urls.length} URLs`);

    // Process URLs - check cache first, then fetch
    const results: EnrichResult[] = [];
    const fetchPromises: Promise<void>[] = [];

    for (const url of urls) {
      const cached = getCachedImage(url);
      if (cached) {
        results.push({
          url,
          imageUrl: cached.imageUrl,
          cached: true,
        });
        context.log(`Cache hit: ${url}`);
      } else {
        // Queue fetch
        const fetchPromise = fetchImageUrl(url).then((imageUrl) => {
          setCachedImage(url, imageUrl);
          results.push({
            url,
            imageUrl,
            cached: false,
          });
          context.log(`Fetched: ${url} -> ${imageUrl ? 'found' : 'no image'}`);
        });
        fetchPromises.push(fetchPromise);
      }
    }

    // Wait for all fetches to complete
    await Promise.all(fetchPromises);

    // Sort results to match input order
    const orderedResults = urls.map((url) => {
      const result = results.find((r) => r.url === url);
      return result || { url, imageUrl: null, cached: false };
    });

    return {
      status: 200,
      body: JSON.stringify({
        images: orderedResults,
        cacheStats: {
          hits: results.filter((r) => r.cached).length,
          misses: results.filter((r) => !r.cached).length,
        },
      }),
      headers: CORS_HEADERS,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Enrich precedent images error:', errorMessage);

    return {
      status: 500,
      body: JSON.stringify({
        error: 'internal_error',
        message: 'Image enrichment failed',
      }),
      headers: CORS_HEADERS,
    };
  }
}

app.http('enrich-precedent-images', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: enrichPrecedentImages,
});
