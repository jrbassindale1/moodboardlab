import { MaterialOption, ProjectImage, SpecSection } from './types';
import moodboardMain from './images/moodboard-2.webp';
import moodboardAlt1 from './images/moodboard-4.webp';
import moodboardAlt2 from './images/moodboard-5.webp';
import moodboardAlt3 from './images/moodboard-6.webp';
import moodboardAlt4 from './images/moodboard.webp';

export const MATERIAL_BASE_IMAGE = moodboardMain;
export const STRUCTURE_BASE_IMAGES: Record<string, string> = {
  'steel-frame': moodboardMain,
  'glulam-structure': moodboardAlt1,
  'concrete-frame': moodboardAlt2,
  'hybrid-structure': moodboardAlt3
};
const contextImage = moodboardMain;

export const SUSTAINABILITY_PYRAMID = [
  {
    id: 'avoid',
    title: 'Avoid & Reduce',
    guidance: 'Eliminate unnecessary materials, reduce quantities, and prioritize passive design moves before adding new products.'
  },
  {
    id: 'reuse',
    title: 'Re-use & Circular',
    guidance: 'Prefer reclaimed, remanufactured, or recycled materials and design for disassembly and future reuse.'
  },
  {
    id: 'renewable',
    title: 'Renewable & Bio-based',
    guidance: 'Choose rapidly renewable, bio-based materials (timber, cork, hemp) with transparent sourcing and responsible forestry.'
  },
  {
    id: 'lowcarbon',
    title: 'Low-Carbon Conventional',
    guidance: 'When conventional materials are needed, pick low-carbon mixes, recycled content, and verified EPD-backed products.'
  },
  {
    id: 'offset',
    title: 'Offset & Compensate',
    guidance: 'As a last step, account for residual impacts with credible offsets; focus first on reduction and substitution.'
  }
];

export const PROJECT_IMAGES: ProjectImage[] = [
  {
    id: 'concept-board',
    url: moodboardMain,
    title: 'Concept Moodboard',
    description: 'Primary board showing the baseline palette and lighting tone for the workspace.',
    category: 'Render'
  },
  {
    id: 'contrast-study',
    url: moodboardAlt1,
    title: 'Contrast & Materiality',
    description: 'A study balancing warm timber textures with cooler metal accents.',
    category: 'Render'
  },
  {
    id: 'facade-tone',
    url: moodboardAlt2,
    title: 'Facade Tone',
    description: 'Exterior-leaning palette exploring neutral renders and daylight behaviour.',
    category: 'Render'
  },
  {
    id: 'texture-stack',
    url: moodboardAlt3,
    title: 'Texture Stack',
    description: 'Layered swatches focusing on grain, textile, and aggregate interplay.',
    category: 'Render'
  },
  {
    id: 'palette-overview',
    url: moodboardAlt4,
    title: 'Palette Overview',
    description: 'Quick overview of the palette in a clean board layout for handoff.',
    category: 'Render'
  }
];

export const BUILDING_SPECS: SpecSection[] = [
  {
    title: 'Social Learning Landscapes',
    content: 'The building is conceived not just as a container for instruction but as a social landscape. The central "street" acts as the community heart, fostering serendipitous encounters and interdisciplinary collaboration. Circulation areas are generous and inhabited, doubling as breakout and informal study zones.',
    image: moodboardAlt1,
    imageAlt: 'Moodboard showing layered materials and social spaces.'
  },
  {
    title: 'Environmental Intelligence',
    content: 'The architectural form drives environmental performance. The central atrium facilitates a natural ventilation strategy, utilizing the stack effect to draw air through the building. Exposed thermal mass (concrete soffits) helps regulate internal temperatures, reducing reliance on mechanical systems.',
    image: moodboardAlt2,
    imageAlt: 'Palette focused on daylighting and neutral tones.'
  },
  {
    title: 'Long Life, Loose Fit',
    content: 'A robust structural grid ensures long-term adaptability. The plan is organized into "hard" zones (cores and fixed labs) and "soft" zones (partitionable classrooms and offices), allowing the building to evolve with changing pedagogical needs over decades.',
    image: moodboardAlt3,
    imageAlt: 'Material stack highlighting adaptable finishes.'
  },
  {
    title: 'Visual Connectivity',
    content: 'Transparency is key to the "science on display" concept. Extensive internal glazing connects laboratories and teaching spaces to the central street, demystifying the engineering process and allowing natural light to penetrate deep into the plan.',
    image: moodboardAlt4,
    imageAlt: 'Board capturing visual links between spaces.'
  },
  {
    title: 'Material Integrity',
    content: 'A palette of honest, self-finished materials—exposed concrete, timber linings, and steel—is selected for durability and low maintenance. Acoustic attenuation is integrated into the architectural fabric (e.g., timber slats) rather than applied as secondary finishes.',
    image: moodboardMain,
    imageAlt: 'Palette with balanced timber, concrete, and metal tones.'
  }
];

export const MATERIAL_PALETTE: MaterialOption[] = [
  {
    id: 'steel-frame',
    name: 'Steel Frame (Painted)',
    tone: '#d9d9d9',
    finish: 'Painted steel — select colour',
    description:
      'Exposed steel beams and columns with expressed joints. Finish: painted steel — select colour (white / charcoal / oxide red / custom RAL).',
    keywords: ['steel', 'painted', 'expressed joints'],
    category: 'structure',
    supportsColor: true,
    carbonIntensity: 'high'
  },
  {
    id: 'glulam-structure',
    name: 'Glulam Timber Structure',
    tone: '#c49a6c',
    finish: 'Glulam timber beams and posts',
    description:
      'Laminated timber beams and posts forming a renewable, visually warm structural system with long-span capability.',
    keywords: ['timber', 'glulam', 'warm'],
    category: 'structure',
    carbonIntensity: 'low'
  },
  {
    id: 'concrete-frame',
    name: 'Reinforced Concrete Frame',
    tone: '#b8b8b8',
    finish: 'Cast-in-place concrete',
    description:
      'Cast-in-place concrete slabs and columns with exposed soffits providing thermal mass and long-term durability.',
    keywords: ['concrete', 'soffit', 'durability'],
    category: 'structure',
    carbonIntensity: 'high'
  },
  {
    id: 'hybrid-structure',
    name: 'Hybrid Timber-Steel',
    tone: '#a0a0a0',
    finish: 'Hybrid timber + steel',
    description:
      'Composite structure with timber beams on steel columns for reduced embodied carbon and efficient spans.',
    keywords: ['hybrid', 'timber', 'steel'],
    category: 'structure',
    carbonIntensity: 'low'
  },
  {
    id: 'clt-structure',
    name: 'Cross-Laminated Timber',
    tone: '#c8a072',
    finish: 'FSC CLT panels',
    description:
      'Mass timber CLT slabs and walls, prefabricated for rapid build, carbon storage, and excellent airtightness.',
    keywords: ['timber', 'clt', 'mass timber', 'low carbon'],
    category: 'structure',
    carbonIntensity: 'low'
  },
  {
    id: 'nlt-structure',
    name: 'DLT / NLT Timber',
    tone: '#c59a6a',
    finish: 'Dowel/nail-laminated timber',
    description:
      'Dowel- or nail-laminated timber decks using solid softwood; glue-free, demountable, and fully bio-based.',
    keywords: ['timber', 'dlt', 'nlt', 'bio-based'],
    category: 'structure',
    carbonIntensity: 'low'
  },
  {
    id: 'ggbs-concrete',
    name: 'Low-Carbon Concrete',
    tone: '#b1b1ac',
    finish: 'GGBS/slag concrete mix',
    description:
      'Concrete with high GGBS/slag replacement to cut embodied carbon; suitable for exposed soffits and thermal mass.',
    keywords: ['concrete', 'ggbs', 'low carbon'],
    category: 'structure',
    carbonIntensity: 'low'
  },
  {
    id: 'rammed-earth-structure',
    name: 'Rammed Earth Walls',
    tone: '#b58c63',
    finish: 'Stabilised rammed earth',
    description:
      'Compacted earth walls with minimal cement stabiliser; massive, carbon-light structure with natural thermal mass.',
    keywords: ['rammed earth', 'bio-based', 'low carbon'],
    category: 'structure',
    carbonIntensity: 'low',
    colorOptions: [
      { label: 'Natural Ochre', tone: '#b58c63' },
      { label: 'Warm Sand', tone: '#c8a984' },
      { label: 'Deep Clay', tone: '#8f623f' }
    ]
  },
  {
    id: 'polished-concrete',
    name: 'Polished Concrete',
    tone: '#c8c3b8',
    finish: 'Polished concrete slab',
    description:
      'Ground, sealed concrete slab with subtle aggregate exposure; durable and low-maintenance.',
    keywords: ['floor', 'polished', 'aggregate'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'lino-floor',
    name: 'Linoleum Flooring',
    tone: '#d2d5d2',
    finish: 'Natural lino sheet',
    description:
      'Natural linoleum sheet with a subtle mottled grain; resilient, low-maintenance, and comfortable underfoot.',
    keywords: ['linoleum', 'resilient', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'recycled-terrazzo',
    name: 'Recycled Plastic Terrazzo',
    tone: '#7fa59f',
    finish: 'Composite terrazzo with plastic fragments',
    description:
      'Composite terrazzo incorporating post-consumer plastic fragments; a colourful, low-carbon alternative.',
    keywords: ['terrazzo', 'recycled', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'rubber-floor',
    name: 'Rubber Flooring',
    tone: '#4c4c50',
    finish: 'Recycled rubber sheet',
    description: 'Durable recycled rubber floor with high slip resistance and impact absorption.',
    keywords: ['rubber', 'recycled', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'timber-flooring',
    name: 'Timber Flooring',
    tone: '#d8b185',
    finish: 'Engineered timber boards',
    description:
      'Engineered timber boards with a light natural finish, offering warmth and acoustic softness.',
    keywords: ['timber', 'flooring', 'warm'],
    category: 'floor',
    carbonIntensity: 'low',
    colorOptions: [
      { label: 'Natural Oak', tone: '#d8b185' },
      { label: 'Pale Ash', tone: '#e5d5be' },
      { label: 'Smoked Oak', tone: '#8a6b4f' }
    ]
  },
  {
    id: 'grey-carpet',
    name: 'Grey Carpet Tiles',
    tone: '#9a9a9f',
    finish: 'Modular low-pile tiles',
    description:
      'Modular low-pile tiles in mid-grey, providing acoustic comfort and easy replacement for high-traffic learning environments.',
    keywords: ['carpet', 'acoustic', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'bamboo-parquet',
    name: 'Bamboo Parquet',
    tone: '#c9a26d',
    finish: 'Strand-woven bamboo blocks',
    description:
      'Rapidly renewable bamboo parquet with hardwearing strand-woven construction; FSC/PEFC certified supply.',
    keywords: ['bamboo', 'renewable', 'floor'],
    category: 'floor',
    carbonIntensity: 'low',
    colorOptions: [
      { label: 'Natural', tone: '#caa36e' },
      { label: 'Carbonised', tone: '#b08451' },
      { label: 'Espresso', tone: '#7a5635' }
    ]
  },
  {
    id: 'cork-plank-floor',
    name: 'Cork Plank Flooring',
    tone: '#b99664',
    finish: 'Oiled cork planks',
    description:
      'Bio-based cork planks with natural binder; warm underfoot, acoustic damping, and carbon negative sourcing.',
    keywords: ['cork', 'bio-based', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'reclaimed-timber-floor',
    name: 'Reclaimed Timber Floor',
    tone: '#b1885f',
    finish: 'Reclaimed oak/softwood boards',
    description:
      'Reclaimed timber boards with visible character marks; circular option with minimal new material demand.',
    keywords: ['reclaimed', 'timber', 'circular'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'stone-paver',
    name: 'Stone Pavers',
    tone: '#b6b3ac',
    finish: 'Honed stone tiles',
    description: 'Honed natural stone tiles for circulation zones with durable finish.',
    keywords: ['stone', 'paver', 'floor'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'aluminum-frame',
    name: 'Aluminum Window Frame',
    tone: '#c0c6cf',
    finish: 'Thermally broken aluminum',
    description: 'Slim thermally-broken aluminum frames with durable powder coat.',
    keywords: ['window', 'aluminum', 'frame'],
    category: 'window',
    carbonIntensity: 'high'
  },
  {
    id: 'timber-frame',
    name: 'Timber Window Frame',
    tone: '#caa57c',
    finish: 'Timber alu-clad',
    description: 'Alu-clad timber frames combining warmth inside and weathering outside.',
    keywords: ['window', 'timber', 'alu-clad'],
    category: 'window',
    carbonIntensity: 'low'
  },
  {
    id: 'recycled-aluminum-frame',
    name: 'Recycled Aluminum Frame',
    tone: '#b8c0c8',
    finish: 'High-recycled-content aluminum',
    description:
      'Thermally broken aluminum frames using 75%+ recycled billet with durable powder coat.',
    keywords: ['window', 'aluminum', 'recycled'],
    category: 'window',
    carbonIntensity: 'low'
  },
  {
    id: 'clay-plaster',
    name: 'Clay Plaster',
    tone: '#d6c0a6',
    finish: 'Natural clay plaster',
    description: 'Breathable clay plaster for walls; warm tone and moisture buffering.',
    keywords: ['wall', 'clay', 'breathable'],
    category: 'wall-internal',
    treePaths: ['Internal>Walls', 'Internal>Plaster / Microcement']
  },
  {
    id: 'gypsum-wall',
    name: 'Gypsum Board Wall',
    tone: '#e6e6e6',
    finish: 'Painted gypsum board',
    description: 'Standard gypsum board walls with low-VOC paint for clean interiors.',
    keywords: ['wall', 'gypsum', 'paint'],
    category: 'wall-internal',
    treePaths: ['Internal>Walls']
  },
  {
    id: 'mineral-microcement',
    name: 'Mineral Microcement',
    tone: '#d5d0c7',
    finish: 'Seamless mineral microcement',
    description: 'Thin-coat mineral microcement for walls and floors; seamless, tactile, and hard-wearing.',
    keywords: ['microcement', 'seamless', 'plaster'],
    category: 'microcement',
    treePaths: ['Internal>Plaster / Microcement']
  },
  {
    id: 'standard-wall-paint',
    name: 'Paint – Standard (Walls)',
    tone: '#f1f1f1',
    finish: 'Low-VOC emulsion',
    description: 'Standard neutral wall paint with low VOC content; pair with the finish selector.',
    keywords: ['paint', 'walls', 'standard'],
    category: 'paint-wall',
    supportsColor: true,
    finishOptions: ['Matte', 'Satin', 'Gloss'],
    treePaths: ['Internal>Paint – Standard']
  },
  {
    id: 'custom-wall-paint',
    name: 'Paint – Custom Colour (Walls)',
    tone: '#e8e8e8',
    finish: 'Custom emulsion colour',
    description: 'Pick any HEX/RGB colour for walls and choose matte, satin, or gloss finish.',
    keywords: ['paint', 'walls', 'custom colour'],
    category: 'paint-wall',
    supportsColor: true,
    finishOptions: ['Matte', 'Satin', 'Gloss'],
    treePaths: ['Internal>Paint – Custom Colour']
  },
  {
    id: 'standard-ceiling-paint',
    name: 'Paint – Standard (Ceilings)',
    tone: '#f6f6f6',
    finish: 'Breathable ceiling paint',
    description: 'Bright ceiling paint optimised for light reflectance with selectable finish.',
    keywords: ['paint', 'ceiling', 'standard'],
    category: 'paint-ceiling',
    supportsColor: true,
    finishOptions: ['Matte', 'Satin', 'Gloss'],
    treePaths: ['Internal>Paint – Standard', 'Internal>Ceilings']
  },
  {
    id: 'custom-ceiling-paint',
    name: 'Paint – Custom Colour (Ceilings)',
    tone: '#eeeeee',
    finish: 'Custom ceiling paint colour',
    description: 'Define a custom HEX/RGB colour for ceilings with matte, satin, or gloss finish.',
    keywords: ['paint', 'ceiling', 'custom'],
    category: 'paint-ceiling',
    supportsColor: true,
    finishOptions: ['Matte', 'Satin', 'Gloss'],
    treePaths: ['Internal>Paint – Custom Colour', 'Internal>Ceilings']
  },
  {
    id: 'brick-veneer',
    name: 'Brick',
    tone: '#b04f3a',
    finish: 'Facing brick',
    description:
      'Facing brick. Available in charcoal, deep brown, classic reds, warm oranges, buff/sand, light cream tones, and reclaimed mixed batches for contextual tuning.',
    keywords: ['brick', 'wall', 'colour options', 'reclaimed'],
    category: 'external',
    carbonIntensity: 'high',
    colorOptions: [
      { label: 'Charcoal', tone: '#3d3835' },
      { label: 'Dark Brown', tone: '#5c3e30' },
      { label: 'Rich Red', tone: '#8f3c2f' },
      { label: 'Heritage Red', tone: '#a24431' },
      { label: 'Terracotta', tone: '#c35a35' },
      { label: 'Burnt Orange', tone: '#d46b3c' },
      { label: 'Warm Buff', tone: '#c29b74' },
      { label: 'Sand', tone: '#d8b98d' },
      { label: 'Pale Cream', tone: '#e6d4b8' },
      { label: 'Light Grey', tone: '#b6b1a9' },
      { label: 'Reclaimed Mix', tone: '#8c6a52' }
    ]
  },
  {
    id: 'hemp-lime-wall',
    name: 'Hemp-Lime Wall',
    tone: '#c8c2aa',
    finish: 'Hemp-lime cast in place',
    description: 'Bio-based hemp-lime wall build-up offering carbon storage and vapor openness.',
    keywords: ['hemp', 'lime', 'bio-based'],
    category: 'external',
    carbonIntensity: 'low'
  },
  {
    id: 'terracotta-wall',
    name: 'Terracotta Panels (Wall)',
    tone: '#d36944',
    finish: 'Pressed terracotta tiles — multiple tones',
    description:
      'Pressed terracotta tiles on ventilated rails; durable, colour-stable, and low maintenance. Palette spans charcoal, greys, taupe, sand, sage/blue, ochre, ivory, and rich red/orange tones.',
    keywords: ['terracotta', 'cladding', 'tactile', 'colour options', 'rainscreen'],
    category: 'external',
    carbonIntensity: 'high',
    colorOptions: [
      { label: 'Charcoal', tone: '#3f3b38' },
      { label: 'Iron Grey', tone: '#5e5a55' },
      { label: 'Warm Taupe', tone: '#7d7365' },
      { label: 'Sandstone', tone: '#c3ab87' },
      { label: 'Sage Blue', tone: '#8ea59b' },
      { label: 'Ochre Yellow', tone: '#d4a74f' },
      { label: 'Ivory', tone: '#e7dec5' },
      { label: 'Deep Red', tone: '#a43429' },
      { label: 'Brick Red', tone: '#b44731' },
      { label: 'Terracotta Orange', tone: '#c85b36' },
      { label: 'Burnt Sienna', tone: '#d46b3d' },
      { label: 'Clay Peach', tone: '#e19a62' }
    ]
  },
  {
    id: 'green-wall',
    name: 'Living Green Wall',
    tone: '#5e8c5a',
    finish: 'Planted living wall system',
    description:
      'Modular living wall with integrated irrigation and planting pockets for dense greenery, biodiversity, and cooling.',
    keywords: ['green wall', 'living wall', 'biophilic', 'vertical garden'],
    category: 'external',
    carbonIntensity: 'low'
  },
  {
    id: 'stone-rainscreen',
    name: 'Stone Rainscreen',
    tone: '#b7babf',
    finish: 'Ventilated stone cladding',
    description: 'Ventilated stone rainscreen on rails; durable and demountable.',
    keywords: ['stone', 'rainscreen', 'exterior'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'charred-timber-cladding',
    name: 'Charred Timber Cladding',
    tone: '#2a2420',
    finish: 'Charred FSC timber boards',
    description:
      'Shou Sugi Ban-inspired charred FSC timber rainscreen for durable, low-maintenance weather protection without petrochemical coatings.',
    keywords: ['timber', 'charred', 'rainscreen', 'low maintenance'],
    category: 'external',
    carbonIntensity: 'low',
    colorOptions: [
      { label: 'Deep Charred', tone: '#1c1917' },
      { label: 'Warm Ember', tone: '#3c2f29' },
      { label: 'Cedar Brown', tone: '#6b4b34' }
    ]
  },
  {
    id: 'timber-rainscreen-larch',
    name: 'Timber Rainscreen (FSC Larch)',
    tone: '#d3b186',
    finish: 'FSC larch rainscreen — natural/oiled/silvered',
    description:
      'Open-jointed FSC larch or cedar battens with ventilated cavity; bio-based, lightweight, and designed to weather evenly.',
    keywords: ['timber', 'rainscreen', 'bio-based'],
    category: 'external',
    carbonIntensity: 'low',
    colorOptions: [
      { label: 'Fresh Larch', tone: '#d7b88d' },
      { label: 'Oiled Cedar', tone: '#b57f52' },
      { label: 'Weathered Silver', tone: '#b0aaa0' }
    ]
  },
  {
    id: 'woodfibre-render',
    name: 'Wood-Fibre + Lime Render',
    tone: '#dcd5c7',
    finish: 'Wood-fibre insulation with lime/mineral render',
    description:
      'Bio-based wood-fibre insulation boards with vapour-open lime render; strong thermal performance and low embodied carbon.',
    keywords: ['wood fibre', 'lime render', 'bio-based', 'insulated render'],
    category: 'external',
    carbonIntensity: 'low'
  },
  {
    id: 'acoustic-ceiling-baffles',
    name: 'Acoustic Ceiling Baffles',
    tone: '#cdd3d8',
    finish: 'Fabric-wrapped baffles',
    description: 'Suspended acoustic baffles for noise control and visual rhythm.',
    keywords: ['ceiling', 'acoustic', 'baffles'],
    category: 'ceiling',
    carbonIntensity: 'low'
  },
  {
    id: 'perforated-metal-ceiling',
    name: 'Perforated Metal Ceiling',
    tone: '#c5c9d0',
    finish: 'Perforated metal with acoustic backing',
    description: 'Perforated metal ceiling panels with acoustic fleece for diffusion.',
    keywords: ['ceiling', 'metal', 'perforated'],
    category: 'ceiling',
    carbonIntensity: 'high'
  },
  {
    id: 'timber-slat-ceiling',
    name: 'Timber Slat Ceiling',
    tone: '#d1a06d',
    finish: 'Timber slat ceiling',
    description: 'Linear timber slats with acoustic insulation behind for warmth overhead.',
    keywords: ['ceiling', 'timber', 'acoustic'],
    category: 'ceiling',
    carbonIntensity: 'low'
  },
  {
    id: 'gypsum-ceiling',
    name: 'Gypsum Ceiling',
    tone: '#e7e7e7',
    finish: 'Flush gypsum board',
    description: 'Smooth painted gypsum ceiling with recessed lighting provisions.',
    keywords: ['ceiling', 'gypsum', 'flush'],
    category: 'ceiling',
    carbonIntensity: 'high'
  },
  {
    id: 'open-grid-ceiling',
    name: 'Open Grid Ceiling',
    tone: '#d0d5d9',
    finish: 'Open cell metal grid',
    description: 'Open cell metal grid ceiling for services access and visual depth.',
    keywords: ['ceiling', 'open cell', 'services'],
    category: 'ceiling',
    carbonIntensity: 'high'
  },
  {
    id: 'exposed-concrete-soffit',
    name: 'Exposed Concrete Soffit',
    tone: '#bcb7ae',
    finish: 'Sealed exposed concrete soffit',
    description:
      'Exposed concrete soffit with a light sandblast and clear sealer to celebrate structure and thermal mass.',
    keywords: ['soffit', 'concrete', 'thermal mass'],
    category: 'soffit',
    carbonIntensity: 'high'
  },
  {
    id: 'timber-slat-soffit',
    name: 'Timber Slat Soffit',
    tone: '#c99e6c',
    finish: 'Timber slats on acoustic backing',
    description:
      'Linear timber slats on a dark acoustic backing to soften reverberation while keeping services accessible.',
    keywords: ['soffit', 'timber', 'acoustic'],
    category: 'soffit',
    carbonIntensity: 'low'
  },
  {
    id: 'perforated-metal-soffit',
    name: 'Perforated Metal Soffit',
    tone: '#c5c9cf',
    finish: 'Micro-perforated metal panels',
    description:
      'Micro-perforated metal soffit panels with acoustic fleece and crisp shadow gaps for a technical expression.',
    keywords: ['soffit', 'metal', 'perforated'],
    category: 'soffit',
    carbonIntensity: 'high'
  },
  {
    id: 'timber-linings',
    name: 'Timber Linings',
    tone: '#c79b6f',
    finish: 'Rift-sawn oak or FSC softwood slats',
    description:
      'Rift-sawn oak or FSC-certified softwood slats providing integrated acoustic performance and natural warmth.',
    keywords: ['timber', 'acoustic', 'slats'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'terracotta-panels',
    name: 'Terracotta Panels',
    tone: '#d36944',
    finish: 'Pressed terracotta panels — multiple clay/mineral tones',
    description:
      'Pressed terracotta used as internal accent or external rainscreen; durable, colour-stable, and low maintenance. Palette spans charcoal, greys, taupe, sand, sage/blue, ochre, ivory, and rich red/orange tones.',
    keywords: ['terracotta', 'cladding', 'tactile', 'colour options', 'rainscreen'],
    category: 'external',
    carbonIntensity: 'high',
    colorOptions: [
      { label: 'Charcoal', tone: '#3f3b38' },
      { label: 'Iron Grey', tone: '#5e5a55' },
      { label: 'Warm Taupe', tone: '#7d7365' },
      { label: 'Sandstone', tone: '#c3ab87' },
      { label: 'Sage Blue', tone: '#8ea59b' },
      { label: 'Ochre Yellow', tone: '#d4a74f' },
      { label: 'Ivory', tone: '#e7dec5' },
      { label: 'Deep Red', tone: '#a43429' },
      { label: 'Brick Red', tone: '#b44731' },
      { label: 'Terracotta Orange', tone: '#c85b36' },
      { label: 'Burnt Sienna', tone: '#d46b3d' },
      { label: 'Clay Peach', tone: '#e19a62' }
    ]
  },
  {
    id: 'bio-fibre-panels',
    name: 'Bio-Based Fibre Panels',
    tone: '#9fb49f',
    finish: 'Hemp/flax/agri-fibre acoustic panels',
    description:
      'Acoustic and wall-lining panels made from hemp, flax, or agricultural fibre waste. Soft texture, excellent acoustics, very low embodied carbon.',
    keywords: ['bio-based', 'acoustic', 'low carbon'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'timber-wall-panels',
    name: 'Timber Wall Panels',
    tone: '#c5a171',
    finish: 'Oak-faced acoustic panels',
    description: 'Prefinished oak-faced panels with integrated acoustic fleece; ideal for walls and joinery fronts.',
    keywords: ['timber', 'panel', 'acoustic'],
    category: 'timber-panel',
    treePaths: ['Internal>Timber Panels', 'Internal>Joinery & Furniture'],
    carbonIntensity: 'low'
  },
  {
    id: 'porcelain-tiles',
    name: 'Large-Format Tiles',
    tone: '#cfcac3',
    finish: 'Large-format porcelain tiles',
    description: 'Durable porcelain tiles with low water absorption; suitable for wet zones and feature walls.',
    keywords: ['tile', 'porcelain', 'internal'],
    category: 'tile',
    treePaths: ['Internal>Tiles'],
    carbonIntensity: 'high'
  },
  {
    id: 'textured-wallpaper',
    name: 'Textured Wallpaper',
    tone: '#d9d3c8',
    finish: 'Natural fibre textured wallpaper',
    description: 'Grasscloth-inspired wallpaper adding warmth and texture to feature walls.',
    keywords: ['wallpaper', 'feature wall', 'texture'],
    category: 'wallpaper',
    treePaths: ['Internal>Wallpaper'],
    carbonIntensity: 'low'
  },
  {
    id: 'fabric-acoustic-panels',
    name: 'Fabric Acoustic Panels',
    tone: '#cfd2d6',
    finish: 'Fabric-wrapped acoustic panels',
    description: 'High NRC fabric panels for walls; demountable and available in wide colour range.',
    keywords: ['acoustic', 'panels', 'fabric'],
    category: 'acoustic-panel',
    treePaths: ['Internal>Acoustic Panels'],
    carbonIntensity: 'low'
  },
  {
    id: 'oak-timber-slats',
    name: 'Oak Timber Slats',
    tone: '#c19967',
    finish: 'Solid oak slatted lining',
    description: 'Solid oak slats on acoustic backing for ceilings or walls; warm tone with rhythm.',
    keywords: ['timber', 'slats', 'acoustic'],
    category: 'timber-slat',
    treePaths: ['Internal>Timber Slats', 'Internal>Ceilings'],
    carbonIntensity: 'low'
  },
  {
    id: 'cork-panels',
    name: 'Cork Wall Panels',
    tone: '#b08a5a',
    finish: 'Natural cork tiles or sheets',
    description:
      'Natural cork tiles or sheets providing acoustic absorption, tactile warmth, and renewable material sourcing.',
    keywords: ['cork', 'acoustic', 'renewable'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'reclaimed-boarding',
    name: 'Reclaimed Timber Boarding',
    tone: '#a77a52',
    finish: 'Upcycled timber cladding',
    description:
      'Upcycled timber cladding with visible grain and weathering; ideal for feature walls and sustainable story-telling.',
    keywords: ['reclaimed', 'timber', 'circular'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'mycelium-tiles',
    name: 'Mycelium Acoustic Tiles',
    tone: '#e5dfcf',
    finish: 'Grown mycelium acoustic tiles',
    description:
      'Compostable mycelium tiles grown on agricultural waste; high acoustic absorption with minimal embodied carbon.',
    keywords: ['mycelium', 'bio-based', 'acoustic'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'wool-felt-panels',
    name: 'Wool Felt Wall Panels',
    tone: '#c4c5bc',
    finish: 'Undyed wool felt panels',
    description:
      'Renewable wool felt panels with low VOC binders; moisture buffering and strong acoustic performance.',
    keywords: ['wool', 'acoustic', 'renewable'],
    category: 'finish',
    carbonIntensity: 'low',
    colorOptions: [
      { label: 'Undyed', tone: '#c4c5bc' },
      { label: 'Charcoal', tone: '#565656' },
      { label: 'Moss', tone: '#7a8a6a' }
    ]
  },
  {
    id: 'bamboo-slat-wall',
    name: 'Bamboo Acoustic Slats',
    tone: '#c6a26d',
    finish: 'Bamboo slats on acoustic backing',
    description:
      'Rapidly renewable bamboo slats on black acoustic felt for controlled reverberation and warm tone.',
    keywords: ['bamboo', 'acoustic', 'renewable'],
    category: 'finish',
    carbonIntensity: 'low',
    colorOptions: [
      { label: 'Natural', tone: '#c6a26d' },
      { label: 'Caramel', tone: '#b2824b' },
      { label: 'Espresso', tone: '#6f4b31' }
    ]
  },
  {
    id: 'secondary-steelwork',
    name: 'Secondary Steelwork',
    tone: '#c3c7cc',
    finish: 'Painted secondary framing',
    description: 'Secondary steel framing, balustrades, and mezzanine members supporting the primary grid.',
    keywords: ['secondary', 'structure', 'steel'],
    category: 'structure',
    treePaths: ['Structure>Secondary Structure', 'Internal>Exposed Structure'],
    carbonIntensity: 'high'
  },
  {
    id: 'permeable-paving',
    name: 'Permeable Paving',
    tone: '#a7a9a2',
    finish: 'Permeable concrete/stone blocks',
    description: 'Permeable block paving for SuDS-compliant external areas with granular sub-base.',
    keywords: ['landscape', 'paving', 'suds'],
    category: 'landscape',
    treePaths: ['External>External Ground / Landscaping'],
    carbonIntensity: 'low'
  },
  {
    id: 'joinery-built-in',
    name: 'Built-in Joinery',
    tone: '#cfa87b',
    finish: 'Birch plywood joinery',
    description: 'Birch plywood joinery elements with clear matte lacquer; integrated shelving and benches.',
    keywords: ['joinery', 'furniture', 'birch'],
    category: 'joinery',
    treePaths: ['Internal>Joinery & Furniture'],
    carbonIntensity: 'low'
  },
  {
    id: 'brass-fixtures',
    name: 'Brass Fixtures & Fittings',
    tone: '#c6a766',
    finish: 'Satin brass fixtures',
    description: 'Satin brass hardware and fittings for door sets, taps, and feature lighting.',
    keywords: ['fixtures', 'brass', 'hardware'],
    category: 'fixture',
    treePaths: ['Internal>Fixtures & Fittings'],
    carbonIntensity: 'high'
  },
  {
    id: 'standing-seam-roof',
    name: 'Standing Seam Metal Roof',
    tone: '#9aa0a8',
    finish: 'Zinc/steel standing seam',
    description: 'Slim standing seam zinc/steel roof with long life and recyclability.',
    keywords: ['roof', 'metal', 'standing seam'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'green-roof',
    name: 'Green Roof',
    tone: '#7fa878',
    finish: 'Extensive green roof',
    description: 'Lightweight sedum green roof for biodiversity, stormwater, and cooling.',
    keywords: ['roof', 'green', 'biodiversity'],
    category: 'roof',
    carbonIntensity: 'low'
  },
  {
    id: 'cool-roof',
    name: 'Cool Roof Membrane',
    tone: '#f2f2f2',
    finish: 'High albedo membrane',
    description: 'High-reflectance membrane roof to reduce heat gain and urban heat island.',
    keywords: ['roof', 'membrane', 'cool roof'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'pv-roof',
    name: 'Solar PV Roof',
    tone: '#4a525d',
    finish: 'Building-integrated PV',
    description: 'Building-integrated or ballasted PV array sized for onsite renewable generation.',
    keywords: ['roof', 'solar', 'pv', 'renewable'],
    category: 'roof',
    carbonIntensity: 'low'
  },
  {
    id: 'blue-roof',
    name: 'Blue Roof',
    tone: '#6f8ba0',
    finish: 'Attenuation roof with controlled outlets',
    description:
      'Shallow attenuation layer to slow stormwater discharge; pairs well with green roofs for SuDS performance.',
    keywords: ['roof', 'water', 'suds'],
    category: 'roof',
    carbonIntensity: 'low'
  }
];

export const DEFAULT_MATERIAL_PROMPT =
  'Material study of the engineering atrium: harmonize structure, daylight, and tactile finishes while keeping the social “street” legible.';
