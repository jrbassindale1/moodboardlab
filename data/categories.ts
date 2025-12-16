export type CategoryChild = {
  id: string;
  label: string;
};

export type Category = {
  id: string;
  label: string;
  children?: CategoryChild[];
};

export const CATEGORIES: Category[] = [
  {
    id: 'structure',
    label: 'Structure',
    children: [
      { id: 'primary-structure', label: 'Primary Structure' },
      { id: 'secondary-structure', label: 'Secondary Structure' },
      { id: 'exposed-structure', label: 'Exposed Structure' },
    ],
  },
  {
    id: 'envelope',
    label: 'Envelope',
    children: [
      { id: 'facade', label: 'Façade' },
      { id: 'glazing', label: 'Glazing' },
      { id: 'roofing', label: 'Roofing' },
      { id: 'insulation', label: 'Insulation' },
    ],
  },
  {
    id: 'interiors',
    label: 'Interiors',
    children: [
      { id: 'floors', label: 'Floors' },
      { id: 'walls', label: 'Walls' },
      { id: 'ceilings', label: 'Ceilings' },
      { id: 'joinery', label: 'Joinery' },
      { id: 'doors', label: 'Doors' },
      { id: 'fixtures-fittings', label: 'Fixtures & Fittings' },
    ],
  },
  {
    id: 'landscape',
    label: 'Landscape',
    children: [
      { id: 'external-ground', label: 'External Ground' },
      { id: 'landscaping', label: 'Landscaping' },
      { id: 'hardscape-paving', label: 'Hardscape / Paving' },
    ],
  },
  {
    id: 'elements',
    label: 'Elements',
    children: [
      { id: 'balustrades-railings', label: 'Balustrades & Railings' },
      { id: 'furniture', label: 'Furniture' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    children: [
      { id: 'upload-image', label: 'Upload Image' },
      { id: 'describe-material', label: 'Describe Material' },
    ],
  },
];

// Helper function to get full category path
export const getCategoryPath = (parentId: string, childId: string): string => {
  const parent = CATEGORIES.find((c) => c.id === parentId);
  const child = parent?.children?.find((c) => c.id === childId);
  return `${parent?.label}>${child?.label}`;
};

// Helper to get all category paths as flat list
export const getAllCategoryPaths = (): string[] => {
  return CATEGORIES.flatMap((parent) =>
    parent.children?.map((child) => getCategoryPath(parent.id, child.id)) || []
  );
};
