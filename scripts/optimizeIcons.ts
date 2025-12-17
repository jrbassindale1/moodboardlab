import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');
const TARGET_SIZE = 768; // Max width/height
const WEBP_QUALITY = 82;

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

function getFilesWithExt(ext: string): string[] {
  return fs
    .readdirSync(ICONS_DIR)
    .filter((file) => file.toLowerCase().endsWith(ext));
}

function totalSize(bytes: number[]): number {
  return bytes.reduce((acc, n) => acc + n, 0);
}

async function optimizeAllIcons() {
  if (!fs.existsSync(ICONS_DIR)) {
    throw new Error(`Icons directory not found: ${ICONS_DIR}`);
  }

  const pngFiles = getFilesWithExt('.png');

  const beforePngBytes = totalSize(
    pngFiles.map((file) => fs.statSync(path.join(ICONS_DIR, file)).size)
  );

  console.log(
    `Found ${pngFiles.length} PNG files in /public/icons (${formatMB(beforePngBytes)} MB)`
  );
  console.log(
    `Resizing to max ${TARGET_SIZE}px, writing compressed PNG + WebP (quality ${WEBP_QUALITY}).\n`
  );

  for (const file of pngFiles) {
    const inputPath = path.join(ICONS_DIR, file);
    const baseName = file.replace(/\.png$/i, '');
    const webpPath = path.join(ICONS_DIR, `${baseName}.webp`);

    try {
      const inputBuffer = fs.readFileSync(inputPath);
      const pipeline = sharp(inputBuffer).resize({
        width: TARGET_SIZE,
        height: TARGET_SIZE,
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true
      });

      const webpInfo = await pipeline
        .clone()
        .webp({ quality: WEBP_QUALITY, effort: 5 })
        .toFile(webpPath);

      const pngInfo = await pipeline
        .clone()
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(inputPath);

      const pngKB = Math.round(pngInfo.size / 1024);
      const webpKB = Math.round(webpInfo.size / 1024);
      console.log(`✓ ${file} → ${pngKB}KB png / ${webpKB}KB webp`);
    } catch (error) {
      console.error(`✗ Failed to optimize ${file}`, error);
    }
  }

  const afterPngBytes = totalSize(
    getFilesWithExt('.png').map((file) => fs.statSync(path.join(ICONS_DIR, file)).size)
  );
  const afterWebpBytes = totalSize(
    getFilesWithExt('.webp').map((file) => fs.statSync(path.join(ICONS_DIR, file)).size)
  );

  const pngCount = getFilesWithExt('.png').length;
  console.log('\nOptimization complete:');
  console.log(`• PNG total:  ${formatMB(afterPngBytes)} MB (${pngCount} files)`);
  console.log(`• WebP total: ${formatMB(afterWebpBytes)} MB`);
  console.log(`• Combined:   ${formatMB(afterPngBytes + afterWebpBytes)} MB`);

  const manifestPath = path.join(ICONS_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      manifest.generatedAt = new Date().toISOString();
      manifest.totalIcons = pngCount;
      manifest.totalSizeMB = parseFloat(formatMB(afterPngBytes + afterWebpBytes));
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('• Updated manifest.json with new totals');
    } catch (error) {
      console.warn('• Skipped manifest update (could not parse existing manifest.json)', error);
    }
  }
}

optimizeAllIcons().catch((error) => {
  console.error('Fatal error while optimizing icons:', error);
  process.exit(1);
});
