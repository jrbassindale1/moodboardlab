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

// Mapping from old category paths to new category + tags
export const OLD_TO_NEW_CATEGORY_MAPPING: Record<
  string,
  { newPath: string; tags: MaterialTag[] }
> = {
  'Internal>Paint – Standard': {
    newPath: 'Interiors>Walls',
    tags: ['paint'],
  },
  'Internal>Paint – Custom Colour': {
    newPath: 'Interiors>Walls',
    tags: ['paint', 'custom-colour'],
  },
  'Internal>Plaster / Microcement': {
    newPath: 'Interiors>Walls',
    tags: ['plaster', 'microcement'],
  },
  'Internal>Timber Panels': {
    newPath: 'Interiors>Walls',
    tags: ['timber-panels'],
  },
  'Internal>Tiles': {
    newPath: 'Interiors>Floors',
    tags: ['tiles'],
  },
  'Internal>Wallpaper': {
    newPath: 'Interiors>Walls',
    tags: ['wallpaper'],
  },
  'Internal>Acoustic Panels': {
    newPath: 'Interiors>Walls',
    tags: ['acoustic'],
  },
  'Internal>Timber Slats': {
    newPath: 'Interiors>Walls',
    tags: ['timber-slats'],
  },
  'External>External Ground / Landscaping': {
    newPath: 'Landscape>External Ground',
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
    newPath: 'Interiors>Walls',
    tags: [],
  },
};
