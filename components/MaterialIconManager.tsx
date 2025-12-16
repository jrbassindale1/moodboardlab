/**
 * Material Icon Manager Component
 *
 * Displays icon generation progress and provides controls
 * for managing material icons
 */

import React from 'react';
import { useMaterialIcons } from '../hooks/useMaterialIcons';
import { MaterialOption } from '../types';

interface MaterialIconManagerProps {
  materials: MaterialOption[];
  autoGenerate?: boolean;
  compact?: boolean;
}

export function MaterialIconManager({
  materials,
  autoGenerate = true,
  compact = false
}: MaterialIconManagerProps) {
  const {
    icons,
    isGenerating,
    progress,
    error,
    regenerateIcons,
    generateMissingIcons
  } = useMaterialIcons(materials, autoGenerate);

  const missingCount = materials.length - icons.size;
  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  if (compact && !isGenerating && missingCount === 0) {
    return null; // Hide when complete in compact mode
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: compact ? '20px' : '80px',
      right: '20px',
      background: 'rgba(255, 255, 255, 0.95)',
      padding: compact ? '12px 16px' : '16px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: compact ? '200px' : '300px',
      zIndex: 1000,
      border: '1px solid #e0e0e0'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: compact ? '4px' : '8px'
      }}>
        <h4 style={{ margin: 0, fontSize: compact ? '13px' : '14px', fontWeight: 600 }}>
          Material Icons
        </h4>
        {!compact && (
          <span style={{ fontSize: '12px', color: '#666' }}>
            {icons.size}/{materials.length}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          color: '#d32f2f',
          fontSize: '12px',
          marginBottom: '8px',
          padding: '8px',
          background: '#ffebee',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {isGenerating ? (
        <div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            marginBottom: '6px'
          }}>
            Generating: {progress.materialName}
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            background: '#e0e0e0',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4CAF50, #45a049)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{
            fontSize: '11px',
            color: '#999',
            marginTop: '4px'
          }}>
            {progress.current} / {progress.total} ({percentage}%)
          </div>
        </div>
      ) : (
        <div>
          {missingCount > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: '#ff9800', marginBottom: '6px' }}>
                {missingCount} icons missing
              </div>
              <button
                onClick={generateMissingIcons}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                Generate Missing Icons
              </button>
            </div>
          )}

          {!compact && (
            <button
              onClick={() => regenerateIcons()}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '6px 12px',
                background: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: missingCount > 0 ? '4px' : '0'
              }}
            >
              Regenerate All Icons
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get material icon by ID
 */
export function useMaterialIcon(materialId: string, materials: MaterialOption[]): string | null {
  const { getIcon } = useMaterialIcons(materials, false);
  return getIcon(materialId);
}
