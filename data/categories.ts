export type CategoryGrandchild = {
  id: string;
  label: string;
};

export type CategoryChild = {
  id: string;
  label: string;
  children?: CategoryGrandchild[];
};

export type Category = {
  id: string;
  label: string;
  children?: CategoryChild[];
};

export const CATEGORIES: Category[] = [
  {
    id: 'favourites',
    label: 'Favourites',
    children: [
      { id: 'my-favourites', label: 'My Favourites' },
    ],
  },
  {
    id: 'structure',
    label: 'Structure',
    children: [
      {
        id: 'primary-structure',
        label: 'Primary Structure',
        children: [
          { id: 'structural-steel', label: 'Structural Steel' },
          { id: 'concrete-precast', label: 'Concrete & Precast' },
          { id: 'structural-timber', label: 'Structural Timber' },
        ],
      },
      { id: 'secondary-structure', label: 'Secondary Structure' },
      { id: 'floor-roof-structure', label: 'Floor & Roof Structure' },
      { id: 'substructure-foundations', label: 'Substructure & Foundations' },
    ],
  },
  {
    id: 'envelope',
    label: 'Envelope',
    children: [
      {
        id: 'external-walls-cladding',
        label: 'External Walls & Cladding',
        children: [
          { id: 'metal-cladding', label: 'Metal Cladding' },
          { id: 'timber-cladding', label: 'Timber Cladding' },
          { id: 'masonry-brick', label: 'Masonry & Brick' },
          { id: 'render-eifs', label: 'Render & EIFS' },
          { id: 'composite-panels', label: 'Composite Panels' },
        ],
      },
      {
        id: 'roofing',
        label: 'Roofing',
        children: [
          { id: 'flat-roofing', label: 'Flat Roofing' },
          { id: 'pitched-roofing', label: 'Pitched Roofing' },
          { id: 'green-biodiverse-roofs', label: 'Green & Biodiverse Roofs' },
        ],
      },
      {
        id: 'glazing-windows',
        label: 'Glazing & Windows',
        children: [
          { id: 'curtain-walling', label: 'Curtain Walling' },
          { id: 'windows-frames', label: 'Windows & Frames' },
          { id: 'rooflights-skylights', label: 'Rooflights & Skylights' },
        ],
      },
      { id: 'external-doors-entrances', label: 'External Doors & Entrances' },
      {
        id: 'insulation-membranes',
        label: 'Insulation & Membranes',
        children: [
          { id: 'rigid-insulation', label: 'Rigid Insulation' },
          { id: 'mineral-wool', label: 'Mineral Wool' },
          { id: 'flexible-spray', label: 'Flexible & Spray' },
        ],
      },
      { id: 'balustrades-railings', label: 'Balustrades & Railings' },
    ],
  },
  {
    id: 'interiors',
    label: 'Interiors',
    children: [
      {
        id: 'floor-finishes',
        label: 'Floor Finishes',
        children: [
          { id: 'carpet-soft-flooring', label: 'Carpet & Soft Flooring' },
          { id: 'luxury-vinyl-lvt', label: 'Luxury Vinyl & LVT' },
          { id: 'ceramic-porcelain', label: 'Ceramic & Porcelain' },
          { id: 'natural-stone-floor', label: 'Natural Stone' },
          { id: 'hardwood-engineered-timber', label: 'Hardwood & Engineered Timber' },
          { id: 'resin-polished-concrete', label: 'Resin & Polished Concrete' },
          { id: 'laminate-composite-floor', label: 'Laminate & Composite' },
        ],
      },
      {
        id: 'wall-finishes',
        label: 'Wall Finishes',
        children: [
          { id: 'paint-emulsion', label: 'Paint & Emulsion' },
          { id: 'plaster-render', label: 'Plaster & Render' },
          { id: 'wall-tiles-stone', label: 'Wall Tiles & Stone' },
          { id: 'timber-panels-cladding', label: 'Timber Panels & Cladding' },
          { id: 'wallcoverings-wallpaper', label: 'Wallcoverings & Wallpaper' },
          { id: 'microcement-polished', label: 'Microcement & Polished Finishes' },
          { id: 'acoustic-wall-panels', label: 'Acoustic Wall Panels' },
        ],
      },
      {
        id: 'ceilings',
        label: 'Ceilings',
        children: [
          { id: 'suspended-tile-systems', label: 'Suspended Tile Systems' },
          { id: 'acoustic-ceilings', label: 'Acoustic Ceilings' },
          { id: 'feature-decorative-ceilings', label: 'Feature & Decorative' },
        ],
      },
      {
        id: 'wet-areas',
        label: 'Wet Areas',
        children: [
          { id: 'bathroom-tiles', label: 'Bathroom Tiles' },
          { id: 'sanitaryware', label: 'Sanitaryware' },
          { id: 'brassware-taps', label: 'Brassware & Taps' },
        ],
      },
      {
        id: 'internal-doors-joinery',
        label: 'Internal Doors & Joinery',
        children: [
          { id: 'internal-doors', label: 'Internal Doors' },
          { id: 'ironmongery-hardware', label: 'Ironmongery & Hardware' },
        ],
      },
      { id: 'fixtures-fittings', label: 'Fixtures & Fittings' },
    ],
  },
  {
    id: 'landscape',
    label: 'Landscape',
    children: [
      {
        id: 'hard-landscaping',
        label: 'Hard Landscaping',
        children: [
          { id: 'paving-patios', label: 'Paving & Patios' },
          { id: 'decking', label: 'Decking' },
          { id: 'kerbs-edging', label: 'Kerbs & Edging' },
        ],
      },
      {
        id: 'soft-landscaping',
        label: 'Soft Landscaping',
        children: [
          { id: 'grass-turf', label: 'Grass & Turf' },
          { id: 'planting-features', label: 'Planting Features' },
        ],
      },
    ],
  },
  {
    id: 'brands',
    label: 'Brands',
    children: [
      { id: 'all-brands', label: 'All Brands' },
      { id: 'partner-brands', label: 'Partner Brands' },
      { id: 'verified-brands', label: 'Verified Brands' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    children: [
      { id: 'describe-material', label: 'Custom Material' },
      { id: 'analyse-photo', label: 'Analyse Photo' },
    ],
  },
];

// Build a flat lookup: id → label for all levels
const buildIdToLabelMap = (): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const parent of CATEGORIES) {
    map[parent.id] = parent.label;
    for (const child of parent.children ?? []) {
      map[child.id] = child.label;
      for (const grandchild of child.children ?? []) {
        map[grandchild.id] = grandchild.label;
      }
    }
  }
  return map;
};

export const CATEGORY_ID_TO_LABEL = buildIdToLabelMap();

// Returns path string: "Parent>Child" or "Parent>Child>Grandchild"
export const getCategoryPath = (
  parentId: string,
  childId: string,
  grandchildId?: string
): string => {
  const parent = CATEGORIES.find((c) => c.id === parentId);
  const child = parent?.children?.find((c) => c.id === childId);
  if (grandchildId) {
    const grandchild = child?.children?.find((c) => c.id === grandchildId);
    return `${parent?.label}>${child?.label}>${grandchild?.label}`;
  }
  return `${parent?.label}>${child?.label}`;
};

// All valid category paths as a flat list (both 2-level and 3-level)
export const getAllCategoryPaths = (): string[] => {
  const paths: string[] = [];
  for (const parent of CATEGORIES) {
    for (const child of parent.children ?? []) {
      const childPath = `${parent.label}>${child.label}`;
      paths.push(childPath);
      for (const grandchild of child.children ?? []) {
        paths.push(`${childPath}>${grandchild.label}`);
      }
    }
  }
  return paths;
};

// Resolve a treePath string back to { parentId, childId, grandchildId }
export const resolveTreePath = (
  path: string
): { parentId: string; childId: string; grandchildId?: string } | null => {
  const parts = path.split('>');
  const [parentLabel, childLabel, grandchildLabel] = parts;

  const parent = CATEGORIES.find((c) => c.label === parentLabel);
  if (!parent) return null;

  const child = parent.children?.find((c) => c.label === childLabel);
  if (!child) return null;

  if (grandchildLabel) {
    const grandchild = child.children?.find((c) => c.label === grandchildLabel);
    return { parentId: parent.id, childId: child.id, grandchildId: grandchild?.id };
  }

  return { parentId: parent.id, childId: child.id };
};
