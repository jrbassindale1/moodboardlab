#!/usr/bin/env tsx
/**
 * Upload Material Icons to Azure Blob Storage
 *
 * Reads icons from /public/icons and uploads them to Azure Blob Storage
 * via the save-material-icon Azure Function.
 *
 * Usage:
 *   ADMIN_KEY=your-admin-key npm run upload-icons
 */

import * as fs from 'fs';
import * as path from 'path';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');
const API_URL = process.env.API_URL || 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

async function uploadIcon(materialId: string, pngPath: string): Promise<boolean> {
  try {
    const imageBuffer = fs.readFileSync(pngPath);
    const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const response = await fetch(`${API_URL}/save-material-icon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        materialId,
        imageBase64,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Failed: ${response.status} - ${errorText}`);
      return false;
    }

    const result = await response.json();
    console.log(`  ✅ Uploaded: ${materialId} -> ${result.webpUrl}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function uploadAllIcons() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Upload Icons to Azure Blob Storage                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!ADMIN_KEY) {
    console.error('❌ ADMIN_KEY environment variable is required');
    console.error('   Usage: ADMIN_KEY=your-key npm run upload-icons');
    process.exit(1);
  }

  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`❌ Icons directory not found: ${ICONS_DIR}`);
    process.exit(1);
  }

  // Get all PNG files
  const pngFiles = fs.readdirSync(ICONS_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('icon-'));

  console.log(`📁 Found ${pngFiles.length} PNG icons to upload`);
  console.log(`🌐 API: ${API_URL}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < pngFiles.length; i++) {
    const file = pngFiles[i];
    const materialId = file.replace('.png', '');
    const filePath = path.join(ICONS_DIR, file);

    console.log(`[${i + 1}/${pngFiles.length}] Uploading: ${materialId}...`);

    const success = await uploadIcon(materialId, filePath);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }

    // Rate limiting - 500ms between uploads
    if (i < pngFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     Upload Complete!                                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Success: ${successCount} icons`);
  console.log(`❌ Errors:  ${errorCount} icons`);
}

uploadAllIcons().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
