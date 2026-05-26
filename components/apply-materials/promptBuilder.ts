import type { MaterialOption, StyleReferenceSource } from '../../types';
import {
  DrawingType,
  getDrawingTypePromptDirectives,
  getRenderViewGuidanceForDrawingType,
  inferDrawingType,
} from '../../utils/renderViewGuidance';
import { ACTIVITY_OPTIONS, SEASON_OPTIONS, TIME_OPTIONS, VIEW_OPTIONS, WEATHER_OPTIONS } from './constants';
import type { SceneControls } from './types';

type BuildApplyRenderPromptParams = {
  renderMaterials: MaterialOption[];
  sceneControls: SceneControls;
  renderNote: string;
  editPrompt?: string;
  requestedDrawingType?: DrawingType;
  uploadedImageName?: string | null;
  isEditingRender: boolean;
  isUpscalingRender: boolean;
  styleReferenceImagePresent: boolean;
  effectiveStyleReferenceSource: StyleReferenceSource | null;
  hasSceneControlsEnabled: boolean;
  summaryText: string;
};

const buildSceneControlsText = (controls: SceneControls): string => {
  const parts: string[] = [];

  if (controls.weather.enabled) {
    parts.push(`adjust atmospheric weather to ${WEATHER_OPTIONS[controls.weather.value]} (sky, clouds, light quality only - preserve all geometry and landscape)`);
  }
  if (controls.activity.enabled) {
    parts.push(`adjust entourage to ${ACTIVITY_OPTIONS[controls.activity.value]} activity level (people count/density only - no changes to architecture or site)`);
  }
  if (controls.timeOfDay.enabled) {
    parts.push(`adjust lighting to ${TIME_OPTIONS[controls.timeOfDay.value]} (sun angle, shadows, ambient light only - keep everything else identical)`);
  }
  if (controls.season.enabled) {
    parts.push(`adjust seasonal character to ${SEASON_OPTIONS[controls.season.value]} (vegetation appearance, foliage color only - preserve landscape type and site layout)`);
  }
  if (controls.viewCharacter.enabled) {
    parts.push(`adjust scene styling to ${VIEW_OPTIONS[controls.viewCharacter.value]} character (entourage detail level, styling approach only - no geometry changes)`);
  }

  if (parts.length === 0) return '';

  return `SUBTLE SCENE ADJUSTMENTS (preserve all architecture, geometry, camera, and landscape): ${parts.join('; ')}.`;
};

const buildPerMaterialLines = (renderMaterials: MaterialOption[]) => {
  const materialsByCategory: Record<string, MaterialOption[]> = {};
  renderMaterials.forEach((item) => {
    if (!materialsByCategory[item.category]) {
      materialsByCategory[item.category] = [];
    }
    materialsByCategory[item.category].push(item);
  });

  return Object.entries(materialsByCategory)
    .map(([category, items]) => {
      const categoryHeader = `\n[${category.toUpperCase()}]`;
      const itemLines = items
        .map((item) => {
          const finishHasColorInfo =
            Boolean(item.colorLabel) ||
            item.finish.includes(' — ') ||
            item.finish.match(/\(#[0-9a-fA-F]{6}\)/) ||
            item.finish.toLowerCase().includes('colour') ||
            item.finish.toLowerCase().includes('color') ||
            item.finish.toLowerCase().includes('select');

          let colorInfo = '';
          if (finishHasColorInfo) {
            if (item.colorLabel) {
              colorInfo = ` | color: ${item.colorLabel}`;
            } else {
              const labelMatch = item.finish.match(/ — ([^(]+)/);
              if (labelMatch) {
                colorInfo = ` | color: ${labelMatch[1].trim()}`;
              } else if (item.finish.match(/\(#[0-9a-fA-F]{6}\)/)) {
                colorInfo = ` | color: ${item.tone}`;
              }
            }
          }

          return `- ${item.name} (${item.finish})${colorInfo} | description: ${item.description}`;
        })
        .join('\n');
      return `${categoryHeader}\n${itemLines}`;
    })
    .join('\n');
};

export const buildApplyRenderPrompt = ({
  renderMaterials,
  sceneControls,
  renderNote,
  editPrompt,
  requestedDrawingType = 'auto',
  uploadedImageName,
  isEditingRender,
  isUpscalingRender,
  styleReferenceImagePresent,
  effectiveStyleReferenceSource,
  hasSceneControlsEnabled,
  summaryText,
}: BuildApplyRenderPromptParams): string => {
  const perMaterialLines = buildPerMaterialLines(renderMaterials);
  const trimmedNote = renderNote.trim();
  const sceneControlsText = buildSceneControlsText(sceneControls);
  const noTextRule =
    'CRITICAL REQUIREMENT - ABSOLUTELY NO TEXT WHATSOEVER in the image: no words, letters, numbers, labels, captions, logos, watermarks, signatures, stamps, or typographic marks of ANY kind. NO pseudo-text, NO scribbles, NO marks that resemble writing. This is a STRICT requirement that must be followed. The image must be completely free of all textual elements, letters, numbers, and symbols.';
  const humanFigureInstruction = [
    'HUMAN FIGURE FIDELITY:',
    '- If human figures appear, render them with natural anatomy, coherent eyes and mouths, realistic proportions, and clean silhouettes.',
    '- Avoid distorted faces, duplicate limbs, malformed hands, and crowd artifacts.',
    '- For distant figures, use subtle believable facial detail rather than over-sharpened invented features.',
    '- Preserve any human figures already present in the base image, especially foreground figures. Do not remove, replace, relocate, or materially redesign them unless explicitly requested.'
  ].join('\n');

  const drawingTypeResolution = inferDrawingType({
    requestedType: requestedDrawingType,
    userText: `${editPrompt || ''}\n${trimmedNote}`,
    baseImageName: uploadedImageName || null,
  });
  const drawingType = drawingTypeResolution.drawingType;
  const shouldPreserveSourceView = false;
  const viewGuidance = shouldPreserveSourceView
    ? {
        intent: 'unknown' as const,
        isTechnicalView: true,
        styleDirective:
          'Preserve the source projection and architectural placement. Do not reinterpret an orthographic drawing as a perspective scene, and do not flatten a perspective image.',
        cameraDirective:
          'Keep the same projection, viewpoint, framing, and architectural placement as the base image.',
        antiDriftDirective:
          'When the view type is ambiguous, preserve projection and framing rather than inventing a new camera; unresolved placeholder regions may still be fully completed.',
      }
    : getRenderViewGuidanceForDrawingType(drawingType);
  const representationDirectives = shouldPreserveSourceView
    ? [
        'REPRESENTATION TYPE: preserve-source-view (auto fallback).',
        'Do not guess a new view type from ambiguous input; preserve the source projection and camera.',
        'If the input reads as elevation, section, plan, axonometric, or another orthographic drawing, keep it orthographic with no perspective distortion.',
        'If the input reads as perspective, keep the same perspective and framing.',
        'Complete unresolved/blank placeholder regions in a way that is consistent with the preserved view; do not preserve flat grey unfinished areas literally.',
      ]
    : getDrawingTypePromptDirectives({
        drawingType,
        userInstruction: `${editPrompt || ''}\n${trimmedNote}`,
        allowUserDrivenPerspectiveConversion: true,
      });
  const resolvedDrawingTypeLabel = shouldPreserveSourceView ? 'preserve-source-view' : drawingType;
  const representationControlText = [
    'REPRESENTATION CONTROL:',
    `- requested drawingType: ${requestedDrawingType}`,
    `- resolved drawingType: ${resolvedDrawingTypeLabel} (source: ${drawingTypeResolution.source})`,
    ...representationDirectives.map((line) => `- ${line}`),
  ].join('\n');

  const atmosphereInstruction = shouldPreserveSourceView
    ? '- Preserve the source view with restrained architectural lighting. Do not introduce cinematic effects or atmospheric staging that would change how the drawing reads, but do complete unresolved foreground/background placeholder regions coherently.'
    : (viewGuidance.isTechnicalView || drawingType !== 'perspective')
    ? '- Use neutral, even lighting and keep edges/cut geometry crisp; avoid cinematic haze, vignette, and dramatic color grading.'
    : '- Include atmospheric effects: subtle depth haze, realistic sky, natural color grading. The sky, ground plane, foreground, and all site context must be fully rendered — do NOT leave landscape, terrain, vegetation, water, or background regions incomplete, faded, or unresolved. Every element of the scene must be photorealistic and complete to the edges of the image.';
  const lineDrawingInstruction = shouldPreserveSourceView
    ? '- If input is a line drawing, sketch, or CAD export: preserve its existing projection and architectural placement. Do not reinterpret it into a different view type. You may fully resolve unfinished/blank regions consistent with that same view.'
    : drawingType === 'perspective'
    ? '- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to a photorealistic perspective render while preserving source framing.'
    : `- If input is a line drawing/sketch/CAD export: preserve the ${drawingType} projection and convert it into a materialised orthographic ${drawingType} presentation drawing without introducing perspective drift.`;
  const presentationConventionInstruction = shouldPreserveSourceView
    ? '- PRESENTATION CONVENTION: preserve the source drawing/view convention exactly. If it is orthographic, keep parallel lines and datum logic. If it is perspective, keep the existing camera and framing.'
    : drawingType === 'elevation'
    ? '- ELEVATION PRESENTATION CONVENTIONS: keep a crisp continuous ground line/datum, a flat frontal facade reading, no visible perspective depth, and only a restrained elevation-style backdrop.'
    : drawingType === 'section'
    ? '- SECTION PRESENTATION CONVENTIONS: keep cut geometry legible, maintain the cut datum, and avoid immersive perspective staging.'
    : drawingType === 'plan'
    ? '- PLAN PRESENTATION CONVENTIONS: keep a flat top-down drawing reading with no horizon, no eye-level depth, and no oblique scene effects.'
    : '';
  const orthographicRealismInstruction = shouldPreserveSourceView
    ? '- PRESENTATION QUALITY: add material realism without altering the underlying representation or composition.'
    : drawingType === 'elevation'
    ? '- ELEVATION PRESENTATION QUALITY: use material realism through texture hierarchy and tonal control, with restrained reflections and minimal depth effects, while keeping the output a flat orthographic elevation plate.'
    : drawingType === 'section'
    ? '- SECTION PRESENTATION QUALITY: emphasise section legibility with clear cut-versus-beyond contrast, restrained material tonality, minimal depth effects, and no cutaway rendering style.'
    : drawingType === 'plan'
    ? '- PLAN PRESENTATION QUALITY: use realistic top-down material expression with restrained tonality and no spatial depth cues, keeping the plan flat, clear, and fully orthographic.'
    : '';
  const orthographicMaterialAssignmentInstruction = shouldPreserveSourceView
    ? '- MATERIAL MAPPING (STRICT): apply the listed materials accurately while preserving the exact geometry and representation shown in the base image.'
    : drawingType === 'section'
    ? '- SECTION MATERIAL MAPPING (STRICT): assign materials with explicit hierarchy: cut structure/poche first, seen-beyond structure second, then cladding, glazing, internal finishes, ground/earth, and finally objects beyond the cut plane. Keep these categories visually distinct.'
    : drawingType === 'elevation'
    ? '- ELEVATION MATERIAL MAPPING (STRICT): keep structure, cladding, glazing, and infill legible as separate systems with consistent tonal hierarchy and no scene-style blending.'
    : drawingType === 'plan'
    ? '- PLAN MATERIAL MAPPING (STRICT): distinguish structure, floor finishes, glazing lines, and external/ground zones clearly, with no perspective-style overlap or depth staging.'
    : '';
  const projectionConstraint = shouldPreserveSourceView
    ? '\n*** CRITICAL SOURCE-VIEW CONSTRAINT ***\nThe source view is ambiguous, so preserve projection, camera, framing, and architectural placement.\n- Do NOT invent a new camera, horizon, or angle\n- If the input is orthographic, keep it orthographic with zero perspective distortion\n- If the input is perspective, keep the same perspective and framing\n- When uncertain, preserve the input projection rather than reinterpreting it\n- Unresolved/blank placeholder regions may be completed, but must stay consistent with the preserved view\n***'
    : drawingType !== 'perspective'
    ? `\n*** CRITICAL ORTHOGRAPHIC CONSTRAINT ***\nThis is an ORTHOGRAPHIC ${drawingType.toUpperCase()} - DO NOT CONVERT TO PERSPECTIVE.\n- ZERO perspective distortion allowed\n- Maintain parallel lines and equal scaling across the view\n- No eye-level rotation or angular viewpoints\n- Camera must be perpendicular to the plane of the ${drawingType} (${drawingType === 'plan' ? 'looking straight down from above' : drawingType === 'elevation' ? 'looking straight at the facade' : 'looking perpendicular at the cut plane'})\n- The output MUST read as a presentation ${drawingType}, not as a frontal render or immersive scene\n- Do not introduce environmental depth staging, foreground framing, or perspective ground planes\n- Preserve or restate the primary datum/ground line where applicable\n***`
    : '';
  const renderTargetInstruction = shouldPreserveSourceView
    ? 'Transform the provided base image into a photorealistic architectural render while preserving the source projection, camera, framing, and architectural placement. Complete unresolved placeholder regions where needed, without changing the representation type.'
    : drawingType === 'perspective'
    ? `Transform the provided base image into a PHOTOREALISTIC architectural render while applying the materials listed below.\n\nPHOTOREALISM MANDATE: The output must be a fully resolved, camera-quality photorealistic architectural visualisation. Every part of the image — building, landscape, sky, ground, foreground, background, and edges — must be rendered to completion. Do NOT leave any region sketchy, diagrammatic, faded, soft-focus to the point of incompleteness, or unresolved. Treat every pixel of the output as equally important. The image must read as a professional CGI render or high-end architectural photograph — not a sketch, moodboard, or partial illustration.`
    : `Render this as a flat 2D orthographic ${drawingType} presentation drawing with materialised architectural finishes. Do NOT convert to 3D perspective. Apply the materials listed below while maintaining the exact orthographic projection of the input.`;
  const projectionPreservationInstruction = shouldPreserveSourceView
    ? '- OUTPUT MUST PRESERVE SOURCE VIEW: keep projection, camera, framing, and architectural placement from the base image; unresolved placeholder regions may be fully resolved.'
    : drawingType === 'perspective'
    ? '- OUTPUT MUST MAINTAIN SOURCE PERSPECTIVE: preserve the existing camera angle, lens feel, framing, and spatial reading of the base image.'
    : '- OUTPUT MUST MAINTAIN ORTHOGRAPHIC PROJECTION: material detail must be realistic and tactile, but geometry must remain flat 2D with no perspective distortion';
  const photorealInputInstruction = shouldPreserveSourceView
    ? '- If input is already photorealistic: preserve its existing projection and camera while applying the material palette.'
    : drawingType === 'perspective'
    ? '- If input is already photorealistic: preserve its existing perspective, camera, and composition while applying the material palette.'
    : '- If input is already photorealistic: reinterpret as a materialised orthographic presentation drawing while preserving geometry';
  const projectionLockInstruction = shouldPreserveSourceView
    ? '- LOCK PROJECTION AND FRAMING: Keep source projection and framing of the base image; do not reinterpret the view type. Completing unresolved placeholder regions is allowed if representation stays consistent.'
    : drawingType === 'perspective'
    ? '- LOCK CAMERA AND FRAMING: Keep the exact perspective, viewpoint, lens feel, and framing of the base image.'
    : '- LOCK PROJECTION AND FRAMING: Keep the exact orthographic orientation and framing of the base image; do not introduce perspective logic';
  const contextInstruction = shouldPreserveSourceView
    ? '- Preserve context in a restrained way that matches the source representation; do not invent immersive staging, but do resolve unfinished context areas so the image is complete.'
    : drawingType === 'perspective'
    ? '- Preserve site context and atmospheric depth only insofar as they already belong to the source view; do not invent a new scene composition.'
    : '- For orthographic drawings, do not preserve or enhance immersive site context; prefer a restrained backdrop and clear datum reading';
  const lightingInstruction = drawingType === 'perspective'
    ? '- Use realistic architectural lighting with coherent shadows, reflections, and depth while preserving source camera and geometry.'
    : '- Use restrained, even presentation-drawing lighting with crisp edges and minimal atmospheric effects';
  const outputQualityInstruction = drawingType === 'perspective'
    ? '- Keep output quality as a fully resolved photorealistic architectural image: clear hierarchy, coherent tonality, and complete scene coverage.'
    : '- Keep output quality as a composed architectural plate: clear hierarchy, restrained tonality, and no immersive scene composition';

  const basePrompt = isUpscalingRender
    ? `Create a 4K upscaled version of the provided architectural render. Preserve the exact composition, camera position, geometry, materials, entourage, and lighting from the source image. Do not redesign or reinterpret the image. Increase resolution, sharpen material detail, and improve fine-grain realism only.\n\n${humanFigureInstruction}`
    : isEditingRender
    ? `You are in a multi-turn render conversation. Use the provided previous render as the base image and update it while preserving the composition, camera, and lighting. Keep material assignments consistent with the list below and do not remove existing context unless explicitly requested.\n\n${noTextRule}\n\nVIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n\n${representationControlText}\n\nMaterials to respect:\n${summaryText}\n\nNew instruction:\nBEFORE MAKING ANY CHANGES - CRITICAL CONSTRAINTS TO PRESERVE:\n- GEOMETRY: Keep ALL building forms, volumes, floor plans, and structural massing EXACTLY as shown - pixel-accurate preservation required\n- CAMERA: Use EXACT same viewpoint, angle, height, focal length, framing - no perspective shifts allowed\n- LANDSCAPE: Preserve ALL terrain, topography, water bodies, ground plane, site context - if water exists keep it, if hills exist keep them, do NOT change landscape type\n- ARCHITECTURE: Do NOT add, remove, resize, or relocate any windows, doors, walls, roofs, or structural elements\n- SITE: Keep all paths, decking, paving, retaining walls, and site infrastructure exactly as shown\n- ONLY ADJUST: Atmosphere (sky, clouds, weather), lighting quality (sun angle, shadows), entourage (people, vegetation appearance within existing landscape), and surface material finishes\n\n${editPrompt || ''}${sceneControlsText ? `\n${sceneControlsText}` : ''}${trimmedNote ? `\nAdditional render note: ${trimmedNote}` : ''}`
    : drawingType === 'perspective'
    ? `Transform the provided base image into a PHOTOREALISTIC architectural render while applying the materials listed below. Materials are organized by their architectural category to help you understand where each should be applied. If the input is a line drawing, sketch, CAD export (SketchUp, Revit, AutoCAD), or diagram, you MUST convert it into a fully photorealistic visualization with realistic lighting, textures, depth, and atmosphere.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- VIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n- OUTPUT MUST BE PHOTOREALISTIC: realistic lighting, shadows, reflections, material textures, and depth of field\n- APPLY MATERIALS ACCORDING TO THEIR CATEGORIES: floors to horizontal surfaces, walls to vertical surfaces, ceilings to overhead surfaces, external materials to facades, etc.\n- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to photorealistic render\n- If input is already photorealistic: enhance and apply materials while maintaining realism\n\nGEOMETRY PRESERVATION - CRITICAL:\n- STRICT ADHERENCE TO INPUT GEOMETRY: Do NOT alter, modify, reshape, or reinterpret the building forms, volumes, or spatial layout from the base image\n- PRESERVE EXACT BUILDING FOOTPRINT: Maintain the precise floor plan, building outline, and structural massing shown in the input\n- LOCK CAMERA POSITION: Use the EXACT camera angle, viewpoint height, focal length, and framing from the base image - do not shift perspective or change the view\n- MAINTAIN PROPORTIONS: Keep all dimensional relationships, floor heights, window-to-wall ratios, and scale relationships identical to the input\n- RESPECT ARCHITECTURAL ELEMENTS: Do not add, remove, resize, or relocate windows, doors, columns, walls, roofs, or structural components\n- PRESERVE SPATIAL RELATIONSHIPS: Maintain distances between buildings, relationship to ground plane, and overall site composition\n- DO NOT INVENT NEW BUILDING MASS: preserve intentional open gaps, courtyards, voids, setbacks, undercrofts, terraces, and spaces between volumes as designed in the source image\n- Unresolved regions may be completed as ground, paving, planting, shadow, sky, or contextual environment, but not as additional architecture unless clearly indicated in the source\n- NO GEOMETRY DRIFT: The building shape, form, and layout must remain pixel-accurate to the input - only materials, lighting, and surface finishes should change\n\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n- Add realistic environmental lighting (natural daylight, ambient occlusion, soft shadows)\n${atmosphereInstruction}\n- Materials must look tactile and realistic with proper surface properties (roughness, reflectivity, texture detail)\n- Maintain architectural accuracy while achieving photographic quality\n- White background not required; enhance or maintain contextual environment from base image\n${sceneControlsText ? `- ${sceneControlsText}\n` : ''}${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`
    : `${projectionConstraint ? `${projectionConstraint}\n\n` : ''}${renderTargetInstruction} Materials are organized by their architectural category to help you understand where each should be applied.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- VIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n${representationControlText}\n${projectionPreservationInstruction}\n${orthographicMaterialAssignmentInstruction}\n${presentationConventionInstruction}\n${orthographicRealismInstruction}\n${lineDrawingInstruction}\n${photorealInputInstruction}\n\nGEOMETRY PRESERVATION - CRITICAL:\n- STRICT ADHERENCE TO INPUT GEOMETRY: Do NOT alter, modify, reshape, or reinterpret the building forms, volumes, or spatial layout from the base image\n- PRESERVE EXACT BUILDING FOOTPRINT: Maintain the precise floor plan, building outline, and structural massing shown in the input\n${projectionLockInstruction}\n- MAINTAIN PROPORTIONS: Keep all dimensional relationships, floor heights, window-to-wall ratios, and scale relationships identical to the input\n- RESPECT ARCHITECTURAL ELEMENTS: Do not add, remove, resize, or relocate windows, doors, columns, walls, roofs, or any structural components\n- PRESERVE SPATIAL RELATIONSHIPS: Maintain relationships to datum lines and overall orthographic composition exactly as shown\n- NO GEOMETRY DRIFT: The building shape, form, and layout must remain pixel-accurate to the input - only materials, tonal hierarchy, and restrained shading should change\n\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n${lightingInstruction}\n${atmosphereInstruction}\n${outputQualityInstruction}\n${contextInstruction}\n${sceneControlsText ? `- ${sceneControlsText}\n` : ''}${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`;

  const useStyleReference = Boolean(styleReferenceImagePresent && !isUpscalingRender);
  const sceneControlsOverrideLine = hasSceneControlsEnabled
    ? '\n- Where scene controls (time of day, weather, season) conflict with the style reference, the SCENE CONTROLS take priority.'
    : '';
  const projectStyleReferenceBlock = `\n\nSTYLE REFERENCE IMAGE (FROM THIS PROJECT):\nTwo images are provided.\n- IMAGE 1 is the BASE IMAGE and is the ONLY authority on geometry, composition, camera, massing, landscape, and architectural layout.\n- IMAGE 2 is a PROJECT STYLE REFERENCE generated from the same material palette.\n\nUse IMAGE 2 to ensure VISUAL CONSISTENCY across the project:\n- Match how each material has been rendered - board direction, joint spacing, texture scale, surface reflectivity, colour tone, and weathering character\n- Maintain the same lighting quality, shadow behaviour, and colour temperature\n- Ensure the two renders look like they belong to the same architectural scheme\n- Carry forward the same level of material detail and photographic quality\n\nThe material list above still controls WHAT materials go WHERE. The project reference controls HOW those same materials should be expressed visually - their texture, scale, tone, and finish quality.\n\nABSOLUTE GEOMETRY FIREWALL:\n- NEVER transfer, blend, average, merge, interpolate, or borrow geometry from IMAGE 2\n- Do NOT copy building form, silhouette, rooflines, window patterns, door positions, facade arrangement, floor count, structural rhythm, site layout, horizon line, or camera perspective from IMAGE 2\n- If IMAGE 2 conflicts with IMAGE 1 in ANY spatial or architectural way, discard IMAGE 2 geometry completely and follow IMAGE 1 exactly\n- Treat IMAGE 2 as a material-expression, lighting, and finish-quality reference only - NOT as a spatial reference\n- Final output must preserve the footprint, outline, openings, proportions, and framing of IMAGE 1 only${sceneControlsOverrideLine}`;
  const externalStyleReferenceBlock = `\n\nSTYLE REFERENCE IMAGE (EXTERNAL):\nTwo images are provided.\n- IMAGE 1 is the BASE IMAGE and is the ONLY authority on geometry, composition, camera, massing, landscape, and architectural layout.\n- IMAGE 2 is an EXTERNAL STYLE REFERENCE.\n\nUse IMAGE 2 ONLY to inform the overall rendering quality:\n- Lighting behaviour (how light falls on surfaces, shadow softness, sun angle quality)\n- Colour grading and colour temperature (warm/cool, muted/saturated)\n- Depth of field and photographic character\n- Overall atmospheric mood\n\nSTRICT EXTERNAL REFERENCE RULES:\n- Do NOT take ANY material, colour, or surface information from IMAGE 2. ALL materials must come strictly and exclusively from the material list above. The material palette is the only authority on what materials appear and where.\n- NEVER transfer, blend, average, merge, interpolate, or borrow geometry from IMAGE 2.\n- Do NOT copy building form, silhouette, rooflines, window patterns, door positions, facade arrangement, floor count, structural rhythm, site layout, horizon line, or camera perspective from IMAGE 2.\n- If IMAGE 2 conflicts with IMAGE 1 in ANY spatial or architectural way, discard IMAGE 2 geometry completely and follow IMAGE 1 exactly.\n- Treat IMAGE 2 as a lighting, atmosphere, and photographic-quality reference only - NOT as a spatial or material reference.\n- This reference influences HOW the render looks, not WHAT it contains.${sceneControlsOverrideLine}`;
  const styleReferenceBlock = effectiveStyleReferenceSource === 'project'
    ? projectStyleReferenceBlock
    : externalStyleReferenceBlock;

  return useStyleReference ? `${basePrompt}${styleReferenceBlock}` : basePrompt;
};
