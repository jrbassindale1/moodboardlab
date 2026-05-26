export interface FeaturedBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  tagline: string | null;
  tier: 'partner' | 'verified' | 'standard';
  materialCount: number;
  sampleTones: string[];
}

export const FEATURED_BRANDS: FeaturedBrand[] = [
  {
    id: 'lithos',
    name: 'Lithos',
    slug: 'lithos',
    logoUrl: null,
    website: null,
    tagline: 'High-performance concrete and stone systems for demanding environments',
    tier: 'partner',
    materialCount: 12,
    sampleTones: ['#B0A898', '#8C8178', '#D4CFC4', '#6E6560'],
  },
  {
    id: 'matelux',
    name: 'Matelux',
    slug: 'matelux',
    logoUrl: null,
    website: null,
    tagline: 'Porcelain tile systems for hospitality and healthcare',
    tier: 'verified',
    materialCount: 18,
    sampleTones: ['#E8E4DC', '#D4CFC4', '#BFB9AD', '#A8A296'],
  },
  {
    id: 'silvanus',
    name: 'Silvanus',
    slug: 'silvanus',
    logoUrl: null,
    website: null,
    tagline: 'Responsibly sourced hardwood cladding and decking',
    tier: 'verified',
    materialCount: 9,
    sampleTones: ['#8B6914', '#A07820', '#7A5A12', '#C4A44A'],
  },
];
