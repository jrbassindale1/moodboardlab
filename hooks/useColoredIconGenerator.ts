/**
 * Hook for generating and caching colored material icon variants
 *
 * When a user selects a colored variant of a material (e.g., Yellow Steel),
 * this hook generates the colored icon and caches it for reuse.
 */

import { useState, useEffect } from 'react';
import { MaterialOption } from '../types';
import { generateMaterialIcon, MaterialIconRequest } from '../utils/materialIconGenerator';
import { saveColoredIcon } from '../api';

const COLORED_ICONS_STORAGE_KEY = 'coloredMaterialIcons';

interface ColoredIconCache {
  [colorVariantId: string]: {
    dataUri: string;
    generatedAt: number;
  };
}

/**
 * Load colored icon cache from localStorage
 */
function loadColoredIconCache(): ColoredIconCache {
  try {
    const stored = localStorage.getItem(COLORED_ICONS_STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load colored icon cache:', error);
    return {};
  }
}

/**
 * Save colored icon to cache
 */
function saveColoredIconToCache(colorVariantId: string, dataUri: string) {
  try {
    const cache = loadColoredIconCache();
    cache[colorVariantId] = {
      dataUri,
      generatedAt: Date.now()
    };
    localStorage.setItem(COLORED_ICONS_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to save colored icon to cache:', error);
  }
}

/**
 * Generate a colored icon variant for a material and save to server
 */
export async function generateColoredIcon(
  material: MaterialOption
): Promise<{ dataUri: string; blobUrl: string } | null> {
  if (!material.colorVariantId || !material.colorLabel) {
    return null;
  }

  // Check if we already have this icon cached
  const cache = loadColoredIconCache();
  const cached = cache[material.colorVariantId];
  if (cached) {
    return { dataUri: cached.dataUri, blobUrl: cached.dataUri };
  }

  try {
    // Generate the colored icon
    const iconRequest: MaterialIconRequest = {
      id: material.colorVariantId,
      name: material.name,
      description: material.description,
      tone: material.tone,
      finish: material.finish,
      keywords: material.keywords,
      colorVariant: material.colorLabel
    };

    const icon = await generateMaterialIcon(iconRequest);

    // Save to server (Azure Blob Storage)
    let blobUrl = icon.dataUri;
    try {
      const saveResult = await saveColoredIcon({
        colorVariantId: material.colorVariantId,
        imageDataUri: icon.dataUri
      });
      blobUrl = saveResult.blobUrl;
      console.log(`Colored icon saved to server: ${material.colorVariantId} -> ${blobUrl}`);
    } catch (saveError) {
      console.error(`Failed to save colored icon to server (using local cache):`, saveError);
      // Continue with local cache even if server save fails
    }

    // Also save to local cache as backup
    saveColoredIconToCache(material.colorVariantId, icon.dataUri);

    return { dataUri: icon.dataUri, blobUrl };
  } catch (error) {
    console.error(`Failed to generate colored icon for ${material.colorVariantId}:`, error);
    return null;
  }
}

/**
 * Hook to generate colored icon when material is added
 */
export function useColoredIconGenerator(material: MaterialOption | null) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [iconDataUri, setIconDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!material || !material.colorVariantId) {
      setIconDataUri(null);
      return;
    }

    // Check cache first
    const cache = loadColoredIconCache();
    const cached = cache[material.colorVariantId];
    if (cached) {
      setIconDataUri(cached.dataUri);
      return;
    }

    // Generate icon in background
    let isCancelled = false;

    const generate = async () => {
      setIsGenerating(true);
      setError(null);

      try {
        const dataUri = await generateColoredIcon(material);
        if (!isCancelled) {
          setIconDataUri(dataUri);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate icon');
        }
      } finally {
        if (!isCancelled) {
          setIsGenerating(false);
        }
      }
    };

    generate();

    return () => {
      isCancelled = true;
    };
  }, [material?.colorVariantId]);

  return {
    isGenerating,
    iconDataUri,
    error
  };
}

/**
 * Get a colored icon from cache (does not generate)
 */
export function getCachedColoredIcon(colorVariantId: string): string | null {
  const cache = loadColoredIconCache();
  return cache[colorVariantId]?.dataUri || null;
}

/**
 * Clear old cached icons (older than 30 days)
 */
export function cleanupOldColoredIcons() {
  try {
    const cache = loadColoredIconCache();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();

    let cleaned = false;
    Object.keys(cache).forEach(key => {
      if (now - cache[key].generatedAt > maxAge) {
        delete cache[key];
        cleaned = true;
      }
    });

    if (cleaned) {
      localStorage.setItem(COLORED_ICONS_STORAGE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Failed to cleanup old colored icons:', error);
  }
}
