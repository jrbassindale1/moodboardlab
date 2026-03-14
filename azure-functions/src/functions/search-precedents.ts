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
const GEMINI_TEXT_URL =
  process.env.GEMINI_TEXT_ENDPOINT ||
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const RESULTS_PER_QUERY = 10;
const MAX_CANDIDATES_FOR_LLM = 15;
const FINAL_RESULTS_COUNT = 3;
const METADATA_FETCH_TIMEOUT_MS = 8000;

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

interface LLMSelectionResult {
  selectedUrls: string[];
  reasoning?: string;
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
];

function isProjectUrl(url: string): boolean {
  for (const pattern of EXCLUDED_URL_PATTERNS) {
    if (pattern.test(url)) {
      return false;
    }
  }

  // ArchDaily: requires numeric ID
  if (url.includes('archdaily.com')) {
    return /archdaily\.com\/(?:[a-z]{2}\/)?(\d{4,})\//i.test(url);
  }

  // Dezeen: requires date pattern
  if (url.includes('dezeen.com')) {
    return /dezeen\.com\/\d{4}\/\d{2}\/\d{2}\//i.test(url);
  }

  // Architizer: requires /projects/ path
  if (url.includes('architizer.com')) {
    return /architizer\.com\/projects\//i.test(url);
  }

  // Designboom: requires date in URL
  if (url.includes('designboom.com')) {
    return /designboom\.com\/architecture\/[^/]+\/[^/]+-\d{2}-\d{2}-\d{4}/i.test(url);
  }

  // Divisare: requires /projects/ path
  if (url.includes('divisare.com')) {
    return /divisare\.com\/projects\//i.test(url);
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
  const sites =
    'site:archdaily.com OR site:dezeen.com OR site:architizer.com OR site:designboom.com OR site:divisare.com';

  // Query 1: Primary material types + architecture
  if (brief.materialTypes.length > 0) {
    const types = brief.materialTypes.slice(0, 2).join(' ');
    queries.push(`${types} architecture project ${sites}`);
  }

  // Query 2: Special keywords (CLT, terrazzo, corten, etc.)
  if (brief.keywords.length > 0) {
    const keyword = brief.keywords[0];
    queries.push(`${keyword} architecture house ${sites}`);
  }

  // Query 3: Material + finish combination
  if (brief.materialTypes.length > 0 && brief.finishes.length > 0) {
    const type = brief.materialTypes[0];
    const finish = brief.finishes[0];
    queries.push(`${finish} ${type} building ${sites}`);
  }

  // Query 4: Second keyword if available
  if (brief.keywords.length > 1) {
    const keyword = brief.keywords[1];
    queries.push(`${keyword} building architecture ${sites}`);
  }

  // Query 5: Material combination
  if (brief.materialTypes.length >= 2) {
    const combo = brief.materialTypes.slice(0, 2).join(' and ');
    queries.push(`${combo} architecture ${sites}`);
  }

  // Ensure at least 3 queries
  if (queries.length < 3 && brief.materialTypes.length > 0) {
    queries.push(`${brief.materialTypes[0]} facade design ${sites}`);
  }

  return queries.slice(0, 5);
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
// Step 4: Merge and Dedupe Results
// =============================================================================

function mergeAndDedupeResults(
  allResults: SerperWebResult[][]
): CandidatePrecedent[] {
  const urlScores = new Map<string, { result: SerperWebResult; score: number }>();

  for (const results of allResults) {
    for (const result of results) {
      const existing = urlScores.get(result.link);
      if (existing) {
        existing.score += 11 - result.position;
      } else {
        urlScores.set(result.link, {
          result,
          score: 11 - result.position,
        });
      }
    }
  }

  const sorted = Array.from(urlScores.entries()).sort((a, b) => b[1].score - a[1].score);

  return sorted.map(([url, { result, score }]) => {
    const { source, sourceName } = getSourceFromUrl(url);
    return {
      url,
      title: result.title,
      snippet: result.snippet,
      source,
      sourceName,
      score,
    };
  });
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
// Step 6: LLM Selection with Gemini
// =============================================================================

const SELECTION_PROMPT = `You are an expert architectural curator helping designers find project precedents that match their material palette.

## Material Brief
The designer is working with these materials:
- Material Types: {materialTypes}
- Finishes: {finishes}
- Key Terms: {keywords}

## Candidate Projects
{candidatesList}

## Your Task
Select exactly 3 projects that:
1. BEST exemplify creative or innovative use of the specified materials
2. Are specific building projects (residential, commercial, cultural, etc.)
3. Show diverse applications (avoid selecting 3 very similar buildings)
4. Prioritize projects where materials are a key design feature

If fewer than 3 strong matches exist, select only the strong ones.

## Output Format
Respond with ONLY valid JSON:
{"selectedUrls": ["url1", "url2", "url3"], "reasoning": "Brief explanation"}`;

async function selectBestPrecedentsWithLLM(
  candidates: CandidatePrecedent[],
  brief: MaterialsBrief,
  context: InvocationContext
): Promise<LLMSelectionResult> {
  const topCandidates = candidates.slice(0, MAX_CANDIDATES_FOR_LLM);

  const candidatesList = topCandidates
    .map(
      (c, i) =>
        `${i + 1}. URL: ${c.url}\n   Title: ${c.title}\n   Snippet: ${c.snippet}\n   Source: ${c.sourceName}`
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
        temperature: 0.3,
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

    // Extract og:image
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogImage = ogImageMatch?.[1] || null;

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

const SUMMARY_PROMPT = `You are an architectural writer creating concise project descriptions.

## Material Context
The designer's palette includes: {materialTypes} with finishes like {finishes}.

## Projects to Summarize
{projectsList}

## Your Task
For each project, write exactly 2 sentences:
- Sentence 1: Describe the building type, location (if known), and architect (if known)
- Sentence 2: Highlight how the materials are used in a distinctive or innovative way

Keep each summary factual and under 50 words total.

## Output Format
Respond with ONLY valid JSON:
{"summaries": {"url1": "Two sentence summary.", "url2": "Two sentence summary.", "url3": "Two sentence summary."}}`;

async function generateSummariesWithLLM(
  selectedCandidates: CandidatePrecedent[],
  metadata: Record<string, PageMetadata>,
  brief: MaterialsBrief,
  context: InvocationContext
): Promise<LLMSummaryResult> {
  const projectsList = selectedCandidates
    .map((c) => {
      const meta: PageMetadata = metadata[c.url] || { ogImage: null, ogTitle: null, metaDescription: null };
      return `URL: ${c.url}
Title: ${meta.ogTitle || c.title}
Description: ${meta.metaDescription || c.snippet}
Source: ${c.sourceName}`;
    })
    .join('\n\n---\n\n');

  const prompt = SUMMARY_PROMPT.replace(
    '{materialTypes}',
    brief.materialTypes.join(', ') || 'various materials'
  )
    .replace('{finishes}', brief.finishes.join(', ') || 'various finishes')
    .replace('{projectsList}', projectsList);

  context.log('Calling Gemini for summaries...');

  const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
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

  // Step 2: Generate queries
  const queries = generateSearchQueries(brief);
  context.log(`Generated ${queries.length} search queries`);

  // Step 3: Execute searches
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

  // Step 4: Merge and dedupe
  let candidates = mergeAndDedupeResults(allResults);
  context.log(`Unique candidates after merge: ${candidates.length}`);

  // Step 5: Filter non-project URLs
  candidates = filterProjectUrls(candidates, context);
  context.log(`Candidates after filtering: ${candidates.length}`);

  if (candidates.length === 0) {
    throw new Error('no_results');
  }

  // Step 6: LLM Selection
  let selectedUrls: string[];
  try {
    const selection = await selectBestPrecedentsWithLLM(candidates, brief, context);
    selectedUrls = selection.selectedUrls || [];
    context.log(`LLM selected ${selectedUrls.length} URLs`);
  } catch (err) {
    context.warn(`LLM selection failed: ${err instanceof Error ? err.message : err}`);
    selectedUrls = candidates.slice(0, FINAL_RESULTS_COUNT).map((c) => c.url);
  }

  // Get selected candidates in order
  const selectedCandidates: CandidatePrecedent[] = [];
  for (const url of selectedUrls) {
    const candidate = candidates.find((c) => c.url === url);
    if (candidate) {
      selectedCandidates.push(candidate);
    }
  }

  // Fill with top candidates if needed
  if (selectedCandidates.length < FINAL_RESULTS_COUNT) {
    for (const c of candidates) {
      if (!selectedCandidates.find((s) => s.url === c.url)) {
        selectedCandidates.push(c);
        if (selectedCandidates.length >= FINAL_RESULTS_COUNT) break;
      }
    }
  }

  const finalCandidates = selectedCandidates.slice(0, FINAL_RESULTS_COUNT);

  // Step 7: Fetch metadata
  let metadata: Record<string, PageMetadata> = {};
  try {
    metadata = await fetchAllMetadata(
      finalCandidates.map((c) => c.url),
      context
    );
  } catch (err) {
    context.warn(`Metadata fetch failed: ${err instanceof Error ? err.message : err}`);
  }

  // Step 8: Generate summaries
  let summaries: LLMSummaryResult = { summaries: {} };
  try {
    summaries = await generateSummariesWithLLM(finalCandidates, metadata, brief, context);
  } catch (err) {
    context.warn(`Summary generation failed: ${err instanceof Error ? err.message : err}`);
    // Fallback: use snippets
    finalCandidates.forEach((c) => {
      summaries.summaries[c.url] = c.snippet;
    });
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
