import fs from 'fs';
import path from 'path';
import { CosmosClient } from '@azure/cosmos';

type ContainerManifest = {
  name: string;
  partitionKey: string;
};

type SeedManifest = {
  generatedAt: string;
  counts: Record<string, number>;
  containers: Record<string, ContainerManifest>;
};

const ROOT = process.cwd();
const DEFAULT_SEED_DIR = path.join(ROOT, 'tmp', 'cosmos-seed');

const FILE_BY_CONTAINER_KEY: Record<string, string> = {
  materials: 'materials.json',
  finishes: 'finishes.json',
  finishSets: 'finish_sets.json',
  materialFinishLinks: 'material_finish_links.json',
  materialFinishSetLinks: 'material_finish_set_links.json',
  lifecycleProfiles: 'lifecycle_profiles.json',
};

const getArgValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
};

const endpoint = process.env.COSMOS_DB_URI;
const key = process.env.COSMOS_DB_KEY;
const dbName = process.env.COSMOS_DB_NAME || 'moodboardlab';
const seedDir = getArgValue('seedDir') || DEFAULT_SEED_DIR;

if (!endpoint || !key) {
  console.error('Missing COSMOS_DB_URI or COSMOS_DB_KEY in environment.');
  process.exit(1);
}

const readJson = <T>(filePath: string): T => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const upsertBatch = async (
  docs: Array<Record<string, unknown>>,
  upsertFn: (doc: Record<string, unknown>) => Promise<void>,
  concurrency = 20
) => {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= docs.length) return;
      await upsertFn(docs[current]);
    }
  });
  await Promise.all(workers);
};

const main = async () => {
  const manifestPath = path.join(seedDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifest = readJson<SeedManifest>(manifestPath);
  const client = new CosmosClient({ endpoint, key });
  const { database } = await client.databases.createIfNotExists({ id: dbName });

  console.log(`Connected to database: ${dbName}`);
  console.log(`Seed generated at: ${manifest.generatedAt}`);

  for (const [containerKey, containerCfg] of Object.entries(manifest.containers)) {
    const fileName = FILE_BY_CONTAINER_KEY[containerKey];
    if (!fileName) {
      console.log(`Skipping unknown container key in manifest: ${containerKey}`);
      continue;
    }

    const filePath = path.join(seedDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${containerCfg.name}: seed file missing (${fileName})`);
      continue;
    }

    const docs = readJson<Array<Record<string, unknown>>>(filePath);
    const { container } = await database.containers.createIfNotExists({
      id: containerCfg.name,
      partitionKey: {
        paths: [containerCfg.partitionKey],
      },
    });

    const startedAt = Date.now();
    await upsertBatch(
      docs,
      async (doc) => {
        await container.items.upsert(doc);
      },
      25
    );
    const durationMs = Date.now() - startedAt;
    console.log(
      `Upserted ${docs.length} docs into ${containerCfg.name} (${Math.round(durationMs / 1000)}s)`
    );
  }

  console.log('Cosmos seed import complete.');
};

main().catch((error) => {
  console.error('Cosmos seed import failed:', error);
  process.exit(1);
});

