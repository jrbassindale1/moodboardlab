import { MaterialOption, MaterialCategory } from '../types';
import { OLD_TO_NEW_CATEGORY_MAPPING } from './tags';

// Map legacy category field values → new 3-level treePaths.
// Where the sub-type can't be determined from the category alone, the path stops
// at the 2-level parent (e.g. 'Interiors>Floor Finishes') so the material still
// appears in the correct shelf without guessing the wrong grandchild.
const CATEGORY_TO_TREE_PATH: Record<MaterialCategory, string[]> = {
  structure:          ['Structure>Primary Structure'],
  'exposed-structure':['Structure>Secondary Structure'],
  floor:              ['Interiors>Floor Finishes'],
  'wall-internal':    ['Interiors>Wall Finishes'],
  ceiling:            ['Interiors>Ceilings'],
  soffit:             ['Interiors>Ceilings'],
  external:           ['Envelope>External Walls & Cladding'],
  window:             ['Envelope>Glazing & Windows'],
  roof:               ['Envelope>Roofing'],
  insulation:         ['Envelope>Insulation & Membranes'],
  balustrade:         ['Envelope>Balustrades & Railings'],
  'paint-wall':       ['Interiors>Wall Finishes>Paint & Emulsion'],
  'paint-ceiling':    ['Interiors>Ceilings'],
  plaster:            ['Interiors>Wall Finishes>Plaster & Render'],
  microcement:        ['Interiors>Wall Finishes>Microcement & Polished Finishes'],
  'timber-panel':     ['Interiors>Wall Finishes>Timber Panels & Cladding'],
  'timber-slat':      ['Interiors>Wall Finishes>Timber Panels & Cladding', 'Interiors>Ceilings>Feature & Decorative'],
  tile:               ['Interiors>Floor Finishes>Ceramic & Porcelain', 'Interiors>Wall Finishes>Wall Tiles & Stone'],
  wallpaper:          ['Interiors>Wall Finishes>Wallcoverings & Wallpaper'],
  'acoustic-panel':   ['Interiors>Wall Finishes>Acoustic Wall Panels', 'Interiors>Ceilings>Acoustic Ceilings'],
  joinery:            ['Interiors>Internal Doors & Joinery'],
  door:               ['Interiors>Internal Doors & Joinery>Internal Doors'],
  fixture:            ['Interiors>Fixtures & Fittings'],
  furniture:          ['Interiors>Fixtures & Fittings'],
  landscape:          ['Landscape>Soft Landscaping'],
  'external-ground':  ['Landscape>Hard Landscaping'],
  finish:             ['Interiors>Wall Finishes'], // default for generic finishes
};

// Map old category values → tags (preserved for discovery/filtering)
const CATEGORY_TO_TAGS: Record<string, string[]> = {
  'paint-wall':    ['paint'],
  'paint-ceiling': ['paint'],
  plaster:         ['plaster'],
  microcement:     ['microcement'],
  'timber-panel':  ['timber-panels'],
  'timber-slat':   ['timber-slats'],
  tile:            ['tiles'],
  wallpaper:       ['wallpaper'],
  'acoustic-panel':['acoustic'],
};

// Old 2-level paths → new paths (handles data written before the 3-level system)
const OLD_PATH_TO_NEW_PATH: Record<string, string> = {
  // Structure
  'Structure>Primary Structure':                 'Structure>Primary Structure',
  'Structure>Secondary Structure':               'Structure>Secondary Structure',
  'Structure>Floors and Roofs':                  'Structure>Floor & Roof Structure',
  'Structure>Stability and Bracing':             'Structure>Secondary Structure',
  'Structure>Envelope and Lightweight Structure':'Envelope>External Walls & Cladding',

  // Envelope (old names)
  'Envelope>Façade':                             'Envelope>External Walls & Cladding',
  'Envelope>Glazing':                            'Envelope>Glazing & Windows',
  'Envelope>Roofing':                            'Envelope>Roofing',
  'Envelope>Insulation':                         'Envelope>Insulation & Membranes',
  'Envelope>Balustrades & Railings':             'Envelope>Balustrades & Railings',

  // Interiors (old names → new 2-level parents; grandchild can't be inferred)
  'Interiors>Floors':                            'Interiors>Floor Finishes',
  'Interiors>Walls':                             'Interiors>Wall Finishes',
  'Interiors>Ceilings':                          'Interiors>Ceilings',
  'Interiors>Doors':                             'Interiors>Internal Doors & Joinery',
  'Interiors>Fixtures & Fittings':               'Interiors>Fixtures & Fittings',

  // Landscape (old names)
  'Landscape>External Ground':                   'Landscape>Hard Landscaping',
  'Landscape>Landscaping':                       'Landscape>Soft Landscaping',

  // Very old paths
  'External>Façade':                             'Envelope>External Walls & Cladding',
  'External>Glazing':                            'Envelope>Glazing & Windows',
  'External>Roofing':                            'Envelope>Roofing',
  'External>Insulation':                         'Envelope>Insulation & Membranes',
  'External>External Ground / Landscaping':      'Landscape>Hard Landscaping',
  'Internal>Floors':                             'Interiors>Floor Finishes',
  'Internal>Walls':                              'Interiors>Wall Finishes',
  'Internal>Ceilings':                           'Interiors>Ceilings',
  'Internal>Doors':                              'Interiors>Internal Doors & Joinery',
  'Internal>Joinery & Furniture':                'Interiors>Internal Doors & Joinery',
  'Internal>Fixtures & Fittings':                'Interiors>Fixtures & Fittings',
  'Internal>Exposed Structure':                  'Structure>Secondary Structure',
  'Internal>Balustrade & Railings':              'Envelope>Balustrades & Railings',
  'Internal>Paint – Standard':                   'Interiors>Wall Finishes>Paint & Emulsion',
  'Internal>Paint – Custom Colour':              'Interiors>Wall Finishes>Paint & Emulsion',
  'Internal>Plaster / Microcement':              'Interiors>Wall Finishes>Plaster & Render',
  'Internal>Timber Panels':                      'Interiors>Wall Finishes>Timber Panels & Cladding',
  'Internal>Tiles':                              'Interiors>Floor Finishes>Ceramic & Porcelain',
  'Internal>Wallpaper':                          'Interiors>Wall Finishes>Wallcoverings & Wallpaper',
  'Internal>Acoustic Panels':                    'Interiors>Wall Finishes>Acoustic Wall Panels',
  'Internal>Timber Slats':                       'Interiors>Wall Finishes>Timber Panels & Cladding',
  'Elements>Balustrades & Railings':             'Envelope>Balustrades & Railings',
  'Elements>Furniture':                          'Interiors>Fixtures & Fittings',
  'Structure>Envelope Substructure':             'Envelope>External Walls & Cladding',
  'Structure>Secondary Structure — Floors and Horizontal Elements': 'Structure>Floor & Roof Structure',
  'Structure>Secondary Structure — Roof Structure':                 'Structure>Floor & Roof Structure',
  'Structure>Secondary Structure — Wall and Edge Support':          'Structure>Secondary Structure',
  'Structure>Secondary Structure — Bracing and Stability':          'Structure>Secondary Structure',
  'Structure>Secondary Structure — Stairs and Circulation Structure':'Structure>Secondary Structure',
  'Structure>Secondary Structure — Façade and Envelope Support':    'Envelope>External Walls & Cladding',
  'Structure>Secondary Structure — Canopies and Lightweight Structures':'Envelope>External Walls & Cladding',
};

function migrateSinglePath(oldPath: string): string {
  // Already a valid new path (3-level or known 2-level)? Keep it.
  if (OLD_PATH_TO_NEW_PATH[oldPath]) return OLD_PATH_TO_NEW_PATH[oldPath];

  // Check the OLD_TO_NEW_CATEGORY_MAPPING from tags.ts
  const tagMapping = OLD_TO_NEW_CATEGORY_MAPPING[oldPath];
  if (tagMapping) return tagMapping.newPath;

  // Unknown path — return as-is so data isn't silently dropped
  return oldPath;
}

export function migrateMaterialCategories(material: MaterialOption): MaterialOption {
  const newTreePaths: string[] = [];
  const tags: string[] = material.tags ? [...material.tags] : [];

  // Migrate existing treePaths
  if (material.treePaths && material.treePaths.length > 0) {
    for (const oldPath of material.treePaths) {
      const newPath = migrateSinglePath(oldPath);
      if (!newTreePaths.includes(newPath)) newTreePaths.push(newPath);

      // Carry tags from old mapping if present
      const tagMapping = OLD_TO_NEW_CATEGORY_MAPPING[oldPath];
      if (tagMapping) {
        for (const tag of tagMapping.tags) {
          if (!tags.includes(tag)) tags.push(tag);
        }
      }
    }
  }

  // Fall back to legacy category field if no treePaths resolved
  if (newTreePaths.length === 0 && material.category) {
    const fromCategory = CATEGORY_TO_TREE_PATH[material.category];
    if (fromCategory) {
      for (const p of fromCategory) {
        if (!newTreePaths.includes(p)) newTreePaths.push(p);
      }
    }
    const fromCategoryTags = CATEGORY_TO_TAGS[material.category];
    if (fromCategoryTags) {
      for (const tag of fromCategoryTags) {
        if (!tags.includes(tag)) tags.push(tag);
      }
    }
  }

  return {
    ...material,
    treePaths: newTreePaths.length > 0 ? newTreePaths : ['Interiors>Wall Finishes'],
    tags: tags.length > 0 ? tags : undefined,
  };
}

export function migrateAllMaterials(materials: MaterialOption[]): MaterialOption[] {
  return materials.map(migrateMaterialCategories);
}
