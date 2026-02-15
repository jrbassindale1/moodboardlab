#!/usr/bin/env node
/**
 * Script to update materials with strategicValue and mitigationTip content
 * Run with: node scripts/update-materials-sustainability-content.js
 *
 * This script adds pre-generated sustainability briefing content to materials:
 * - strategicValue: For low-carbon materials, explains why they're excellent choices
 * - mitigationTip: For high-carbon materials, provides practical mitigation advice
 */

const API_URL = 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api/materials';
const ADMIN_KEY = '11NarrowPath';

// Pre-generated content for materials based on their carbon intensity and characteristics
const materialUpdates = [
  // ============================================
  // LOW CARBON MATERIALS - Strategic Value
  // ============================================
  {
    id: 'clt-structure',
    strategicValue: 'Cross-laminated timber sequesters atmospheric CO2 throughout its service life, storing approximately 0.9 tonnes of carbon per cubic metre while providing structural performance comparable to concrete.'
  },
  {
    id: 'clt-floor-panels',
    strategicValue: 'CLT floor panels combine carbon sequestration with rapid installation, enabling low-carbon construction that locks away CO2 for the building lifetime.'
  },
  {
    id: 'clt-roof-panels',
    strategicValue: 'CLT roof panels provide excellent thermal mass and carbon storage, creating naturally insulating roof structures with minimal processing energy.'
  },
  {
    id: 'exposed-clt-ceiling',
    strategicValue: 'Exposed CLT ceilings eliminate the need for separate finishes, reducing material use while showcasing the natural beauty and carbon-storing properties of mass timber.'
  },
  {
    id: 'glulam-structure',
    strategicValue: 'Glulam beams and columns achieve long spans with a fraction of the embodied carbon of steel or concrete, while storing atmospheric CO2 in the building structure.'
  },
  {
    id: 'glulam-roof-beams',
    strategicValue: 'Glulam roof beams combine structural efficiency with carbon sequestration, enabling dramatic spans while maintaining a low-carbon building envelope.'
  },
  {
    id: 'green-oak-structure',
    strategicValue: 'Green oak construction uses minimal processing energy and naturally seasons in place. Its traditional joinery methods enable future disassembly and material reuse.'
  },
  {
    id: 'timber-frame',
    strategicValue: 'Timber window frames store carbon while providing natural thermal breaks. Their warm appearance and sustainability credentials enhance occupant wellbeing.'
  },
  {
    id: 'timber-flooring',
    strategicValue: 'Timber flooring acts as a carbon sink while providing natural warmth and acoustic comfort. Responsibly sourced timber supports forest regeneration.'
  },
  {
    id: 'timber-joists-floor-cassettes',
    strategicValue: 'Timber floor cassettes enable offsite prefabrication, reducing construction waste by up to 90% while storing carbon throughout the building life.'
  },
  {
    id: 'timber-slat-ceiling',
    strategicValue: 'Timber slat ceilings combine acoustic performance with carbon storage, creating warm, biophilic interiors with minimal environmental impact.'
  },
  {
    id: 'timber-slat-soffit',
    strategicValue: 'Timber slat soffits provide natural warmth and visual interest while contributing to the building carbon sink through responsible timber sourcing.'
  },
  {
    id: 'timber-linings',
    strategicValue: 'Timber wall linings store carbon while creating warm, tactile interior surfaces. Their natural moisture regulation improves indoor air quality.'
  },
  {
    id: 'timber-wall-panels',
    strategicValue: 'Timber wall panels provide natural insulation and acoustic dampening while sequestering carbon. They can be specified with FSC certification for verified sustainability.'
  },
  {
    id: 'timber-rafters-purlins',
    strategicValue: 'Timber roof structures have 5-10x lower embodied carbon than steel alternatives, while storing CO2 captured during tree growth.'
  },
  {
    id: 'timber-stair-carriages',
    strategicValue: 'Timber stair structures combine structural performance with carbon storage, often enabling exposed finishes that showcase sustainable material choices.'
  },
  {
    id: 'timber-wind-bracing',
    strategicValue: 'Timber wind bracing provides lateral stability with minimal embodied carbon, complementing other sustainable structural choices.'
  },
  {
    id: 'timber-pergola-structures',
    strategicValue: 'Timber pergolas create outdoor comfort zones using low-carbon, carbon-storing materials that weather naturally over time.'
  },
  {
    id: 'nlt-structure',
    strategicValue: 'Dowel-laminated and nail-laminated timber structures maximise carbon storage while using simple, reversible connection methods that enable future disassembly.'
  },
  {
    id: 'hybrid-structure',
    strategicValue: 'Hybrid timber-steel structures optimise each material for its strengths, minimising steel use while maximising timber carbon sequestration.'
  },
  {
    id: 'rammed-earth-structure',
    strategicValue: 'Rammed earth construction uses locally sourced subsoil with minimal processing, achieving embodied carbon as low as 20kg CO2/m3 compared to 400+ for conventional concrete.'
  },
  {
    id: 'ggbs-concrete',
    strategicValue: 'Low-carbon concrete with GGBS cement replacement reduces embodied carbon by 50-70% compared to standard mixes while maintaining structural performance.'
  },
  {
    id: 'reclaimed-timber-floor',
    strategicValue: 'Reclaimed timber extends carbon storage indefinitely while eliminating the impact of new harvesting. Its aged character often exceeds that of new-growth timber.'
  },
  {
    id: 'reclaimed-boarding',
    strategicValue: 'Reclaimed timber boarding preserves embodied carbon from previous uses while adding character and provenance to interior spaces.'
  },
  {
    id: 'bamboo-parquet',
    strategicValue: 'Bamboo is the fastest-growing plant on earth, reaching maturity in 3-5 years versus 30+ for hardwoods. Its rapid regrowth cycle makes it highly renewable.'
  },
  {
    id: 'bamboo-slat-wall',
    strategicValue: 'Bamboo acoustic slats combine rapid renewability with excellent acoustic performance, creating sustainable interior finishes.'
  },
  {
    id: 'cork-plank-floor',
    strategicValue: 'Cork is harvested from living trees without felling, making it truly renewable. Its cellular structure provides natural thermal insulation and acoustic dampening.'
  },
  {
    id: 'cork-panels',
    strategicValue: 'Cork wall panels combine renewable harvesting with excellent acoustic and thermal properties, while naturally regulating interior humidity.'
  },
  {
    id: 'lino-floor',
    strategicValue: 'Linoleum is made from linseed oil, wood flour, and natural resins, making it biodegradable at end of life. It hardens and improves with age.'
  },
  {
    id: 'linoleum-tiles',
    strategicValue: 'Linoleum tiles offer natural, biodegradable flooring that continues to cure and harden over its service life, extending durability.'
  },
  {
    id: 'sheep-wool-insulation',
    strategicValue: 'Sheep wool insulation is carbon-negative, requiring minimal processing energy. It naturally regulates humidity, absorbing up to 35% of its weight in moisture.'
  },
  {
    id: 'cellulose-insulation',
    strategicValue: 'Made from 85% recycled newspaper, cellulose insulation diverts waste from landfill while achieving comparable performance to synthetic alternatives.'
  },
  {
    id: 'clay-plaster',
    strategicValue: 'Clay plaster uses minimal processing energy and naturally regulates indoor humidity. It can be recycled indefinitely with no loss of properties.'
  },
  {
    id: 'lime-plaster',
    strategicValue: 'Lime plaster reabsorbs CO2 as it cures through carbonation, partially offsetting production emissions. Its flexibility reduces cracking over time.'
  },
  {
    id: 'tadelakt-plaster',
    strategicValue: 'Tadelakt uses lime plaster techniques that have been refined over centuries, creating waterproof surfaces without synthetic sealers.'
  },
  {
    id: 'acoustic-plaster',
    strategicValue: 'Acoustic plaster combines sound absorption with seamless aesthetics, often using natural binders with lower environmental impact than conventional materials.'
  },
  {
    id: 'bio-fibre-panels',
    strategicValue: 'Bio-based fibre panels use agricultural waste streams, sequestering carbon while providing excellent acoustic and insulation performance.'
  },
  {
    id: 'mycelium-tiles',
    strategicValue: 'Mycelium acoustic tiles are grown from fungal roots on agricultural waste, creating carbon-negative materials that can be composted at end of life.'
  },
  {
    id: 'wool-felt-panels',
    strategicValue: 'Wool felt panels use natural renewable fibres with excellent acoustic properties. They biodegrade at end of life with no harmful residues.'
  },
  {
    id: 'fabric-acoustic-panels',
    strategicValue: 'Fabric acoustic panels can be specified with natural fibres and recycled cores, providing excellent sound absorption with minimal environmental impact.'
  },
  {
    id: 'acoustic-ceiling-baffles',
    strategicValue: 'Acoustic baffles can be specified in natural materials like wool felt or timber, combining sound control with low embodied carbon.'
  },
  {
    id: 'acoustic-tiles-ceiling',
    strategicValue: 'Acoustic ceiling tiles can now be specified with high recycled content and bio-based binders, reducing environmental impact significantly.'
  },
  {
    id: 'acoustic-panels-wall',
    strategicValue: 'Acoustic wall panels combine sound absorption with aesthetic appeal, and can be specified with recycled or natural materials for lower impact.'
  },
  {
    id: 'stretch-fabric-ceiling',
    strategicValue: 'Stretch fabric ceilings enable concealment of services while using minimal material. They can be specified with recycled content fabrics.'
  },
  {
    id: 'coffered-ceiling',
    strategicValue: 'Coffered ceilings can be executed in timber or timber-composite materials, combining architectural impact with carbon storage.'
  },
  {
    id: 'textured-wallpaper',
    strategicValue: 'Natural fibre wallpapers use renewable materials like grasscloth, cork, or paper, providing texture with minimal processing energy.'
  },
  {
    id: 'leather-panels',
    strategicValue: 'Leather panels, particularly from responsibly managed sources, offer durability measured in decades, making them efficient over their full lifecycle.'
  },
  {
    id: 'plywood-panels-wall',
    strategicValue: 'Plywood wall panels combine structural performance with carbon storage. FSC-certified plywood ensures sustainable forest management.'
  },
  {
    id: 'plywood-panels-finish',
    strategicValue: 'Plywood finish panels use thin veneer layers efficiently, providing natural aesthetics while maximising carbon storage per unit of material.'
  },
  {
    id: 'oak-timber-slats',
    strategicValue: 'Oak timber slats provide durability measured in decades while storing carbon. Their natural variation creates unique, characterful interiors.'
  },
  {
    id: 'engineered-oak-floor',
    strategicValue: 'Engineered oak flooring uses a thin hardwood veneer on sustainable core materials, maximising valuable hardwood use while maintaining appearance.'
  },
  {
    id: 'rubber-floor',
    strategicValue: 'Rubber flooring, particularly from recycled tyres, diverts waste while providing excellent durability, acoustic dampening, and slip resistance.'
  },
  {
    id: 'vinyl-planks',
    strategicValue: 'Recycled vinyl planks divert waste plastic from landfill, creating durable, moisture-resistant flooring with take-back recycling options.'
  },
  {
    id: 'recycled-terrazzo',
    strategicValue: 'Recycled plastic terrazzo transforms waste into durable, beautiful flooring. Its seamless installation eliminates maintenance-intensive grout lines.'
  },
  {
    id: 'grey-carpet',
    strategicValue: 'Carpet tiles with high recycled content and take-back programmes enable circular material flows, reducing virgin material demand.'
  },
  {
    id: 'recycled-aluminum-frame',
    strategicValue: 'Recycled aluminium uses only 5% of the energy required for primary production, making it a significantly lower-carbon choice for window frames.'
  },
  {
    id: 'composite-window-frame',
    strategicValue: 'Composite window frames combine recycled materials with excellent thermal performance, often incorporating timber cores for natural insulation.'
  },

  // ============================================
  // HIGH CARBON MATERIALS - Mitigation Tips
  // ============================================
  {
    id: 'steel-frame',
    mitigationTip: 'Specify steel with minimum 85% recycled content from electric arc furnace (EAF) production. Request mill certificates and EPDs showing recycled content.'
  },
  {
    id: 'secondary-steelwork',
    mitigationTip: 'Use high recycled content steel and design for disassembly to enable future reuse. Consider timber alternatives where fire ratings permit.'
  },
  {
    id: 'steel-window-frame',
    mitigationTip: 'Specify steel frames with verified recycled content. Their exceptional durability (100+ years) helps offset higher initial carbon over building lifetime.'
  },
  {
    id: 'steel-purlins',
    mitigationTip: 'Consider timber purlin alternatives where spans permit. When steel is required, specify high recycled content and design for future disassembly.'
  },
  {
    id: 'steel-stair-stringers',
    mitigationTip: 'Consider timber stair alternatives where fire regulations permit. For steel, specify high recycled content and design for bolted connections enabling reuse.'
  },
  {
    id: 'steel-canopy-frames',
    mitigationTip: 'Consider timber canopy alternatives. When steel is necessary, use hollow sections efficiently and specify high recycled content.'
  },
  {
    id: 'cross-bracing-steel',
    mitigationTip: 'Steel bracing should use high recycled content. Consider tension rod systems that minimise material use while maintaining structural performance.'
  },
  {
    id: 'secondary-steel-infill-beams',
    mitigationTip: 'Optimise beam sizing to minimise steel use. Specify EAF steel with high recycled content and design connections for future disassembly.'
  },
  {
    id: 'aluminum-frame',
    mitigationTip: 'Specify post-consumer recycled aluminium (minimum 75%) as recycling uses only 5% of primary production energy. Design for future recycling.'
  },
  {
    id: 'aluminium-cladding',
    mitigationTip: 'Specify post-consumer recycled aluminium content. Design panels for easy removal and ensure take-back arrangements for end-of-life recycling.'
  },
  {
    id: 'concrete-frame',
    mitigationTip: 'Specify GGBS or PFA cement replacement at 50%+ levels to halve embodied carbon. Use recycled aggregate and optimise structural design to reduce volume.'
  },
  {
    id: 'polished-concrete',
    mitigationTip: 'Maximise cement replacement with GGBS (up to 70%) or PFA (up to 35%). Consider local aggregate to reduce transport emissions.'
  },
  {
    id: 'exposed-concrete-soffit',
    mitigationTip: 'Use high cement replacement levels and recycled aggregate. The thermal mass benefits may offset some carbon through reduced operational energy.'
  },
  {
    id: 'precast-concrete-floor-planks',
    mitigationTip: 'Factory production enables higher cement replacement ratios and quality control. Specify 50%+ GGBS and design for modular reuse.'
  },
  {
    id: 'concrete-block-wall',
    mitigationTip: 'Specify blocks with high recycite aggregate content and cement replacement. Consider unfired earth blocks as alternatives where appropriate.'
  },
  {
    id: 'composite-metal-deck-slabs',
    mitigationTip: 'Optimise deck profile to reduce concrete volume. Specify high recycled content steel decking and maximum cement replacement in concrete.'
  },
  {
    id: 'brick-veneer',
    mitigationTip: 'Source bricks from kilns using renewable energy or biomass. Consider reclaimed bricks which can reduce embodied carbon by 80%+.'
  },
  {
    id: 'brick-internal',
    mitigationTip: 'Consider reclaimed bricks or unfired earth alternatives. When new bricks are required, specify from manufacturers using renewable kiln energy.'
  },
  {
    id: 'ceramic-tiles',
    mitigationTip: 'Source tiles from manufacturers using renewable energy and recycled content. Consider locally produced tiles to reduce transport emissions.'
  },
  {
    id: 'porcelain-tiles',
    mitigationTip: 'Porcelain requires higher firing temperatures than ceramic. Specify recycled content and consider whether ceramic alternatives might suit.'
  },
  {
    id: 'terracotta-panels',
    mitigationTip: 'Terracotta is energy-intensive to fire. Source from manufacturers using renewable energy and consider the 60+ year durability in lifecycle assessments.'
  },
  {
    id: 'stone-paver',
    mitigationTip: 'Source stone locally to minimise transport impact. Consider reclaimed stone or specify thinner formats to reduce material volume by up to 75%.'
  },
  {
    id: 'travertine-tiles',
    mitigationTip: 'Travertine requires energy-intensive quarrying and transport. Source regionally where possible and consider honed finishes to reduce processing.'
  },
  {
    id: 'marble-floor',
    mitigationTip: 'Minimise transport emissions by sourcing regionally. Specify honed rather than polished finish to reduce processing energy.'
  },
  {
    id: 'marble-panels',
    mitigationTip: 'Consider thin stone veneer (10-12mm) on honeycomb backing to reduce stone volume by 80% while maintaining appearance.'
  },
  {
    id: 'curtain-wall-system',
    mitigationTip: 'Maximise recycled aluminium content. Optimise glazing ratios to balance daylighting with embodied carbon. Design for disassembly.'
  },
  {
    id: 'curtain-wall-mullions-transoms',
    mitigationTip: 'Specify recycled aluminium for all framing. Consider unitised systems for better quality control and easier end-of-life disassembly.'
  },
  {
    id: 'frameless-glazing',
    mitigationTip: 'Maximise recycled glass content and specify efficient glass processing. Balance visual impact against embodied carbon of large glass panels.'
  },
  {
    id: 'glass-partitions',
    mitigationTip: 'Design partitions for demountability and reuse. Specify recycled glass content and consider whether solid alternatives might suit.'
  },
  {
    id: 'glass-panels-finish',
    mitigationTip: 'Consider whether glass is essential or if alternative materials might achieve similar effects with lower carbon impact.'
  },
  {
    id: 'upvc-window-frame',
    mitigationTip: 'Specify frames with high recycled PVC content and verify end-of-life take-back schemes. Consider timber or composite alternatives.'
  },
  {
    id: 'resin-flooring',
    mitigationTip: 'Consider polished concrete or terrazzo alternatives which may offer longer service life. If resin is required, specify bio-based formulations.'
  },
  {
    id: 'epoxy-flooring',
    mitigationTip: 'Specify bio-based epoxy systems where available. Consider polished concrete or terrazzo alternatives which may offer longer service life.'
  },
  {
    id: 'microcement-floor',
    mitigationTip: 'Microcement uses cement binders with higher carbon impact. Consider polished concrete or clay-based alternatives where suitable.'
  },
  {
    id: 'mineral-microcement',
    mitigationTip: 'Specify microcement with GGBS or pozzolanic additions to reduce cement content. Consider natural plaster alternatives for wall applications.'
  },
  {
    id: 'gypsum-wall',
    mitigationTip: 'Specify boards with high recycled gypsum content (available up to 100%). Design for disassembly to enable material recovery.'
  },
  {
    id: 'gypsum-ceiling',
    mitigationTip: 'Use high recycled content gypsum boards and design for demountability. Consider exposed structure alternatives to eliminate ceiling finishes.'
  },
  {
    id: 'plasterboard-wall',
    mitigationTip: 'Specify boards with maximum recycled gypsum content. Design for demountability to enable future material recovery and recycling.'
  },
  {
    id: 'plasterboard-ceiling',
    mitigationTip: 'Consider whether a ceiling is necessary or if exposed structure might work. When required, use high recycled content boards.'
  },
  {
    id: 'perforated-metal-ceiling',
    mitigationTip: 'Specify high recycled content aluminium or steel. Design panels for easy removal and ensure take-back arrangements for recycling.'
  },
  {
    id: 'perforated-metal-soffit',
    mitigationTip: 'Use recycled aluminium and design for disassembly. Consider whether timber slat alternatives might achieve similar visual effects.'
  },
  {
    id: 'metal-mesh-ceiling',
    mitigationTip: 'Specify high recycled content and ensure panels are designed for removal and recycling. Consider wire diameter optimisation.'
  },
  {
    id: 'metal-mesh-panels',
    mitigationTip: 'Use recycled stainless steel or aluminium mesh. Design fixings for easy removal to enable future material recovery.'
  },
  {
    id: 'open-grid-ceiling',
    mitigationTip: 'Specify recycled aluminium grid systems. Consider whether exposed services might eliminate the need for a ceiling grid.'
  },
  {
    id: 'space-frame-structure',
    mitigationTip: 'Space frames use significant steel. Specify high recycled content, optimise node design to minimise material, and design for disassembly.'
  },
  {
    id: 'raised-access-floor-systems',
    mitigationTip: 'Consider whether raised floors are essential. When required, specify recycled steel pedestals and high recycled content panels.'
  },
  {
    id: 'secondary-trusses',
    mitigationTip: 'Consider timber truss alternatives where fire regulations permit. For steel, optimise profiles and specify high recycled content.'
  },
  {
    id: 'lightweight-space-frame-infill',
    mitigationTip: 'Minimise member sizes through structural optimisation. Specify high recycled content and design connections for future disassembly.'
  },
  {
    id: 'edge-beams',
    mitigationTip: 'Optimise beam design to minimise steel use. Consider composite or timber alternatives where structural requirements permit.'
  },
  {
    id: 'spandrel-beams',
    mitigationTip: 'Design spandrels for structural efficiency. Specify high recycled content steel and consider exposed finishes to eliminate cladding.'
  },
  {
    id: 'ring-beams',
    mitigationTip: 'Optimise ring beam sections for structural efficiency. Consider concrete alternatives with high cement replacement where appropriate.'
  },
  {
    id: 'secondary-lintels',
    mitigationTip: 'Consider timber or concrete lintels as alternatives. When steel is required, specify from stockholders with verified recycled content.'
  },
  {
    id: 'masonry-shelf-angles',
    mitigationTip: 'Optimise bracket spacing to minimise steel use. Specify galvanised rather than stainless to reduce embodied carbon.'
  },
  {
    id: 'k-x-bracing-secondary',
    mitigationTip: 'Optimise bracing configuration to minimise steel use. Specify high recycled content and design bolted connections for reuse.'
  },
  {
    id: 'diaphragm-bracing-elements',
    mitigationTip: 'Consider plywood or CLT diaphragms as alternatives. When steel is required, optimise gauge thickness for structural efficiency.'
  },
  {
    id: 'secondary-shear-panels',
    mitigationTip: 'Consider timber or plywood shear panels as lower-carbon alternatives. Ensure any steel panels use high recycled content.'
  },
  {
    id: 'stair-landings-trimmers',
    mitigationTip: 'Consider timber or CLT stair construction where regulations permit. For steel, specify high recycled content and bolted connections.'
  },
  {
    id: 'cantilevered-stair-treads',
    mitigationTip: 'Optimise steel sections for structural efficiency. Consider timber or stone treads supported on steel stringers as alternatives.'
  },
  {
    id: 'facade-support-rails',
    mitigationTip: 'Optimise rail spacing to minimise material use. Specify recycled aluminium and design for disassembly to enable cladding reuse.'
  },
  {
    id: 'rainscreen-carrier-systems',
    mitigationTip: 'Consider timber battens as alternatives for some cladding types. When aluminium is required, specify high recycled content.'
  },
  {
    id: 'secondary-facade-brackets',
    mitigationTip: 'Optimise bracket design for material efficiency. Specify recycled content and design for disassembly to enable cladding reuse.'
  },
  {
    id: 'balcony-support-beams',
    mitigationTip: 'Consider timber or CLT balcony structures where appropriate. For steel, specify high recycled content and corrosion protection.'
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
    const contentType = update.strategicValue ? 'strategicValue' : 'mitigationTip';
    console.log(`Updated ${update.id}: ${contentType} added`);
    return true;
  } catch (error) {
    console.error(`Error updating ${update.id}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Starting sustainability content update...');
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
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`Update complete!`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

main().catch(console.error);
