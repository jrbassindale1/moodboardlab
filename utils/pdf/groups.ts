import type { MaterialOption } from '../../types';
import type { PDFContext } from '../../types/sustainability';
import { isLandscapeMaterial } from '../lifecycleDurations';
import { ensureSpace } from './layout';

type ElementGroupId = 'structure' | 'enclosure' | 'finishes' | 'landscape';

const ELEMENT_GROUPS: { id: ElementGroupId; label: string }[] = [
  { id: 'structure', label: 'Structure' },
  { id: 'enclosure', label: 'Enclosure' },
  { id: 'finishes', label: 'Finishes' },
  { id: 'landscape', label: 'Landscape' },
];

const ELEMENT_CATEGORY_MAP: Record<ElementGroupId, Set<MaterialOption['category']>> = {
  structure: new Set(['structure', 'exposed-structure']),
  enclosure: new Set(['external', 'window', 'roof', 'insulation', 'soffit']),
  finishes: new Set([
    'floor',
    'finish',
    'wall-internal',
    'ceiling',
    'paint-wall',
    'paint-ceiling',
    'plaster',
    'microcement',
    'timber-panel',
    'tile',
    'wallpaper',
    'acoustic-panel',
    'timber-slat',
    'joinery',
    'fixture',
    'door',
    'balustrade',
    'furniture',
  ]),
  landscape: new Set(['landscape', 'external-ground']),
};

function getElementGroupId(material: MaterialOption): ElementGroupId {
  if (material.category === 'external-ground' || isLandscapeMaterial(material)) {
    return 'landscape';
  }
  const category = material.category;
  if (ELEMENT_CATEGORY_MAP.structure.has(category)) return 'structure';
  if (ELEMENT_CATEGORY_MAP.enclosure.has(category)) return 'enclosure';
  return 'finishes';
}

export function groupMaterialsByElement(
  materials: MaterialOption[]
): { group: { id: ElementGroupId; label: string }; items: MaterialOption[] }[] {
  const grouped = ELEMENT_GROUPS.map((group) => ({ group, items: [] as MaterialOption[] }));
  const indexById = new Map<ElementGroupId, number>();
  ELEMENT_GROUPS.forEach((group, idx) => indexById.set(group.id, idx));

  materials.forEach((material) => {
    const groupId = getElementGroupId(material);
    const index = indexById.get(groupId) ?? 0;
    grouped[index].items.push(material);
  });

  return grouped;
}

export function drawGroupHeader(
  ctx: PDFContext,
  label: string,
  tableStartX: number,
  tableWidth: number
): void {
  ensureSpace(ctx, 14);
  ctx.doc.setFillColor(246, 247, 249);
  ctx.doc.rect(tableStartX, ctx.cursorY - 8, tableWidth, 10, 'F');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(70);
  ctx.doc.text(label, tableStartX + 4, ctx.cursorY);
  ctx.doc.setTextColor(0);
  ctx.cursorY += 12;
}
