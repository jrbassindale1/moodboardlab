#!/usr/bin/env tsx
/**
 * Upload Material Icons directly to Azure Blob Storage
 *
 * Bypasses the Azure Function and uploads directly using the storage connection string.
 * Icons are already optimized locally, so no server-side processing needed.
 *
 * Usage:
 *   AZURE_STORAGE_CONNECTION_STRING="your-connection-string" npm run upload-icons-direct
 */

import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');
const CONTAINER_NAME = 'material-icons';
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';

async function uploadAllIcons() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Direct Upload to Azure Blob Storage                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!CONNECTION_STRING) {
    console.error('❌ AZURE_STORAGE_CONNECTION_STRING environment variable is required');
    console.error('   Get it from: Azure Portal → Storage Account → Access Keys');
    console.error('   Usage: AZURE_STORAGE_CONNECTION_STRING="..." npm run upload-icons-direct');
    process.exit(1);
  }

  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`❌ Icons directory not found: ${ICONS_DIR}`);
    process.exit(1);
  }

  // Get all WebP files (already optimized)
  const webpFiles = fs.readdirSync(ICONS_DIR)
    .filter(f => f.endsWith('.webp') && !f.startsWith('icon-'));

  const pngFiles = fs.readdirSync(ICONS_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('icon-'));

  console.log(`📁 Found ${webpFiles.length} WebP and ${pngFiles.length} PNG icons`);

  // Connect to blob storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  // Ensure container exists with public blob access
  console.log(`🔧 Ensuring container "${CONTAINER_NAME}" exists...`);
  await containerClient.createIfNotExists({ access: 'blob' });
  console.log(`✅ Container ready\n`);

  let successCount = 0;
  let errorCount = 0;

  // Upload WebP files
  console.log('📤 Uploading WebP files...\n');
  for (let i = 0; i < webpFiles.length; i++) {
    const file = webpFiles[i];
    const filePath = path.join(ICONS_DIR, file);

    try {
      const buffer = fs.readFileSync(filePath);
      const blobClient = containerClient.getBlockBlobClient(file);

      await blobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: 'image/webp',
          blobCacheControl: 'public, max-age=31536000',
        },
      });

      console.log(`[${i + 1}/${webpFiles.length}] ✅ ${file}`);
      successCount++;
    } catch (error) {
      console.error(`[${i + 1}/${webpFiles.length}] ❌ ${file}: ${error instanceof Error ? error.message : error}`);
      errorCount++;
    }
  }

  // Upload PNG files
  console.log('\n📤 Uploading PNG files...\n');
  for (let i = 0; i < pngFiles.length; i++) {
    const file = pngFiles[i];
    const filePath = path.join(ICONS_DIR, file);

    try {
      const buffer = fs.readFileSync(filePath);
      const blobClient = containerClient.getBlockBlobClient(file);

      await blobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: 'image/png',
          blobCacheControl: 'public, max-age=31536000',
        },
      });

      console.log(`[${i + 1}/${pngFiles.length}] ✅ ${file}`);
      successCount++;
    } catch (error) {
      console.error(`[${i + 1}/${pngFiles.length}] ❌ ${file}: ${error instanceof Error ? error.message : error}`);
      errorCount++;
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     Upload Complete!                                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Success: ${successCount} files`);
  console.log(`❌ Errors:  ${errorCount} files`);
  console.log(`\n🌐 Icons available at:`);
  console.log(`   https://${blobServiceClient.accountName}.blob.core.windows.net/${CONTAINER_NAME}/[material-id].webp`);
}

uploadAllIcons().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
