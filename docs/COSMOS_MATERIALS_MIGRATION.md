# Cosmos Materials Migration

## Goal
Move hardcoded materials into Cosmos DB with normalized entities for:
- Materials
- Finishes (shared across materials)
- Finish sets (shared option lists, e.g. RAL palettes vs stone/mineral lists)
- Material-finish links
- Material-finish-set links
- Lifecycle profiles

Frontend still supports fallback to hardcoded `MATERIAL_PALETTE` during migration.

## Containers
Recommended SQL API containers:

1. `materials`
- Partition key: `/pk`
- `pk` value: material category (e.g. `structure`, `floor`)
- Document shape: current `MaterialOption` plus:
  - `docType: "material"`
  - `finishIds: string[]`
  - `primaryFinishId: string | null`
  - `lifecycleProfileId: string | null`
  - `sortOrder: number`

2. `finishes`
- Partition key: `/pk`
- `pk` value: `"finish"`
- Document shape:
  - `id` (e.g. `finish:painted-steel-select-colour`)
  - `label`
  - `normalizedLabel`
  - `type: "finish"`

3. `material_finish_links`
- Partition key: `/pk`
- `pk` value: material id
- Document shape:
  - `materialId`
  - `finishId`
  - `isPrimary`

4. `finish_sets`
- Partition key: `/pk`
- `pk` value: `"finish_set"`
- Document shape:
  - `id`
  - `type` (`ral`, `colorOptions`, `textOptions`, `single`)
  - `name`
  - `options[]` (e.g. RAL list, or minimal stone options)

5. `material_finish_set_links`
- Partition key: `/pk`
- `pk` value: material id
- Document shape:
  - `materialId`
  - `finishSetId`
  - `isDefault`

6. `lifecycle_profiles`
- Partition key: `/pk`
- `pk` value: material id
- Document shape:
  - `materialId`
  - `stages` object (`raw`, `manufacturing`, `transport`, etc.)

## Seed Export
Generate seed files from current source data:

```bash
npm run export-cosmos-material-model
```

Output directory:
- `tmp/cosmos-seed/materials.json`
- `tmp/cosmos-seed/finishes.json`
- `tmp/cosmos-seed/material_finish_links.json`
- `tmp/cosmos-seed/finish_sets.json`
- `tmp/cosmos-seed/material_finish_set_links.json`
- `tmp/cosmos-seed/lifecycle_profiles.json`
- `tmp/cosmos-seed/manifest.json`

## Direct Import (CLI + SDK)
If you have Azure CLI access, import all seed files directly to Cosmos:

```bash
COSMOS_DB_URI='https://moodboardlab-cosmos.documents.azure.com:443/' \
COSMOS_DB_KEY="$(az cosmosdb keys list -g moodboardlab-rg -n moodboardlab-cosmos --query primaryMasterKey -o tsv)" \
COSMOS_DB_NAME='moodboardlab' \
npm run import-cosmos-seed
```

If Azure MFA has expired:

```bash
az logout
az login --tenant "07ef1208-413c-4b5e-9cdd-64ef305754f0" --scope "https://management.core.windows.net//.default"
```

Then rerun the import command.

## Rollout Plan
1. Create containers above in `moodboardlab-cosmos`.
2. Import JSON seed files.
3. Verify backend `GET /api/materials` returns expected records.
4. Validate staging UI loads DB-backed materials.
5. Promote to production.

## Notes
- `GET /api/materials` currently returns the `materials` container only.
- Normalized finishes/lifecycle containers are added for complete migration and future querying.
- Keep hardcoded fallback until DB quality and completeness are validated.
