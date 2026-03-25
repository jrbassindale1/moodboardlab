import type { MaterialOption } from '../types';

export type MaterialCarbonIntensity = NonNullable<MaterialOption['carbonIntensity']>;

export const CARBON_IMPACT_LABELS: Record<MaterialCarbonIntensity, string> = {
  low: 'Low carbon impact',
  medium: 'Medium carbon impact',
  high: 'High carbon impact',
};

export const CARBON_IMPACT_CLASSES: Record<MaterialCarbonIntensity, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
};
