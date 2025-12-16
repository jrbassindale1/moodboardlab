/**
 * Material Icon Generator
 *
 * Generates small, representative icons for materials using the Gemini API
 * with Imagen 3 for consistent, familiar visual representations.
 */

import { callGeminiImage } from '../api';

export interface MaterialIconRequest {
  id: string;
  name: string;
  description: string;
  tone?: string;
  finish?: string;
  keywords?: string[];
}

export interface MaterialIcon {
  id: string;
  dataUri: string;
  generatedAt: number;
}

const ICON_SIZE = 512; // 512x512 for quality, can be resized in UI

/**
 * Generate a prompt for a material icon that produces consistent,
 * familiar, minimalist results
 */
function createIconPrompt(material: MaterialIconRequest): string {
  const keywordHints = material.keywords?.join(', ') || '';

  return `Create a simple, minimalist material swatch icon of ${material.name}.
Style: Clean, professional architectural material sample, square format, centered.
Material: ${material.description}
Finish: ${material.finish || 'standard'}
Keywords: ${keywordHints}

Requirements:
- Show the material texture/pattern clearly
- White or neutral background
- Professional architectural representation
- No text, labels, or borders
- Photorealistic material texture
- Square composition, ${ICON_SIZE}x${ICON_SIZE}px
- Suitable for use as a small thumbnail icon`;
}

/**
 * Generate a single material icon using Gemini Imagen
 */
export async function generateMaterialIcon(
  material: MaterialIconRequest
): Promise<MaterialIcon> {
  try {
    const prompt = createIconPrompt(material);

    const response = await callGeminiImage({
      prompt,
      aspectRatio: '1:1',
      numberOfImages: 1
    });

    if (!response.images || response.images.length === 0) {
      throw new Error('No image returned from Gemini');
    }

    // Assuming the API returns base64 or data URI
    const imageData = response.images[0];
    const dataUri = imageData.startsWith('data:')
      ? imageData
      : `data:image/png;base64,${imageData}`;

    return {
      id: material.id,
      dataUri,
      generatedAt: Date.now()
    };
  } catch (error) {
    console.error(`Failed to generate icon for ${material.id}:`, error);
    throw new Error(`Icon generation failed for ${material.name}: ${error}`);
  }
}

/**
 * Generate icons for multiple materials with rate limiting
 */
export async function generateMaterialIcons(
  materials: MaterialIconRequest[],
  onProgress?: (completed: number, total: number, current: string) => void,
  delayMs: number = 1000 // Rate limiting delay between requests
): Promise<Map<string, MaterialIcon>> {
  const results = new Map<string, MaterialIcon>();

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];

    try {
      onProgress?.(i, materials.length, material.name);

      const icon = await generateMaterialIcon(material);
      results.set(material.id, icon);

      // Rate limiting - wait between requests
      if (i < materials.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Skipping ${material.id} due to error:`, error);
      // Continue with next material
    }
  }

  onProgress?.(materials.length, materials.length, 'Complete');
  return results;
}

/**
 * Save generated icons to localStorage for persistence
 */
export function saveMaterialIcons(icons: Map<string, MaterialIcon>): void {
  const iconsObject = Object.fromEntries(icons);
  localStorage.setItem('materialIcons', JSON.stringify(iconsObject));
  localStorage.setItem('materialIconsTimestamp', Date.now().toString());
}

/**
 * Load material icons from localStorage
 */
export function loadMaterialIcons(): Map<string, MaterialIcon> {
  try {
    const stored = localStorage.getItem('materialIcons');
    if (!stored) return new Map();

    const parsed = JSON.parse(stored);
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.error('Failed to load material icons:', error);
    return new Map();
  }
}

/**
 * Check if icons need regeneration (e.g., older than 30 days)
 */
export function shouldRegenerateIcons(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): boolean {
  const timestamp = localStorage.getItem('materialIconsTimestamp');
  if (!timestamp) return true;

  const age = Date.now() - parseInt(timestamp);
  return age > maxAgeMs;
}

/**
 * Get missing material IDs (materials without icons)
 */
export function getMissingIconMaterials(
  allMaterials: MaterialIconRequest[],
  existingIcons: Map<string, MaterialIcon>
): MaterialIconRequest[] {
  return allMaterials.filter(material => !existingIcons.has(material.id));
}
