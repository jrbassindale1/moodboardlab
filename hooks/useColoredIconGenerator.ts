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
const COLORED_ICON_SERVER_DISABLED_KEY = 'coloredIconServerDisabledUntil';
const COLORED_ICON_SERVER_DISABLED_REASON_KEY = 'coloredIconServerDisabledReason';
const COLORED_ICON_SERVER_DISABLED_MS = 24 * 60 * 60 * 1000;
const COLORED_ICON_CACHE_MAX_ITEMS = 20;
const COLORED_ICON_CACHE_MAX_BYTES = 4_500_000;
const COLORED_ICON_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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

function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'QuotaExceededError') {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('QuotaExceededError') || message.includes('quota');
}

function pruneColoredIconCache(cache: ColoredIconCache): ColoredIconCache {
  const entries = Object.entries(cache)
    .filter(([, value]) => Date.now() - value.generatedAt <= COLORED_ICON_CACHE_MAX_AGE_MS)
    .sort((a, b) => a[1].generatedAt - b[1].generatedAt);

  const pruned: ColoredIconCache = Object.fromEntries(entries);
  let serialized = JSON.stringify(pruned);

  while (
    entries.length > 0 &&
    (Object.keys(pruned).length > COLORED_ICON_CACHE_MAX_ITEMS ||
      serialized.length > COLORED_ICON_CACHE_MAX_BYTES)
  ) {
    const [oldestKey] = entries.shift() as [string, ColoredIconCache[string]];
    delete pruned[oldestKey];
    serialized = JSON.stringify(pruned);
  }

  return pruned;
}

function persistColoredIconCache(cache: ColoredIconCache) {
  try {
    localStorage.setItem(COLORED_ICONS_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    if (isQuotaError(error)) {
      const entries = Object.entries(cache).sort((a, b) => a[1].generatedAt - b[1].generatedAt);
      const keepFrom = Math.floor(entries.length / 2);
      const reduced = Object.fromEntries(entries.slice(keepFrom));
      try {
        localStorage.setItem(COLORED_ICONS_STORAGE_KEY, JSON.stringify(reduced));
        return;
      } catch (retryError) {
        console.error('Failed to save colored icon to cache after pruning:', retryError);
        return;
      }
    }
    console.error('Failed to save colored icon to cache:', error);
  }
}

function isColoredIconServerDisabled(): boolean {
  try {
    const untilRaw = localStorage.getItem(COLORED_ICON_SERVER_DISABLED_KEY);
    if (!untilRaw) return false;
    const until = Number(untilRaw);
    if (!Number.isFinite(until)) {
      localStorage.removeItem(COLORED_ICON_SERVER_DISABLED_KEY);
      localStorage.removeItem(COLORED_ICON_SERVER_DISABLED_REASON_KEY);
      return false;
    }
    if (Date.now() < until) return true;
    localStorage.removeItem(COLORED_ICON_SERVER_DISABLED_KEY);
    localStorage.removeItem(COLORED_ICON_SERVER_DISABLED_REASON_KEY);
    return false;
  } catch {
    return false;
  }
}

function disableColoredIconServer(reason: string) {
  try {
    localStorage.setItem(
      COLORED_ICON_SERVER_DISABLED_KEY,
      String(Date.now() + COLORED_ICON_SERVER_DISABLED_MS)
    );
    localStorage.setItem(COLORED_ICON_SERVER_DISABLED_REASON_KEY, reason);
  } catch {
    // Ignore storage errors
  }
}

function shouldDisableColoredIconServer(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Public access is not permitted') ||
    message.includes('AuthorizationPermissionMismatch') ||
    message.includes('AuthenticationFailed') ||
    message.includes('Permission')
  );
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
    const pruned = pruneColoredIconCache(cache);
    persistColoredIconCache(pruned);
  } catch (error) {
    console.error('Failed to prepare colored icon cache:', error);
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
    if (!isColoredIconServerDisabled()) {
      try {
        const saveResult = await saveColoredIcon({
          colorVariantId: material.colorVariantId,
          imageDataUri: icon.dataUri
        });
        blobUrl = saveResult.blobUrl;
        console.log(`Colored icon saved to server: ${material.colorVariantId} -> ${blobUrl}`);
      } catch (saveError) {
        if (shouldDisableColoredIconServer(saveError)) {
          const reason = saveError instanceof Error ? saveError.message : String(saveError);
          disableColoredIconServer(reason);
          console.warn('Colored icon server disabled temporarily:', reason);
        } else {
          console.error(`Failed to save colored icon to server (using local cache):`, saveError);
        }
        // Continue with local cache even if server save fails
      }
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
    const cache = pruneColoredIconCache(loadColoredIconCache());
    persistColoredIconCache(cache);
  } catch (error) {
    console.error('Failed to cleanup old colored icons:', error);
  }
}
