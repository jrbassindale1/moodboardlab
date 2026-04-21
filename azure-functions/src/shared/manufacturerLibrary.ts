export type ManufacturerLink = {
  name: string;
  url: string;
};

type ManufacturerLibrary = Record<string, ManufacturerLink[]>;

const CURATED_MANUFACTURER_LIBRARY: ManufacturerLibrary = {
  "structural steel systems": [
    { name: "ArcelorMittal", url: "https://constructalia.arcelormittal.com" },
    { name: "Tata Steel", url: "https://www.tatasteeleurope.com/construction" },
  ],
  "concrete frame systems": [
    { name: "Heidelberg Materials", url: "https://www.heidelbergmaterials.com" },
    { name: "Holcim", url: "https://www.holcim.com" },
  ],
  "mass timber systems": [
    { name: "Stora Enso", url: "https://www.storaenso.com/en/products/wood-products/building-solutions" },
    { name: "KLH", url: "https://www.klh.at/en" },
  ],
  "curtain walling": [
    { name: "Schuco", url: "https://www.schueco.com" },
    { name: "Reynaers Aluminium", url: "https://www.reynaers.com" },
  ],
  "aluminium facade systems": [
    { name: "Alucobond", url: "https://www.alucobond.com" },
    { name: "ALPOLIC", url: "https://www.alpolic.com" },
  ],
  "terracotta rainscreen": [
    { name: "Wienerberger", url: "https://www.wienerberger.com" },
    { name: "Argeton", url: "https://www.argeton.com" },
  ],
  "fibre cement facade": [
    { name: "EQUITONE", url: "https://www.equitone.com" },
    { name: "Swisspearl", url: "https://www.swisspearl.com" },
  ],
  "roofing systems": [
    { name: "Kingspan", url: "https://www.kingspan.com" },
    { name: "Sika", url: "https://www.sika.com" },
  ],
  "green roof systems": [
    { name: "ZinCo", url: "https://www.zinco-greenroof.com" },
    { name: "Sempergreen", url: "https://www.sempergreen.com" },
  ],
  "living wall systems": [
    { name: "Sempergreen", url: "https://www.sempergreen.com" },
    { name: "ANS Global", url: "https://www.ansglobal.com" },
  ],
  "rainscreen support systems": [
    { name: "Leviat", url: "https://www.leviat.com" },
    { name: "SFS", url: "https://www.sfs.com" },
  ],
  "glazing units": [
    { name: "Saint-Gobain Glass", url: "https://www.saint-gobain-glass.com" },
    { name: "Guardian Glass", url: "https://www.guardianglass.com" },
  ],
};

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  "primary structure": "structural steel systems",
  "structural steel": "structural steel systems",
  "steel frame": "structural steel systems",
  "concrete structure": "concrete frame systems",
  "concrete frame": "concrete frame systems",
  "mass timber": "mass timber systems",
  "timber frame": "mass timber systems",
  glazing: "glazing units",
  "curtain wall": "curtain walling",
  "curtain walling": "curtain walling",
  "facade aluminium": "aluminium facade systems",
  "aluminium facade": "aluminium facade systems",
  "aluminium cladding": "aluminium facade systems",
  terracotta: "terracotta rainscreen",
  "terracotta facade": "terracotta rainscreen",
  "fibre cement": "fibre cement facade",
  "fibre cement panel": "fibre cement facade",
  roofing: "roofing systems",
  roof: "roofing systems",
  "green roof": "green roof systems",
  "living wall": "living wall systems",
  "green wall": "living wall systems",
  rainscreen: "rainscreen support systems",
  "support rail": "rainscreen support systems",
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const resolveManufacturerCategory = (input: string): string => {
  const normalized = normalizeText(input);
  if (!normalized) return "";

  if (CURATED_MANUFACTURER_LIBRARY[normalized]) {
    return normalized;
  }

  if (CATEGORY_ALIAS_MAP[normalized]) {
    return CATEGORY_ALIAS_MAP[normalized];
  }

  for (const [alias, target] of Object.entries(CATEGORY_ALIAS_MAP)) {
    if (normalized.includes(alias)) {
      return target;
    }
  }

  for (const key of Object.keys(CURATED_MANUFACTURER_LIBRARY)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return key;
    }
  }

  return "";
};

export function getManufacturerPathwaysForCategory(category: string): ManufacturerLink[] {
  const key = resolveManufacturerCategory(category);
  const pathways = key ? CURATED_MANUFACTURER_LIBRARY[key] || [] : [];

  return pathways
    .map((entry) => ({
      name: String(entry.name || "").trim(),
      url: normalizeUrl(String(entry.url || "")),
    }))
    .filter((entry) => entry.name && entry.url)
    .slice(0, 4);
}

export function getCuratedManufacturerCategories(): string[] {
  return Object.keys(CURATED_MANUFACTURER_LIBRARY);
}
