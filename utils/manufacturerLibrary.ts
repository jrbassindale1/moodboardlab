import type { SupplierLink } from "../types/materialTranslation";

type ManufacturerLibrary = Record<string, SupplierLink[]>;

// Placeholder for a curated, category-based manufacturer pathway layer.
// First release relies primarily on model output; this table can be expanded
// with vetted pathways and internal confidence weighting later.
const CATEGORY_MANUFACTURER_LIBRARY: ManufacturerLibrary = {};

export const getManufacturerPathwaysForCategory = (category: string): SupplierLink[] => {
  const key = category.trim();
  return CATEGORY_MANUFACTURER_LIBRARY[key] || [];
};
