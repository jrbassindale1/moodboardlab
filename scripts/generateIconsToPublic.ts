#!/usr/bin/env ts-node
/**
 * Generate Material Icons to /public/icons folder
 *
 * Run this script ONCE to generate all icons locally.
 * Icons will be committed to your repo and served to all users.
 *
 * Usage:
 *   npm run generate-icons
 *
 * Cost: ~$8 one-time (200+ materials × $0.04 each)
 * Time: ~10 minutes (1.5s delay between each)
 */

import { MATERIAL_PALETTE } from '../constants';
import { generateMaterialIcon } from '../utils/materialIconGenerator';
import * as fs from 'fs';
import * as path from 'path';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');

async function generateAllIcons() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Material Icon Generator                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Materials to generate: ${MATERIAL_PALETTE.length}`);
  console.log(`💰 Estimated cost: ~$${(MATERIAL_PALETTE.length * 0.04).toFixed(2)}`);
  console.log(`⏱️  Estimated time: ~${Math.round((MATERIAL_PALETTE.length * 1.5) / 60)} minutes\n`);

  // Create icons directory if it doesn't exist
  if (!fs.existsSync(ICONS_DIR)) {
    console.log(`📁 Creating directory: ${ICONS_DIR}`);
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Check which icons already exist
  const existingIcons = fs.existsSync(ICONS_DIR)
    ? fs.readdirSync(ICONS_DIR).map(f => f.replace('.png', ''))
    : [];

  const materialsToGenerate = MATERIAL_PALETTE.filter(
    m => !existingIcons.includes(m.id)
  );

  if (materialsToGenerate.length === 0) {
    console.log('✅ All icons already exist! Nothing to generate.\n');
    console.log('💡 To regenerate all icons, delete the /public/icons folder first.');
    return;
  }

  console.log(`🔄 Skipping ${existingIcons.length} existing icons`);
  console.log(`🆕 Generating ${materialsToGenerate.length} new icons\n`);

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  const errors: { material: string; error: string }[] = [];

  for (let i = 0; i < materialsToGenerate.length; i++) {
    const material = materialsToGenerate[i];
    const progress = `[${i + 1}/${materialsToGenerate.length}]`;

    try {
      console.log(`${progress} 🎨 Generating: ${material.name}...`);

      // Generate icon via API
      const icon = await generateMaterialIcon({
        id: material.id,
        name: material.name,
        description: material.description,
        tone: material.tone,
        finish: material.finish,
        keywords: material.keywords
      });

      // Convert base64 to buffer
      const base64Data = icon.dataUri.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Save to file
      const filePath = path.join(ICONS_DIR, `${material.id}.png`);
      fs.writeFileSync(filePath, buffer);

      const fileSizeKB = Math.round(buffer.length / 1024);
      console.log(`${progress} ✅ Saved: ${material.id}.png (${fileSizeKB}KB)\n`);

      successCount++;

      // Rate limiting - wait 1.5 seconds between requests
      if (i < materialsToGenerate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`${progress} ❌ Failed: ${material.name}`);
      console.error(`${progress}    Error: ${errorMsg}\n`);

      errors.push({
        material: material.name,
        error: errorMsg
      });
      errorCount++;
    }
  }

  const endTime = Date.now();
  const durationMin = Math.round((endTime - startTime) / 1000 / 60);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     Generation Complete!                               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Success: ${successCount} icons`);
  console.log(`❌ Errors:  ${errorCount} icons`);
  console.log(`⏱️  Duration: ${durationMin} minutes`);
  console.log(`📁 Location: ${ICONS_DIR}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:\n');
    errors.forEach(({ material, error }) => {
      console.log(`   • ${material}: ${error}`);
    });
  }

  // Calculate total storage
  const totalSize = fs.readdirSync(ICONS_DIR)
    .map(f => fs.statSync(path.join(ICONS_DIR, f)).size)
    .reduce((a, b) => a + b, 0);
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

  console.log(`\n💾 Total storage: ${totalSizeMB}MB`);
  console.log(`\n🎉 Icons ready to use! Update your components to:`);
  console.log(`   <img src="/icons/\${material.id}.png" />\n`);

  // Create a manifest file
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalIcons: fs.readdirSync(ICONS_DIR).length,
    totalSizeMB: parseFloat(totalSizeMB),
    icons: MATERIAL_PALETTE.map(m => ({
      id: m.id,
      name: m.name,
      exists: fs.existsSync(path.join(ICONS_DIR, `${m.id}.png`))
    }))
  };

  fs.writeFileSync(
    path.join(ICONS_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('📄 Manifest created: /public/icons/manifest.json\n');
}

// Run the script
generateAllIcons().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
