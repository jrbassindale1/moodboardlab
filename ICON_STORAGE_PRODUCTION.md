# Production Icon Storage Strategy

## Problem

localStorage is **per-user** - each visitor would regenerate icons:
- ❌ Expensive: $8 × number of users
- ❌ Slow: 10 minutes wait for each new user
- ❌ Not scalable

## Solution: Pre-Generate + Cloud Storage

Generate icons **once**, store in Azure Blob Storage, serve to all users via CDN.

---

## Architecture: Azure Blob Storage + CDN

```
┌─────────────────────────────────────────┐
│  Your Computer (One-Time Setup)         │
│                                          │
│  Run: npm run generate-icons            │
│  ├─> Generates all 200+ icons           │
│  ├─> Uploads to Azure Blob Storage      │
│  └─> Takes ~10 min, costs ~$8 once      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Azure Blob Storage                      │
│  Container: material-icons               │
│                                          │
│  /steel-frame.png                        │
│  /glulam-structure.png                   │
│  /concrete-frame.png                     │
│  ... (200+ icons)                        │
└─────────────────────────────────────────┘
                    │
                    ▼ (Served via CDN)
┌─────────────────────────────────────────┐
│  All Users' Browsers                     │
│  <img src="https://your-cdn.blob.core   │
│    .windows.net/material-icons/          │
│    steel-frame.png" />                   │
│                                          │
│  ✅ Instant loading                      │
│  ✅ No generation needed                 │
│  ✅ No per-user cost                     │
└─────────────────────────────────────────┘
```

---

## Implementation

### Step 1: Create Azure Blob Storage Container

```bash
# Azure CLI (one-time setup)
az storage account create \
  --name moodboardlabstorage \
  --resource-group your-resource-group \
  --location westeurope \
  --sku Standard_LRS

az storage container create \
  --name material-icons \
  --account-name moodboardlabstorage \
  --public-access blob
```

### Step 2: Create Icon Generation Script

This script generates icons and uploads them to Azure Blob Storage.

**File: `scripts/generateAndUploadIcons.ts`**

```typescript
import { BlobServiceClient } from '@azure/storage-blob';
import { MATERIAL_PALETTE } from '../constants';
import { generateMaterialIcon } from '../utils/materialIconGenerator';
import * as fs from 'fs';
import * as path from 'path';

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const CONTAINER_NAME = 'material-icons';

async function generateAndUploadAllIcons() {
  console.log(`🚀 Starting icon generation for ${MATERIAL_PALETTE.length} materials...`);

  // Create blob service client
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  // Ensure container exists
  await containerClient.createIfNotExists({ access: 'blob' });

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < MATERIAL_PALETTE.length; i++) {
    const material = MATERIAL_PALETTE[i];

    try {
      console.log(`[${i + 1}/${MATERIAL_PALETTE.length}] Generating: ${material.name}...`);

      // Generate icon
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

      // Upload to blob storage
      const blobName = `${material.id}.png`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: 'image/png',
          blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
        }
      });

      console.log(`✅ Uploaded: ${blobName}`);
      successCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error(`❌ Failed: ${material.name}`, error);
      errorCount++;
    }
  }

  console.log(`\n🎉 Complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\n🌐 Icons available at:`);
  console.log(`https://${blobServiceClient.accountName}.blob.core.windows.net/${CONTAINER_NAME}/[material-id].png`);
}

generateAndUploadAllIcons();
```

### Step 3: Update Your Constants

Add the CDN URL to your constants:

```typescript
// constants.ts
export const ICON_BASE_URL =
  'https://moodboardlabstorage.blob.core.windows.net/material-icons';

export function getMaterialIconUrl(materialId: string): string {
  return `${ICON_BASE_URL}/${materialId}.png`;
}
```

### Step 4: Update Components to Use CDN URLs

```typescript
// components/MaterialIconDisplay.tsx
import { getMaterialIconUrl } from '../constants';

export function MaterialIconDisplay({ material, size = 48 }: Props) {
  const iconUrl = getMaterialIconUrl(material.id);

  return (
    <div style={{ width: size, height: size }}>
      <img
        src={iconUrl}
        alt={material.name}
        loading="lazy"
        onError={(e) => {
          // Fallback to color swatch if image fails
          e.currentTarget.style.display = 'none';
        }}
      />
      {/* Fallback color swatch */}
      <div style={{ background: material.tone }} />
    </div>
  );
}
```

### Step 5: Run the Generation Script (One Time)

```bash
# Install dependencies
npm install @azure/storage-blob

# Set environment variable
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"

# Run generation script (takes ~10 minutes, costs ~$8)
npm run generate-icons
```

---

## Alternative: Generate Icons Locally, Commit to Repo

If you don't want Azure Blob Storage, generate icons locally and commit them to your repo.

### Generate Icons to `/public/icons` Folder

```typescript
// scripts/generateIconsLocally.ts
import { MATERIAL_PALETTE } from '../constants';
import { generateMaterialIcon } from '../utils/materialIconGenerator';
import * as fs from 'fs';
import * as path from 'path';

async function generateIconsToPublicFolder() {
  const iconsDir = path.join(process.cwd(), 'public', 'icons');

  // Create directory if it doesn't exist
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const material of MATERIAL_PALETTE) {
    console.log(`Generating: ${material.name}...`);

    const icon = await generateMaterialIcon({
      id: material.id,
      name: material.name,
      description: material.description,
      tone: material.tone,
      finish: material.finish,
      keywords: material.keywords
    });

    // Convert base64 to buffer and save as PNG
    const base64Data = icon.dataUri.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filePath = path.join(iconsDir, `${material.id}.png`);
    fs.writeFileSync(filePath, buffer);

    console.log(`✅ Saved: ${material.id}.png`);

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('🎉 All icons generated!');
}

generateIconsToPublicFolder();
```

Then update your component:

```typescript
export function MaterialIconDisplay({ material }: Props) {
  const iconUrl = `/icons/${material.id}.png`;
  return <img src={iconUrl} alt={material.name} />;
}
```

**Pros**:
- ✅ No cloud storage needed
- ✅ Works offline
- ✅ Simple deployment

**Cons**:
- ❌ Adds ~10-20MB to your repo
- ❌ Slower initial page load (no CDN)

---

## Comparison

| Approach | Cost (One-Time) | Cost (Per User) | Speed | Maintenance |
|----------|-----------------|-----------------|-------|-------------|
| **localStorage (current)** | $0 | $8 | Slow (10 min wait) | None |
| **Azure Blob + CDN** | $8 + $1/month | $0 | Fast (instant) | Low |
| **Public folder (repo)** | $8 | $0 | Medium | None |

---

## Recommended: Azure Blob Storage + CDN

**Best for production** because:
1. Generate once, serve to millions
2. Fast CDN delivery worldwide
3. Minimal ongoing cost (~$1/month storage)
4. Professional infrastructure
5. Easy to regenerate/update specific icons

---

## Quick Migration Plan

1. **Now**: Use current localStorage system for development
2. **Before launch**: Run generation script once, upload to Azure Blob
3. **Update**: Change components to use CDN URLs
4. **Deploy**: Icons load instantly for all users
5. **Cost**: $8 once + ~$1/month storage

**Total savings**: $8 per user avoided! 🎉
