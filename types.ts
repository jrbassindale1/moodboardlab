export interface ProjectImage {
  id: string;
  url: string; // In a real scenario, this would be the local path to the user's images
  title: string;
  description: string;
  category: 'Render' | 'Plan' | 'Section';
}

export interface SpecSection {
  title: string;
  content: string;
  image: string;
  imageAlt: string;
}

export type MaterialCategory =
  | 'floor'
  | 'structure'
  | 'finish'
  | 'wall-internal'
  | 'external'
  | 'soffit'
  | 'ceiling'
  | 'window'
  | 'roof';

export interface MaterialOption {
  id: string;
  name: string;
  tone: string; // hex value for quick swatch
  finish: string;
  description: string;
  keywords: string[];
  category: MaterialCategory;
  colorOptions?: { label: string; tone: string }[];
  supportsColor?: boolean;
  carbonIntensity?: 'low' | 'high';
}

export interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
}
