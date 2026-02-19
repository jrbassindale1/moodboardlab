/**
 * Material Icon Demo Component
 *
 * Optional demo component to showcase the icon generation system
 * Add this to your app temporarily to test the icons
 */

import React, { useState } from 'react';
import { MATERIAL_PALETTE } from '../constants';
import { MaterialGrid, MaterialIconDisplay } from './MaterialIconDisplay';
import { useMaterialIcons } from '../hooks/useMaterialIcons';
import { MaterialOption } from '../types';
import { formatDescriptionForDisplay, formatFinishForDisplay } from '../utils/materialDisplay';

export function MaterialIconDemo() {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialOption | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { icons, isGenerating, progress, generateMissingIcons } = useMaterialIcons(MATERIAL_PALETTE);

  const missingCount = MATERIAL_PALETTE.length - icons.size;

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
          Material Icon System Demo
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Showcasing AI-generated material icons for {MATERIAL_PALETTE.length} materials
        </p>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
            {icons.size}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
            Icons Generated
          </div>
        </div>

        <div style={{
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
            {missingCount}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
            Pending Icons
          </div>
        </div>

        <div style={{
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: isGenerating ? '#4CAF50' : '#666' }}>
            {isGenerating ? `${Math.round((progress.current / progress.total) * 100)}%` : 'Idle'}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
            Generation Status
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '16px',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              padding: '8px 16px',
              background: viewMode === 'grid' ? '#2196F3' : 'white',
              color: viewMode === 'grid' ? 'white' : '#333',
              border: '1px solid #2196F3',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Grid View
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '8px 16px',
              background: viewMode === 'list' ? '#2196F3' : 'white',
              color: viewMode === 'list' ? 'white' : '#333',
              border: '1px solid #2196F3',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            List View
          </button>
        </div>

        {missingCount > 0 && (
          <button
            onClick={generateMissingIcons}
            disabled={isGenerating}
            style={{
              padding: '8px 20px',
              background: isGenerating ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            {isGenerating
              ? `Generating... (${progress.current}/${progress.total})`
              : `Generate ${missingCount} Missing Icons`
            }
          </button>
        )}
      </div>

      {/* Material Display */}
      {viewMode === 'grid' ? (
        <MaterialGrid
          materials={MATERIAL_PALETTE}
          onSelectMaterial={setSelectedMaterial}
          selectedMaterialId={selectedMaterial?.id}
          iconSize={100}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {MATERIAL_PALETTE.map(material => (
            <div
              key={material.id}
              style={{
                padding: '12px',
                background: selectedMaterial?.id === material.id ? '#e3f2fd' : 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedMaterial(material)}
            >
              <MaterialIconDisplay
                material={material}
                size={64}
                showName={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* Selected Material Detail */}
      {selectedMaterial && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}
        onClick={() => setSelectedMaterial(null)}
        >
          <div
            style={{
              background: 'white',
              padding: '32px',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%'
            }}
            onClick={e => e.stopPropagation()}
          >
            <MaterialIconDisplay
              material={selectedMaterial}
              size={120}
              showName={false}
            />
            <h2 style={{ marginTop: '24px', fontSize: '24px', fontWeight: 'bold' }}>
              {selectedMaterial.name}
            </h2>
            <p style={{ color: '#666', marginTop: '8px' }}>
              {formatDescriptionForDisplay(selectedMaterial.description)}
            </p>
            <div style={{ marginTop: '16px', fontSize: '14px' }}>
              <strong>Finish:</strong> {formatFinishForDisplay(selectedMaterial.finish)}
            </div>
            <div style={{ marginTop: '8px', fontSize: '14px' }}>
              <strong>Category:</strong> {selectedMaterial.category}
            </div>
            {selectedMaterial.keywords && (
              <div style={{ marginTop: '8px', fontSize: '14px' }}>
                <strong>Keywords:</strong> {selectedMaterial.keywords.join(', ')}
              </div>
            )}
            <button
              onClick={() => setSelectedMaterial(null)}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '12px',
                background: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
