const HEX_IN_PARENS_RE = /\s*\(\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\s*\)\s*/g;
const CUSTOM_HEX_RGB_COLOUR_RE = /\bcustom\s+HEX\/RGB\s+colou?r\b/gi;
const HEX_RGB_COLOUR_RE = /\bHEX\/RGB\s+colou?r\b/gi;

export const formatFinishForDisplay = (finish?: string) => {
  if (!finish) return '';
  return finish.replace(HEX_IN_PARENS_RE, ' ').replace(/\s{2,}/g, ' ').trim();
};

export const formatDescriptionForDisplay = (description?: string) => {
  if (!description) return '';
  return description
    .replace(CUSTOM_HEX_RGB_COLOUR_RE, 'custom colour')
    .replace(HEX_RGB_COLOUR_RE, 'colour')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
