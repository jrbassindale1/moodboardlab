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
    title: 'Materials Workspace | Moodboard Lab',
    description:
      'Browse material options, compare specifications, and build a project palette for architecture and interior design workflows.',
  },
  moodboard: {
    path: '/moodboard',
    title: 'AI Moodboard Generator | Moodboard Lab',
    description:
      'Generate photoreal moodboards from your selected materials and create presentation-ready visuals for design reviews and client conversations.',
  },
  apply: {
    path: '/apply',
    title: 'Apply Materials to Images | Moodboard Lab',
    description:
      'Upload a sketch or reference image and apply your selected materials to test palettes in context before committing to design decisions.',
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
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Moodboard Lab',
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.png`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Moodboard Lab',
        url: SITE_URL,
        description: seo.description,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Moodboard Lab',
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Any',
        url,
        image: DEFAULT_OG_IMAGE,
        description: seo.description,
      },
    ];
  }

  if (page === 'moodboard' || page === 'apply') {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: seo.title,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Any',
      url,
      image: DEFAULT_OG_IMAGE,
      description: seo.description,
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
