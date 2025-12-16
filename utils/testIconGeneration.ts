/**
 * Test Icon Generation
 *
 * Simple test script to verify the icon generation system works
 * Run this in browser console or as a test component
 */

import { generateMaterialIcon } from './materialIconGenerator';
import { MATERIAL_PALETTE } from '../constants';

/**
 * Test generating a single icon
 */
export async function testSingleIcon() {
  console.log('🧪 Testing single icon generation...');

  const testMaterial = MATERIAL_PALETTE[0]; // Get first material

  try {
    const icon = await generateMaterialIcon({
      id: testMaterial.id,
      name: testMaterial.name,
      description: testMaterial.description,
      tone: testMaterial.tone,
      finish: testMaterial.finish,
      keywords: testMaterial.keywords
    });

    console.log('✅ Icon generated successfully!');
    console.log('Material:', testMaterial.name);
    console.log('Icon data length:', icon.dataUri.length);
    console.log('Generated at:', new Date(icon.generatedAt).toISOString());

    // Create a test image to verify it's valid
    const img = new Image();
    img.onload = () => {
      console.log('✅ Image is valid and can be displayed');
      console.log('Dimensions:', img.width, 'x', img.height);
    };
    img.onerror = () => {
      console.error('❌ Image data is invalid');
    };
    img.src = icon.dataUri;

    return icon;
  } catch (error) {
    console.error('❌ Icon generation failed:', error);
    throw error;
  }
}

/**
 * Test generating icons for first 5 materials
 */
export async function testBatchIcons() {
  console.log('🧪 Testing batch icon generation (5 materials)...');

  const testMaterials = MATERIAL_PALETTE.slice(0, 5);

  for (const material of testMaterials) {
    try {
      console.log(`Generating icon for: ${material.name}...`);

      const icon = await generateMaterialIcon({
        id: material.id,
        name: material.name,
        description: material.description,
        tone: material.tone,
        finish: material.finish,
        keywords: material.keywords
      });

      console.log(`✅ ${material.name}: ${icon.dataUri.substring(0, 50)}...`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`❌ Failed for ${material.name}:`, error);
    }
  }

  console.log('🎉 Batch test complete!');
}

// Make these available in browser console for testing
if (typeof window !== 'undefined') {
  (window as any).testIconGeneration = {
    testSingleIcon,
    testBatchIcons
  };
  console.log('💡 Icon generation tests loaded. Run in console:');
  console.log('  testIconGeneration.testSingleIcon()');
  console.log('  testIconGeneration.testBatchIcons()');
}
