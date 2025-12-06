import { ProjectImage, SpecSection } from './types';

// NOTE: Please replace the URL for 'img-2' with the local path to your uploaded plan image (e.g., '/assets/plan.jpg')
export const PROJECT_IMAGES: ProjectImage[] = [
  {
    id: 'img-1',
    url: 'https://picsum.photos/1600/900?grayscale', 
    title: 'The Internal Street',
    description: 'The primary organising axis of the building. A generous, continuous space suitable for informal gathering, acting as the social heart from which all classrooms and laboratories are accessed.',
    category: 'Render'
  },
  {
    id: 'img-2',
    url: 'https://picsum.photos/1200/1200?grayscale&contrast=1.2', 
    title: 'Typical Level Plan',
    description: 'A rational rectangular floor plate organized around a central atrium "street". Corner cores provide structural stability and house services, keeping the central axis open for circulation, social interaction, and visual connectivity.',
    category: 'Plan'
  },
  {
    id: 'img-3',
    url: 'https://picsum.photos/1600/900?blur=1', 
    title: 'Breakout Alcoves',
    description: 'Informal learning spaces carved out of the circulation zone. These areas allow learning to spill out from the classrooms into the public realm.',
    category: 'Render'
  },
  {
    id: 'img-4',
    url: 'https://picsum.photos/1200/800?grayscale', 
    title: 'Structural Logic',
    description: 'Exposed concrete frame structure providing thermal mass and acoustic solidity, with a clear grid that allows for future adaptation.',
    category: 'Section'
  }
];

export const BUILDING_SPECS: SpecSection[] = [
  {
    title: 'Social Learning Landscapes',
    content: 'The building is conceived not just as a container for instruction but as a social landscape. The central "street" acts as the community heart, fostering serendipitous encounters and interdisciplinary collaboration. Circulation areas are generous and inhabited, doubling as breakout and informal study zones.'
  },
  {
    title: 'Environmental Intelligence',
    content: 'The architectural form drives environmental performance. The central atrium facilitates a natural ventilation strategy, utilizing the stack effect to draw air through the building. Exposed thermal mass (concrete soffits) helps regulate internal temperatures, reducing reliance on mechanical systems.'
  },
  {
    title: 'Long Life, Loose Fit',
    content: 'A robust structural grid ensures long-term adaptability. The plan is organized into "hard" zones (cores and fixed labs) and "soft" zones (partitionable classrooms and offices), allowing the building to evolve with changing pedagogical needs over decades.'
  },
  {
    title: 'Visual Connectivity',
    content: 'Transparency is key to the "science on display" concept. Extensive internal glazing connects laboratories and teaching spaces to the central street, demystifying the engineering process and allowing natural light to penetrate deep into the plan.'
  },
  {
    title: 'Material Integrity',
    content: 'A palette of honest, self-finished materials—exposed concrete, timber linings, and steel—is selected for durability and low maintenance. Acoustic attenuation is integrated into the architectural fabric (e.g., timber slats) rather than applied as secondary finishes.'
  }
];