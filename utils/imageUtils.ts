// Image loading and conversion utilities

const isDataUri = (value: string) => value.startsWith('data:');

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const loadImage = (src: string, useCrossOrigin = true) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * Converts an image source (URL or data URI) to a data URI.
 * Tries multiple strategies to handle CORS and expired URLs.
 */
export const resolveImageSourceToDataUrl = async (source: string): Promise<string> => {
  if (!source) throw new Error('Missing image source.');
  if (isDataUri(source)) return source;

  // Try multiple strategies to load the image

  // Strategy 1: Try loading with crossOrigin='anonymous' (for cross-origin images with CORS)
  try {
    const img = await loadImage(source, true);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    // Strategy 2: Try loading without crossOrigin (for same-origin images)
    try {
      const img = await loadImage(source, false);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (err2) {
      // Strategy 3: Fallback to fetch approach
      try {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        return blobToDataUrl(blob);
      } catch (fetchErr) {
        throw new Error('The image could not be loaded. The URL may have expired or CORS is blocking access.');
      }
    }
  }
};
