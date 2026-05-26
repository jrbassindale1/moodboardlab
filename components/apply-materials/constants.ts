import type { SceneControls } from './types';

export const WEATHER_OPTIONS = ['clear / sunny', 'soft overcast', 'heavy overcast', 'misty / moody', 'wet after rain'] as const;
export const ACTIVITY_OPTIONS = ['empty', 'sparse', 'moderate', 'busy'] as const;
export const TIME_OPTIONS = ['morning', 'midday', 'afternoon / evening', 'dusk', 'night'] as const;
export const SEASON_OPTIONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const VIEW_OPTIONS = ['clean architectural', 'lightly lived-in', 'lived-in scene', 'editorial photo', 'candid street view'] as const;

export const DEFAULT_SCENE_CONTROLS: SceneControls = {
  weather: { enabled: false, value: 0 },
  activity: { enabled: false, value: 0 },
  timeOfDay: { enabled: false, value: 0 },
  season: { enabled: false, value: 0 },
  viewCharacter: { enabled: false, value: 0 }
};
