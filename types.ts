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
}