/**
 * Search Precedents Function
 *
 * POST /api/search-precedents
 *
 * Materials-led architectural precedent finder.
 * Uses web search + LLM curation to return exactly 3 high-quality precedents.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// =============================================================================
// Configuration
// =============================================================================

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const SERPER_WEB_URL = 'https://google.serper.dev/search';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// NOTE: gemini-2.0-flash deprecated, shuts down 1 June 2026
// Migrated to gemini-2.5-flash for precedent curation
const GEMINI_TEXT_URL =
  process.env.GEMINI_TEXT_ENDPOINT ||
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const RESULTS_PER_QUERY = 8;
const MAX_QUERIES = 4;
const SHORTLIST_SIZE = 6;            // candidates passed to LLM selector
const FINAL_RESULTS_COUNT = 3;
const METADATA_FETCH_TIMEOUT_MS = 5000;
const SNIPPET_MAX_CHARS = 200;       // max snippet chars sent to LLM
const MAX_PER_DOMAIN = 2;            // max candidates per domain in shortlist

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// =============================================================================
// TypeScript Interfaces
// =============================================================================

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

interface SerperWebResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperWebResponse {
  organic?: SerperWebResult[];
}

interface PageMetadata {
  ogImage: string | null;
  ogTitle: string | null;
  metaDescription: string | null;
  fetchError?: string;
}

interface CandidatePrecedent {
  url: string;
  title: string;
  snippet: string;
  source: 'archdaily' | 'dezeen' | 'architizer' | 'designboom' | 'divisare' | 'other';
  sourceName: string;
  score: number;
}

interface MaterialsBrief {
  materialTypes: string[];
  finishes: string[];
  keywords: string[];
  categories: string[];
  searchTerms: string[];
}

interface LLMSelectedItem {
  url: string;
  confidence: number;
  matchType: 'direct' | 'close' | 'conceptual';
  matchedMaterials: string[];
  shortReason: string;
}

interface LLMSelectionResult {
  selected: LLMSelectedItem[];
}

interface LLMSummaryResult {
  summaries: Record<string, string>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface PrecedentResult {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: 'archdaily' | 'dezeen' | 'architizer' | 'designboom' | 'divisare' | 'other';
  sourceName: string;
}

// =============================================================================
// URL Filtering
// =============================================================================

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
  /\/author\//i,
  /\/office\//i,
  /\/firm\//i,
  /\/product\//i,
  /\/products\//i,
  /\/materials\//i,
  /\/about/i,
  /\/contact/i,
  // Exclude guides, listicles, and editorial content
  /\/guide/i,
  /\/guides\//i,
  /-guide-to-/i,
  /\/tips\//i,
  /\/how-to\//i,
  /\/best-/i,
  /\/top-\d+/i,
  /\d+-best-/i,
  /\d+-top-/i,
  /\/lookbook/i,
  /\/roundup/i,
  /\/collection\//i,
  /\/inspiration\//i,
  /\/trends\//i,
  /\/event\//i,
  /\/events\//i,
  /\/exhibition\//i,
  /\/fair\//i,
  /\/week\//i,
  /dutch-design-week/i,
  /milan-design-week/i,
  /london-design-festival/i,
  // Exclude manufacturer/supplier pages
  /\/manufacturer\//i,
  /\/supplier\//i,
  /\/company\//i,
  /\/brand\//i,
  /co\.\,?\s*ltd/i,
  // Exclude generic blogs and news sub-paths
  /\/blog\b/i,
  /\/blog\//i,
  /\/news\//i,
  /\/trend\//i,
  // Exclude shop / purchase / comparison pages
  /\/shop\b/i,
  /\/shop\//i,
  /\/store\b/i,
  /\/buy\b/i,
  /\/review\b/i,
  /\/compare\b/i,
  /\/price\b/i,
  /\/pricing\b/i,
  // Exclude social/platform aggregator noise
  /\/pin\//i,
  /\/saved\//i,
  /\/collections\//i,
];

function isProjectUrl(url: string): boolean {
  for (const pattern of EXCLUDED_URL_PATTERNS) {
    if (pattern.test(url)) {
      return false;
    }
  }

  // ArchDaily: requires numeric ID in path
  if (url.includes('archdaily.com')) {
    return /archdaily\.com\/(?:[a-z]{2}\/)?(\d{4,})\//i.test(url);
  }

  // Dezeen: requires date-stamped path
  if (url.includes('dezeen.com')) {
    return /dezeen\.com\/\d{4}\/\d{2}\/\d{2}\//i.test(url);
  }

  // Architizer: requires /projects/ path
  if (url.includes('architizer.com')) {
    return /architizer\.com\/projects\//i.test(url);
  }

  // Designboom: requires date in URL slug
  if (url.includes('designboom.com')) {
    return /designboom\.com\/architecture\/[^/]+\/[^/]+-\d{2}-\d{2}-\d{4}/i.test(url);
  }

  // Divisare: requires /projects/ path
  if (url.includes('divisare.com')) {
    return /divisare\.com\/projects\//i.test(url);
  }

  // For all other domains: require at least one path segment (filter bare homepages)
  // and fast-accept known architect portfolio path patterns
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 1) return false;
    if (/\/(projects?|work|portfolio|architecture)\//i.test(pathname)) return true;
  } catch {
    // malformed URL — let through and rely on pre-ranking
  }

  return true;
}

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
  if (urlLower.includes('divisare.com')) {
    return { source: 'divisare', sourceName: 'Divisare' };
  }
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return { source: 'other', sourceName: domain };
  } catch {
    return { source: 'other', sourceName: 'Unknown' };
  }
}

// =============================================================================
// Step 1: Normalize Materials Brief
// =============================================================================

function normalizeMaterialsBrief(materials: MaterialInput[]): MaterialsBrief {
  const materialTypes = new Set<string>();
  const finishes = new Set<string>();
  const keywords = new Set<string>();
  const categories = new Set<string>();

  for (const m of materials) {
    if (m.materialType) {
      materialTypes.add(m.materialType.toLowerCase());
    }
    if (m.finish) {
      finishes.add(m.finish.toLowerCase());
    }
    if (m.category) {
      categories.add(m.category.toLowerCase());
    }
    if (m.keywords) {
      m.keywords.forEach((k) => keywords.add(k.toLowerCase()));
    }

    // Extract special terms from name
    const name = m.name.toLowerCase();
    const specialTerms = [
      { pattern: /clt|cross[- ]?laminated/i, term: 'CLT timber' },
      { pattern: /glulam/i, term: 'glulam' },
      { pattern: /corten|weathering steel/i, term: 'corten steel' },
      { pattern: /terrazzo/i, term: 'terrazzo' },
      { pattern: /exposed concrete|fair[- ]?faced/i, term: 'exposed concrete' },
      { pattern: /board[- ]?formed/i, term: 'board-formed concrete' },
      { pattern: /curtain wall/i, term: 'curtain wall' },
      { pattern: /rammed earth/i, term: 'rammed earth' },
      { pattern: /brick|masonry/i, term: 'brick' },
      { pattern: /zinc/i, term: 'zinc cladding' },
      { pattern: /copper/i, term: 'copper facade' },
      { pattern: /cork/i, term: 'cork' },
      { pattern: /hemp/i, term: 'hempcrete' },
      { pattern: /bamboo/i, term: 'bamboo' },
      { pattern: /slate/i, term: 'slate' },
      { pattern: /marble/i, term: 'marble' },
      { pattern: /granite/i, term: 'granite' },
      { pattern: /limestone/i, term: 'limestone' },
      { pattern: /travertine/i, term: 'travertine' },
    ];

    for (const { pattern, term } of specialTerms) {
      if (pattern.test(name)) {
        keywords.add(term);
      }
    }
  }

  const searchTerms = [
    ...Array.from(materialTypes),
    ...Array.from(keywords).slice(0, 3),
  ];

  return {
    materialTypes: Array.from(materialTypes),
    finishes: Array.from(finishes),
    keywords: Array.from(keywords),
    categories: Array.from(categories),
    searchTerms,
  };
}

// =============================================================================
// Step 2: Generate Search Queries
// =============================================================================

function generateSearchQueries(brief: MaterialsBrief): string[] {
  const queries: string[] = [];

  // Top publishers for project pages — Divisare included explicitly
  const topPublishers =
    'site:archdaily.com OR site:dezeen.com OR site:divisare.com OR site:architizer.com OR site:designboom.com';
  // Strong editorial/product exclusions baked into every query
  const excludeTerms =
    '-guide -"best of" -roundup -trends -event -exhibition -week -product -supplier -shop';

  const primaryTypes = brief.materialTypes.slice(0, 2).join(' ');
  const primaryKeyword = brief.keywords[0] ?? primaryTypes;

  // Query 1: Material + residential programme on top publishers (highest hit rate for project pages)
  if (primaryTypes) {
    queries.push(
      `${primaryTypes} house OR residence OR dwelling ${topPublishers} ${excludeTerms}`
    );
  }

  // Query 2: Specific material term + completed architecture project on top publishers
  if (primaryKeyword) {
    queries.push(
      `${primaryKeyword} completed architecture project ${topPublishers} ${excludeTerms}`
    );
  }

  // Query 3: Material + civic/cultural/workplace programme on top publishers
  if (primaryTypes) {
    queries.push(
      `${primaryTypes} office OR museum OR school OR library OR community ${topPublishers} ${excludeTerms}`
    );
  }

  // Query 4: Divisare-targeted search — very high precision, only real project pages
  const divisareTerms =
    brief.keywords.slice(0, 2).join(' ') || primaryTypes;
  if (divisareTerms) {
    queries.push(`${divisareTerms} site:divisare.com`);
  }

  // Ensure at least 3 queries
  if (queries.length < 3 && primaryTypes) {
    queries.push(`${primaryTypes} architecture project ${topPublishers} ${excludeTerms}`);
  }

  return queries.slice(0, MAX_QUERIES);
}

// =============================================================================
// Step 3: Serper Web Search
// =============================================================================

async function searchSerperWeb(
  query: string,
  numResults: number,
  context: InvocationContext
): Promise<SerperWebResponse> {
  context.log(`Serper query: ${query}`);

  const response = await fetch(SERPER_WEB_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: numResults,
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

// =============================================================================
// Step 4: Merge, URL-Normalise, and Dedupe Results
// =============================================================================

// Shared site-suffix list used for title normalisation
const SITE_TITLE_SUFFIXES = [
  '| archdaily', '- archdaily', '- dezeen', '| dezeen',
  '| architizer', '- designboom', '| designboom', '| divisare',
];

function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid', 'gclid'].forEach((p) =>
      u.searchParams.delete(p)
    );
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '').split('#')[0];
  }
}

function normalizeTitleForDedup(title: string): string {
  let t = title.toLowerCase();
  for (const suffix of SITE_TITLE_SUFFIXES) {
    t = t.replace(suffix, '');
  }
  return t.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function mergeAndDedupeResults(
  allResults: SerperWebResult[][]
): CandidatePrecedent[] {
  const urlScores = new Map<
    string,
    { result: SerperWebResult; score: number; normalizedUrl: string }
  >();

  for (const results of allResults) {
    for (const result of results) {
      const normalizedUrl = normalizeUrlForDedup(result.link);
      // Match by normalised URL to collapse trivial variants (trailing slash, tracking params)
      let existingKey: string | undefined;
      for (const [key, val] of urlScores.entries()) {
        if (val.normalizedUrl === normalizedUrl) {
          existingKey = key;
          break;
        }
      }
      if (existingKey) {
        urlScores.get(existingKey)!.score += 11 - result.position;
      } else {
        urlScores.set(result.link, {
          result,
          score: 11 - result.position,
          normalizedUrl,
        });
      }
    }
  }

  // Sort by raw search score descending
  const sorted = Array.from(urlScores.entries()).sort((a, b) => b[1].score - a[1].score);

  // Dedupe near-identical titles (same project on different URLs)
  const seenTitles = new Set<string>();
  const candidates: CandidatePrecedent[] = [];

  for (const [url, { result, score }] of sorted) {
    const normalizedTitle = normalizeTitleForDedup(result.title);
    if (normalizedTitle && seenTitles.has(normalizedTitle)) continue;
    if (normalizedTitle) seenTitles.add(normalizedTitle);

    const { source, sourceName } = getSourceFromUrl(url);
    candidates.push({
      url,
      title: result.title,
      snippet: result.snippet,
      source,
      sourceName,
      score,
    });
  }

  return candidates;
}

// =============================================================================
// Step 5: Filter Non-Project URLs
// =============================================================================

function filterProjectUrls(
  candidates: CandidatePrecedent[],
  context: InvocationContext
): CandidatePrecedent[] {
  const filtered = candidates.filter((c) => {
    const isProject = isProjectUrl(c.url);
    if (!isProject) {
      context.log(`Filtered out: ${c.url}`);
    }
    return isProject;
  });
  return filtered;
}

// =============================================================================
// Step 5b: Pre-rank by Source Quality and Material Signals
// =============================================================================

function getSourceQualityScore(url: string): number {
  const u = url.toLowerCase();
  // Tiered source trust — Divisare and ArchDaily/Dezeen are highest trust
  if (u.includes('divisare.com')) return 18;
  if (u.includes('archdaily.com')) return 12;
  if (u.includes('dezeen.com')) return 12;
  if (u.includes('architizer.com')) return 10;
  if (u.includes('designboom.com')) return 8;
  // Architect/institutional portfolio path patterns (non-listed sources)
  if (/\/(projects?|work|portfolio)\//i.test(u)) return 15;
  return 0;
}

const PROJECT_SIGNAL_WORDS = [
  'house', 'studio', 'extension', 'school', 'office', 'dwelling', 'gallery',
  'centre', 'center', 'library', 'apartment', 'residence', 'housing', 'museum',
  'church', 'chapel', 'tower', 'villa', 'cabin', 'barn', 'lodge', 'clinic',
  'hall', 'pavilion', 'project', 'building',
];

const NEGATIVE_SIGNAL_WORDS = [
  'product', 'shop', 'guide', 'trend', 'best', 'ideas', 'roundup',
  'listicle', 'buy', 'price', 'review', 'compare', 'manufacturer',
  'supplier', 'inspiration', 'lookbook', 'news', 'blog',
];

function getSignalScore(candidate: CandidatePrecedent): number {
  const combined = `${candidate.url} ${candidate.title} ${candidate.snippet}`.toLowerCase();
  let score = 0;
  for (const w of PROJECT_SIGNAL_WORDS) {
    if (combined.includes(w)) { score += 6; break; }
  }
  for (const w of NEGATIVE_SIGNAL_WORDS) {
    if (combined.includes(w)) { score -= 20; break; }
  }
  return score;
}

function preRankCandidates(candidates: CandidatePrecedent[]): CandidatePrecedent[] {
  return candidates
    .map((c) => ({
      ...c,
      score: c.score + getSourceQualityScore(c.url) + getSignalScore(c),
    }))
    .sort((a, b) => b.score - a.score);
}

// =============================================================================
// Step 5c: Diversify Shortlist (max MAX_PER_DOMAIN per domain)
// =============================================================================

function diversifyShortlist(
  candidates: CandidatePrecedent[],
  size: number
): CandidatePrecedent[] {
  const domainCounts = new Map<string, number>();
  const shortlist: CandidatePrecedent[] = [];

  for (const c of candidates) {
    let domain: string;
    try {
      domain = new URL(c.url).hostname.replace('www.', '');
    } catch {
      domain = 'unknown';
    }
    const count = domainCounts.get(domain) ?? 0;
    if (count < MAX_PER_DOMAIN) {
      shortlist.push(c);
      domainCounts.set(domain, count + 1);
    }
    if (shortlist.length >= size) break;
  }

  // Fill remaining slots ignoring the domain cap if we're still short
  if (shortlist.length < size) {
    for (const c of candidates) {
      if (!shortlist.find((s) => s.url === c.url)) {
        shortlist.push(c);
        if (shortlist.length >= size) break;
      }
    }
  }

  return shortlist;
}

// =============================================================================
// Step 6: LLM Selection with Gemini
// =============================================================================

const SELECTION_PROMPT = `You are an expert architectural curator. Select exactly 3 real, completed building projects from the shortlist below that best match the designer's material palette.

## Material Brief
- Material types: {materialTypes}
- Finishes: {finishes}
- Key material terms: {keywords}

## Match Hierarchy (apply strictly)
- direct match: the listed materials or systems are explicitly evidenced in the title, snippet, or source
- close match: materially equivalent finishes or construction systems are clearly evidenced
- conceptual match: only atmospheric, tonal, or sustainability similarity

Prefer: direct match > close match > conceptual match.

## Candidate Projects
{candidatesList}

## Selection Rules
1. Select only REAL BUILT BUILDINGS — not concepts, pavilions, exhibitions, or speculative schemes.
2. Prefer architect-owned project pages and Divisare entries — they are high-trust sources.
3. Prefer material relevance over visual or atmospheric similarity.
4. Ensure the 3 results span different building types or scales where relevance remains high.
5. Reject any candidate that is a product page, guide, listicle, news article, trend feature, or manufacturer page — even if it passed pre-filtering.
6. If fewer than 3 valid building projects exist, return only the valid ones.

## Output Format
Respond with ONLY valid JSON. No markdown, no code blocks, no explanation outside the JSON.
{
  "selected": [
    {
      "url": "...",
      "confidence": 0.0,
      "matchType": "direct",
      "matchedMaterials": ["material a"],
      "shortReason": "One sentence explaining the match."
    }
  ]
}`;

async function selectBestPrecedentsWithLLM(
  candidates: CandidatePrecedent[],
  brief: MaterialsBrief,
  context: InvocationContext
): Promise<LLMSelectionResult> {
  const shortlist = candidates.slice(0, SHORTLIST_SIZE);

  const candidatesList = shortlist
    .map(
      (c, i) =>
        `${i + 1}. URL: ${c.url}\n   Title: ${c.title}\n   Snippet: ${c.snippet.slice(0, SNIPPET_MAX_CHARS)}\n   Source: ${c.sourceName}`
    )
    .join('\n\n');

  const prompt = SELECTION_PROMPT.replace(
    '{materialTypes}',
    brief.materialTypes.join(', ') || 'various'
  )
    .replace('{finishes}', brief.finishes.join(', ') || 'various')
    .replace('{keywords}', brief.keywords.join(', ') || 'none specified')
    .replace('{candidatesList}', candidatesList);

  context.log('Calling Gemini for selection...');

  const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.15,
        topP: 0.9,
      },
    }),
  });

  if (!response.ok) {
    context.error(`Gemini API error: ${response.status}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse LLM selection response');
  }

  return JSON.parse(jsonMatch[0]) as LLMSelectionResult;
}

// =============================================================================
// Step 7: Fetch Page Metadata
// =============================================================================

// Known logo/generic images to filter out
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
];

function isLikelyLogo(imageUrl: string): boolean {
  return LOGO_PATTERNS.some((pattern) => pattern.test(imageUrl));
}

async function fetchPageMetadata(url: string): Promise<PageMetadata> {
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
      return { ogImage: null, ogTitle: null, metaDescription: null, fetchError: `HTTP ${response.status}` };
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
    // Look for <img> tags with width/height attributes > 400px or in article/main content
    const contentImgMatch = html.match(
      /<(?:article|main|div[^>]*class=["'][^"']*(?:content|article|post|entry)[^"']*["'])[^>]*>[\s\S]{0,3000}?<img[^>]+src=["']([^"']+)["']/i
    );
    if (contentImgMatch?.[1]) imageCandidates.push(contentImgMatch[1]);

    // Select first non-logo image
    let ogImage: string | null = null;
    for (const candidate of imageCandidates) {
      if (candidate && !isLikelyLogo(candidate)) {
        ogImage = candidate;
        break;
      }
    }

    // If all images look like logos, use the first one anyway
    if (!ogImage && imageCandidates.length > 0 && imageCandidates[0]) {
      ogImage = imageCandidates[0];
    }

    // Extract og:title
    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const ogTitle = ogTitleMatch?.[1] || null;

    // Extract meta description
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const metaDescription = descMatch?.[1] || null;

    return { ogImage, ogTitle, metaDescription };
  } catch (err) {
    return {
      ogImage: null,
      ogTitle: null,
      metaDescription: null,
      fetchError: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function fetchAllMetadata(
  urls: string[],
  context: InvocationContext
): Promise<Record<string, PageMetadata>> {
  const results: Record<string, PageMetadata> = {};

  const promises = urls.map((url) =>
    fetchPageMetadata(url).then((meta) => {
      if (meta.fetchError) {
        context.warn(`Metadata fetch failed for ${url}: ${meta.fetchError}`);
      }
      return { url, meta };
    })
  );

  const settled = await Promise.allSettled(promises);

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results[result.value.url] = result.value.meta;
    }
  }

  return results;
}

// =============================================================================
// Step 8: Generate Summaries with Gemini
// =============================================================================

const SUMMARY_PROMPT = `You are an architectural writer producing project descriptions for a design research tool.

## Material Context
Designer's material palette: {materialTypes}{finishContext}.

## Projects
{projectsList}

## Instructions
For each project, write exactly 2 factual sentences.
- Sentence 1: Describe the building type and location only if confirmed by the title or snippet. Do not invent the architect name if it is not stated in the title or snippet.
- Sentence 2: Describe how the materials are applied. Only state what is directly evidenced in the title or snippet. Omit any detail that is not confirmed — do not invent material specifics, finishes, awards, or programme details.

Do not hallucinate. If a fact is absent, omit it rather than guessing.
Keep each description under 50 words total.

## Output Format
Respond with ONLY valid JSON. No markdown, no code blocks.
{"summaries": {"url1": "Two sentences.", "url2": "Two sentences.", "url3": "Two sentences."}}`;

async function generateSummariesWithLLM(
  selectedCandidates: CandidatePrecedent[],
  brief: MaterialsBrief,
  context: InvocationContext
): Promise<LLMSummaryResult> {
  const projectsList = selectedCandidates
    .map((c) =>
      `URL: ${c.url}\nTitle: ${c.title}\nSnippet: ${c.snippet.slice(0, SNIPPET_MAX_CHARS)}\nSource: ${c.sourceName}`
    )
    .join('\n\n---\n\n');

  const finishContext =
    brief.finishes.length > 0 ? ` with finishes including ${brief.finishes.join(', ')}` : '';

  const prompt = SUMMARY_PROMPT.replace(
    '{materialTypes}',
    brief.materialTypes.join(', ') || 'various materials'
  )
    .replace('{finishContext}', finishContext)
    .replace('{projectsList}', projectsList);

  context.log('Calling Gemini for summaries...');

  const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        topP: 0.9,
      },
    }),
  });

  if (!response.ok) {
    context.error(`Gemini API error: ${response.status}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse LLM summary response');
  }

  return JSON.parse(jsonMatch[0]) as LLMSummaryResult;
}

// =============================================================================
// Step 9: Assemble Final Results
// =============================================================================

function assembleFinalResults(
  selectedCandidates: CandidatePrecedent[],
  metadata: Record<string, PageMetadata>,
  summaries: LLMSummaryResult
): PrecedentResult[] {
  return selectedCandidates.map((c, index) => {
    const meta: PageMetadata = metadata[c.url] || { ogImage: null, ogTitle: null, metaDescription: null };
    const summary = summaries.summaries[c.url] || c.snippet;

    // Clean up title
    let cleanTitle = meta.ogTitle || c.title;
    const siteSuffixes = [
      '| ArchDaily',
      ' - ArchDaily',
      '- Dezeen',
      ' | Dezeen',
      '| Architizer',
      '- designboom',
      '| designboom',
      '| Divisare',
    ];
    for (const suffix of siteSuffixes) {
      cleanTitle = cleanTitle.replace(suffix, '').trim();
    }

    // Decode HTML entities
    cleanTitle = cleanTitle
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    return {
      id: `precedent-${index}`,
      title: cleanTitle,
      description: summary,
      url: c.url,
      imageUrl: meta.ogImage,
      source: c.source,
      sourceName: c.sourceName,
    };
  });
}

// =============================================================================
// Main Handler
// =============================================================================

async function handleSearchWithFallbacks(
  materials: MaterialInput[],
  context: InvocationContext
): Promise<{ results: PrecedentResult[]; query: string }> {
  // Step 1: Normalize materials
  const brief = normalizeMaterialsBrief(materials);
  context.log(`Materials brief: ${JSON.stringify(brief)}`);

  // Step 2: Generate queries (4 focused queries)
  const queries = generateSearchQueries(brief);
  context.log(`Generated ${queries.length} search queries`);

  // Step 3: Execute all searches in parallel
  const searchPromises = queries.map((q) =>
    searchSerperWeb(q, RESULTS_PER_QUERY, context).catch((err) => {
      context.warn(`Search query failed: ${err.message}`);
      return { organic: [] } as SerperWebResponse;
    })
  );

  const searchResponses = await Promise.all(searchPromises);
  const allResults = searchResponses.map((r) => r.organic || []);

  const totalResults = allResults.flat().length;
  context.log(`Total search results: ${totalResults}`);

  if (totalResults === 0) {
    throw new Error('no_results');
  }

  // Step 4: Merge, URL-normalise, title-dedupe
  let candidates = mergeAndDedupeResults(allResults);
  context.log(`Unique candidates after merge/dedupe: ${candidates.length}`);

  // Step 5a: Filter non-project URLs
  candidates = filterProjectUrls(candidates, context);
  context.log(`Candidates after URL filter: ${candidates.length}`);

  if (candidates.length === 0) {
    throw new Error('no_results');
  }

  // Step 5b: Pre-rank by source quality + material signals
  candidates = preRankCandidates(candidates);
  context.log(`Candidates pre-ranked, top score: ${candidates[0]?.score ?? 0}`);

  // Step 5c: Diversify → SHORTLIST_SIZE candidates (max MAX_PER_DOMAIN per domain)
  const shortlist = diversifyShortlist(candidates, SHORTLIST_SIZE);
  context.log(`Shortlist size: ${shortlist.length}`);

  // Step 6: LLM Selection (receives a small, high-quality, varied shortlist)
  let selectedItems: LLMSelectedItem[];
  try {
    const selection = await selectBestPrecedentsWithLLM(shortlist, brief, context);
    selectedItems = selection.selected || [];
    context.log(`LLM selected ${selectedItems.length} projects`);
  } catch (err) {
    context.warn(`LLM selection failed: ${err instanceof Error ? err.message : err}`);
    // Fallback: top FINAL_RESULTS_COUNT from shortlist
    selectedItems = shortlist.slice(0, FINAL_RESULTS_COUNT).map((c) => ({
      url: c.url,
      confidence: 0.5,
      matchType: 'conceptual' as const,
      matchedMaterials: [],
      shortReason: 'Fallback selection.',
    }));
  }

  // Resolve selected candidates in LLM order; also accept URLs from full candidate pool
  const selectedCandidates: CandidatePrecedent[] = [];
  for (const item of selectedItems) {
    const candidate =
      shortlist.find((c) => c.url === item.url) ?? candidates.find((c) => c.url === item.url);
    if (candidate) selectedCandidates.push(candidate);
  }

  // Fill to FINAL_RESULTS_COUNT from shortlist if LLM returned fewer
  if (selectedCandidates.length < FINAL_RESULTS_COUNT) {
    for (const c of shortlist) {
      if (!selectedCandidates.find((s) => s.url === c.url)) {
        selectedCandidates.push(c);
        if (selectedCandidates.length >= FINAL_RESULTS_COUNT) break;
      }
    }
  }

  const finalCandidates = selectedCandidates.slice(0, FINAL_RESULTS_COUNT);

  // Steps 7 & 8: Fetch og:image metadata and generate summaries in parallel
  // Summaries are built from title+snippet only (no metaDescription needed)
  let metadata: Record<string, PageMetadata> = {};
  let summaries: LLMSummaryResult = { summaries: {} };

  try {
    [metadata, summaries] = await Promise.all([
      fetchAllMetadata(finalCandidates.map((c) => c.url), context).catch((err) => {
        context.warn(`Metadata fetch failed: ${err instanceof Error ? err.message : err}`);
        return {} as Record<string, PageMetadata>;
      }),
      generateSummariesWithLLM(finalCandidates, brief, context).catch((err) => {
        context.warn(`Summary generation failed: ${err instanceof Error ? err.message : err}`);
        const fallback: LLMSummaryResult = { summaries: {} };
        finalCandidates.forEach((c) => { fallback.summaries[c.url] = c.snippet; });
        return fallback;
      }),
    ]);
  } catch (err) {
    context.warn(`Parallel enrichment failed: ${err instanceof Error ? err.message : err}`);
    finalCandidates.forEach((c) => { summaries.summaries[c.url] = c.snippet; });
  }

  // Step 9: Assemble results
  const results = assembleFinalResults(finalCandidates, metadata, summaries);

  return {
    results,
    query: brief.searchTerms.join(' + '),
  };
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

  // Check for API keys
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

  if (!GEMINI_API_KEY) {
    context.error('GEMINI_API_KEY is not configured');
    return {
      status: 500,
      body: JSON.stringify({
        error: 'configuration_error',
        message: 'AI service is not configured',
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

    // Execute search
    const { results, query } = await handleSearchWithFallbacks(body.materials, context);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Search precedents error:', errorMessage);

    if (errorMessage === 'no_results') {
      return {
        status: 200,
        body: JSON.stringify({
          results: [],
          query: '',
          totalFound: 0,
        }),
        headers: CORS_HEADERS,
      };
    }

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
