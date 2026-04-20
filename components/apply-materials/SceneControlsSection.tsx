import { ACTIVITY_OPTIONS, SEASON_OPTIONS, TIME_OPTIONS, VIEW_OPTIONS, WEATHER_OPTIONS } from './constants';
import type { SceneControls } from './types';

type SceneControlKey = keyof SceneControls;

interface SceneControlsSectionProps {
  contextLabel: 'setup' | 'refine';
  idPrefix: string;
  disabled: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  hideHeader?: boolean;
  sceneControls: SceneControls;
  onToggleEnabled: (key: SceneControlKey, enabled: boolean) => void;
  onChangeValue: (key: SceneControlKey, value: number) => void;
}

const CONTROL_CONFIGS: Array<{
  key: SceneControlKey;
  label: string;
  options: readonly string[];
  idSuffix: string;
}> = [
  { key: 'weather', label: 'Weather / Atmosphere', options: WEATHER_OPTIONS, idSuffix: 'weather' },
  { key: 'activity', label: 'Activity Level', options: ACTIVITY_OPTIONS, idSuffix: 'activity' },
  { key: 'timeOfDay', label: 'Time of Day', options: TIME_OPTIONS, idSuffix: 'time' },
  { key: 'season', label: 'Season', options: SEASON_OPTIONS, idSuffix: 'season' },
  { key: 'viewCharacter', label: 'View Character', options: VIEW_OPTIONS, idSuffix: 'view' },
];

const SceneControlsSection = ({
  contextLabel,
  idPrefix,
  disabled,
  isOpen,
  onToggleOpen,
  hideHeader = false,
  sceneControls,
  onToggleEnabled,
  onChangeValue,
}: SceneControlsSectionProps) => {
  const shouldShowControls = contextLabel === 'setup' ? true : isOpen;

  return (
    <div className="space-y-3 border border-gray-200 bg-white p-3">
      {!hideHeader && (
        <div className={contextLabel === 'setup' ? 'space-y-1' : 'flex items-center justify-between gap-3'}>
          <div>
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-700 font-bold">
              {contextLabel === 'setup' ? 'Setup Scene Controls' : 'Refine Scene Controls (Optional)'}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {contextLabel === 'setup'
                ? 'Use only if you want to steer mood before first render.'
                : 'Use only when refining the generated render.'}
            </p>
          </div>
          {contextLabel !== 'setup' && (
            <button
              type="button"
              onClick={onToggleOpen}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 bg-white font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
              disabled={disabled}
            >
              {isOpen ? 'Hide controls' : 'Show controls'}
            </button>
          )}
        </div>
      )}

      {shouldShowControls
        ? CONTROL_CONFIGS.map(({ key, label, options, idSuffix }) => {
            const control = sceneControls[key];
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`${idPrefix}-${idSuffix}-enable`}
                    checked={control.enabled}
                    onChange={(event) => onToggleEnabled(key, event.target.checked)}
                    disabled={disabled}
                    className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
                  />
                  <label htmlFor={`${idPrefix}-${idSuffix}-enable`} className="font-sans text-xs text-gray-700">
                    {label}
                  </label>
                </div>
                {control.enabled && (
                  <div className="ml-5 space-y-1">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                      {options[control.value]}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={options.length - 1}
                      step="1"
                      value={control.value}
                      onChange={(event) => onChangeValue(key, parseInt(event.target.value, 10))}
                      disabled={disabled}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
            );
          })
        : null}
    </div>
  );
};

export default SceneControlsSection;
