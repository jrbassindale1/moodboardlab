import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import crypto from 'crypto';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

type MaterialRecord = {
  id: string;
  name: string;
  finish: string;
  finishOptions?: string[];
  colorOptions?: Array<{ label: string; tone: string }>;
  supportsColor?: boolean;
  category: string;
  [key: string]: JsonValue | undefined;
};

type LifecycleProfilesFile = {
  profiles: Record<string, Record<string, { impact: number; confidence?: string }>>;
};

type ScopeMap = Map<string, JsonValue>;

const ROOT = process.cwd();
const CONSTANTS_FILE = path.join(ROOT, 'constants.ts');
const RAL_FILE = path.join(ROOT, 'data', 'ralColors.ts');
const LIFECYCLE_FILE = path.join(ROOT, 'data', 'lifecycleProfiles.json');
const LIFECYCLE_INSIGHTS_FILE = path.join(ROOT, 'data', 'lifecycleInsights.json');
const SPEC_ACTIONS_FILE = path.join(ROOT, 'data', 'specificationActions.json');
const HEALTH_TOXICITY_FILE = path.join(ROOT, 'data', 'healthToxicity.json');
const MATERIAL_RISKS_FILE = path.join(ROOT, 'data', 'materialRisks.json');
const MATERIAL_DURATIONS_FILE = path.join(ROOT, 'data', 'materialDurations.json');
const CATEGORY_DURATIONS_FILE = path.join(ROOT, 'data', 'categoryDurations.json');
const OUT_DIR = path.join(ROOT, 'tmp', 'cosmos-seed');

type HealthRiskLevel = 'low' | 'medium' | 'high';
type HealthDataEntry = {
  riskLevel: HealthRiskLevel;
  concerns: string[];
  note: string;
};

type RiskEntry = {
  risk: string;
  mitigation: string;
};

type DurationOverride = {
  id: string;
  pattern: string;
  patternFlags?: string;
  categories?: string[];
  duration: {
    serviceLife: number;
    replacementCycle?: number;
    notes?: string;
  };
};

type CategoryDuration = {
  serviceLife: number;
  replacementCycle?: number;
  notes?: string;
};

const normalizeFinishKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const readSourceFile = (filePath: string): ts.SourceFile =>
  ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

const evalNode = (node: ts.Expression, scope: ScopeMap): JsonValue => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => evalNode(el as ts.Expression, scope));
  }

  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, JsonValue> = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const name = ts.isIdentifier(prop.name)
          ? prop.name.text
          : ts.isStringLiteral(prop.name)
            ? prop.name.text
            : undefined;
        if (!name) continue;
        out[name] = evalNode(prop.initializer, scope);
      }
    }
    return out;
  }

  if (ts.isIdentifier(node)) {
    const value = scope.get(node.text);
    if (value === undefined) throw new Error(`Unknown identifier: ${node.text}`);
    return value;
  }

  if (ts.isParenthesizedExpression(node)) return evalNode(node.expression, scope);
  if (ts.isAsExpression(node)) return evalNode(node.expression, scope);

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const n = evalNode(node.operand, scope);
    if (typeof n === 'number') return -n;
  }

  throw new Error(`Unsupported node kind: ${ts.SyntaxKind[node.kind]}`);
};

const collectConstScope = (source: ts.SourceFile, initialScope: ScopeMap): ScopeMap => {
  const scope = new Map(initialScope);

  for (const stmt of source.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    if (!(stmt.declarationList.flags & ts.NodeFlags.Const)) continue;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const varName = decl.name.text;
      if (varName === 'MATERIAL_PALETTE') continue;
      try {
        const value = evalNode(decl.initializer, scope);
        scope.set(varName, value);
      } catch {
        // Skip constants that rely on unsupported/imported runtime symbols.
      }
    }
  }

  return scope;
};

const getVariableInitializer = (source: ts.SourceFile, varName: string): ts.Expression => {
  for (const stmt of source.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === varName && decl.initializer) {
        return decl.initializer;
      }
    }
  }
  throw new Error(`Variable ${varName} not found in ${source.fileName}`);
};

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const stripUndefined = <T>(obj: T): T =>
  JSON.parse(JSON.stringify(obj)) as T;

const hashKey = (value: string): string =>
  crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);

const getServiceLife = (
  material: MaterialRecord,
  durationOverrides: DurationOverride[],
  categoryDurations: Record<string, CategoryDuration>
): number | null => {
  const nameAndId = `${material.id} ${material.name}`.toLowerCase();

  for (const override of durationOverrides) {
    // Check category match if specified
    if (override.categories && override.categories.length > 0) {
      if (!override.categories.includes(material.category)) {
        continue;
      }
    }

    // Check pattern match
    const flags = override.patternFlags || 'i';
    const regex = new RegExp(override.pattern, flags);
    if (regex.test(nameAndId)) {
      return override.duration.serviceLife;
    }
  }

  // Default service life by category
  const categoryDefault = categoryDurations[material.category];
  return categoryDefault?.serviceLife ?? null;
};

const main = () => {
  const constantsSource = readSourceFile(CONSTANTS_FILE);
  const ralSource = readSourceFile(RAL_FILE);

  const ralScope = collectConstScope(ralSource, new Map());
  const ralOptionsValue = ralScope.get('RAL_COLOR_OPTIONS');
  if (!ralOptionsValue) {
    throw new Error('Could not resolve RAL_COLOR_OPTIONS from data/ralColors.ts');
  }

  const initialScope: ScopeMap = new Map([['RAL_COLORS', ralOptionsValue]]);
  const constantsScope = collectConstScope(constantsSource, initialScope);
  const materialPaletteNode = getVariableInitializer(constantsSource, 'MATERIAL_PALETTE');
  const materialPalette = evalNode(materialPaletteNode, constantsScope) as JsonValue[];

  const materials = materialPalette as MaterialRecord[];
  const lifecycleProfiles = JSON.parse(
    fs.readFileSync(LIFECYCLE_FILE, 'utf8')
  ) as LifecycleProfilesFile;

  // Load additional data files
  const lifecycleInsights = JSON.parse(
    fs.readFileSync(LIFECYCLE_INSIGHTS_FILE, 'utf8')
  ) as { insights: Record<string, string> };

  const specificationActions = JSON.parse(
    fs.readFileSync(SPEC_ACTIONS_FILE, 'utf8')
  ) as { actions: Record<string, string[]> };

  const healthToxicity = JSON.parse(
    fs.readFileSync(HEALTH_TOXICITY_FILE, 'utf8')
  ) as { healthData: Record<string, HealthDataEntry> };

  const materialRisks = JSON.parse(
    fs.readFileSync(MATERIAL_RISKS_FILE, 'utf8')
  ) as { risks: Record<string, RiskEntry[]> };

  const materialDurations = JSON.parse(
    fs.readFileSync(MATERIAL_DURATIONS_FILE, 'utf8')
  ) as { overrides: DurationOverride[] };

  const categoryDurations = JSON.parse(
    fs.readFileSync(CATEGORY_DURATIONS_FILE, 'utf8')
  ) as { durations: Record<string, CategoryDuration> };

  const finishesById = new Map<string, { id: string; pk: string; label: string; normalizedLabel: string; type: string }>();
  const finishSetsById = new Map<
    string,
    {
      id: string;
      pk: string;
      type: 'ral' | 'colorOptions' | 'textOptions' | 'single';
      name: string;
      options: Array<{ label: string; tone?: string }>;
      signature: string;
    }
  >();
  const materialFinishLinks: Array<{
    id: string;
    pk: string;
    materialId: string;
    finishId: string;
    isPrimary: boolean;
  }> = [];
  const materialFinishSetLinks: Array<{
    id: string;
    pk: string;
    materialId: string;
    finishSetId: string;
    isDefault: boolean;
  }> = [];

  const materialDocs = materials.map((material, index) => {
    const finishCandidates = [material.finish, ...(material.finishOptions || [])]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

    const dedupFinishIds: string[] = [];

    for (const finishLabel of finishCandidates) {
      const key = normalizeFinishKey(finishLabel);
      const finishId = `finish:${key}`;
      if (!finishesById.has(finishId)) {
        finishesById.set(finishId, {
          id: finishId,
          pk: 'finish',
          label: finishLabel,
          normalizedLabel: key,
          type: 'finish',
        });
      }
      if (!dedupFinishIds.includes(finishId)) dedupFinishIds.push(finishId);
      materialFinishLinks.push({
        id: `mf:${material.id}:${finishId}`,
        pk: material.id,
        materialId: material.id,
        finishId,
        isPrimary: finishLabel === material.finish,
      });
    }

    const lifecycleProfile = lifecycleProfiles.profiles[material.id];

    const finishSetCandidates: Array<{ type: 'ral' | 'colorOptions' | 'textOptions' | 'single'; options: Array<{ label: string; tone?: string }> }> = [];
    if (Array.isArray(material.colorOptions) && material.colorOptions.length > 0) {
      finishSetCandidates.push({
        type: 'colorOptions',
        options: material.colorOptions.map((c) => ({ label: c.label, tone: c.tone })),
      });
    } else if (material.supportsColor) {
      const ralOptions = (ralOptionsValue as Array<{ label: string; tone: string }>).map((c) => ({
        label: c.label,
        tone: c.tone,
      }));
      finishSetCandidates.push({ type: 'ral', options: ralOptions });
    }

    if (Array.isArray(material.finishOptions) && material.finishOptions.length > 0) {
      finishSetCandidates.push({
        type: 'textOptions',
        options: material.finishOptions.map((label) => ({ label })),
      });
    }

    if (finishSetCandidates.length === 0) {
      finishSetCandidates.push({
        type: 'single',
        options: [{ label: material.finish }],
      });
    }

    const materialFinishSetIds: string[] = [];
    for (const candidate of finishSetCandidates) {
      const signature = JSON.stringify({
        type: candidate.type,
        options: candidate.options.map((o) => ({ label: o.label, tone: o.tone || null })),
      });
      const finishSetId = `fs:${candidate.type}:${hashKey(signature)}`;
      if (!finishSetsById.has(finishSetId)) {
        finishSetsById.set(finishSetId, {
          id: finishSetId,
          pk: 'finish_set',
          type: candidate.type,
          name:
            candidate.type === 'ral'
              ? 'RAL Colour Set'
              : candidate.type === 'colorOptions'
                ? 'Material Colour Set'
                : candidate.type === 'textOptions'
                  ? 'Material Finish Options'
                  : 'Single Finish',
          options: candidate.options,
          signature,
        });
      }

      materialFinishSetIds.push(finishSetId);
      materialFinishSetLinks.push({
        id: `mfs:${material.id}:${finishSetId}`,
        pk: material.id,
        materialId: material.id,
        finishSetId,
        isDefault: materialFinishSetIds.length === 1,
      });
    }

    // Get additional data for this material
    const insight = lifecycleInsights.insights[material.id] || null;
    const actions = specificationActions.actions[material.id] || null;
    const healthData = healthToxicity.healthData[material.id];
    const risks = materialRisks.risks[material.id] || null;
    const serviceLife = getServiceLife(
      material,
      materialDurations.overrides,
      categoryDurations.durations
    );

    return stripUndefined({
      ...material,
      id: material.id,
      pk: material.category || 'uncategorized',
      docType: 'material',
      sortOrder: index,
      finishIds: dedupFinishIds,
      primaryFinishId: dedupFinishIds[0] || null,
      finishSetIds: materialFinishSetIds,
      primaryFinishSetId: materialFinishSetIds[0] || null,
      lifecycleProfileId: lifecycleProfile ? `lp:${material.id}` : null,
      // Additional sustainability data
      insight,
      actions,
      healthRiskLevel: healthData?.riskLevel || null,
      healthConcerns: healthData?.concerns || null,
      healthNote: healthData?.note || null,
      risks,
      serviceLife,
    });
  });

  const lifecycleDocs = Object.entries(lifecycleProfiles.profiles).map(([materialId, profile]) =>
    stripUndefined({
      id: `lp:${materialId}`,
      pk: materialId,
      docType: 'lifecycleProfile',
      materialId,
      stages: profile,
    })
  );

  ensureDir(OUT_DIR);

  const outputs = {
    materials: materialDocs,
    finishes: Array.from(finishesById.values()),
    finishSets: Array.from(finishSetsById.values()),
    materialFinishLinks,
    materialFinishSetLinks,
    lifecycleProfiles: lifecycleDocs,
    manifest: {
      generatedAt: new Date().toISOString(),
      counts: {
        materials: materialDocs.length,
        finishes: finishesById.size,
        finishSets: finishSetsById.size,
        materialFinishLinks: materialFinishLinks.length,
        materialFinishSetLinks: materialFinishSetLinks.length,
        lifecycleProfiles: lifecycleDocs.length,
      },
      containers: {
        materials: {
          name: 'materials',
          partitionKey: '/pk',
        },
        finishes: {
          name: 'finishes',
          partitionKey: '/pk',
        },
        finishSets: {
          name: 'finish_sets',
          partitionKey: '/pk',
        },
        materialFinishLinks: {
          name: 'material_finish_links',
          partitionKey: '/pk',
        },
        materialFinishSetLinks: {
          name: 'material_finish_set_links',
          partitionKey: '/pk',
        },
        lifecycleProfiles: {
          name: 'lifecycle_profiles',
          partitionKey: '/pk',
        },
      },
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, 'materials.json'), JSON.stringify(outputs.materials, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'finishes.json'), JSON.stringify(outputs.finishes, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'finish_sets.json'), JSON.stringify(outputs.finishSets, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'material_finish_links.json'), JSON.stringify(outputs.materialFinishLinks, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'material_finish_set_links.json'), JSON.stringify(outputs.materialFinishSetLinks, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'lifecycle_profiles.json'), JSON.stringify(outputs.lifecycleProfiles, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(outputs.manifest, null, 2));

  console.log(`Exported Cosmos seed files to ${OUT_DIR}`);
  console.log(JSON.stringify(outputs.manifest.counts, null, 2));
};

main();
