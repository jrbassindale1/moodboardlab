import type { MaterialOption } from '../../types';
import type { MaterialMetrics } from '../../types/sustainability';
import { isLandscapeMaterial } from '../lifecycleDurations';

export function calculateProjectMetrics(
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
) {
  let totalEmbodied = 0;
  let bioBasedCount = 0;
  let circularCount = 0;
  let landscapeCount = 0;

  materials.forEach((material) => {
    const metric = metrics.get(material.id);
    if (!metric) return;

    totalEmbodied += metric.embodied_proxy;

    const lowerName = material.name.toLowerCase();
    const isBio =
      lowerName.includes('timber') ||
      lowerName.includes('wood') ||
      lowerName.includes('lino') ||
      lowerName.includes('cork') ||
      lowerName.includes('hemp') ||
      lowerName.includes('wool') ||
      lowerName.includes('clt') ||
      lowerName.includes('glulam');

    if (isBio) bioBasedCount += 1;

    if (metric.end_of_life_proxy <= 2.5) circularCount += 1;

    if (isLandscapeMaterial(material)) landscapeCount += 1;
  });

  const bioRatio = materials.length > 0 ? bioBasedCount / materials.length : 0;
  const circularRatio = materials.length > 0 ? circularCount / materials.length : 0;

  let paletteType = 'Mixed Material Palette';
  if (bioRatio > 0.4) paletteType = 'Bio-based / Hybrid Palette';
  if (landscapeCount > 2) paletteType = 'Landscape-Integrated Palette';

  return {
    bioRatio,
    circularRatio,
    paletteType,
  };
}
