/**
 * Script to generate lifecycle profiles for all materials
 * Run with: node scripts/generate-lifecycle-profiles.js
 */

// Material type heuristics for lifecycle impacts
const materialTypeProfiles = {
  // Bio-based / Renewable
  timber: {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  // High-temp manufactured
  ceramic: {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' }, // Kiln firing
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  // Metals
  metal: {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' } // Recyclable
  },

  // Concrete / Cement-based
  concrete: {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' }, // Cement production
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  // Glass
  glass: {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' }, // High-temp melting
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  // Plastics / Synthetics
  plastic: {
    raw: { impact: 4, confidence: 'high' }, // Petroleum-based
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' }, // Lightweight
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 4, confidence: 'low' } // Recycling uncertain
  },

  // Natural / Earth-based
  earth: {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 1, confidence: 'high' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  // Stone
  stone: {
    raw: { impact: 3, confidence: 'high' }, // Quarrying
    manufacturing: { impact: 3, confidence: 'high' }, // Cutting/polishing
    transport: { impact: 4, confidence: 'medium' }, // Very heavy
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  // Textiles / Fabrics
  textile: {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  // Bio-based (hemp, cork, etc.)
  biobased: {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  // Recycled content
  recycled: {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 2, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  }
};

// Classify material by keywords
function classifyMaterial(material) {
  const text = `${material.name} ${material.finish} ${material.description} ${material.keywords?.join(' ')}`.toLowerCase();

  // Check for specific material types
  if (text.includes('timber') || text.includes('wood') || text.includes('oak') || text.includes('bamboo')) {
    if (text.includes('reclaimed')) return 'recycled';
    return 'timber';
  }
  if (text.includes('steel') || text.includes('aluminum') || text.includes('aluminium') || text.includes('metal') || text.includes('brass') || text.includes('copper') || text.includes('zinc')) {
    return 'metal';
  }
  if (text.includes('concrete') || text.includes('cement') || text.includes('microcement')) {
    return 'concrete';
  }
  if (text.includes('glass') || text.includes('glazing')) {
    return 'glass';
  }
  if (text.includes('ceramic') || text.includes('terracotta') || text.includes('porcelain') || text.includes('clay') || text.includes('brick')) {
    return 'ceramic';
  }
  if (text.includes('plastic') || text.includes('vinyl') || text.includes('upvc') || text.includes('composite') || text.includes('grp') || text.includes('pet')) {
    return 'plastic';
  }
  if (text.includes('hemp') || text.includes('cork') || text.includes('mycelium') || text.includes('bio-based') || text.includes('biobased')) {
    return 'biobased';
  }
  if (text.includes('earth') || text.includes('rammed') || text.includes('lime')) {
    return 'earth';
  }
  if (text.includes('stone') || text.includes('marble') || text.includes('granite') || text.includes('slate') || text.includes('travertine')) {
    return 'stone';
  }
  if (text.includes('fabric') || text.includes('textile') || text.includes('carpet') || text.includes('felt') || text.includes('wool') || text.includes('leather')) {
    return 'textile';
  }
  if (text.includes('recycled') || text.includes('reclaimed')) {
    return 'recycled';
  }
  if (text.includes('paint') || text.includes('plaster') || text.includes('render')) {
    return 'concrete'; // Default for cementitious finishes
  }

  // Default fallback
  return 'recycled';
}

function generateProfile(material) {
  const type = classifyMaterial(material);
  const baseProfile = materialTypeProfiles[type];

  return {
    id: material.id,
    profile: baseProfile,
    type: type,
    comment: `// ${material.name} - classified as ${type}`
  };
}

// Format as TypeScript code
function formatProfile(id, profile) {
  return `  '${id}': {
    raw: { impact: ${profile.raw.impact}, confidence: '${profile.raw.confidence}' },
    manufacturing: { impact: ${profile.manufacturing.impact}, confidence: '${profile.manufacturing.confidence}' },
    transport: { impact: ${profile.transport.impact}, confidence: '${profile.transport.confidence}' },
    installation: { impact: ${profile.installation.impact}, confidence: '${profile.installation.confidence}' },
    inUse: { impact: ${profile.inUse.impact}, confidence: '${profile.inUse.confidence}' },
    maintenance: { impact: ${profile.maintenance.impact}, confidence: '${profile.maintenance.confidence}' },
    endOfLife: { impact: ${profile.endOfLife.impact}, confidence: '${profile.endOfLife.confidence}' }
  }`;
}

console.log('// Generated lifecycle profiles');
console.log('// Add these to MATERIAL_LIFECYCLE_PROFILES in constants.ts');
console.log('');

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    materialTypeProfiles,
    classifyMaterial,
    generateProfile,
    formatProfile
  };
}
