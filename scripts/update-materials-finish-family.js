#!/usr/bin/env node
/**
 * Script to update materials with finishFamily and varietyOptions
 * Run with: node scripts/update-materials-finish-family.js
 */

const API_URL = 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api/materials';
const ADMIN_KEY = '11NarrowPath';

const materialUpdates = [
  // ============================================
  // STONE MATERIALS - Add variety options
  // ============================================
  {
    id: 'stone-paver',
    finishFamily: 'stone-honed',
    varietyOptions: ['Bath Stone', 'Portland Stone', 'York Stone', 'Purbeck Stone', 'Limestone', 'Sandstone', 'Granite', 'Slate'],
    finishOptions: ['Honed', 'Polished', 'Flamed', 'Bush-hammered', 'Natural Cleft'],
  },
  {
    id: 'stone-facade',
    finishFamily: 'stone-natural',
    varietyOptions: ['Bath Stone', 'Portland Stone', 'York Stone', 'Purbeck Stone', 'Limestone', 'Sandstone', 'Granite'],
    finishOptions: ['Sawn', 'Honed', 'Split-face', 'Bush-hammered', 'Natural Cleft'],
  },
  {
    id: 'stone-rainscreen',
    finishFamily: 'stone-honed',
    varietyOptions: ['Limestone', 'Sandstone', 'Granite', 'Slate', 'Travertine'],
    finishOptions: ['Honed', 'Polished', 'Flamed', 'Brushed'],
  },
  {
    id: 'marble-floor',
    finishFamily: 'stone-polished',
    varietyOptions: ['Carrara', 'Calacatta', 'Statuario', 'Nero Marquina', 'Emperador', 'Bianco Dolomiti', 'Botticino'],
    finishOptions: ['Polished', 'Honed', 'Tumbled'],
  },
  {
    id: 'marble-panels',
    finishFamily: 'stone-polished',
    varietyOptions: ['Carrara', 'Calacatta', 'Statuario', 'Nero Marquina', 'Emperador', 'Bianco Dolomiti'],
    finishOptions: ['Polished', 'Honed', 'Bookmatched'],
  },
  {
    id: 'travertine-tiles',
    finishFamily: 'stone-honed',
    varietyOptions: ['Classic Travertine', 'Noce Travertine', 'Silver Travertine', 'Gold Travertine', 'Walnut Travertine'],
    finishOptions: ['Honed', 'Polished', 'Filled', 'Unfilled', 'Tumbled'],
  },
  {
    id: 'slate-cladding',
    finishFamily: 'stone-natural',
    varietyOptions: ['Welsh Slate', 'Spanish Slate', 'Brazilian Slate', 'Indian Slate'],
    finishOptions: ['Natural Cleft', 'Honed', 'Calibrated'],
  },
  {
    id: 'slate-tiles-roof',
    finishFamily: 'stone-natural',
    varietyOptions: ['Welsh Slate', 'Spanish Slate', 'Cornish Slate', 'Burlington Slate'],
  },
  {
    id: 'gravel-paving',
    finishFamily: 'stone-natural',
    varietyOptions: ['Pea Gravel', 'Crushed Granite', 'Cotswold Gravel', 'Flint', 'River Pebbles'],
  },

  // ============================================
  // TIMBER MATERIALS - Add finish family and varieties
  // ============================================
  {
    id: 'timber-flooring',
    finishFamily: 'timber-oil',
    varietyOptions: ['Oak', 'Walnut', 'Ash', 'Maple', 'Beech', 'Pine', 'Douglas Fir'],
    finishOptions: ['Oiled', 'Lacquered', 'Waxed', 'Brushed', 'Smoked'],
  },
  {
    id: 'engineered-oak-floor',
    finishFamily: 'timber-oil',
    varietyOptions: ['European Oak', 'American White Oak', 'French Oak'],
    finishOptions: ['Oiled', 'Lacquered', 'Brushed & Oiled', 'Smoked & Oiled', 'Natural'],
  },
  {
    id: 'reclaimed-timber-floor',
    finishFamily: 'timber-natural',
    varietyOptions: ['Reclaimed Oak', 'Reclaimed Pine', 'Reclaimed Elm', 'Mixed Reclaimed'],
    finishOptions: ['Oiled', 'Waxed', 'Natural', 'Lightly Sanded'],
  },
  {
    id: 'bamboo-parquet',
    finishFamily: 'timber-lacquer',
    varietyOptions: ['Strand-woven Natural', 'Strand-woven Carbonised', 'Horizontal Natural', 'Vertical Natural'],
  },
  {
    id: 'cork-plank-floor',
    finishFamily: 'timber-oil',
    varietyOptions: ['Natural Cork', 'Coloured Cork', 'Patterned Cork'],
    finishOptions: ['Oiled', 'Lacquered', 'Waxed'],
  },
  {
    id: 'timber-rainscreen',
    finishFamily: 'timber-natural',
    varietyOptions: ['Western Red Cedar', 'Siberian Larch', 'European Larch', 'Accoya', 'Thermowood'],
    finishOptions: ['Natural', 'Oiled', 'Stained', 'Pre-greyed'],
  },
  {
    id: 'charred-timber-cladding',
    finishFamily: 'timber-natural',
    varietyOptions: ['Cedar Shou Sugi Ban', 'Larch Shou Sugi Ban', 'Accoya Charred'],
    finishOptions: ['Deep Char', 'Light Char', 'Brushed Char'],
  },
  {
    id: 'timber-slat-ceiling',
    finishFamily: 'timber-oil',
    varietyOptions: ['Oak', 'Ash', 'Walnut', 'Douglas Fir', 'Western Red Cedar'],
    finishOptions: ['Oiled', 'Lacquered', 'Natural', 'Stained'],
  },
  {
    id: 'timber-slat-soffit',
    finishFamily: 'timber-oil',
    varietyOptions: ['Oak', 'Cedar', 'Larch', 'Accoya'],
    finishOptions: ['Oiled', 'Natural', 'Stained'],
  },
  {
    id: 'oak-timber-slats',
    finishFamily: 'timber-oil',
    varietyOptions: ['European Oak', 'American White Oak', 'Fumed Oak'],
    finishOptions: ['Oiled', 'Lacquered', 'Brushed & Oiled', 'Natural'],
  },
  {
    id: 'timber-linings',
    finishFamily: 'timber-oil',
    varietyOptions: ['Oak', 'Ash', 'Walnut', 'FSC Softwood', 'Western Red Cedar'],
    finishOptions: ['Oiled', 'Lacquered', 'Natural', 'Stained'],
  },
  {
    id: 'reclaimed-boarding',
    finishFamily: 'timber-natural',
    varietyOptions: ['Reclaimed Oak', 'Reclaimed Pine', 'Reclaimed Elm', 'Scaffold Board'],
    finishOptions: ['Natural', 'Oiled', 'Wire-brushed'],
  },
  {
    id: 'plywood-panels-finish',
    finishFamily: 'timber-lacquer',
    varietyOptions: ['Birch Plywood', 'Oak-faced Plywood', 'Walnut-faced Plywood', 'Douglas Fir Plywood'],
    finishOptions: ['Oiled', 'Lacquered', 'Natural', 'Whitewashed'],
  },
  {
    id: 'plywood-panels-wall',
    finishFamily: 'timber-lacquer',
    varietyOptions: ['Birch Plywood', 'Oak-faced Plywood', 'Marine Plywood'],
    finishOptions: ['Oiled', 'Lacquered', 'Natural'],
  },
  {
    id: 'bamboo-slat-wall',
    finishFamily: 'timber-lacquer',
    varietyOptions: ['Natural Bamboo', 'Carbonised Bamboo', 'Bleached Bamboo'],
  },
  {
    id: 'timber-wall-panels',
    finishFamily: 'timber-oil',
    varietyOptions: ['Oak', 'Walnut', 'Ash', 'Acoustic Perforated'],
    finishOptions: ['Oiled', 'Lacquered', 'Natural'],
  },
  {
    id: 'decking-external',
    finishFamily: 'timber-oil',
    varietyOptions: ['Ipe', 'Cedar', 'Larch', 'Thermowood', 'Accoya', 'Composite'],
    finishOptions: ['Oiled', 'Natural', 'Pre-greyed'],
  },
  {
    id: 'timber-door',
    finishFamily: 'timber-oil',
    varietyOptions: ['Oak', 'Walnut', 'Ash', 'Painted Softwood'],
    finishOptions: ['Oiled', 'Lacquered', 'Painted', 'Stained'],
  },
  {
    id: 'coffered-ceiling',
    finishFamily: 'timber-lacquer',
    varietyOptions: ['Oak', 'Walnut', 'Painted MDF', 'Plaster'],
  },
  {
    id: 'joinery-built-in',
    finishFamily: 'timber-lacquer',
    varietyOptions: ['Birch Plywood', 'Oak Veneer', 'Walnut Veneer', 'Painted MDF', 'Lacquered MDF'],
    finishOptions: ['Oiled', 'Lacquered', 'Painted', 'Natural'],
  },

  // ============================================
  // METAL MATERIALS - Add finish family
  // ============================================
  {
    id: 'steel-frame',
    finishFamily: 'ral',
    // Already has colorOptions
  },
  {
    id: 'aluminium-cladding',
    finishFamily: 'ral',
    finishOptions: ['Powder-coated', 'Anodised', 'Mill Finish', 'PVDF Coated'],
  },
  {
    id: 'aluminium-standing-seam-roof',
    finishFamily: 'ral',
    finishOptions: ['Powder-coated', 'Mill Finish', 'PVDF Coated'],
  },
  {
    id: 'aluminum-door',
    finishFamily: 'metal-anodised',
    finishOptions: ['Anodised Silver', 'Anodised Bronze', 'Powder-coated'],
  },
  {
    id: 'aluminum-frame',
    finishFamily: 'metal-anodised',
    finishOptions: ['Anodised Silver', 'Anodised Bronze', 'Anodised Black', 'Powder-coated'],
  },
  {
    id: 'recycled-aluminum-frame',
    finishFamily: 'metal-anodised',
    finishOptions: ['Anodised Silver', 'Anodised Bronze', 'Powder-coated'],
  },
  {
    id: 'steel-door',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated', 'Galvanised', 'Painted'],
  },
  {
    id: 'steel-window-frame',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated', 'Galvanised', 'Painted'],
  },
  {
    id: 'steel-railing',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated', 'Galvanised', 'Painted'],
  },
  {
    id: 'zinc-cladding',
    finishFamily: 'metal-patina',
    varietyOptions: ['Natural Zinc', 'Pre-weathered Zinc', 'Quartz Zinc', 'Anthra Zinc', 'Pigmento Zinc'],
    finishOptions: ['Natural', 'Pre-weathered', 'Lacquered'],
  },
  {
    id: 'copper-cladding',
    finishFamily: 'metal-patina',
    varietyOptions: ['Natural Copper', 'Pre-patinated Green', 'Pre-patinated Brown', 'Brass-clad'],
    finishOptions: ['Natural', 'Pre-patinated', 'Lacquered'],
  },
  {
    id: 'copper-standing-seam-roof',
    finishFamily: 'metal-patina',
    varietyOptions: ['Natural Copper', 'Pre-patinated'],
  },
  {
    id: 'lead-cladding',
    finishFamily: 'metal-patina',
  },
  {
    id: 'lead-standing-seam-roof',
    finishFamily: 'metal-patina',
  },
  {
    id: 'weathering-steel-cladding',
    finishFamily: 'metal-patina',
    finishOptions: ['Natural Weathering', 'Accelerated Patina', 'Sealed'],
  },
  {
    id: 'stainless-cladding',
    finishFamily: 'metal-brushed',
    finishOptions: ['Brushed', 'Mirror Polished', 'Bead-blasted', 'Patterned'],
  },
  {
    id: 'stainless-standing-seam-roof',
    finishFamily: 'metal-brushed',
    finishOptions: ['Brushed', 'Mill Finish'],
  },
  {
    id: 'standing-seam-roof',
    finishFamily: 'metal-patina',
    varietyOptions: ['Zinc', 'Copper', 'Aluminium', 'Steel'],
    finishOptions: ['Natural', 'Pre-weathered', 'Powder-coated'],
  },
  {
    id: 'perforated-metal-ceiling',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated', 'Anodised', 'Natural Metal'],
  },
  {
    id: 'perforated-metal-soffit',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated', 'Anodised', 'Perforated'],
  },
  {
    id: 'metal-mesh-ceiling',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated', 'Stainless', 'Brass', 'Copper'],
  },
  {
    id: 'metal-mesh-panels',
    finishFamily: 'metal-brushed',
    finishOptions: ['Stainless', 'Brass', 'Bronze', 'Powder-coated'],
  },
  {
    id: 'open-grid-ceiling',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated White', 'Powder-coated Black', 'Aluminium'],
  },
  {
    id: 'brass-fixtures',
    finishFamily: 'metal-brushed',
    finishOptions: ['Satin Brass', 'Polished Brass', 'Antique Brass', 'Brushed Brass'],
  },
  {
    id: 'cable-railing',
    finishFamily: 'metal-polished',
    finishOptions: ['Stainless Steel', 'Galvanised', 'Black Oxide'],
  },
  {
    id: 'mesh-railing',
    finishFamily: 'metal-powder-coat',
    finishOptions: ['Powder-coated', 'Galvanised', 'Stainless'],
  },

  // ============================================
  // CONCRETE MATERIALS - Add finish family
  // ============================================
  {
    id: 'polished-concrete',
    finishFamily: 'concrete-polished',
    finishOptions: ['High Polish', 'Matte Polish', 'Salt & Pepper', 'Exposed Aggregate'],
  },
  {
    id: 'concrete-frame',
    finishFamily: 'concrete-formed',
    finishOptions: ['Board-formed', 'Smooth Form', 'Exposed Aggregate', 'Acid-etched'],
  },
  {
    id: 'concrete-block-wall',
    finishFamily: 'concrete-exposed',
    finishOptions: ['Painted', 'Sealed', 'Split-face', 'Smooth'],
  },
  {
    id: 'exposed-concrete-soffit',
    finishFamily: 'concrete-exposed',
    finishOptions: ['Board-formed', 'Smooth', 'Sealed', 'Painted'],
  },
  {
    id: 'precast-concrete-panels',
    finishFamily: 'concrete-exposed',
    finishOptions: ['Smooth', 'Textured', 'Exposed Aggregate', 'Acid-etched', 'Polished'],
  },
  {
    id: 'precast-concrete',
    finishFamily: 'concrete-exposed',
    finishOptions: ['Smooth', 'Textured', 'Exposed Aggregate'],
  },
  {
    id: 'rammed-earth-structure',
    finishFamily: 'self-finished',
    varietyOptions: ['Local Earth', 'Stabilised', 'Pigmented'],
  },
  {
    id: 'block-paving',
    finishFamily: 'concrete-exposed',
    varietyOptions: ['Concrete Block', 'Clay Block', 'Permeable Block'],
    finishOptions: ['Natural', 'Tumbled', 'Textured'],
  },
  {
    id: 'concrete-paving',
    finishFamily: 'concrete-exposed',
    finishOptions: ['Smooth', 'Textured', 'Exposed Aggregate', 'Brushed'],
  },

  // ============================================
  // PAINT MATERIALS - Add finish family
  // ============================================
  {
    id: 'standard-wall-paint',
    finishFamily: 'paint-matte',
    finishOptions: ['Matte', 'Eggshell', 'Satin'],
  },
  {
    id: 'custom-wall-paint',
    finishFamily: 'paint-matte',
    finishOptions: ['Matte', 'Eggshell', 'Satin', 'Semi-gloss'],
  },
  {
    id: 'standard-ceiling-paint',
    finishFamily: 'paint-matte',
    finishOptions: ['Flat Matte', 'Matte'],
  },
  {
    id: 'custom-ceiling-paint',
    finishFamily: 'paint-matte',
    finishOptions: ['Flat Matte', 'Matte', 'Eggshell'],
  },

  // ============================================
  // PLASTER MATERIALS - Add finish family
  // ============================================
  {
    id: 'clay-plaster',
    finishFamily: 'self-finished',
    varietyOptions: ['Natural Clay', 'Coloured Clay', 'Textured Clay'],
    finishOptions: ['Smooth', 'Textured', 'Burnished'],
  },
  {
    id: 'lime-plaster',
    finishFamily: 'self-finished',
    varietyOptions: ['Natural Lime', 'Coloured Lime', 'Marmorino'],
    finishOptions: ['Smooth', 'Textured', 'Polished'],
  },
  {
    id: 'tadelakt-plaster',
    finishFamily: 'self-finished',
    varietyOptions: ['Natural', 'Coloured', 'Metallic'],
    finishOptions: ['Polished', 'Matte'],
  },
  {
    id: 'acoustic-plaster',
    finishFamily: 'self-finished',
    finishOptions: ['Smooth', 'Fine Textured'],
  },
  {
    id: 'gypsum-wall',
    finishFamily: 'paint-matte',
    finishOptions: ['Level 4 Finish', 'Level 5 Finish', 'Skim Coat'],
  },
  {
    id: 'plasterboard-wall',
    finishFamily: 'paint-matte',
    finishOptions: ['Level 4 Finish', 'Level 5 Finish'],
  },
  {
    id: 'plasterboard-ceiling',
    finishFamily: 'paint-matte',
    finishOptions: ['Level 4 Finish', 'Level 5 Finish'],
  },
  {
    id: 'gypsum-ceiling',
    finishFamily: 'paint-matte',
    finishOptions: ['Level 4 Finish', 'Level 5 Finish'],
  },

  // ============================================
  // TILE MATERIALS - Add finish family
  // ============================================
  {
    id: 'ceramic-tiles',
    finishFamily: 'tile-glazed',
    varietyOptions: ['Plain Colour', 'Patterned', 'Hand-painted', 'Zellige'],
    finishOptions: ['Glossy', 'Matte', 'Satin'],
  },
  {
    id: 'porcelain-tiles',
    finishFamily: 'tile-glazed',
    varietyOptions: ['Stone-effect', 'Concrete-effect', 'Wood-effect', 'Plain Colour', 'Large Format'],
    finishOptions: ['Polished', 'Matte', 'Textured', 'Anti-slip'],
  },
  {
    id: 'terracotta-panels',
    finishFamily: 'tile-unglazed',
    varietyOptions: ['Natural Terracotta', 'Glazed Terracotta', 'Mixed Earth Tones'],
    finishOptions: ['Natural', 'Glazed', 'Engobed'],
  },

  // ============================================
  // GLASS MATERIALS - Add finish family
  // ============================================
  {
    id: 'glass-panels-finish',
    finishFamily: 'glass-tinted',
    varietyOptions: ['Clear', 'Low-iron', 'Tinted', 'Frosted'],
    finishOptions: ['Back-painted', 'Etched', 'Textured', 'Mirrored'],
  },
  {
    id: 'glass-partitions',
    finishFamily: 'glass-clear',
    varietyOptions: ['Clear', 'Low-iron', 'Frosted', 'Reeded'],
    finishOptions: ['Clear', 'Frosted', 'Patterned', 'Switchable'],
  },
  {
    id: 'glass-balustrade',
    finishFamily: 'glass-clear',
    varietyOptions: ['Clear', 'Low-iron', 'Tinted', 'Frosted'],
    finishOptions: ['Polished Edge', 'Pencil Edge'],
  },
  {
    id: 'frameless-glazing',
    finishFamily: 'glass-clear',
    varietyOptions: ['Clear', 'Low-iron', 'Tinted'],
  },
  {
    id: 'glass-door',
    finishFamily: 'glass-clear',
    varietyOptions: ['Clear', 'Frosted', 'Tinted', 'Patterned'],
  },
  {
    id: 'glass-facade',
    finishFamily: 'glass-tinted',
    varietyOptions: ['Clear', 'Low-iron', 'Solar Control', 'Fritted', 'Coloured'],
  },

  // ============================================
  // FABRIC/TEXTILE MATERIALS - Add finish family
  // ============================================
  {
    id: 'fabric-acoustic-panels',
    finishFamily: 'fabric-natural',
    varietyOptions: ['Wool Felt', 'Recycled PET', 'Cotton', 'Linen'],
  },
  {
    id: 'wool-felt-panels',
    finishFamily: 'fabric-natural',
    varietyOptions: ['Natural Wool', 'Coloured Wool', 'Patterned'],
  },
  {
    id: 'textured-wallpaper',
    finishFamily: 'fabric-natural',
    varietyOptions: ['Grasscloth', 'Linen', 'Sisal', 'Cork', 'Paper'],
  },
  {
    id: 'stretch-fabric-ceiling',
    finishFamily: 'fabric-synthetic',
    varietyOptions: ['PVC', 'Polyester', 'Acoustic'],
    finishOptions: ['Matte', 'Satin', 'Printed'],
  },
  {
    id: 'leather-panels',
    finishFamily: 'leather',
    varietyOptions: ['Full Grain', 'Top Grain', 'Recycled Leather', 'Vegan Leather'],
    finishOptions: ['Natural', 'Aniline', 'Semi-aniline', 'Pigmented'],
  },

  // ============================================
  // VINYL/POLYMER MATERIALS - Add finish family
  // ============================================
  {
    id: 'vinyl-planks',
    finishFamily: 'vinyl',
    varietyOptions: ['Wood-effect', 'Stone-effect', 'Concrete-effect'],
    finishOptions: ['Matte', 'Embossed', 'High Traffic'],
  },
  {
    id: 'resin-flooring',
    finishFamily: 'self-finished',
    varietyOptions: ['Epoxy', 'Polyurethane', 'PMMA', 'Terrazzo-effect'],
    finishOptions: ['Matte', 'Satin', 'High Gloss', 'Anti-slip'],
  },
  {
    id: 'epoxy-flooring',
    finishFamily: 'self-finished',
    finishOptions: ['Matte', 'Satin', 'High Gloss', 'Anti-slip', 'Flake Finish'],
  },
  {
    id: 'rubber-floor',
    finishFamily: 'self-finished',
    varietyOptions: ['Recycled Rubber', 'Virgin Rubber', 'Cork-rubber Composite'],
    finishOptions: ['Smooth', 'Studded', 'Textured'],
  },

  // ============================================
  // MICROCEMENT/MINERAL MATERIALS
  // ============================================
  {
    id: 'microcement-floor',
    finishFamily: 'self-finished',
    finishOptions: ['Matte', 'Satin', 'Polished'],
  },
  {
    id: 'mineral-microcement',
    finishFamily: 'self-finished',
    finishOptions: ['Matte', 'Satin', 'Polished'],
  },

  // ============================================
  // INSULATED RENDER - Add finish family
  // ============================================
  {
    id: 'insulated-render-system',
    finishFamily: 'ral',
    finishOptions: ['Smooth', 'Textured', 'Scraped', 'Pebble-dash'],
  },

  // ============================================
  // BRICK MATERIALS
  // ============================================
  {
    id: 'brick-veneer',
    finishFamily: 'self-finished',
    varietyOptions: ['Stock Brick', 'Engineering Brick', 'Handmade Brick', 'Reclaimed Brick', 'Clinker Brick'],
    finishOptions: ['Natural', 'Glazed', 'Tumbled'],
  },
  {
    id: 'brick-internal',
    finishFamily: 'self-finished',
    varietyOptions: ['Stock Brick', 'Reclaimed Brick', 'Whitewashed', 'Painted'],
    finishOptions: ['Natural', 'Painted', 'Whitewashed', 'Sealed'],
  },
  {
    id: 'brick-slip-rainscreen',
    finishFamily: 'self-finished',
    varietyOptions: ['Stock Brick Slip', 'Engineering Slip', 'Handmade Slip', 'Reclaimed Slip'],
  },

  // ============================================
  // COMPOSITE/LAMINATE MATERIALS
  // ============================================
  {
    id: 'metal-composite-panels',
    finishFamily: 'ral',
    finishOptions: ['Powder-coated', 'PVDF', 'Anodised-look', 'Metallic'],
  },
  {
    id: 'fibre-cement-panels',
    finishFamily: 'self-finished',
    varietyOptions: ['Smooth', 'Textured', 'Wood-effect'],
    finishOptions: ['Natural Grey', 'Coloured', 'Through-coloured'],
  },
];

async function updateMaterial(update) {
  const response = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
      'Origin': 'https://agreeable-river-02d882203-staging.westeurope.3.azurestaticapps.net',
    },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update ${update.id}: ${response.status} - ${text}`);
  }

  return response.json();
}

async function main() {
  console.log(`Updating ${materialUpdates.length} materials with finishFamily and varietyOptions...\n`);

  let success = 0;
  let failed = 0;

  for (const update of materialUpdates) {
    try {
      await updateMaterial(update);
      console.log(`✓ Updated: ${update.id}`);
      success++;
    } catch (error) {
      console.error(`✗ Failed: ${update.id} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Completed: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
