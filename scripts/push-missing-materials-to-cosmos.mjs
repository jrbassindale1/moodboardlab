import fs from 'fs';
import path from 'path';
import { CosmosClient } from '@azure/cosmos';

const ROOT = '/Users/jr-bassindale/moodboard_lab';
const SEED_DIR = path.join(ROOT, 'tmp', 'cosmos-seed');
const API_URL = 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api/materials';

const endpoint = process.env.COSMOS_DB_URI;
const key = process.env.COSMOS_DB_KEY;
const dbName = process.env.COSMOS_DB_NAME || 'moodboardlab';

if (!endpoint || !key) {
  console.error('Missing COSMOS_DB_URI/COSMOS_DB_KEY');
  process.exit(1);
}

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(SEED_DIR, name), 'utf8'));

const upsertBatch = async (docs, upsertFn, concurrency = 20) => {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = index++;
      if (i >= docs.length) return;
      await upsertFn(docs[i]);
    }
  });
  await Promise.all(workers);
};

const main = async () => {
  const liveRes = await fetch(API_URL);
  if (!liveRes.ok) {
    throw new Error(`Failed to fetch live materials: ${liveRes.status}`);
  }
  const liveJson = await liveRes.json();
  const liveItems = Array.isArray(liveJson) ? liveJson : (liveJson.items || []);
  const liveIds = new Set(liveItems.map((m) => m.id));

  const materials = readJson('materials.json');
  const finishes = readJson('finishes.json');
  const finishSets = readJson('finish_sets.json');
  const materialFinishLinks = readJson('material_finish_links.json');
  const materialFinishSetLinks = readJson('material_finish_set_links.json');
  const lifecycleProfiles = readJson('lifecycle_profiles.json');
  const manifest = readJson('manifest.json');
  const containers = manifest.containers || {};
  const containerNames = {
    materials: containers.materials?.name || 'materials',
    finishes: containers.finishes?.name || 'finishes',
    finishSets: containers.finishSets?.name || 'finish_sets',
    materialFinishLinks: containers.materialFinishLinks?.name || 'material_finish_links',
    materialFinishSetLinks: containers.materialFinishSetLinks?.name || 'material_finish_set_links',
    lifecycleProfiles: containers.lifecycleProfiles?.name || 'lifecycle_profiles',
  };

  const seedIds = new Set(materials.map((m) => m.id));
  const missingMaterialIds = [...seedIds].filter((id) => !liveIds.has(id));

  if (!missingMaterialIds.length) {
    console.log('No missing materials to insert.');
    return;
  }

  const missingIdSet = new Set(missingMaterialIds);
  const docsMaterials = materials.filter((m) => missingIdSet.has(m.id));
  const docsMfLinks = materialFinishLinks.filter((d) => missingIdSet.has(d.materialId));
  const docsMfsLinks = materialFinishSetLinks.filter((d) => missingIdSet.has(d.materialId));
  const docsLifecycle = lifecycleProfiles.filter((d) => missingIdSet.has(d.materialId));

  const finishIdSet = new Set(docsMfLinks.map((d) => d.finishId));
  const finishSetIdSet = new Set(docsMfsLinks.map((d) => d.finishSetId));
  const docsFinishes = finishes.filter((d) => finishIdSet.has(d.id));
  const docsFinishSets = finishSets.filter((d) => finishSetIdSet.has(d.id));

  console.log('Missing material IDs:', missingMaterialIds.length);
  console.log(missingMaterialIds.join(', '));
  console.log('Docs to upsert:');
  console.log(`- materials: ${docsMaterials.length}`);
  console.log(`- finishes: ${docsFinishes.length}`);
  console.log(`- finishSets: ${docsFinishSets.length}`);
  console.log(`- materialFinishLinks: ${docsMfLinks.length}`);
  console.log(`- materialFinishSetLinks: ${docsMfsLinks.length}`);
  console.log(`- lifecycleProfiles: ${docsLifecycle.length}`);

  const client = new CosmosClient({ endpoint, key });
  const db = client.database(dbName);

  const upsertTo = async (containerId, docs) => {
    if (!docs.length) return;
    const container = db.container(containerId);
    await upsertBatch(docs, async (doc) => {
      await container.items.upsert(doc);
    }, 25);
    console.log(`Upserted ${docs.length} into ${containerId}`);
  };

  await upsertTo(containerNames.finishes, docsFinishes);
  await upsertTo(containerNames.finishSets, docsFinishSets);
  await upsertTo(containerNames.materialFinishLinks, docsMfLinks);
  await upsertTo(containerNames.materialFinishSetLinks, docsMfsLinks);
  await upsertTo(containerNames.lifecycleProfiles, docsLifecycle);
  await upsertTo(containerNames.materials, docsMaterials);

  const verifyRes = await fetch(API_URL);
  const verifyJson = await verifyRes.json();
  const verifyItems = Array.isArray(verifyJson) ? verifyJson : (verifyJson.items || []);
  const verifyIds = new Set(verifyItems.map((m) => m.id));
  const stillMissing = missingMaterialIds.filter((id) => !verifyIds.has(id));

  if (stillMissing.length) {
    throw new Error(`Some materials still missing after upsert: ${stillMissing.join(', ')}`);
  }

  console.log(`Success. Live API now has all ${missingMaterialIds.length} inserted materials.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
