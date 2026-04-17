export type RenderViewIntent =
  | 'point-cloud'
  | 'elevation'
  | 'section'
  | 'plan'
  | 'axonometric'
  | 'interior'
  | 'exterior'
  | 'street-level'
  | 'aerial'
  | 'unknown';

export type DrawingType = 'perspective' | 'elevation' | 'section' | 'plan' | 'auto';
export type ResolvedDrawingType = Exclude<DrawingType, 'auto'>;

export interface DrawingTypeResolution {
  drawingType: ResolvedDrawingType;
  source: 'requested' | 'text' | 'filename' | 'default';
}

export interface RenderViewGuidance {
  intent: RenderViewIntent;
  isTechnicalView: boolean;
  styleDirective: string;
  cameraDirective: string;
  antiDriftDirective: string;
}

const POINT_CLOUD_RE = /\bpoint[\s-]?cloud\b/i;
const ELEVATION_RE = /\belevation\b/i;
const SECTION_RE = /\bsection(?:al)?\b/i;
const AXONOMETRIC_RE = /\b(axonometric|axon|isometric|orthographic)\b/i;
const PLAN_RE = /\b(plan|top[\s-]?down)\b/i;
const INTERIOR_RE = /\b(interior|inside|internal)\b/i;
const STREET_LEVEL_RE = /\b(street[\s-]?level|pedestrian|eye[\s-]?level)\b/i;
const AERIAL_RE = /\b(aerial|bird'?s[\s-]?eye|drone)\b/i;
const EXTERIOR_RE = /\b(exterior|outside|facade|fa[çc]ade)\b/i;
const PERSPECTIVE_RE = /\b(perspective|spatial|3d|eye[\s-]?level|street[\s-]?view|immersive)\b/i;

const EXPLICIT_PERSPECTIVE_CONVERT_RE =
  /\b(convert|change|switch|turn|make|transform)\b[\s\S]{0,60}\b(perspective|3d|spatial|eye[\s-]?level|street[\s-]?view)\b/i;

const EXPLICIT_ORTHOGRAPHIC_CONVERT_RE =
  /\b(convert|change|switch|turn|make|transform)\b[\s\S]{0,60}\b(elevation|section|plan|orthographic|top[\s-]?down)\b/i;

export function detectRenderViewIntent(input?: string | null): RenderViewIntent {
  const text = (input || '').toLowerCase();
  if (!text.trim()) return 'unknown';
  if (POINT_CLOUD_RE.test(text)) return 'point-cloud';
  if (ELEVATION_RE.test(text)) return 'elevation';
  if (SECTION_RE.test(text)) return 'section';
  if (AXONOMETRIC_RE.test(text)) return 'axonometric';
  if (PLAN_RE.test(text)) return 'plan';
  if (STREET_LEVEL_RE.test(text)) return 'street-level';
  if (AERIAL_RE.test(text)) return 'aerial';
  if (INTERIOR_RE.test(text)) return 'interior';
  if (EXTERIOR_RE.test(text)) return 'exterior';
  return 'unknown';
}

export function inferDrawingType(params?: {
  requestedType?: DrawingType;
  userText?: string | null;
  baseImageName?: string | null;
}): DrawingTypeResolution {
  const requestedType = params?.requestedType ?? 'auto';
  if (requestedType !== 'auto') {
    return { drawingType: requestedType, source: 'requested' };
  }

  const userText = (params?.userText || '').toLowerCase();
  const nameText = (params?.baseImageName || '').toLowerCase();

  if (SECTION_RE.test(userText)) return { drawingType: 'section', source: 'text' };
  if (ELEVATION_RE.test(userText)) return { drawingType: 'elevation', source: 'text' };
  if (PLAN_RE.test(userText)) return { drawingType: 'plan', source: 'text' };
  if (PERSPECTIVE_RE.test(userText)) return { drawingType: 'perspective', source: 'text' };

  if (SECTION_RE.test(nameText)) return { drawingType: 'section', source: 'filename' };
  if (ELEVATION_RE.test(nameText)) return { drawingType: 'elevation', source: 'filename' };
  if (PLAN_RE.test(nameText)) return { drawingType: 'plan', source: 'filename' };
  if (PERSPECTIVE_RE.test(nameText)) return { drawingType: 'perspective', source: 'filename' };

  return { drawingType: 'perspective', source: 'default' };
}

export function hasExplicitPerspectiveConversionRequest(input?: string | null): boolean {
  return EXPLICIT_PERSPECTIVE_CONVERT_RE.test(input || '');
}

export function hasExplicitOrthographicConversionRequest(input?: string | null): boolean {
  return EXPLICIT_ORTHOGRAPHIC_CONVERT_RE.test(input || '');
}

export function getDrawingTypePromptDirectives(params: {
  drawingType: ResolvedDrawingType;
  userInstruction?: string | null;
  allowUserDrivenPerspectiveConversion?: boolean;
}): string[] {
  const userInstruction = params.userInstruction || '';
  const allowPerspectiveConvert = Boolean(params.allowUserDrivenPerspectiveConversion);
  const wantsPerspective = hasExplicitPerspectiveConversionRequest(userInstruction);
  const wantsOrthographic = hasExplicitOrthographicConversionRequest(userInstruction);

  if (params.drawingType === 'elevation') {
    return [
      'REPRESENTATION TYPE: elevation (orthographic).',
      'Keep a straight-on orthographic elevation view with no oblique camera angle, no lens distortion, and no perspective convergence.',
      'Preserve facade order, opening alignment, floor levels, and vertical/horizontal datums exactly from the source.',
      'Preserve elevation drawing conventions: keep a clear ground datum/ground line, a flat frontal facade reading, and no foreground or background perspective staging.',
      'Use a restrained presentation-elevation backdrop only; avoid immersive site depth, angled terrain, dramatic entourage, or scene-like composition.',
      allowPerspectiveConvert && wantsPerspective
        ? 'User explicitly requested a perspective conversion. If converting, still preserve facade proportions and element order.'
        : 'Do not convert this elevation into a perspective or immersive scene unless the user explicitly asks for conversion.'
    ];
  }

  if (params.drawingType === 'section') {
    return [
      'REPRESENTATION TYPE: section (orthographic).',
      'Keep an orthographic section plate with explicit cut-versus-beyond hierarchy; do not switch to cutaway rendering or external perspective.',
      'Preserve cut logic, alignment, floor heights, and the distinction between cut structure, seen-beyond structure, and background elements.',
      allowPerspectiveConvert && wantsPerspective
        ? 'User explicitly requested a perspective conversion. If converting, preserve the sectional organization and key levels.'
        : 'Do not convert this section into a perspective scene unless the user explicitly asks for conversion.'
    ];
  }

  if (params.drawingType === 'plan') {
    return [
      'REPRESENTATION TYPE: plan (top-down orthographic).',
      'Keep a top-down orthographic plan view; no eye-level camera, no oblique camera tilt, and no cinematic lens effects.',
      'Preserve room/zone adjacency, wall alignments, circulation logic, and top-down spatial relationships.',
      allowPerspectiveConvert && wantsPerspective
        ? 'User explicitly requested a perspective conversion. If converting, preserve plan organization and key adjacencies.'
        : 'Do not convert this plan into a perspective scene unless the user explicitly asks for conversion.'
    ];
  }

  return [
    'REPRESENTATION TYPE: perspective / spatial view.',
    'Use the source spatial viewpoint and preserve camera framing, geometry, and composition.',
    wantsOrthographic
      ? 'User explicitly requested orthographic output. Respect that request and preserve geometry while changing projection type.'
      : 'Keep the output as a realistic architectural spatial visualization while preserving source geometry.'
  ];
}

export function getRenderViewGuidance(input?: string | null): RenderViewGuidance {
  const intent = detectRenderViewIntent(input);
  return getRenderViewGuidanceForIntent(intent);
}

export function getRenderViewGuidanceForDrawingType(drawingType: ResolvedDrawingType): RenderViewGuidance {
  const intent: RenderViewIntent =
    drawingType === 'perspective'
      ? 'exterior'
      : drawingType;

  return getRenderViewGuidanceForIntent(intent);
}

function getRenderViewGuidanceForIntent(intent: RenderViewIntent): RenderViewGuidance {
  const isTechnicalView =
    intent === 'elevation' ||
    intent === 'section' ||
    intent === 'plan' ||
    intent === 'axonometric';

  if (intent === 'point-cloud') {
    return {
      intent,
      isTechnicalView: false,
      styleDirective:
        'Render in a dense, clean architectural point-cloud style with clear depth cues and consistent color coding for materials.',
      cameraDirective:
        'Preserve the exact base-image camera framing, geometry, massing, and spatial proportions.',
      antiDriftDirective:
        'Do not switch to photomontage collage or cartoon styles; keep it as a coherent point-cloud render.',
    };
  }

  const styleDirective = isTechnicalView
    ? 'Render as a high-fidelity materialised architectural presentation drawing with restrained tonal shading, clear hierarchy, and no cinematic scene effects.'
    : 'Render as a photorealistic architectural visualization with realistic textures, shadows, reflections, and depth.';

  let cameraDirective = 'Keep the camera position, lens perspective, and framing locked to the base image.';
  if (intent === 'elevation') {
    cameraDirective =
      'Use a true frontal orthographic elevation plate with zero perspective distortion, strict vertical/horizontal alignment, and clean datum reading.';
  } else if (intent === 'section') {
    cameraDirective =
      'Use a true orthographic section plate with a clear cut condition, explicit cut-versus-beyond hierarchy, and no spatial staging.';
  } else if (intent === 'plan') {
    cameraDirective = 'Use a true top-down orthographic plan plate while preserving layout geometry and adjacency relationships.';
  } else if (intent === 'axonometric') {
    cameraDirective =
      'Use an axonometric/isometric view with stable projection and coherent depth relationships.';
  } else if (intent === 'interior') {
    cameraDirective = 'Use an interior viewpoint with believable eye-level perspective and realistic lighting.';
  } else if (intent === 'street-level') {
    cameraDirective =
      'Use a pedestrian street-level viewpoint with natural eye-height perspective and believable scale.';
  } else if (intent === 'aerial') {
    cameraDirective = 'Use an aerial/bird-eye viewpoint while keeping overall building composition coherent.';
  } else if (intent === 'exterior') {
    cameraDirective =
      'Use an exterior architectural viewpoint with realistic perspective and environment integration.';
  }

  return {
    intent,
    isTechnicalView,
    styleDirective,
    cameraDirective,
    antiDriftDirective:
      'Unless explicitly requested, never switch to point-cloud, wireframe, mesh, line-art, clay, or schematic output.',
  };
}

