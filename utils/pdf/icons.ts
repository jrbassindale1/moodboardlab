import { getMaterialIconId } from '../materialIconMapping';

const ICON_FETCH_FORMATS = ['webp', 'png'] as const;
const PDF_ICON_MAX_DIMENSION = 96;
const PDF_IMAGE_MIME = 'image/jpeg';
const PDF_IMAGE_QUALITY = 0.72;
const iconFetchCache = new Map<string, Promise<string | null>>();

function blobToDataUri(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

async function optimizeBlobForPdf(
  blob: Blob,
  maxDimension: number,
  mimeType: string,
  quality: number
): Promise<string | null> {
  const image = await loadImageFromBlob(blob);
  if (!image) return null;

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return null;

  const longestSide = Math.max(sourceWidth, sourceHeight);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Keep consistent white-backed thumbnails for compact JPEG embedding in jsPDF.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  try {
    return canvas.toDataURL(mimeType, quality);
  } catch {
    return null;
  }
}

/**
 * Fetch a static icon and convert to data URI for PDF embedding
 * Tries webp first, then falls back to png
 */
export async function fetchIconAsDataUri(materialId: string): Promise<string | null> {
  const iconId = getMaterialIconId(materialId);
  const cached = iconFetchCache.get(iconId);
  if (cached) return cached;

  const requestPromise = (async () => {
    for (const format of ICON_FETCH_FORMATS) {
      try {
        const response = await fetch(`/icons/${iconId}.${format}`, { cache: 'force-cache' });
        if (!response.ok) continue;

        const blob = await response.blob();
        const optimized = await optimizeBlobForPdf(
          blob,
          PDF_ICON_MAX_DIMENSION,
          PDF_IMAGE_MIME,
          PDF_IMAGE_QUALITY
        );

        if (optimized) return optimized;

        const fallback = await blobToDataUri(blob);
        if (fallback) return fallback;
      } catch {
        // Try next format
      }
    }
    return null;
  })();

  iconFetchCache.set(iconId, requestPromise);
  const result = await requestPromise;
  if (!result) {
    iconFetchCache.delete(iconId);
  }
  return result;
}

export async function optimizeImageDataUriForPdf(
  dataUri: string,
  options?: {
    maxDimension?: number;
    mimeType?: string;
    quality?: number;
  }
): Promise<string> {
  if (!dataUri || !dataUri.startsWith('data:image/')) return dataUri;

  try {
    const response = await fetch(dataUri);
    if (!response.ok) return dataUri;
    const blob = await response.blob();
    const optimized = await optimizeBlobForPdf(
      blob,
      options?.maxDimension ?? PDF_ICON_MAX_DIMENSION,
      options?.mimeType ?? PDF_IMAGE_MIME,
      options?.quality ?? PDF_IMAGE_QUALITY
    );
    return optimized || dataUri;
  } catch {
    return dataUri;
  }
}

/**
 * Pre-fetch icons for multiple materials (for PDF generation)
 */
export async function prefetchMaterialIcons(
  materialIds: string[]
): Promise<Map<string, string>> {
  const iconMap = new Map<string, string>();
  const uniqueMaterialIds = [...new Set(materialIds)];

  await Promise.all(
    uniqueMaterialIds.map(async (id) => {
      const dataUri = await fetchIconAsDataUri(id);
      if (dataUri) {
        iconMap.set(id, dataUri);
      }
    })
  );

  return iconMap;
}
