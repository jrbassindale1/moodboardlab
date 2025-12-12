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
    title: 'Avoid and Reduce',
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
    id: 'vinyl-planks',
    name: 'Vinyl Planks (Recycled)',
    tone: '#d4c9b8',
    finish: 'Recycled vinyl planks',
    description: 'Luxury vinyl planks with recycled content; durable, water-resistant, and comfortable underfoot.',
    keywords: ['vinyl', 'recycled', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'resin-flooring',
    name: 'Resin Flooring',
    tone: '#c5c8ca',
    finish: 'Seamless epoxy resin',
    description: 'Seamless epoxy resin floor for hard-wearing, easy-clean surfaces with customizable finish.',
    keywords: ['resin', 'seamless', 'floor'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'microcement-floor',
    name: 'Microcement Flooring',
    tone: '#d0cbc2',
    finish: 'Seamless mineral microcement',
    description: 'Thin-coat microcement for floors; seamless, industrial aesthetic with sealed finish.',
    keywords: ['microcement', 'seamless', 'floor'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'ceramic-tiles',
    name: 'Ceramic Tiles',
    tone: '#e6e4de',
    finish: 'Glazed ceramic tiles',
    description: 'Durable glazed ceramic tiles for wet areas and circulation; wide range of sizes and colors.',
    keywords: ['ceramic', 'tiles', 'floor'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'epoxy-flooring',
    name: 'Epoxy Flooring',
    tone: '#b8bfc7',
    finish: 'Industrial epoxy coating',
    description: 'Industrial-grade epoxy coating for high-traffic areas; chemical-resistant and easy to clean.',
    keywords: ['epoxy', 'industrial', 'floor'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'travertine-tiles',
    name: 'Travertine Tiles',
    tone: '#d8cdb9',
    finish: 'Honed travertine',
    description: 'Natural travertine tiles with characteristic pitting; warm neutral tone for circulation.',
    keywords: ['travertine', 'stone', 'floor'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'marble-floor',
    name: 'Marble Flooring',
    tone: '#e8e5df',
    finish: 'Polished marble',
    description: 'Polished natural marble tiles with veining; elegant finish for entrance and feature zones.',
    keywords: ['marble', 'stone', 'floor'],
    category: 'floor',
    carbonIntensity: 'high'
  },
  {
    id: 'engineered-oak-floor',
    name: 'Engineered Oak Flooring',
    tone: '#d4b08a',
    finish: 'Engineered oak planks',
    description: 'Wide-plank engineered oak with hardwearing finish; stable and suitable for underfloor heating.',
    keywords: ['oak', 'engineered', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
  },
  {
    id: 'linoleum-tiles',
    name: 'Linoleum Tiles',
    tone: '#cdd1cf',
    finish: 'Modular linoleum tiles',
    description: 'Modular linoleum tiles with natural mottled pattern; easy to replace and maintain.',
    keywords: ['linoleum', 'tiles', 'floor'],
    category: 'floor',
    carbonIntensity: 'low'
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
    id: 'steel-window-frame',
    name: 'Steel Window Frame',
    tone: '#3a3f45',
    finish: 'Slim steel frames',
    description: 'Slim steel window frames with minimal sightlines; industrial aesthetic and high strength.',
    keywords: ['window', 'steel', 'frame'],
    category: 'window',
    carbonIntensity: 'high'
  },
  {
    id: 'composite-window-frame',
    name: 'Composite Window Frame',
    tone: '#c8c3b5',
    finish: 'Timber-polymer composite',
    description: 'Composite timber-polymer frames combining low maintenance with natural appearance.',
    keywords: ['window', 'composite', 'frame'],
    category: 'window',
    carbonIntensity: 'low'
  },
  {
    id: 'upvc-window-frame',
    name: 'uPVC Window Frame',
    tone: '#f0f0f0',
    finish: 'Multi-chamber uPVC',
    description: 'Multi-chamber uPVC frames with thermal efficiency; low maintenance and cost-effective.',
    keywords: ['window', 'upvc', 'frame'],
    category: 'window',
    carbonIntensity: 'high'
  },
  {
    id: 'curtain-wall-system',
    name: 'Curtain Wall System',
    tone: '#b5c0ca',
    finish: 'Aluminum curtain wall',
    description: 'Structural glazing curtain wall system for full-height transparency and weatherproofing.',
    keywords: ['window', 'curtain wall', 'glazing'],
    category: 'window',
    carbonIntensity: 'high'
  },
  {
    id: 'frameless-glazing',
    name: 'Frameless Glazing',
    tone: '#e6f0f5',
    finish: 'Structural glass with minimal framing',
    description: 'Minimal-frame or frameless structural glazing for maximum transparency and connection.',
    keywords: ['window', 'frameless', 'glazing'],
    category: 'window',
    carbonIntensity: 'high'
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
    id: 'plasterboard-wall',
    name: 'Plasterboard Wall',
    tone: '#ebebeb',
    finish: 'Smooth plasterboard finish',
    description: 'Standard plasterboard walls with smooth skim finish; versatile base for paint or wallpaper.',
    keywords: ['plasterboard', 'wall', 'internal'],
    category: 'wall-internal',
    treePaths: ['Internal>Walls']
  },
  {
    id: 'plywood-panels-wall',
    name: 'Plywood Wall Panels',
    tone: '#d8c0a0',
    finish: 'Birch plywood panels',
    description: 'Birch plywood panels with natural grain; warm and tactile interior finish.',
    keywords: ['plywood', 'wall', 'panels'],
    category: 'wall-internal',
    treePaths: ['Internal>Walls', 'Internal>Timber Panels']
  },
  {
    id: 'acoustic-panels-wall',
    name: 'Acoustic Wall Panels',
    tone: '#d2d5d8',
    finish: 'Fabric-wrapped acoustic panels',
    description: 'Sound-absorbing acoustic panels for walls; demountable and available in custom colors.',
    keywords: ['acoustic', 'wall', 'panels'],
    category: 'wall-internal',
    treePaths: ['Internal>Walls', 'Internal>Acoustic Panels']
  },
  {
    id: 'glass-partitions',
    name: 'Glass Partitions',
    tone: '#e8f2f5',
    finish: 'Frameless or framed glass',
    description: 'Transparent glass partitions for spatial division with visual connection; single or double-glazed.',
    keywords: ['glass', 'partition', 'wall'],
    category: 'wall-internal',
    treePaths: ['Internal>Walls']
  },
  {
    id: 'brick-internal',
    name: 'Brick (Internal)',
    tone: '#b8624a',
    finish: 'Exposed brick wall',
    description: 'Exposed internal brick wall for texture and warmth; can be sealed or painted.',
    keywords: ['brick', 'wall', 'internal'],
    category: 'wall-internal',
    treePaths: ['Internal>Walls']
  },
  {
    id: 'concrete-block-wall',
    name: 'Concrete Block Wall',
    tone: '#b5b0a5',
    finish: 'Painted concrete block',
    description: 'Concrete block walls with painted or exposed finish; durable and fire-resistant.',
    keywords: ['concrete', 'block', 'wall'],
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
    id: 'zinc-cladding',
    name: 'Zinc Cladding',
    tone: '#97a1ab',
    finish: 'Standing seam or flat-lock zinc',
    description: 'Self-patinating zinc cladding with long life and minimal maintenance; distinctive blue-grey patina.',
    keywords: ['zinc', 'cladding', 'external'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'copper-cladding',
    name: 'Copper Cladding',
    tone: '#b87333',
    finish: 'Copper sheets or shingles',
    description: 'Copper cladding that develops natural verdigris patina; highly durable and distinctive appearance.',
    keywords: ['copper', 'cladding', 'external'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'fiber-cement-panels',
    name: 'Fiber Cement Panels',
    tone: '#c5c3bd',
    finish: 'Fiber cement rainscreen',
    description: 'Fiber cement panels for durable, low-maintenance cladding; available in various textures and colors.',
    keywords: ['fiber cement', 'cladding', 'external'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'metal-composite-panels',
    name: 'Metal Composite Panels',
    tone: '#b8bcc0',
    finish: 'Aluminum composite panels',
    description: 'Lightweight aluminum composite panels with polyethylene core; versatile and economical cladding.',
    keywords: ['composite', 'aluminum', 'cladding', 'external'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'gfrc-panels',
    name: 'GFRC Panels',
    tone: '#c8c5be',
    finish: 'Glass fiber reinforced concrete',
    description: 'Glass fiber reinforced concrete panels offering sculptural possibilities with reduced weight.',
    keywords: ['gfrc', 'concrete', 'cladding', 'external'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'weathering-steel-panels',
    name: 'Weathering Steel Panels',
    tone: '#7a4f3c',
    finish: 'Corten steel panels',
    description: 'Weathering steel (Corten) panels forming protective rust patina; no coating required.',
    keywords: ['corten', 'steel', 'cladding', 'external'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'slate-cladding',
    name: 'Slate Cladding',
    tone: '#5a5f65',
    finish: 'Natural slate panels',
    description: 'Natural slate cladding with split or sawn finish; highly durable and weather-resistant.',
    keywords: ['slate', 'stone', 'cladding', 'external'],
    category: 'external',
    carbonIntensity: 'high'
  },
  {
    id: 'cork-rainscreen',
    name: 'Cork Rainscreen',
    tone: '#b5935e',
    finish: 'Expanded cork panels',
    description: 'Expanded cork rainscreen panels; bio-based, insulating, and naturally fire-resistant.',
    keywords: ['cork', 'cladding', 'bio-based', 'external'],
    category: 'external',
    carbonIntensity: 'low'
  },
  {
    id: 'recycled-plastic-cladding',
    name: 'Recycled Plastic Cladding',
    tone: '#8a9098',
    finish: 'Recycled plastic composite',
    description: 'Recycled plastic composite cladding; durable, low-maintenance, and circular material use.',
    keywords: ['recycled', 'plastic', 'cladding', 'external'],
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
    id: 'stretch-fabric-ceiling',
    name: 'Stretch Fabric Ceiling',
    tone: '#f5f5f5',
    finish: 'Tensioned fabric membrane',
    description: 'Tensioned fabric membrane ceiling with concealed services and lighting; smooth, seamless finish.',
    keywords: ['fabric', 'ceiling', 'stretch'],
    category: 'ceiling',
    carbonIntensity: 'low'
  },
  {
    id: 'coffered-ceiling',
    name: 'Coffered Ceiling',
    tone: '#d8c9b0',
    finish: 'Timber or plaster coffers',
    description: 'Recessed panel coffered ceiling adding architectural depth and rhythm; timber or plaster finish.',
    keywords: ['coffered', 'ceiling', 'architectural'],
    category: 'ceiling',
    carbonIntensity: 'low'
  },
  {
    id: 'plasterboard-ceiling',
    name: 'Plasterboard Ceiling',
    tone: '#ececec',
    finish: 'Smooth plasterboard',
    description: 'Standard smooth plasterboard ceiling with painted finish; versatile and cost-effective.',
    keywords: ['plasterboard', 'ceiling', 'standard'],
    category: 'ceiling',
    carbonIntensity: 'high'
  },
  {
    id: 'exposed-clt-ceiling',
    name: 'Exposed CLT Ceiling',
    tone: '#c7a276',
    finish: 'Exposed CLT panels',
    description: 'Exposed cross-laminated timber ceiling panels showcasing structure; warm and natural finish.',
    keywords: ['clt', 'timber', 'ceiling', 'exposed'],
    category: 'ceiling',
    carbonIntensity: 'low'
  },
  {
    id: 'metal-mesh-ceiling',
    name: 'Metal Mesh Ceiling',
    tone: '#b8bec5',
    finish: 'Expanded metal mesh',
    description: 'Expanded or woven metal mesh ceiling for visual transparency with acoustic backing.',
    keywords: ['metal', 'mesh', 'ceiling'],
    category: 'ceiling',
    carbonIntensity: 'high'
  },
  {
    id: 'acoustic-tiles-ceiling',
    name: 'Acoustic Ceiling Tiles',
    tone: '#e0e0df',
    finish: 'Mineral fiber acoustic tiles',
    description: 'Suspended mineral fiber acoustic tiles in grid system; high sound absorption and easy access.',
    keywords: ['acoustic', 'tiles', 'ceiling'],
    category: 'ceiling',
    carbonIntensity: 'low'
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
    id: 'plywood-panels-finish',
    name: 'Plywood Panels',
    tone: '#d5be9e',
    finish: 'Birch or oak plywood',
    description: 'Structural plywood panels with natural grain; warm, cost-effective interior finish.',
    keywords: ['plywood', 'panels', 'finish'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'marble-panels',
    name: 'Marble Panels',
    tone: '#e5e2db',
    finish: 'Polished marble panels',
    description: 'Polished natural marble panels with distinctive veining; elegant feature wall material.',
    keywords: ['marble', 'stone', 'panels'],
    category: 'finish',
    carbonIntensity: 'high'
  },
  {
    id: 'leather-panels',
    name: 'Leather Panels',
    tone: '#8b5a3c',
    finish: 'Leather wall tiles',
    description: 'Tactile leather wall tiles or panels; luxurious, warm finish for acoustic and visual softness.',
    keywords: ['leather', 'panels', 'tactile'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'metal-mesh-panels',
    name: 'Metal Mesh Panels',
    tone: '#b0b5bb',
    finish: 'Woven or expanded metal mesh',
    description: 'Architectural metal mesh panels for partitions and feature walls; semi-transparent and industrial.',
    keywords: ['metal', 'mesh', 'panels'],
    category: 'finish',
    carbonIntensity: 'high'
  },
  {
    id: 'glass-panels-finish',
    name: 'Glass Panels',
    tone: '#e8f0f3',
    finish: 'Back-painted or textured glass',
    description: 'Back-painted or textured glass panels for feature walls; easy to clean and hygienic.',
    keywords: ['glass', 'panels', 'finish'],
    category: 'finish',
    carbonIntensity: 'high'
  },
  {
    id: 'acoustic-plaster',
    name: 'Acoustic Plaster',
    tone: '#e5e0d8',
    finish: 'Seamless acoustic plaster',
    description: 'Seamless acoustic plaster for ceilings and walls; combines sound absorption with smooth finish.',
    keywords: ['acoustic', 'plaster', 'seamless'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'lime-plaster',
    name: 'Lime Plaster',
    tone: '#e0d5c5',
    finish: 'Natural lime plaster',
    description: 'Breathable natural lime plaster with soft, mottled finish; moisture-regulating and low-carbon.',
    keywords: ['lime', 'plaster', 'breathable'],
    category: 'finish',
    carbonIntensity: 'low'
  },
  {
    id: 'tadelakt-plaster',
    name: 'Tadelakt Plaster',
    tone: '#d8c8b5',
    finish: 'Polished Moroccan plaster',
    description: 'Polished waterproof Moroccan lime plaster; smooth, lustrous finish for wet areas.',
    keywords: ['tadelakt', 'plaster', 'waterproof'],
    category: 'finish',
    carbonIntensity: 'low'
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
    id: 'brick-loadbearing',
    name: 'Brick Load-Bearing Walls',
    tone: '#a8553c',
    finish: 'Solid brick masonry',
    description: 'Traditional solid brick load-bearing construction with lime mortar; thermal mass and durability.',
    keywords: ['brick', 'masonry', 'structure'],
    category: 'structure',
    carbonIntensity: 'high'
  },
  {
    id: 'hempcrete-structural',
    name: 'Hempcrete Structural',
    tone: '#c5bfab',
    finish: 'Hempcrete infill with timber frame',
    description: 'Bio-based hempcrete infill within a timber frame; carbon-negative and breathable.',
    keywords: ['hempcrete', 'bio-based', 'structure'],
    category: 'structure',
    carbonIntensity: 'low'
  },
  {
    id: 'steel-concrete-composite',
    name: 'Steel-Concrete Composite',
    tone: '#b2b5b8',
    finish: 'Composite steel decking with concrete',
    description: 'Composite steel decking with concrete topping; efficient long-span solution.',
    keywords: ['composite', 'steel', 'concrete', 'structure'],
    category: 'structure',
    carbonIntensity: 'high'
  },
  {
    id: 'precast-concrete',
    name: 'Precast Concrete',
    tone: '#b5b0a8',
    finish: 'Precast concrete elements',
    description: 'Factory-made precast concrete beams and slabs for rapid, quality-controlled construction.',
    keywords: ['precast', 'concrete', 'structure'],
    category: 'structure',
    carbonIntensity: 'high'
  },
  {
    id: 'mass-timber-columns',
    name: 'Mass Timber Columns',
    tone: '#c2995d',
    finish: 'Glulam or CLT columns',
    description: 'Glulam or CLT columns providing vertical load-bearing with renewable, carbon-storing material.',
    keywords: ['timber', 'mass timber', 'columns', 'structure'],
    category: 'structure',
    carbonIntensity: 'low'
  },
  {
    id: 'steel-trusses',
    name: 'Steel Trusses',
    tone: '#c1c5ca',
    finish: 'Welded steel trusses',
    description: 'Long-span steel trusses for efficient roof and floor structures; painted or exposed finish.',
    keywords: ['steel', 'trusses', 'structure'],
    category: 'structure',
    carbonIntensity: 'high'
  },
  {
    id: 'prestressed-concrete',
    name: 'Prestressed Concrete',
    tone: '#b0aba3',
    finish: 'Prestressed concrete beams',
    description: 'Prestressed concrete beams for long spans with reduced material use; efficient structural system.',
    keywords: ['prestressed', 'concrete', 'structure'],
    category: 'structure',
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
      'Shallow attenuation layers to slow stormwater discharge; pairs well with green roofs for SuDS performance.',
    keywords: ['roof', 'water', 'suds'],
    category: 'roof',
    carbonIntensity: 'low'
  },
  {
    id: 'clay-tiles-roof',
    name: 'Clay Tiles',
    tone: '#b85a3c',
    finish: 'Interlocking clay tiles',
    description: 'Traditional interlocking clay tiles with long lifespan and natural thermal performance.',
    keywords: ['clay', 'tiles', 'roof'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'slate-tiles-roof',
    name: 'Slate Tiles',
    tone: '#3f444a',
    finish: 'Natural slate roofing',
    description: 'Natural slate roofing tiles; durable, low-maintenance, and highly weather-resistant.',
    keywords: ['slate', 'tiles', 'roof'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'metal-tiles-roof',
    name: 'Metal Tiles',
    tone: '#8a9099',
    finish: 'Profiled metal tiles',
    description: 'Lightweight profiled metal tiles mimicking traditional forms; durable and recyclable.',
    keywords: ['metal', 'tiles', 'roof'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'epdm-membrane',
    name: 'EPDM Membrane',
    tone: '#2b2d30',
    finish: 'Single-ply EPDM',
    description: 'Single-ply EPDM rubber membrane for flat roofs; durable, flexible, and UV-resistant.',
    keywords: ['epdm', 'membrane', 'roof'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'tpo-membrane',
    name: 'TPO Membrane',
    tone: '#e8e8e8',
    finish: 'White TPO single-ply',
    description: 'White TPO single-ply membrane with high reflectivity for cool roof performance.',
    keywords: ['tpo', 'membrane', 'roof', 'cool roof'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'built-up-roofing',
    name: 'Built-Up Roofing',
    tone: '#3a3a3a',
    finish: 'Bituminous built-up layers',
    description: 'Traditional built-up bituminous roofing with multiple layers; proven durability for flat roofs.',
    keywords: ['bitumen', 'built-up', 'roof'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'polycarbonate-roof',
    name: 'Polycarbonate Roof Panels',
    tone: '#d8e8f0',
    finish: 'Multi-wall polycarbonate',
    description: 'Lightweight multi-wall polycarbonate panels for daylighting; insulating and impact-resistant.',
    keywords: ['polycarbonate', 'panels', 'roof', 'daylighting'],
    category: 'roof',
    carbonIntensity: 'high'
  },
  {
    id: 'wood-fiber-insulation',
    name: 'Wood Fiber Insulation',
    tone: '#c8b49a',
    finish: 'Rigid wood fiber boards',
    description: 'Bio-based rigid wood fiber insulation boards; breathable, high thermal mass, and carbon-storing.',
    keywords: ['insulation', 'wood fiber', 'bio-based'],
    category: 'insulation',
    carbonIntensity: 'low'
  },
  {
    id: 'hemp-insulation',
    name: 'Hemp Insulation',
    tone: '#b5a88a',
    finish: 'Hemp fiber batts',
    description: 'Natural hemp fiber insulation batts; breathable, renewable, and excellent moisture management.',
    keywords: ['insulation', 'hemp', 'bio-based'],
    category: 'insulation',
    carbonIntensity: 'low'
  },
  {
    id: 'sheep-wool-insulation',
    name: "Sheep's Wool Insulation",
    tone: '#e0d8c8',
    finish: 'Natural wool batts',
    description: 'Natural sheep wool insulation batts; renewable, moisture-buffering, and non-toxic.',
    keywords: ['insulation', 'wool', 'natural'],
    category: 'insulation',
    carbonIntensity: 'low'
  },
  {
    id: 'cork-insulation',
    name: 'Cork Insulation',
    tone: '#a18a68',
    finish: 'Expanded cork boards',
    description: 'Expanded cork insulation boards; bio-based, naturally fire-resistant, and carbon-negative.',
    keywords: ['insulation', 'cork', 'bio-based'],
    category: 'insulation',
    carbonIntensity: 'low'
  },
  {
    id: 'cellulose-insulation',
    name: 'Cellulose Insulation',
    tone: '#d5cbb8',
    finish: 'Recycled paper cellulose',
    description: 'Blown or batt cellulose from recycled paper; high recycled content and good thermal performance.',
    keywords: ['insulation', 'cellulose', 'recycled'],
    category: 'insulation',
    carbonIntensity: 'low'
  },
  {
    id: 'mineral-wool',
    name: 'Mineral Wool',
    tone: '#c8c3b5',
    finish: 'Stone wool batts',
    description: 'Stone wool insulation batts with excellent fire resistance and acoustic performance.',
    keywords: ['insulation', 'mineral wool', 'fire-resistant'],
    category: 'insulation',
    carbonIntensity: 'high'
  },
  {
    id: 'pir-insulation',
    name: 'PIR/PUR Boards',
    tone: '#e8d5a0',
    finish: 'Rigid foam insulation',
    description: 'High-performance rigid foam insulation boards; thin profile with high R-value.',
    keywords: ['insulation', 'pir', 'foam'],
    category: 'insulation',
    carbonIntensity: 'high'
  },
  {
    id: 'aerogel-insulation',
    name: 'Aerogel Insulation',
    tone: '#b8c5d0',
    finish: 'Ultra-thin aerogel blankets',
    description: 'Ultra-high-performance aerogel insulation blankets; extreme R-value in minimal thickness.',
    keywords: ['insulation', 'aerogel', 'high-performance'],
    category: 'insulation',
    carbonIntensity: 'high'
  },
  {
    id: 'timber-door',
    name: 'Timber Doors',
    tone: '#b89968',
    finish: 'Solid or veneered timber',
    description: 'Solid or engineered timber doors with various finishes; warm, natural, and customizable.',
    keywords: ['door', 'timber', 'wood'],
    category: 'door',
    carbonIntensity: 'low'
  },
  {
    id: 'steel-door',
    name: 'Steel Doors',
    tone: '#6a7075',
    finish: 'Powder-coated steel',
    description: 'Robust steel doors with powder-coat finish; high security and fire-rating options.',
    keywords: ['door', 'steel', 'security'],
    category: 'door',
    carbonIntensity: 'high'
  },
  {
    id: 'aluminum-door',
    name: 'Aluminum Doors',
    tone: '#b5bcc3',
    finish: 'Anodized or powder-coated aluminum',
    description: 'Lightweight aluminum doors with slim profiles; durable and low-maintenance.',
    keywords: ['door', 'aluminum', 'lightweight'],
    category: 'door',
    carbonIntensity: 'high'
  },
  {
    id: 'glass-door',
    name: 'Glass Doors',
    tone: '#e0ebf0',
    finish: 'Frameless or framed glass',
    description: 'Transparent glass doors for maximum light transmission; frameless or minimal framing.',
    keywords: ['door', 'glass', 'transparent'],
    category: 'door',
    carbonIntensity: 'high'
  },
  {
    id: 'composite-door',
    name: 'Composite Doors',
    tone: '#8a7a65',
    finish: 'GRP composite with insulated core',
    description: 'Glass-reinforced plastic composite doors with insulated core; low-maintenance and thermally efficient.',
    keywords: ['door', 'composite', 'insulated'],
    category: 'door',
    carbonIntensity: 'high'
  },
  {
    id: 'fire-rated-door',
    name: 'Fire-Rated Doors',
    tone: '#a59585',
    finish: 'Fire-rated timber or steel',
    description: 'Fire-rated doors with certified performance; timber or steel construction with intumescent seals.',
    keywords: ['door', 'fire-rated', 'safety'],
    category: 'door',
    carbonIntensity: 'high'
  },
  {
    id: 'glass-balustrade',
    name: 'Glass Balustrade',
    tone: '#e8f0f5',
    finish: 'Frameless or channel-mounted glass',
    description: 'Frameless or channel-mounted glass balustrade; transparent, safe, and minimal visual obstruction.',
    keywords: ['balustrade', 'glass', 'transparent'],
    category: 'balustrade',
    carbonIntensity: 'high'
  },
  {
    id: 'steel-railing',
    name: 'Steel Railing',
    tone: '#4a5055',
    finish: 'Powder-coated steel',
    description: 'Powder-coated steel railings with various infill options; durable and customizable.',
    keywords: ['balustrade', 'steel', 'railing'],
    category: 'balustrade',
    carbonIntensity: 'high'
  },
  {
    id: 'timber-railing',
    name: 'Timber Railing',
    tone: '#c19a6f',
    finish: 'Hardwood or softwood rails',
    description: 'Natural timber railings with warm aesthetic; suitable for interior and sheltered exterior use.',
    keywords: ['balustrade', 'timber', 'railing'],
    category: 'balustrade',
    carbonIntensity: 'low'
  },
  {
    id: 'cable-railing',
    name: 'Cable Railing',
    tone: '#a8b0b8',
    finish: 'Stainless steel cables',
    description: 'Minimal stainless steel cable railings; modern aesthetic with unobstructed views.',
    keywords: ['balustrade', 'cable', 'minimal'],
    category: 'balustrade',
    carbonIntensity: 'high'
  },
  {
    id: 'mesh-railing',
    name: 'Mesh Railing',
    tone: '#9a9fa5',
    finish: 'Woven or expanded metal mesh',
    description: 'Metal mesh infill railings; industrial aesthetic with safety and semi-transparency.',
    keywords: ['balustrade', 'mesh', 'industrial'],
    category: 'balustrade',
    carbonIntensity: 'high'
  },
  {
    id: 'gravel-paving',
    name: 'Gravel',
    tone: '#b5a895',
    finish: 'Loose gravel or aggregate',
    description: 'Loose gravel surface for paths and landscaping; permeable and natural drainage.',
    keywords: ['landscape', 'gravel', 'permeable'],
    category: 'external-ground',
    carbonIntensity: 'low'
  },
  {
    id: 'resin-bound-gravel',
    name: 'Resin-Bound Gravel',
    tone: '#c8b59a',
    finish: 'Resin-bound aggregate',
    description: 'Smooth resin-bound gravel surface; permeable, durable, and low-maintenance.',
    keywords: ['landscape', 'resin', 'gravel'],
    category: 'external-ground',
    carbonIntensity: 'high'
  },
  {
    id: 'concrete-paving',
    name: 'Concrete Paving',
    tone: '#c5c0b5',
    finish: 'Poured or slab concrete',
    description: 'Durable concrete paving for paths and hard standing; versatile and cost-effective.',
    keywords: ['landscape', 'concrete', 'paving'],
    category: 'external-ground',
    carbonIntensity: 'high'
  },
  {
    id: 'block-paving',
    name: 'Block Paving',
    tone: '#b8a590',
    finish: 'Concrete or clay block pavers',
    description: 'Interlocking concrete or clay block pavers; durable and repairable surface.',
    keywords: ['landscape', 'block', 'paving'],
    category: 'external-ground',
    carbonIntensity: 'high'
  },
  {
    id: 'grass-reinforcement',
    name: 'Grass Reinforcement',
    tone: '#7a9a6f',
    finish: 'Plastic grid with grass',
    description: 'Plastic or concrete grid system for reinforced grass areas; permeable and green appearance.',
    keywords: ['landscape', 'grass', 'reinforcement'],
    category: 'external-ground',
    carbonIntensity: 'high'
  },
  {
    id: 'decking-external',
    name: 'Decking (Timber/Composite)',
    tone: '#b88a5f',
    finish: 'Timber or composite boards',
    description: 'Timber or composite decking for terraces and paths; warm finish with good drainage.',
    keywords: ['landscape', 'decking', 'timber'],
    category: 'external-ground',
    carbonIntensity: 'low'
  }
]; 