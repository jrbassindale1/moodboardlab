import { MaterialOption } from '../types';
import { getMaterialIconId } from './materialIconMapping';

export function getMaterialIconUrls(material: MaterialOption): { webpUrl: string; pngUrl: string } {
  const iconId = getMaterialIconId(material.id);
  return {
    webpUrl: material.iconWebpUrl || `/icons/${iconId}.webp`,
    pngUrl: material.iconPngUrl || `/icons/${iconId}.png`,
  };
}

