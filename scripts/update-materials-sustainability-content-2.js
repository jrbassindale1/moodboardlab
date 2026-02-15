#!/usr/bin/env node
/**
 * Script to update remaining materials with strategicValue and mitigationTip content
 * Run with: node scripts/update-materials-sustainability-content-2.js
 */

const API_URL = 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api/materials';
const ADMIN_KEY = '11NarrowPath';

const materialUpdates = [
  // ============================================
  // MEDIUM CARBON MATERIALS - Need both fields for flexibility
  // ============================================
  {
    id: 'standard-wall-paint',
    strategicValue: 'Standard paints with low-VOC formulations improve indoor air quality while providing durable, maintainable surfaces.',
    mitigationTip: 'Specify paints with high recycled content, low VOC emissions, and long maintenance intervals to reduce lifecycle impact.'
  },
  {
    id: 'custom-wall-paint',
    strategicValue: 'Custom colour matching eliminates waste from incorrect orders while allowing precise design intent.',
    mitigationTip: 'Specify low-VOC formulations and consider whether standard colours might achieve similar effects with lower carbon.'
  },
  {
    id: 'standard-ceiling-paint',
    strategicValue: 'Standard ceiling paints offer good coverage and durability with established supply chains reducing waste.',
    mitigationTip: 'Specify high-opacity paints to reduce coats required. Consider whether exposed structure might eliminate ceiling finishes entirely.'
  },
  {
    id: 'custom-ceiling-paint',
    strategicValue: 'Custom colours enable design flexibility while modern low-VOC formulations protect indoor air quality.',
    mitigationTip: 'Minimise custom colours where possible. Consider spray application for better coverage and reduced material use.'
  },
  {
    id: 'brick-slip-rainscreen',
    strategicValue: 'Brick slips use significantly less material than full bricks while achieving traditional aesthetics.',
    mitigationTip: 'Source slips from reclaimed brick cutting or specify from manufacturers using renewable kiln energy.'
  },
  {
    id: 'stone-rainscreen',
    strategicValue: 'Thin stone rainscreen uses 75% less material than solid stone while maintaining visual impact.',
    mitigationTip: 'Source stone regionally to minimise transport. Consider 20mm thickness or honeycomb-backed panels to reduce weight.'
  },
  {
    id: 'gfrc-grc-panels',
    strategicValue: 'Glass fibre reinforced concrete uses less cement than precast while achieving complex forms.',
    mitigationTip: 'Specify maximum cement replacement and consider whether timber or natural materials might achieve similar effects.'
  },
  {
    id: 'slate-cladding',
    strategicValue: 'Natural slate cladding offers 100+ year durability, offsetting extraction impacts over its service life.',
    mitigationTip: 'Source slate regionally where possible. Consider thinner formats and specify from quarries with renewable energy.'
  },
  {
    id: 'insulated-render-system',
    strategicValue: 'External wall insulation reduces operational carbon while protecting the building envelope.',
    mitigationTip: 'Specify mineral or wood fibre insulation over synthetic. Use lime-based renders where possible for breathability.'
  },
  {
    id: 'zinc-cladding',
    strategicValue: 'Zinc achieves 80+ year service life and is 100% recyclable, making it efficient over its full lifecycle.',
    mitigationTip: 'Specify high recycled content zinc. Design for disassembly to enable future material recovery and recycling.'
  },
  {
    id: 'fibre-cement-panels',
    strategicValue: 'Fibre cement panels provide durable, low-maintenance facades with moderate embodied carbon.',
    mitigationTip: 'Specify panels with maximum recycite content and consider whether timber alternatives might be suitable.'
  },
  {
    id: 'etfe-tensile-facade',
    strategicValue: 'ETFE uses 1% of the material weight of glass while providing similar light transmission and 25+ year lifespan.',
    mitigationTip: 'Design for long service life and ensure take-back arrangements for end-of-life recycling of the polymer.'
  },

  // ============================================
  // LOW CARBON MATERIALS - Strategic Value
  // ============================================
  {
    id: 'hempcrete-structural',
    strategicValue: 'Hempcrete is carbon-negative, sequestering more CO2 during hemp growth than is released in processing. It provides combined insulation, thermal mass, and moisture regulation.'
  },
  {
    id: 'permeable-paving',
    strategicValue: 'Permeable paving manages stormwater at source while reducing urban heat island effect. It enables natural groundwater recharge.'
  },
  {
    id: 'joinery-built-in',
    strategicValue: 'Built-in joinery reduces furniture purchases and enables efficient use of space. Timber joinery stores carbon throughout building life.'
  },
  {
    id: 'green-roof',
    strategicValue: 'Green roofs reduce operational carbon through insulation and cooling, while supporting biodiversity and managing stormwater.'
  },
  {
    id: 'pv-roof',
    strategicValue: 'Solar PV generates renewable energy that offsets its embodied carbon within 2-3 years, delivering net-positive energy over its 25+ year lifespan.'
  },
  {
    id: 'blue-roof',
    strategicValue: 'Blue roofs attenuate stormwater while providing passive cooling through evaporation, reducing both infrastructure and operational carbon.'
  },
  {
    id: 'wood-fiber-insulation',
    strategicValue: 'Wood fibre insulation sequesters carbon while providing excellent hygrothermal performance. It is compostable at end of life.'
  },
  {
    id: 'hemp-insulation',
    strategicValue: 'Hemp insulation is carbon-negative, grown in 4 months with minimal inputs. It naturally regulates humidity and resists pests without treatment.'
  },
  {
    id: 'cork-insulation',
    strategicValue: 'Cork insulation is harvested without felling trees, making it truly renewable. Its closed-cell structure provides excellent thermal and acoustic performance.'
  },
  {
    id: 'timber-door',
    strategicValue: 'Timber doors store carbon while providing natural thermal insulation. FSC-certified timber ensures sustainable forest management.'
  },
  {
    id: 'timber-railing',
    strategicValue: 'Timber railings combine carbon storage with warm, tactile aesthetics. They can be detailed for future disassembly and reuse.'
  },
  {
    id: 'gravel-paving',
    strategicValue: 'Gravel is minimally processed and naturally permeable. Local sourcing keeps transport emissions very low.'
  },
  {
    id: 'decking-external',
    strategicValue: 'Timber decking stores carbon while creating outdoor amenity spaces. Specify FSC-certified or reclaimed timber for lowest impact.'
  },
  {
    id: 'hemp-lime-wall',
    strategicValue: 'Hemp-lime walls are carbon-negative, combining hemp shiv with lime binder to create breathable, insulating, and carbon-storing wall systems.'
  },
  {
    id: 'timber-rainscreen',
    strategicValue: 'Timber rainscreen cladding sequesters carbon while naturally weathering to a silver-grey patina that requires no maintenance coatings.'
  },
  {
    id: 'charred-timber-cladding',
    strategicValue: 'Charred timber (Shou Sugi Ban) combines carbon storage with natural fire resistance and durability, eliminating the need for chemical treatments.'
  },
  {
    id: 'cork-rainscreen',
    strategicValue: 'Cork cladding is harvested renewably and provides natural insulation. It is lightweight, reducing structural requirements.'
  },
  {
    id: 'wood-fibre-lime-render',
    strategicValue: 'Wood fibre boards with lime render create a breathable, carbon-storing external insulation system using natural materials.'
  },
  {
    id: 'living-green-wall',
    strategicValue: 'Living walls improve air quality, reduce urban heat island effect, and support biodiversity while providing natural building cooling.'
  },
  {
    id: 'native-planting',
    strategicValue: 'Native planting requires minimal irrigation and maintenance while supporting local biodiversity and pollinators.'
  },
  {
    id: 'wildflower-meadow',
    strategicValue: 'Wildflower meadows require minimal mowing and no irrigation, while supporting biodiversity and sequestering carbon in soil.'
  },
  {
    id: 'rain-garden',
    strategicValue: 'Rain gardens manage stormwater naturally while creating habitat and reducing infrastructure carbon.'
  },
  {
    id: 'living-wall-external',
    strategicValue: 'External living walls improve biodiversity, reduce building cooling loads, and improve local air quality.'
  },
  {
    id: 'ornamental-planting',
    strategicValue: 'Well-designed planting sequesters carbon, manages rainwater, and improves occupant wellbeing with minimal ongoing impact.'
  },
  {
    id: 'tree-planting',
    strategicValue: 'Trees provide long-term carbon sequestration, shade, habitat, and air quality benefits that increase over time.'
  },
  {
    id: 'oak-dining-table',
    strategicValue: 'Solid oak furniture stores carbon for decades while providing durability that outlasts multiple generations of flat-pack alternatives.'
  },
  {
    id: 'plywood-furniture',
    strategicValue: 'Plywood furniture uses timber efficiently through thin veneer layers, storing carbon while enabling precise manufacturing.'
  },
  {
    id: 'reclaimed-timber-furniture',
    strategicValue: 'Reclaimed timber furniture extends carbon storage indefinitely while celebrating material history and character.'
  },

  // ============================================
  // HIGH CARBON MATERIALS - Mitigation Tips
  // ============================================
  {
    id: 'tension-rods-tie-members',
    mitigationTip: 'Use stainless steel only where essential. For internal applications, specify high recycled content carbon steel with appropriate coatings.'
  },
  {
    id: 'secondary-cantilever-arms',
    mitigationTip: 'Optimise cantilever design to minimise steel. Consider timber alternatives where loading and fire requirements permit.'
  },
  {
    id: 'brick-loadbearing',
    mitigationTip: 'Consider reclaimed bricks which reduce embodied carbon by 80%+. For new bricks, specify from manufacturers using renewable kiln energy.'
  },
  {
    id: 'concrete-block-loadbearing',
    mitigationTip: 'Specify blocks with recycled aggregate and cement replacement. Consider hempcrete or rammed earth alternatives where appropriate.'
  },
  {
    id: 'steel-concrete-composite',
    mitigationTip: 'Maximise cement replacement in concrete and specify high recycled content steel decking. Consider CLT floor alternatives.'
  },
  {
    id: 'steel-trusses',
    mitigationTip: 'Consider glulam or timber truss alternatives where fire regulations permit. For steel, specify EAF production with high recycled content.'
  },
  {
    id: 'prestressed-concrete',
    mitigationTip: 'Specify maximum cement replacement (GGBS/PFA) compatible with strength requirements. Consider mass timber alternatives for floor spans.'
  },
  {
    id: 'brass-fixtures',
    mitigationTip: 'Specify recycled brass content and design for longevity. Consider whether lower-carbon alternatives might achieve similar aesthetics.'
  },
  {
    id: 'standing-seam-roof',
    mitigationTip: 'Zinc provides 80+ year durability and is fully recyclable. Specify high recycled content and design for future recovery.'
  },
  {
    id: 'aluminium-standing-seam-roof',
    mitigationTip: 'Specify post-consumer recycled aluminium (minimum 75%). Design for easy removal and ensure take-back arrangements for recycling.'
  },
  {
    id: 'copper-standing-seam-roof',
    mitigationTip: 'Copper achieves 100+ year service life and is infinitely recyclable. Specify minimum 65% recycled content.'
  },
  {
    id: 'stainless-standing-seam-roof',
    mitigationTip: 'Stainless steel has high embodied carbon but exceptional durability. Consider zinc alternatives with similar longevity but lower impact.'
  },
  {
    id: 'lead-standing-seam-roof',
    mitigationTip: 'Lead roofing typically contains 95% recycled content already. Ensure proper handling protocols and specify recycled material.'
  },
  {
    id: 'cool-roof',
    mitigationTip: 'Cool roof membranes reduce operational carbon through cooling load reduction. Specify products with recycled content where available.'
  },
  {
    id: 'clay-tiles-roof',
    mitigationTip: 'Source tiles from manufacturers using renewable kiln energy. Consider reclaimed tiles which eliminate manufacturing emissions.'
  },
  {
    id: 'slate-tiles-roof',
    mitigationTip: 'Slate achieves 100+ year durability. Source regionally where possible and consider reclaimed slate from building salvage.'
  },
  {
    id: 'metal-tiles-roof',
    mitigationTip: 'Specify high recycled content metal and design for easy replacement of individual tiles. Consider zinc or aluminium options.'
  },
  {
    id: 'epdm-membrane',
    mitigationTip: 'EPDM is durable but petroleum-based. Consider bio-based alternatives where available or specify products with recycled rubber content.'
  },
  {
    id: 'tpo-membrane',
    mitigationTip: 'TPO is recyclable at end of life. Ensure contractor has take-back arrangements and consider cool roof variants to reduce operational carbon.'
  },
  {
    id: 'built-up-roofing',
    mitigationTip: 'Multi-layer systems have high embodied carbon. Consider single-ply alternatives or specify modified bitumen with recycled content.'
  },
  {
    id: 'polycarbonate-roof',
    mitigationTip: 'Polycarbonate is petroleum-based. Consider ETFE alternatives for lightweight glazing or natural daylighting alternatives.'
  },
  {
    id: 'mineral-wool',
    mitigationTip: 'Specify mineral wool with high recycled glass or stone content. Compare with natural alternatives like wood fibre or sheep wool.'
  },
  {
    id: 'aerogel-insulation',
    mitigationTip: 'Aerogel has high embodied carbon but enables ultra-thin build-ups. Use only where space constraints justify the impact.'
  },
  {
    id: 'steel-door',
    mitigationTip: 'Specify high recycled content steel. Consider whether timber doors with steel reinforcement might achieve required security ratings.'
  },
  {
    id: 'aluminum-door',
    mitigationTip: 'Specify post-consumer recycled aluminium (minimum 75%). Consider timber-aluminium composite for lower overall impact.'
  },
  {
    id: 'glass-door',
    mitigationTip: 'Specify recycled glass content and efficient processing. Consider whether solid doors with vision panels might reduce glazing area.'
  },
  {
    id: 'composite-door',
    mitigationTip: 'Composite doors combine multiple materials making recycling difficult. Specify products with established take-back schemes.'
  },
  {
    id: 'fire-rated-door',
    mitigationTip: 'Fire doors are essential for safety. Specify timber cores where ratings permit, as they store carbon while meeting requirements.'
  },
  {
    id: 'glass-balustrade',
    mitigationTip: 'Glass balustrades have high embodied carbon. Consider cable or mesh alternatives where visual transparency is acceptable.'
  },
  {
    id: 'steel-railing',
    mitigationTip: 'Specify high recycled content steel and design for bolted connections enabling future reuse. Consider timber alternatives.'
  },
  {
    id: 'cable-railing',
    mitigationTip: 'Cable railings use less material than solid panels. Specify stainless steel with recycled content for marine or exposed applications.'
  },
  {
    id: 'mesh-railing',
    mitigationTip: 'Wire mesh uses minimal material compared to solid panels. Specify recycled stainless steel for durability without excessive weight.'
  },
  {
    id: 'resin-bound-gravel',
    mitigationTip: 'Resin binders are petroleum-based. Consider bio-based resin alternatives or self-binding gravel where appropriate.'
  },
  {
    id: 'concrete-paving',
    mitigationTip: 'Specify maximum cement replacement and recycled aggregate. Consider permeable variants to provide stormwater management.'
  },
  {
    id: 'block-paving',
    mitigationTip: 'Specify blocks with recycled aggregate content. Consider permeable laying patterns and reclaimed blocks where available.'
  },
  {
    id: 'grass-reinforcement',
    mitigationTip: 'Grass reinforcement grids are often plastic-based. Specify recycled content or consider natural alternatives like gravel.'
  },
  {
    id: 'stone-facade',
    mitigationTip: 'Source stone locally to minimise transport. Consider thin-veneer systems which reduce stone volume by up to 80%.'
  },
  {
    id: 'precast-concrete-panels',
    mitigationTip: 'Factory production enables higher cement replacement and quality control. Specify 50%+ GGBS and design for modular reuse.'
  },
  {
    id: 'stainless-cladding',
    mitigationTip: 'Stainless steel has high embodied carbon but exceptional durability. Consider zinc or aluminium alternatives with similar longevity.'
  },
  {
    id: 'lead-cladding',
    mitigationTip: 'Lead cladding typically uses 95% recycled content. Ensure proper handling and specify from suppliers with verified recycled content.'
  },
  {
    id: 'weathering-steel-cladding',
    mitigationTip: 'Weathering steel eliminates coating maintenance but has high initial carbon. Specify high recycled content from EAF production.'
  },
  {
    id: 'insulated-metal-panels',
    mitigationTip: 'Specify mineral wool cores over foam for better fire performance and recyclability. Use high recycled content metal facings.'
  },
  {
    id: 'metal-composite-panels',
    mitigationTip: 'Metal composite panels combine aluminium with plastic cores. Specify fire-safe mineral cores and high recycled aluminium content.'
  },
  {
    id: 'glass-facade',
    mitigationTip: 'Optimise glazing ratios to balance daylighting with embodied carbon. Specify recycled glass content and efficient framing.'
  },
  {
    id: 'upholstered-seating',
    mitigationTip: 'Specify natural fabrics (wool, linen) over synthetic. Choose frames designed for reupholstery to extend furniture life.'
  },
  {
    id: 'metal-chair',
    mitigationTip: 'Specify recycled aluminium or steel. Design for durability and repairability to maximise service life.'
  },
  {
    id: 'modular-shelving',
    mitigationTip: 'Specify timber or recycled metal components. Design for reconfiguration and disassembly to enable reuse in different spaces.'
  }
];

async function updateMaterial(update) {
  try {
    const response = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
        'Origin': 'https://agreeable-river-02d882203-staging.westeurope.3.azurestaticapps.net'
      },
      body: JSON.stringify(update)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to update ${update.id}: ${response.status} - ${errorText}`);
      return false;
    }

    const result = await response.json();
    const fields = [];
    if (update.strategicValue) fields.push('strategicValue');
    if (update.mitigationTip) fields.push('mitigationTip');
    console.log(`Updated ${update.id}: ${fields.join(' + ')} added`);
    return true;
  } catch (error) {
    console.error(`Error updating ${update.id}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Starting sustainability content update (batch 2)...');
  console.log(`Total materials to update: ${materialUpdates.length}`);
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (const update of materialUpdates) {
    const success = await updateMaterial(update);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`Update complete!`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

main().catch(console.error);
