/**
 * Material Icon Display Component
 *
 * Displays a material with its generated icon
 * Use this in material selection dropdowns, cards, etc.
 */

import React from 'react';
import { MaterialOption } from '../types';

interface MaterialIconDisplayProps {
  material: MaterialOption;
  size?: number;
  showName?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MaterialIconDisplay({
  material,
  size = 48,
  showName = true,
  onClick,
  className = ''
}: MaterialIconDisplayProps) {
  // Use icon from /public/icons folder
  const iconUrl = `/icons/${material.id}.png`;
  const [iconLoaded, setIconLoaded] = React.useState(false);
  const [iconError, setIconError] = React.useState(false);

  return (
    <div
      className={`flex items-center gap-3 ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${className}`}
      onClick={onClick}
    >
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          background: material.tone || '#f5f5f5',
          flexShrink: 0,
          position: 'relative'
        }}
      >
        {!iconError && (
          <img
            src={iconUrl}
            alt={material.name}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: iconLoaded ? 'block' : 'none'
            }}
            onLoad={() => setIconLoaded(true)}
            onError={() => setIconError(true)}
          />
        )}
        {/* Fallback to color swatch while loading or on error */}
        {(!iconLoaded || iconError) && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: material.tone || '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#999'
            }}
          >
            {/* Empty - just show color */}
          </div>
        )}
      </div>

      {showName && (
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{material.name}</div>
          <div className="text-xs text-gray-500 truncate">{material.finish}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Material Grid with Icons
 * Displays multiple materials in a grid layout with icons
 */
interface MaterialGridProps {
  materials: MaterialOption[];
  onSelectMaterial?: (material: MaterialOption) => void;
  selectedMaterialId?: string;
  iconSize?: number;
}

export function MaterialGrid({
  materials,
  onSelectMaterial,
  selectedMaterialId,
  iconSize = 80
}: MaterialGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {materials.map(material => (
        <div
          key={material.id}
          className={`
            p-3 rounded-lg border-2 transition-all
            ${selectedMaterialId === material.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
            }
            ${onSelectMaterial ? 'cursor-pointer' : ''}
          `}
          onClick={() => onSelectMaterial?.(material)}
        >
          <MaterialIconDisplay
            material={material}
            size={iconSize}
            showName={true}
            className="flex-col items-center text-center"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Material Dropdown Option with Icon
 * Use in Select/Dropdown components
 */
interface MaterialDropdownOptionProps {
  material: MaterialOption;
  isSelected?: boolean;
}

export function MaterialDropdownOption({
  material,
  isSelected = false
}: MaterialDropdownOptionProps) {
  return (
    <div
      className={`
        px-3 py-2 flex items-center gap-3
        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
      `}
    >
      <MaterialIconDisplay
        material={material}
        size={32}
        showName={true}
        className="w-full"
      />
    </div>
  );
}
