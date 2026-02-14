# Cosmos Database Schema Reference

Last updated: 2026-02-14  
Database: `moodboardlab`

This is the application-level schema contract for Cosmos DB in this repo. Cosmos itself is schemaless, so this file documents what the code writes and expects.

## Source of truth
- Runtime types and container access: `azure-functions/shared/cosmosClient.ts`
- Materials normalization/seed shape: `scripts/export-cosmos-material-model.ts`
- Seed import behavior: `scripts/import-cosmos-seed.ts`
- Current seed manifest snapshot: `tmp/cosmos-seed/manifest.json`

### Material data sources (merged during export)
- Base material definitions: `constants.ts` (MATERIAL_PALETTE)
- Lifecycle impact profiles: `data/lifecycleProfiles.json`
- Lifecycle insights: `data/lifecycleInsights.json`
- Specification actions: `data/specificationActions.json`
- Health/toxicity data: `data/healthToxicity.json`
- Material risks: `data/materialRisks.json`
- Service life durations: `data/materialDurations.json`, `data/categoryDurations.json`

## Container map (current)
- `usage` partition key: `/userId`
- `generations` partition key: `/userId`
- `materials` partition key: `/pk`
- `finishes` partition key: `/pk`
- `finish_sets` partition key: `/pk`
- `material_finish_links` partition key: `/pk`
- `material_finish_set_links` partition key: `/pk`
- `lifecycle_profiles` partition key: `/pk`
- `users` partition key: `/userId` (type exists but not actively written/read by current functions)

## Exact document schemas

### `usage`
```ts
type UsageDocument = {
  id: string; // `${userId}:${YYYY-MM}`
  userId: string; // partition key
  yearMonth: string; // YYYY-MM
  generationCounts: {
    moodboard: number;
    applyMaterials: number;
    upscale: number;
    materialIcon: number;
    sustainabilityBriefing: number;
  };
  totalGenerations: number;
  lastUpdatedAt: string; // ISO-8601 UTC
};
```

### `generations`
```ts
type GenerationDocument = {
  id: string; // uuid
  userId: string; // partition key
  type: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing';
  prompt: string;
  blobUrl?: string;
  materials?: unknown; // sanitized object payload (data URLs removed)
  createdAt: string; // ISO-8601 UTC
  metadata?: Record<string, unknown>;
};
```

### `materials`
```ts
type MaterialDocument = {
  id: string; // material id, e.g. "steel-frame"
  pk: string; // category, e.g. "structure"
  docType: 'material';
  sortOrder: number;

  name: string;
  tone: string; // hex
  finish: string;
  description: string;
  keywords: string[];
  category: string;

  colorOptions?: Array<{ label: string; tone: string }>;
  supportsColor?: boolean;
  finishOptions?: string[];
  treePaths?: string[];
  carbonIntensity?: 'low' | 'medium' | 'high';
  tags?: string[];
  materialType?: string;
  materialForm?: string[];
  materialFunction?: string[];
  manufacturingProcess?: string[];

  finishIds: string[];
  primaryFinishId: string | null;
  finishSetIds: string[];
  primaryFinishSetId: string | null;
  lifecycleProfileId: string | null;

  // Sustainability and specification data (from JSON data files)
  insight: string | null; // AI-generated lifecycle insight
  actions: string[] | null; // Up to 3 specification actions
  healthRiskLevel: 'low' | 'medium' | 'high' | null;
  healthConcerns: string[] | null; // e.g. ["vocs", "formaldehyde"]
  healthNote: string | null; // Detailed health/toxicity note
  risks: Array<{ risk: string; mitigation: string }> | null;
  serviceLife: number | null; // Expected service life in years
};
```

### `finishes`
```ts
type FinishDocument = {
  id: string; // `finish:<normalized-label>`
  pk: 'finish';
  label: string;
  normalizedLabel: string;
  type: 'finish';
};
```

### `finish_sets`
```ts
type FinishSetDocument = {
  id: string; // `fs:<type>:<hash>`
  pk: 'finish_set';
  type: 'ral' | 'colorOptions' | 'textOptions' | 'single';
  name: string;
  options: Array<{ label: string; tone?: string }>;
  signature: string; // dedupe key
};
```

### `material_finish_links`
```ts
type MaterialFinishLinkDocument = {
  id: string; // `mf:<materialId>:<finishId>`
  pk: string; // materialId
  materialId: string;
  finishId: string;
  isPrimary: boolean;
};
```

### `material_finish_set_links`
```ts
type MaterialFinishSetLinkDocument = {
  id: string; // `mfs:<materialId>:<finishSetId>`
  pk: string; // materialId
  materialId: string;
  finishSetId: string;
  isDefault: boolean;
};
```

### `lifecycle_profiles`
```ts
type LifecycleProfileDocument = {
  id: string; // `lp:<materialId>`
  pk: string; // materialId
  docType: 'lifecycleProfile';
  materialId: string;
  stages: {
    raw: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    manufacturing: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    transport: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    installation: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    inUse: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    maintenance: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    endOfLife: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
  };
};
```

### `users` (defined only)
```ts
type UserDocument = {
  id: string;
  userId: string; // partition key
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string;
  tier: 'free' | 'pro';
};
```

## API to container mapping
- `GET /api/materials` reads `materials` and appends response-only `iconWebpUrl`/`iconPngUrl` values.
- `GET /api/usage` reads `usage`.
- `GET /api/generations` reads `generations`.
- `POST /api/save-generation` writes `generations` and increments `usage`.
- `POST /api/save-pdf` writes/updates `generations` (no usage increment).
- `GET /api/check-quota` reads `usage`.
- `POST /api/consume-credits` increments `usage`.

## Current normalized seed counts
From `tmp/cosmos-seed/manifest.json` (generated at `2026-02-14T13:54:23.455Z`):
- `materials`: 209
- `finishes`: 206
- `finishSets`: 189
- `materialFinishLinks`: 221
- `materialFinishSetLinks`: 213
- `lifecycleProfiles`: 214

## How to keep this updated
1. Regenerate seed files:
```bash
npm run export-cosmos-material-model
```
2. Check the latest manifest for container list/counts:
```bash
cat tmp/cosmos-seed/manifest.json
```
3. Import into Cosmos:
```bash
npm run import-cosmos-seed
```
4. If any fields or container names changed, update this file in the same commit.
