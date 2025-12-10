import { MaterialOption, ProjectImage, SpecSection } from './types';
import frontageImage from './images/Gemini_Generated_Image_q4di9vq4di9vq4di.png';
import atriumImage from './images/Gemini_Generated_Image_cabuhicabuhicabu.png';
import sectionImage from './images/Gemini_Generated_Image_fm4idjfm4idjfm4i.png';
import planImage from './images/Gemini_Generated_Image_h5obkfh5obkfh5ob.png';
import collaborationImage from './images/Gemini_Generated_Image_pcapx4pcapx4pcap.png';
import materialImage from './images/Gemini_Generated_Image_ss4b84ss4b84ss4b.png';
import contextImage from './images/unnamed.jpg';
import socialSpecImage from './images/unnamed-2.jpg';
import environmentalSpecImage from './images/unnamed-3.jpg';
import flexibilitySpecImage from './images/unnamed-4.jpg';
import connectivitySpecImage from './images/unnamed-5.jpg';
import materialitySpecImage from './images/unnamed-6.jpg';

export const MATERIAL_BASE_IMAGE = collaborationImage;

export const PROJECT_IMAGES: ProjectImage[] = [
  {
    id: 'frontage',
    url: frontageImage,
    title: 'Arrival Courtyard',
    description: 'Frontage perspective that frames the new engineering building and hints at the internal street beyond the glazed entry.',
    category: 'Render'
  },
  {
    id: 'atrium',
    url: atriumImage,
    title: 'Internal Street',
    description: 'Central circulation spine acting as the social heart, connecting labs, classrooms, and collaboration terraces.',
    category: 'Render'
  },
  {
    id: 'plan',
    url: planImage,
    title: 'Typical Level Plan',
    description: 'Rational floor plate organised around a daylit void, with corner cores and flexible learning zones along the street.',
    category: 'Plan'
  },
  {
    id: 'section',
    url: sectionImage,
    title: 'Atrium Section',
    description: 'Sectional study showing the stacked breakout spaces, natural ventilation path, and visual connectivity across levels.',
    category: 'Section'
  },
  {
    id: 'collaboration',
    url: collaborationImage,
    title: 'Collaboration Terraces',
    description: 'Informal learning terraces carved into the circulation route, supporting project work and peer-led study.',
    category: 'Render'
  },
  {
    id: 'materiality',
    url: materialImage,
    title: 'Material Strategy',
    description: 'Palette of honest materials—exposed structure, timber linings, and filtered daylight—supporting acoustic comfort.',
    category: 'Render'
  },
  {
    id: 'context',
    url: contextImage,
    title: 'Campus Context',
    description: 'Site context view placing the engineering building within the wider campus landscape and public realm.',
    category: 'Render'
  }
];

export const BUILDING_SPECS: SpecSection[] = [
  {
    title: 'Social Learning Landscapes',
    content: 'The building is conceived not just as a container for instruction but as a social landscape. The central "street" acts as the community heart, fostering serendipitous encounters and interdisciplinary collaboration. Circulation areas are generous and inhabited, doubling as breakout and informal study zones.',
    image: socialSpecImage,
    imageAlt: 'Social learning terraces spilling out from the central atrium.'
  },
  {
    title: 'Environmental Intelligence',
    content: 'The architectural form drives environmental performance. The central atrium facilitates a natural ventilation strategy, utilizing the stack effect to draw air through the building. Exposed thermal mass (concrete soffits) helps regulate internal temperatures, reducing reliance on mechanical systems.',
    image: environmentalSpecImage,
    imageAlt: 'Daylit atrium supporting passive environmental strategies.'
  },
  {
    title: 'Long Life, Loose Fit',
    content: 'A robust structural grid ensures long-term adaptability. The plan is organized into "hard" zones (cores and fixed labs) and "soft" zones (partitionable classrooms and offices), allowing the building to evolve with changing pedagogical needs over decades.',
    image: flexibilitySpecImage,
    imageAlt: 'Open plan floor plate showing an adaptable grid and learning spaces.'
  },
  {
    title: 'Visual Connectivity',
    content: 'Transparency is key to the "science on display" concept. Extensive internal glazing connects laboratories and teaching spaces to the central street, demystifying the engineering process and allowing natural light to penetrate deep into the plan.',
    image: connectivitySpecImage,
    imageAlt: 'Glazed teaching spaces overlooking the central circulation street.'
  },
  {
    title: 'Material Integrity',
    content: 'A palette of honest, self-finished materials—exposed concrete, timber linings, and steel—is selected for durability and low maintenance. Acoustic attenuation is integrated into the architectural fabric (e.g., timber slats) rather than applied as secondary finishes.',
    image: materialitySpecImage,
    imageAlt: 'Detail of timber, concrete, and steel surfaces used throughout the building.'
  }
];

export const MATERIAL_PALETTE: MaterialOption[] = [
  {
    id: 'steel-frame',
    name: 'Triangulated Steel Frame (Painted)',
    tone: '#d9d9d9',
    finish: 'Painted steel — select colour',
    description:
      'Exposed triangulated steel beams and columns with expressed joints. Finish: painted steel — select colour (white / charcoal / oxide red / custom RAL).',
    keywords: ['steel', 'painted', 'expressed joints'],
    category: 'structure',
    supportsColor: true
  },
  {
    id: 'glulam-structure',
    name: 'Glulam Timber Structure',
    tone: '#c49a6c',
    finish: 'Glulam timber beams and posts',
    description:
      'Laminated timber beams and posts forming a renewable, visually warm structural system with long-span capability.',
    keywords: ['timber', 'glulam', 'warm'],
    category: 'structure'
  },
  {
    id: 'concrete-frame',
    name: 'Reinforced Concrete Frame',
    tone: '#b8b8b8',
    finish: 'Cast-in-place concrete',
    description:
      'Cast-in-place concrete slabs and columns with exposed soffits providing thermal mass and long-term durability.',
    keywords: ['concrete', 'soffit', 'durability'],
    category: 'structure'
  },
  {
    id: 'polished-concrete',
    name: 'Polished Concrete',
    tone: '#c8c3b8',
    finish: 'Polished concrete slab',
    description:
      'Ground, sealed concrete slab with subtle aggregate exposure; durable and low-maintenance.',
    keywords: ['floor', 'polished', 'aggregate'],
    category: 'floor'
  },
  {
    id: 'recycled-terrazzo',
    name: 'Recycled Plastic Terrazzo',
    tone: '#7fa59f',
    finish: 'Composite terrazzo with plastic fragments',
    description:
      'Composite terrazzo incorporating post-consumer plastic fragments; a colourful, low-carbon alternative.',
    keywords: ['terrazzo', 'recycled', 'floor'],
    category: 'floor'
  },
  {
    id: 'timber-flooring',
    name: 'Timber Flooring',
    tone: '#d8b185',
    finish: 'Engineered timber boards',
    description:
      'Engineered timber boards with a light natural finish, offering warmth and acoustic softness.',
    keywords: ['timber', 'flooring', 'warm'],
    category: 'floor'
  },
  {
    id: 'grey-carpet',
    name: 'Grey Carpet Tiles',
    tone: '#9a9a9f',
    finish: 'Modular low-pile tiles',
    description:
      'Modular low-pile tiles in mid-grey, providing acoustic comfort and easy replacement for high-traffic learning environments.',
    keywords: ['carpet', 'acoustic', 'floor'],
    category: 'floor'
  },
  {
    id: 'timber-linings',
    name: 'Timber Linings',
    tone: '#c79b6f',
    finish: 'Rift-sawn oak slats',
    description:
      'Rift-sawn oak slats providing integrated acoustic attenuation and a warm tactile surface.',
    keywords: ['timber', 'acoustic', 'slats'],
    category: 'finish'
  },
  {
    id: 'low-iron-glass',
    name: 'Low-Iron Glass',
    tone: '#d9e7ef',
    finish: 'Ultra-clear glazing',
    description:
      'Ultra-clear internal glazing for partitions and balustrades to enhance visual connectivity and daylight penetration.',
    keywords: ['glass', 'clear', 'daylight'],
    category: 'finish'
  },
  {
    id: 'terracotta-panels',
    name: 'Terracotta Panels',
    tone: '#d36944',
    finish: 'Pressed terracotta panels',
    description:
      'Pressed terracotta used as rainscreen cladding or internal accent surfaces; durable, colour-stable, and tactile.',
    keywords: ['terracotta', 'cladding', 'tactile'],
    category: 'finish'
  }
];

export const DEFAULT_MATERIAL_PROMPT =
  'Material study of the engineering atrium: harmonize structure, daylight, and tactile finishes while keeping the social “street” legible.';
