const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';

export const dataUrlSizeBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
};

export const isDataUri = (value: string) => value.startsWith('data:');

export const getMimeTypeFromDataUrl = (dataUrl: string): string =>
  dataUrl.match(/^data:([^;]+);base64,/i)?.[1] || 'image/png';

export const getExtensionFromMimeType = (mimeType?: string | null): string => {
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('avif')) return 'avif';
  if (mime.includes('svg')) return 'svg';
  return 'png';
};

export const getExtensionFromImageSource = (source: string): string => {
  if (!source) return 'png';
  if (isDataUri(source)) {
    return getExtensionFromMimeType(getMimeTypeFromDataUrl(source));
  }
  try {
    const withoutQuery = source.split('?')[0];
    const lastSegment = withoutQuery.split('/').pop() || '';
    const ext = lastSegment.split('.').pop() || '';
    return ext.trim().toLowerCase() || 'png';
  } catch {
    return 'png';
  }
};

export const sanitizeFilenameStem = (value: string): string => {
  const stem = value
    .trim()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stem || 'image';
};

export const buildTimestampedFilename = (stem: string, source: string): string => {
  const ext = getExtensionFromImageSource(source);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sanitizeFilenameStem(stem)}-${timestamp}.${ext}`;
};

export const buildPreservedFilename = (name: string, source: string): string => {
  const ext = getExtensionFromImageSource(source);
  const stem = sanitizeFilenameStem(name);
  return `${stem}.${ext}`;
};

export const loadImage = (src: string, useCrossOrigin = true) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const createNamedObjectUrlFromSource = async (source: string, filename: string): Promise<string> => {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error('Could not prepare image for browser preview.');
  }
  const blob = await response.blob();
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  return URL.createObjectURL(file);
};

export const downscaleImage = (
  dataUrl: string,
  targetMime = RESIZE_MIME,
  quality = RESIZE_QUALITY
): Promise<{ dataUrl: string; width: number; height: number; mimeType: string; sizeBytes: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported in this browser.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const mime = targetMime || 'image/jpeg';
      const resizedUrl = canvas.toDataURL(mime, quality);
      resolve({
        dataUrl: resizedUrl,
        width,
        height,
        mimeType: mime,
        sizeBytes: dataUrlSizeBytes(resizedUrl)
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

export const calculateAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;

  const validRatios: { label: string; value: number }[] = [
    { label: '1:1', value: 1 },
    { label: '3:2', value: 3 / 2 },
    { label: '2:3', value: 2 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '4:5', value: 4 / 5 },
    { label: '5:4', value: 5 / 4 },
    { label: '9:16', value: 9 / 16 },
    { label: '16:9', value: 16 / 9 },
    { label: '21:9', value: 21 / 9 }
  ];

  let closest = validRatios[0];
  let minDiff = Math.abs(ratio - closest.value);

  for (const validRatio of validRatios) {
    const diff = Math.abs(ratio - validRatio.value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validRatio;
    }
  }

  return closest.label;
};

export const dataUrlToInlineData = (dataUrl: string) => {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = meta?.match(/data:(.*);base64/);
  return {
    inlineData: {
      mimeType: mimeMatch?.[1] || 'image/png',
      data: content || ''
    }
  };
};
