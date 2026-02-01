import { getMaterialIconId } from '../materialIconMapping';

/**
 * Fetch a static icon and convert to data URI for PDF embedding
 * Tries webp first, then falls back to png
 */
export async function fetchIconAsDataUri(materialId: string): Promise<string | null> {
  const iconId = getMaterialIconId(materialId);
  const formats = ['webp', 'png'];

  for (const format of formats) {
    try {
      const response = await fetch(`/icons/${iconId}.${format}`);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // Try next format
    }
  }
  return null;
}

/**
 * Pre-fetch icons for multiple materials (for PDF generation)
 */
export async function prefetchMaterialIcons(
  materialIds: string[]
): Promise<Map<string, string>> {
  const iconMap = new Map<string, string>();

  await Promise.all(
    materialIds.map(async (id) => {
      const dataUri = await fetchIconAsDataUri(id);
      if (dataUri) {
        iconMap.set(id, dataUri);
      }
    })
  );

  return iconMap;
}
