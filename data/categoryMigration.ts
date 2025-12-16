import { MaterialOption } from '../types';
import { OLD_TO_NEW_CATEGORY_MAPPING } from './tags';

/**
 * Migrates a material's old treePaths to new category structure
 * and extracts tags from retired categories
 */
export function migrateMaterialCategories(material: MaterialOption): MaterialOption {
  if (!material.treePaths || material.treePaths.length === 0) {
    return material;
  }

  const newTreePaths: string[] = [];
  const tags: string[] = material.tags || [];

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

  return {
    ...material,
    treePaths: newTreePaths.length > 0 ? newTreePaths : material.treePaths,
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
    'Structure>Envelope Substructure': 'Structure>Secondary Structure',
    'Internal>Exposed Structure': 'Structure>Exposed Structure',
    'Internal>Balustrade & Railings': 'Elements>Balustrades & Railings',
  };

  return pathMappings[oldPath] || oldPath;
}

/**
 * Batch migrate all materials
 */
export function migrateAllMaterials(materials: MaterialOption[]): MaterialOption[] {
  return materials.map(migrateMaterialCategories);
}
