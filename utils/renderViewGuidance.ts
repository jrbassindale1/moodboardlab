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

export function getRenderViewGuidance(input?: string | null): RenderViewGuidance {
  const intent = detectRenderViewIntent(input);
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
    ? 'Render as a high-fidelity architectural technical view with realistic material behavior but restrained cinematic effects.'
    : 'Render as a photorealistic architectural visualization with realistic textures, shadows, reflections, and depth.';

  let cameraDirective = 'Keep the camera position, lens perspective, and framing locked to the base image.';
  if (intent === 'elevation') {
    cameraDirective =
      'Use a frontal elevation view with minimal perspective distortion and clean vertical alignment.';
  } else if (intent === 'section') {
    cameraDirective =
      'Use a sectional view with a clear cut condition and readable depth behind the cut plane.';
  } else if (intent === 'plan') {
    cameraDirective = 'Use a top-down plan-style view while preserving layout geometry and scale relationships.';
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

