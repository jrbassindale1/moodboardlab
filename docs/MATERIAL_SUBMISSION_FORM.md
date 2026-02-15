# Material Submission Form (Company -> Moodboard Lab)

Use this form to collect one material per submission. The top section is for companies to complete. The lower section is for your internal database mapping.

## 1) How to use this form

1. Duplicate this file for each new material.
2. Send the duplicate to the supplier/company.
3. Ask them to complete all fields marked **Required**.
4. Review and normalize values (especially IDs, category, and lists).
5. Convert the completed form into a Cosmos `materials` document using the JSON template in section 5.
6. Add it in Cosmos Data Explorer:
   - Database: `moodboardlab`
   - Container: `materials`
   - Partition key: `/pk` (must match `category`)

Note: Your current API `PUT /api/materials` updates existing materials by `id`; it does not create new IDs. Create new records directly in Cosmos Data Explorer (or via seed import scripts) first.

## 2) Company-Facing Form (send this part)

### Company details

- Company name (**Required**):
- Contact person (**Required**):
- Contact email (**Required**):
- Website:
- Date submitted (**Required**):

### Material identity

- Material display name (**Required**) (example: `Engineered Oak Flooring`):
- Primary finish name (**Required**) (example: `Oiled oak planks`):
- Short description (**Required**) (1-3 sentences):
- Keywords (**Required**) (comma-separated, 3-10 words):
- Category (**Required**) (pick one):
  - `structure`
  - `envelope`
  - `interiors`
  - `landscape`
  - `custom`

### Visual and option fields

- Representative tone/colour hex (recommended) (example: `#A67C52`):
- Supports colour selection? (`true`/`false`):
- Colour options (optional) (format: `Label|#HEX`, comma-separated):
- Additional finish options (optional) (comma-separated):
- Variety options (optional) (comma-separated):
- Tags (optional) (comma-separated):
- Tree paths (optional) (example: `Interiors>Walls`):

### Technical classification (optional but useful)

- Material type (example: `timber`, `metal`, `stone`):
- Finish family (example: `timber-oil`, `metal-powder-coat`):
- Material form (comma-separated) (example: `panel,board,sheet`):
- Material function (comma-separated) (example: `structure,finish,acoustic`):
- Manufacturing process (comma-separated):

### Sustainability and health (optional)

- Carbon intensity (`low`/`medium`/`high`):
- Strategic value text (best for low-carbon materials):
- Mitigation tip text (best for high-carbon materials):
- Lifecycle insight text:
- Specification actions (comma-separated short actions):
- Health risk level (`low`/`medium`/`high`):
- Health concerns (comma-separated):
- Health note:
- Risks (optional, format one per line: `Risk | Mitigation`):
- Service life in years (number):

### Evidence (recommended attachments)

- Product datasheet attached? (`yes`/`no`)
- EPD attached? (`yes`/`no`)
- SDS / health certification attached? (`yes`/`no`)
- Fire/acoustic/thermal certificates attached? (`yes`/`no`)

## 3) Internal Mapping (admin use)

Fill these before inserting into Cosmos.

- `id` (**Required**): stable slug, lowercase, hyphenated. Example: `engineered-oak-flooring`
- `name`: from “Material display name”
- `finish`: from “Primary finish name”
- `description`: from “Short description”
- `keywords`: split comma list into string array
- `category`: from form category
- `pk`: must equal `category`
- `docType`: always `material`
- `sortOrder`: integer position in list
- `tone`: use provided hex; fallback to a sensible representative hex
- `supportsColor`: `true`/`false`
- `colorOptions`: array of `{ label, tone }`
- `finishOptions`: string[]
- `varietyOptions`: string[]
- `treePaths`: string[]
- `tags`: string[]
- `carbonIntensity`: `low|medium|high` or `null`
- `materialType`: string or `null`
- `finishFamily`: string or `null`
- `materialForm`: string[]
- `materialFunction`: string[]
- `manufacturingProcess`: string[]
- `insight`: string or `null`
- `actions`: string[] or `null`
- `strategicValue`: string or `null`
- `mitigationTip`: string or `null`
- `healthRiskLevel`: `low|medium|high` or `null`
- `healthConcerns`: string[] or `null`
- `healthNote`: string or `null`
- `risks`: array of `{ risk, mitigation }` or `null`
- `serviceLife`: integer or `null`
- `lifecycleProfileId`: nullable string (usually `null` unless you create a lifecycle profile doc)

Normalized finish linkage fields (keep populated for consistency):
- `finishIds`: at least one ID, e.g. `finish:oiled-oak-planks`
- `primaryFinishId`: first finish ID
- `finishSetIds`: `[]` if not using finish sets yet
- `primaryFinishSetId`: `null` if none

## 4) ID normalization rules

Use these rules for generated IDs:

- Lowercase
- Trim spaces
- Replace `&` with `and`
- Replace non-alphanumeric chars with `-`
- Collapse repeated `-`
- Remove leading/trailing `-`

Examples:
- `Painted steel — select colour` -> `finish:painted-steel-select-colour`
- `Engineered Oak Flooring` -> `engineered-oak-flooring`

## 5) Copy/Paste JSON Template (all material fields)

```json
{
  "id": "new-material-id",
  "pk": "interiors",
  "docType": "material",
  "sortOrder": 999,

  "name": "New Material Name",
  "tone": "#A67C52",
  "finish": "Primary finish label",
  "description": "Short material description.",
  "keywords": ["keyword-1", "keyword-2", "keyword-3"],
  "category": "interiors",

  "colorOptions": [
    { "label": "Natural", "tone": "#A67C52" }
  ],
  "supportsColor": false,
  "finishOptions": ["Option A", "Option B"],
  "varietyOptions": ["Variant A", "Variant B"],
  "treePaths": ["Interiors>Walls"],
  "carbonIntensity": "medium",
  "tags": ["supplier-submitted"],
  "materialType": "timber",
  "finishFamily": "timber-oil",
  "materialForm": ["board"],
  "materialFunction": ["finish"],
  "manufacturingProcess": ["pressed"],

  "finishIds": ["finish:primary-finish-label"],
  "primaryFinishId": "finish:primary-finish-label",
  "finishSetIds": [],
  "primaryFinishSetId": null,
  "lifecycleProfileId": null,

  "insight": null,
  "actions": null,
  "strategicValue": null,
  "mitigationTip": null,
  "healthRiskLevel": null,
  "healthConcerns": null,
  "healthNote": null,
  "risks": null,
  "serviceLife": null
}
```

## 6) Quick QA checklist before insert

- `id` is unique in `materials` container.
- `pk` equals `category`.
- `docType` is exactly `material`.
- `keywords` is an array, not a single string.
- `finishIds[0]` matches `primaryFinishId`.
- `colorOptions` entries use valid hex values.
- Nullable fields are either valid values or `null` (not empty object).

## 7) CSV template for suppliers

Use `docs/MATERIAL_SUBMISSION_TEMPLATE.csv` when you want companies to submit in spreadsheet format.

CSV rules:
- One row = one material.
- Keep the header row unchanged.
- For list fields, separate values with `|` (pipe), not commas.
- For `colorOptions`, use `Label:#HEX|Label:#HEX`.
- For `risks`, use `Risk=>Mitigation|Risk=>Mitigation`.

## 8) Convert completed CSV into Cosmos JSON

Run:

```bash
npm run convert-material-submissions -- \
  --in docs/MATERIAL_SUBMISSION_TEMPLATE.csv \
  --out tmp/material-submissions/materials.json \
  --report tmp/material-submissions/report.json
```

What you get:
- `tmp/material-submissions/materials.json`: ready-to-insert material documents.
- `tmp/material-submissions/report.json`: row-by-row warnings and submitter metadata.

Then import records manually in Cosmos Data Explorer:
- Database: `moodboardlab`
- Container: `materials`
- Ensure each item has `pk` equal to `category`
