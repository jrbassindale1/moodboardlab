/**
 * React Hook for Material Icon Management
 *
 * Handles loading, generating, and providing material icons
 * with automatic background generation for missing icons
 */

import { useState, useEffect, useCallback } from 'react';
import { MaterialOption } from '../types';
import {
  generateMaterialIcons,
  loadMaterialIcons,
  saveMaterialIcons,
  getMissingIconMaterials,
  shouldRegenerateIcons,
  MaterialIcon,
  MaterialIconRequest
} from '../utils/materialIconGenerator';

export interface UseMaterialIconsResult {
  icons: Map<string, MaterialIcon>;
  isGenerating: boolean;
  progress: { current: number; total: number; materialName: string };
  error: string | null;
  getIcon: (materialId: string) => string | null;
  regenerateIcons: (materials?: MaterialOption[]) => Promise<void>;
  generateMissingIcons: () => Promise<void>;
}

export function useMaterialIcons(
  materials: MaterialOption[],
  autoGenerateMissing: boolean = true
): UseMaterialIconsResult {
  const [icons, setIcons] = useState<Map<string, MaterialIcon>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, materialName: '' });
  const [error, setError] = useState<string | null>(null);

  // Load icons from localStorage on mount
  useEffect(() => {
    const loadedIcons = loadMaterialIcons();
    setIcons(loadedIcons);
  }, []);

  // Auto-generate missing icons in background
  useEffect(() => {
    if (!autoGenerateMissing || isGenerating) return;

    const missingMaterials = getMissingIconMaterials(
      materials.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        tone: m.tone,
        finish: m.finish,
        keywords: m.keywords
      })),
      icons
    );

    if (missingMaterials.length > 0) {
      // Start generation in background after a short delay
      const timeoutId = setTimeout(() => {
        console.log(`Auto-generating icons for ${missingMaterials.length} materials...`);
        generateMissing(missingMaterials);
      }, 2000); // Wait 2 seconds after mount

      return () => clearTimeout(timeoutId);
    }
  }, [materials, icons, autoGenerateMissing, isGenerating]);

  const generateMissing = useCallback(async (missingMaterials: MaterialIconRequest[]) => {
    if (missingMaterials.length === 0) return;

    setIsGenerating(true);
    setError(null);

    try {
      const newIcons = await generateMaterialIcons(
        missingMaterials,
        (current, total, materialName) => {
          setProgress({ current, total, materialName });
        },
        1500 // 1.5 second delay between requests to avoid rate limiting
      );

      // Merge with existing icons
      const updatedIcons = new Map([...icons, ...newIcons]);
      setIcons(updatedIcons);
      saveMaterialIcons(updatedIcons);

      console.log(`✓ Generated ${newIcons.size} material icons`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Icon generation failed';
      setError(message);
      console.error('Icon generation error:', err);
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0, materialName: '' });
    }
  }, [icons]);

  const generateMissingIcons = useCallback(async () => {
    const missingMaterials = getMissingIconMaterials(
      materials.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        tone: m.tone,
        finish: m.finish,
        keywords: m.keywords
      })),
      icons
    );

    await generateMissing(missingMaterials);
  }, [materials, icons, generateMissing]);

  const regenerateIcons = useCallback(async (materialsToRegenerate?: MaterialOption[]) => {
    const targetMaterials = materialsToRegenerate || materials;

    setIsGenerating(true);
    setError(null);

    try {
      const materialRequests = targetMaterials.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        tone: m.tone,
        finish: m.finish,
        keywords: m.keywords
      }));

      const newIcons = await generateMaterialIcons(
        materialRequests,
        (current, total, materialName) => {
          setProgress({ current, total, materialName });
        }
      );

      const updatedIcons = new Map([...icons, ...newIcons]);
      setIcons(updatedIcons);
      saveMaterialIcons(updatedIcons);

      console.log(`✓ Regenerated ${newIcons.size} material icons`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Icon regeneration failed';
      setError(message);
      console.error('Icon regeneration error:', err);
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0, materialName: '' });
    }
  }, [materials, icons]);

  const getIcon = useCallback(
    (materialId: string): string | null => {
      const icon = icons.get(materialId);
      return icon?.dataUri || null;
    },
    [icons]
  );

  return {
    icons,
    isGenerating,
    progress,
    error,
    getIcon,
    regenerateIcons,
    generateMissingIcons
  };
}
