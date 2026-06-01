// Tags for material attributes (retired categories that became tags)
export const MATERIAL_TAGS = [
  'paint',
  'custom-colour',
  'plaster',
  'microcement',
  'timber-panels',
  'tiles',
  'wallpaper',
  'acoustic',
  'timber-slats',
] as const;

export type MaterialTag = (typeof MATERIAL_TAGS)[number];

// Mapping from old category paths to new 3-level paths + tags.
// newPath uses the deepest applicable grandchild where it can be inferred;
// otherwise stops at the 2-level parent to avoid misclassification.
export const OLD_TO_NEW_CATEGORY_MAPPING: Record<
  string,
  { newPath: string; tags: MaterialTag[] }
> = {
  'Internal>Paint – Standard': {
    newPath: 'Interiors>Wall Finishes>Paint & Emulsion',
    tags: ['paint'],
  },
  'Internal>Paint – Custom Colour': {
    newPath: 'Interiors>Wall Finishes>Paint & Emulsion',
    tags: ['paint', 'custom-colour'],
  },
  'Internal>Plaster / Microcement': {
    newPath: 'Interiors>Wall Finishes>Plaster & Render',
    tags: ['plaster', 'microcement'],
  },
  'Internal>Timber Panels': {
    newPath: 'Interiors>Wall Finishes>Timber Panels & Cladding',
    tags: ['timber-panels'],
  },
  'Internal>Tiles': {
    newPath: 'Interiors>Floor Finishes>Ceramic & Porcelain',
    tags: ['tiles'],
  },
  'Internal>Wallpaper': {
    newPath: 'Interiors>Wall Finishes>Wallcoverings & Wallpaper',
    tags: ['wallpaper'],
  },
  'Internal>Acoustic Panels': {
    newPath: 'Interiors>Wall Finishes>Acoustic Wall Panels',
    tags: ['acoustic'],
  },
  'Internal>Timber Slats': {
    newPath: 'Interiors>Wall Finishes>Timber Panels & Cladding',
    tags: ['timber-slats'],
  },
  'External>External Ground / Landscaping': {
    newPath: 'Landscape>Hard Landscaping',
    tags: [],
  },
  'Internal>Balustrade & Railings': {
    newPath: 'Envelope>Balustrades & Railings',
    tags: [],
  },
  'Elements>Balustrades & Railings': {
    newPath: 'Envelope>Balustrades & Railings',
    tags: [],
  },
  'Elements>Furniture': {
    newPath: 'Interiors>Fixtures & Fittings',
    tags: [],
  },
  'Internal>Joinery & Furniture': {
    newPath: 'Interiors>Internal Doors & Joinery',
    tags: [],
  },
};
