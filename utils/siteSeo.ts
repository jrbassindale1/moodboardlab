const SITE_URL = 'https://moodboard-lab.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph.png`;

type PageSeo = {
  path: string;
  title: string;
  description: string;
  indexable?: boolean;
};

const PAGE_SEO: Record<string, PageSeo> = {
  concept: {
    path: '/',
    title: 'Moodboard Lab | AI Material Palette Tool for Architects and Designers',
    description:
      'Curate material palettes, compare sustainability trade-offs, and generate photoreal moodboards for architecture and interior design projects.',
  },
  product: {
    path: '/product',
    title: 'Product Overview | Moodboard Lab',
    description:
      'See how Moodboard Lab combines material curation, sustainability guidance, and photoreal rendering in one workflow for design teams.',
  },
  materials: {
    path: '/materials',
    title: 'Materials | Moodboard Lab',
    description:
      'Browse material options, compare specifications, and build a project palette for architecture and interior design workflows.',
  },
  moodboard: {
    path: '/moodboard',
    title: 'Workspace | Moodboard Lab',
    description:
      'Review selected materials, generate photoreal moodboards, and create presentation-ready visuals for design reviews and client conversations.',
  },
  apply: {
    path: '/apply',
    title: 'Render | Moodboard Lab',
    description:
      'Upload a sketch or reference image and render your selected materials in context before committing to design decisions.',
  },
  dashboard: {
    path: '/dashboard',
    title: 'Dashboard | Moodboard Lab',
    description: 'Manage recent generations, saved work, and project outputs inside Moodboard Lab.',
    indexable: false,
  },
  privacy: {
    path: '/privacy',
    title: 'Privacy Policy | Moodboard Lab',
    description: 'Read the Moodboard Lab privacy policy covering data handling, cookies, and account information.',
  },
  terms: {
    path: '/terms',
    title: 'Terms of Service | Moodboard Lab',
    description: 'Review the terms of service for using Moodboard Lab and its AI-assisted material workflow features.',
  },
  contact: {
    path: '/contact',
    title: 'Contact | Moodboard Lab',
    description: 'Contact Moodboard Lab for support, partnership conversations, and product questions.',
  },
  pricing: {
    path: '/pricing',
    title: 'Pricing & Credits | Moodboard Lab',
    description: 'Simple, transparent pricing for Moodboard Lab. Start with 10 free credits monthly, purchase more when you need them.',
  },
  'material-admin': {
    path: '/material-admin',
    title: 'Material Admin | Moodboard Lab',
    description: 'Administrative tools for managing materials in Moodboard Lab.',
    indexable: false,
  },
};

const PAGE_TYPES: Record<string, string> = {
  concept: 'WebSite',
  product: 'AboutPage',
  materials: 'CollectionPage',
  moodboard: 'SoftwareApplication',
  apply: 'SoftwareApplication',
  dashboard: 'WebPage',
  privacy: 'WebPage',
  terms: 'WebPage',
  contact: 'ContactPage',
  pricing: 'WebPage',
  'material-admin': 'WebPage',
};

const normalizePath = (pathname: string): string => {
  if (!pathname) return '/';
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export const getPathForPage = (page: string): string => PAGE_SEO[page]?.path ?? PAGE_SEO.concept.path;

export const getPageFromPath = (pathname: string): string => {
  const normalizedPath = normalizePath(pathname);
  const match = Object.entries(PAGE_SEO).find(([, config]) => config.path === normalizedPath);
  return match?.[0] ?? 'concept';
};

const ensureMetaTag = (name: 'name' | 'property', value: string) => {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${name}="${value}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(name, value);
    document.head.appendChild(tag);
  }
  return tag;
};

const ensureLinkTag = (rel: string) => {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  return tag;
};

const ensureJsonLdTag = () => {
  const selector = 'script[data-site-seo="true"]';
  let tag = document.head.querySelector<HTMLScriptElement>(selector);
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.dataset.siteSeo = 'true';
    document.head.appendChild(tag);
  }
  return tag;
};

const ORGANIZATION_SCHEMA = {
  '@type': 'Organization',
  name: 'Moodboard Lab',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
};

const SOFTWARE_FEATURES = [
  'AI-powered moodboard generation',
  'Material palette curation',
  'Sustainability trade-off analysis',
  'Photoreal rendering',
  'Material application to reference images',
  'EPD and carbon data integration',
];

// Build SoftwareApplication schema - optionally without @context for use in @graph
const buildSoftwareApplicationSchema = (url: string, description: string, includeOffers = true, includeContext = true) => {
  const schema: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    name: 'Moodboard Lab',
    applicationCategory: 'DesignApplication',
    applicationSubCategory: 'Architecture & Interior Design Tools',
    operatingSystem: 'Any (Web-based)',
    url,
    image: DEFAULT_OG_IMAGE,
    description,
    featureList: SOFTWARE_FEATURES,
    publisher: ORGANIZATION_SCHEMA,
    author: ORGANIZATION_SCHEMA,
  };

  if (includeContext) {
    schema['@context'] = 'https://schema.org';
  }

  if (includeOffers) {
    schema.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'GBP',
      description: '10 free credits monthly included',
      availability: 'https://schema.org/InStock',
    };
  }

  return schema;
};

const buildStructuredData = (page: string, seo: PageSeo) => {
  const url = `${SITE_URL}${seo.path}`;
  const sharedWebPage = {
    '@context': 'https://schema.org',
    '@type': PAGE_TYPES[page] ?? 'WebPage',
    name: seo.title,
    description: seo.description,
    url,
  };

  if (page === 'concept') {
    // Use @graph structure instead of array to avoid Safari JSON-LD parsing bug
    // See: https://bugs.webkit.org/show_bug.cgi?id=255764
    return {
      '@context': 'https://schema.org',
      '@graph': [
        ORGANIZATION_SCHEMA,
        {
          '@type': 'WebSite',
          name: 'Moodboard Lab',
          url: SITE_URL,
          description: seo.description,
        },
        buildSoftwareApplicationSchema(url, seo.description, true, false), // no @context in @graph
      ],
    };
  }

  if (page === 'moodboard' || page === 'apply') {
    return buildSoftwareApplicationSchema(url, seo.description);
  }

  if (page === 'pricing') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url,
      mainEntity: {
        '@type': 'Product',
        name: 'Moodboard Lab Credits',
        description: 'Credits for AI moodboard generation and material application',
        brand: ORGANIZATION_SCHEMA,
        offers: [
          {
            '@type': 'Offer',
            name: 'Free Tier',
            price: '0',
            priceCurrency: 'GBP',
            description: '10 free credits monthly',
            availability: 'https://schema.org/InStock',
          },
          {
            '@type': 'Offer',
            name: 'Credit Pack',
            price: '5',
            priceCurrency: 'GBP',
            description: '50 credits',
            availability: 'https://schema.org/InStock',
          },
        ],
      },
    };
  }

  return sharedWebPage;
};

export const applyPageSeo = (page: string) => {
  if (typeof document === 'undefined') return;

  const seo = PAGE_SEO[page] ?? PAGE_SEO.concept;
  const absoluteUrl = `${SITE_URL}${seo.path}`;

  document.title = seo.title;

  ensureMetaTag('name', 'description').content = seo.description;
  ensureMetaTag('name', 'robots').content = seo.indexable === false ? 'noindex, nofollow' : 'index, follow';
  ensureMetaTag('property', 'og:title').content = seo.title;
  ensureMetaTag('property', 'og:description').content = seo.description;
  ensureMetaTag('property', 'og:type').content = 'website';
  ensureMetaTag('property', 'og:url').content = absoluteUrl;
  ensureMetaTag('property', 'og:image').content = DEFAULT_OG_IMAGE;
  ensureMetaTag('property', 'og:site_name').content = 'Moodboard Lab';
  ensureMetaTag('name', 'twitter:card').content = 'summary_large_image';
  ensureMetaTag('name', 'twitter:title').content = seo.title;
  ensureMetaTag('name', 'twitter:description').content = seo.description;
  ensureMetaTag('name', 'twitter:image').content = DEFAULT_OG_IMAGE;

  ensureLinkTag('canonical').href = absoluteUrl;
  ensureLinkTag('manifest').href = '/manifest.webmanifest';

  ensureJsonLdTag().text = JSON.stringify(buildStructuredData(page, seo));
};

export const SITE_URL_ORIGIN = SITE_URL;
export const INDEXABLE_PAGE_KEYS = Object.entries(PAGE_SEO)
  .filter(([, seo]) => seo.indexable !== false)
  .map(([page]) => page);
