import { MaterialOption, MaterialCategory } from '../types';
import { OLD_TO_NEW_CATEGORY_MAPPING } from './tags';

// Map old category field values to new treePaths
const CATEGORY_TO_TREE_PATH: Record<MaterialCategory, string[]> = {
  structure: ['Structure>Primary Structure'],
  floor: ['Interiors>Floors'],
  'wall-internal': ['Interiors>Walls'],
  external: ['Envelope>Façade'],
  ceiling: ['Interiors>Ceilings'],
  soffit: ['Interiors>Ceilings'],
  window: ['Envelope>Glazing'],
  roof: ['Envelope>Roofing'],
  'paint-wall': ['Interiors>Walls'],
  'paint-ceiling': ['Interiors>Ceilings'],
  plaster: ['Interiors>Walls'],
  microcement: ['Interiors>Walls'],
  'timber-panel': ['Interiors>Walls'],
  tile: ['Interiors>Floors', 'Interiors>Walls'],
  wallpaper: ['Interiors>Walls'],
  'acoustic-panel': ['Interiors>Walls', 'Interiors>Ceilings'],
  'timber-slat': ['Interiors>Walls', 'Interiors>Ceilings'],
  'exposed-structure': ['Structure>Secondary Structure'],
  joinery: ['Interiors>Joinery'],
  fixture: ['Interiors>Fixtures & Fittings'],
  landscape: ['Landscape>Landscaping'],
  insulation: ['Envelope>Insulation'],
  door: ['Interiors>Doors'],
  balustrade: ['Envelope>Balustrades & Railings'],
  'external-ground': ['Landscape>External Ground'],
  furniture: ['Interiors>Fixtures & Fittings'],
  finish: ['Interiors>Walls'], // default for generic finishes
};

// Map old categories to tags
const CATEGORY_TO_TAGS: Record<string, string[]> = {
  'paint-wall': ['paint'],
  'paint-ceiling': ['paint'],
  plaster: ['plaster'],
  microcement: ['microcement'],
  'timber-panel': ['timber-panels'],
  tile: ['tiles'],
  wallpaper: ['wallpaper'],
  'acoustic-panel': ['acoustic'],
  'timber-slat': ['timber-slats'],
};

/**
 * Migrates a material's old treePaths to new category structure
 * and extracts tags from retired categories
 */
export function migrateMaterialCategories(material: MaterialOption): MaterialOption {
  const newTreePaths: string[] = [];
  const tags: string[] = material.tags || [];

  // If material has treePaths, migrate them
  if (material.treePaths && material.treePaths.length > 0) {
    material.treePaths.forEach((oldPath) => {
      const mapping = OLD_TO_NEW_CATEGORY_MAPPING[oldPath];

      if (mapping) {
        // Add new path if not already present
        if (!newTreePaths.includes(mapping.newPath)) {
          newTreePaths.push(mapping.newPath);
        }
        // Add tags if not already present
        mapping.tags.forEach((tag) => {
          if (!tags.includes(tag)) {
            tags.push(tag);
          }
        });
      } else {
        // Path doesn't need migration, keep it
        // But we need to update the path format from old to new
        const updatedPath = updatePathFormat(oldPath);
        if (updatedPath && !newTreePaths.includes(updatedPath)) {
          newTreePaths.push(updatedPath);
        }
      }
    });
  }

  // If no treePaths were generated from migration, use category field
  if (newTreePaths.length === 0 && material.category) {
    const categoryPaths = CATEGORY_TO_TREE_PATH[material.category];
    if (categoryPaths) {
      newTreePaths.push(...categoryPaths);
    }

    // Add tags based on category
    const categoryTags = CATEGORY_TO_TAGS[material.category];
    if (categoryTags) {
      categoryTags.forEach((tag) => {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      });
    }
  }

  return {
    ...material,
    treePaths: newTreePaths.length > 0 ? newTreePaths : ['Interiors>Walls'], // fallback
    tags: tags.length > 0 ? tags : undefined,
  };
}

/**
 * Updates path format from old structure to new
 * e.g., "Structure>Primary Structure" stays the same
 * "External>Façade" becomes "Envelope>Façade"
 */
function updatePathFormat(oldPath: string): string | null {
  const pathMappings: Record<string, string> = {
    'External>Façade': 'Envelope>Façade',
    'External>Glazing': 'Envelope>Glazing',
    'External>Roofing': 'Envelope>Roofing',
    'External>Insulation': 'Envelope>Insulation',
    'Internal>Floors': 'Interiors>Floors',
    'Internal>Walls': 'Interiors>Walls',
    'Internal>Ceilings': 'Interiors>Ceilings',
    'Internal>Joinery & Furniture': 'Interiors>Joinery',
    'Internal>Doors': 'Interiors>Doors',
    'Internal>Fixtures & Fittings': 'Interiors>Fixtures & Fittings',
    'Structure>Primary Structure': 'Structure>Primary Structure',
    'Structure>Secondary Structure': 'Structure>Secondary Structure',
    'Structure>Envelope Substructure': 'Structure>Envelope and Lightweight Structure',
    'Internal>Exposed Structure': 'Structure>Secondary Structure',
    'Structure>Secondary Structure — Floors and Horizontal Elements': 'Structure>Floors and Roofs',
    'Structure>Secondary Structure — Roof Structure': 'Structure>Floors and Roofs',
    'Structure>Secondary Structure — Wall and Edge Support': 'Structure>Secondary Structure',
    'Structure>Secondary Structure — Bracing and Stability': 'Structure>Stability and Bracing',
    'Structure>Secondary Structure — Stairs and Circulation Structure': 'Structure>Secondary Structure',
    'Structure>Secondary Structure — Façade and Envelope Support': 'Structure>Envelope and Lightweight Structure',
    'Structure>Secondary Structure — Canopies and Lightweight Structures': 'Structure>Envelope and Lightweight Structure',
    'Structure>Floors and Roofs': 'Structure>Floors and Roofs',
    'Structure>Stability and Bracing': 'Structure>Stability and Bracing',
    'Structure>Envelope and Lightweight Structure': 'Structure>Envelope and Lightweight Structure',
    'Internal>Balustrade & Railings': 'Envelope>Balustrades & Railings',
    'Elements>Balustrades & Railings': 'Envelope>Balustrades & Railings',
    'Elements>Furniture': 'Interiors>Fixtures & Fittings',
  };

  return pathMappings[oldPath] || oldPath;
}

/**
 * Batch migrate all materials
 */
export function migrateAllMaterials(materials: MaterialOption[]): MaterialOption[] {
  return materials.map(migrateMaterialCategories);
}
