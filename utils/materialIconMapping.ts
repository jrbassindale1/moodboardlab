const ICON_FALLBACKS: Record<string, string> = {
  'insulated-render-system': 'render-facade',
  'aluminium-cladding': 'zinc-cladding',
  'stainless-cladding': 'zinc-cladding',
  'lead-cladding': 'zinc-cladding',
  'aluminium-standing-seam-roof': 'standing-seam-roof',
  'copper-standing-seam-roof': 'standing-seam-roof',
  'stainless-standing-seam-roof': 'standing-seam-roof',
  'lead-standing-seam-roof': 'standing-seam-roof'
};

export function getMaterialIconId(materialId: string): string {
  if (!materialId) return materialId;
  return ICON_FALLBACKS[materialId] || materialId;
}
