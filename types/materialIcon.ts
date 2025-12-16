/**
 * Material Icon Type Definitions
 *
 * TypeScript types for the material icon generation system
 */

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

export interface IconGenerationProgress {
  current: number;
  total: number;
  materialName: string;
}

export interface IconGenerationConfig {
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '4:3';
  numberOfImages: number;
}

export interface IconGenerationResponse {
  images: string[];
}

export interface MaterialIconStorage {
  [materialId: string]: MaterialIcon;
}

export interface UseMaterialIconsOptions {
  autoGenerateMissing?: boolean;
  delayMs?: number;
  maxAgeMs?: number;
}
