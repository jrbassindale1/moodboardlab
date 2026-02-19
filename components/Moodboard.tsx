import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Wand2 } from 'lucide-react';
import ChosenMaterialsList from './moodboard/ChosenMaterialsList';
import SustainabilityBriefingSection from './moodboard/SustainabilityBriefingSection';
import MoodboardRenderSection from './moodboard/MoodboardRenderSection';
import {
  generateBriefingPdf as buildBriefingPdf,
  generateMaterialsSheetPdf as buildMaterialsSheetPdf,
} from '../utils/moodboardPdfGenerators';
import {
  MATERIAL_LIFECYCLE_PROFILES,
  LifecycleProfile,
  LifecycleStageKey,
} from '../lifecycleProfiles';
import {
  callGeminiImage,
  callGeminiText,
  checkQuota,
  saveGenerationAuth,
  savePdfAuth,
  generateSustainabilityBriefing
} from '../api';
import { MaterialOption } from '../types';
import { useAuth, useUsage } from '../auth';
import { generateMaterialIcon } from '../utils/materialIconGenerator';

// Sustainability report utilities
import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  ReportProse,
  Hotspot,
  UKCheck,
  Benefit,
  Risk,
} from '../types/sustainability';
import { calculateMaterialMetrics } from '../utils/sustainabilityScoring';
import { generateDesignRisk, generateDesignResponse } from '../utils/designConsequences';
import { isLandscapeMaterial } from '../utils/lifecycleDurations';
import {
  prepareBriefingPayload,
  getSustainabilityBriefingSystemInstruction,
  getBriefingMaterialsKey,
  type SustainabilityBriefingResponse,
  type SustainabilityBriefingPayload,
} from '../utils/sustainabilityBriefing';

type BoardItem = MaterialOption;

// Use enhanced sustainability insight type from types/sustainability.ts
type SustainabilityInsight = EnhancedSustainabilityInsight;

interface MoodboardProps {
  onNavigate?: (page: string) => void;
  initialBoard?: BoardItem[];
  onBoardChange?: (items: BoardItem[]) => void;
  moodboardRenderUrl?: string | null;
  onMoodboardRenderUrlChange?: (url: string | null) => void;
  sustainabilityBriefing?: SustainabilityBriefingResponse | null;
  onSustainabilityBriefingChange?: (value: SustainabilityBriefingResponse | null) => void;
  briefingPayload?: SustainabilityBriefingPayload | null;
  onBriefingPayloadChange?: (value: SustainabilityBriefingPayload | null) => void;
  onBriefingMaterialsKeyChange?: (value: string | null) => void;
  briefingInvalidatedMessage?: string | null;
  onBriefingInvalidatedMessageChange?: (value: string | null) => void;
}

type MoodboardFlowProgress = {
  step: number;
  total: number;
  label: string;
  state: 'running' | 'complete' | 'error';
};

const MOODBOARD_FLOW_TOTAL_STEPS = 2;
const CUSTOM_PAINT_IDS = new Set(['custom-wall-paint', 'custom-ceiling-paint']);
const GENERIC_COLOUR_SEGMENT_RE =
  /\b(multiple|select|choose|chosen|custom|palette|colou?r|color|tone|finish|texture|variant|option|options|ral|hex\/rgb)\b/i;

const normalizeSpacing = (value: string) =>
  value
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

const normalizeSelectedPaintMaterial = (material: MaterialOption): MaterialOption => {
  const isPaintCategory = material.category === 'paint-wall' || material.category === 'paint-ceiling';
  if (!isPaintCategory) return material;

  const hasCustomWording =
    CUSTOM_PAINT_IDS.has(material.id) ||
    /custom\s+colou?r/i.test(material.name) ||
    /\bcustom\b/i.test(material.finish) ||
    /pick any hex\/rgb|define a custom hex\/rgb/i.test(material.description);
  if (!hasCustomWording) return material;

  const fallbackName = material.category === 'paint-wall' ? 'Paint – Walls' : 'Paint – Ceilings';
  const fallbackFinish = material.category === 'paint-wall' ? 'Emulsion paint' : 'Ceiling paint';
  const fallbackDescription =
    material.category === 'paint-wall'
      ? 'Selected wall paint colour with matte, satin, or gloss finish.'
      : 'Selected ceiling paint colour with matte, satin, or gloss finish.';

  const namedByCategory =
    material.category === 'paint-wall'
      ? material.name.replace(/paint\s*[–-]\s*custom\s+colou?r\s*\(walls\)/i, 'Paint – Walls')
      : material.name.replace(/paint\s*[–-]\s*custom\s+colou?r\s*\(ceilings\)/i, 'Paint – Ceilings');

  const cleanedName =
    normalizeSpacing(
      namedByCategory
        .replace(/\bcustom\s+colou?r\b/gi, '')
        .replace(/\bcustom\b/gi, '')
    ) || fallbackName;

  const cleanedFinish =
    normalizeSpacing(
      material.finish
        .replace(/\bcustom\s+emulsion\s+colou?r\b/gi, 'Emulsion paint')
        .replace(/\bcustom\s+ceiling\s+paint\s+colou?r\b/gi, 'Ceiling paint')
        .replace(/\bcustom\s+paint\s+colou?r\b/gi, 'Paint')
        .replace(/\bcustom\b/gi, '')
    ) || fallbackFinish;

  const cleanedDescription = /pick any hex\/rgb|define a custom hex\/rgb/i.test(material.description)
    ? fallbackDescription
    : normalizeSpacing(material.description) || fallbackDescription;

  return {
    ...material,
    name: cleanedName,
    finish: cleanedFinish,
    description: cleanedDescription
  };
};

const normalizeSelectedColourWording = (material: MaterialOption): MaterialOption => {
  const finishSegments = material.finish
    .split(/\s[—-]\s/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  let cleanedFinish = material.finish;
  const explicitSelectionMatch = material.finish.match(
    /^(.*?)(?:\s[—-]\s*)(?:select|choose|chosen|custom)\s+(?:colou?r|color|finish|texture|tone|variant|option|options)(?:\s[—-]\s*)(.+)$/i
  );

  if (explicitSelectionMatch?.[1] && explicitSelectionMatch?.[2]) {
    cleanedFinish = normalizeSpacing(`${explicitSelectionMatch[1]} — ${explicitSelectionMatch[2]}`);
  }

  if (!explicitSelectionMatch && finishSegments.length >= 3) {
    const base = finishSegments[0];
    const middle = finishSegments.slice(1, -1).join(' ');
    const selectedLabel = finishSegments[finishSegments.length - 1];
    if (GENERIC_COLOUR_SEGMENT_RE.test(middle) && selectedLabel) {
      cleanedFinish = normalizeSpacing(`${base} — ${selectedLabel}`);
    }
  } else if (
    finishSegments.length === 2 &&
    GENERIC_COLOUR_SEGMENT_RE.test(finishSegments[1]) &&
    /\(#[0-9a-fA-F]{6}\)/.test(finishSegments[1])
  ) {
    const cleanedSuffix = normalizeSpacing(
      finishSegments[1]
        .replace(
          /\b(select|choose|chosen|custom|multiple)\s+(?:colou?r|color|finish|texture|tone|variant|option|options)\b|\bselect\b|\bchoose\b|\bchosen\b|\bcustom\b|\bmultiple\b/gi,
          ''
        )
        .replace(/\bral\s+colou?r\b|\bcolou?r\s+range\b|\bcolor\s+range\b|\bfinish\s+range\b|\bfinish\s+selector\b/gi, '')
    );
    cleanedFinish = cleanedSuffix ? normalizeSpacing(`${finishSegments[0]} ${cleanedSuffix}`) : finishSegments[0];
  }

  const selectedColourChosen =
    finishSegments.length >= 3 ||
    /\(#[0-9a-fA-F]{6}\)/.test(cleanedFinish) ||
    Boolean(material.colorLabel);

  const cleanedDescription = selectedColourChosen
    ? normalizeSpacing(
        material.description
          .replace(/\s*Palette\s+spans[^.]*\.\s*/i, ' ')
          .replace(/\s*Available\s+in\s+many\s+RAL\s+colou?rs?[^.]*\.\s*/i, ' ')
          .replace(/\s*Pick\s+any\s+HEX\/RGB\s+colou?r[^.]*\.\s*/i, ' ')
          .replace(/\s*Define\s+a\s+custom\s+HEX\/RGB\s+colou?r[^.]*\.\s*/i, ' ')
          .replace(/\s*pair\s+with\s+the\s+finish\s+selector\.?\s*/i, ' ')
          .replace(/\s*with\s+selectable\s+finish\.?\s*/i, ' ')
          .replace(/\s*available\s+in\s+custom\s+colou?rs?\.?\s*/i, ' ')
          .replace(/\s*with\s+various\s+finishes?[^.;]*[.;]?/i, '.')
          .replace(/\s*and\s+customi[sz]able[^.;]*[.;]?/i, '.')
          .replace(/,\s*and\s+available\s+in[^.;]*[.;]?/i, '.')
          .replace(/\s*with\s+full\s+RAL\s+colou?r\s+range[^.;]*[.;]?/i, '.')
          .replace(/\s*offered\s+in\s+the\s+finish\s+range[^.;]*[.;]?/i, '.')
          .replace(/\s*available\s+in\s+a\s+zinc\s+finish\s+range[^.;]*[.;]?/i, '.')
          .replace(/\.\./g, '.')
      )
    : material.description;

  if (cleanedFinish === material.finish && cleanedDescription === material.description) {
    return material;
  }

  return {
    ...material,
    finish: cleanedFinish,
    description: cleanedDescription
  };
};

const normalizeSelectedMaterial = (material: MaterialOption): MaterialOption =>
  normalizeSelectedColourWording(normalizeSelectedPaintMaterial(material));

const normalizeBoardItems = (items: MaterialOption[]) => items.map(normalizeSelectedMaterial);

const areBoardItemsEquivalent = (a: MaterialOption, b: MaterialOption) =>
  a === b ||
  (a.id === b.id &&
    a.name === b.name &&
    a.finish === b.finish &&
    a.description === b.description &&
    a.tone === b.tone &&
    a.category === b.category &&
    a.colorLabel === b.colorLabel &&
    a.colorVariantId === b.colorVariantId &&
    a.customImage === b.customImage &&
    a.excludeFromMoodboardRender === b.excludeFromMoodboardRender);

const areBoardsEquivalent = (a: MaterialOption[], b: MaterialOption[]) =>
  a.length === b.length && a.every((item, index) => areBoardItemsEquivalent(item, b[index]));

const dataUrlToInlineData = (dataUrl: string) => {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = meta?.match(/data:(.*);base64/);
  return {
    inlineData: {
      mimeType: mimeMatch?.[1] || 'image/png',
      data: content || ''
    }
  };
};

const LIFECYCLE_STAGE_ORDER: LifecycleStageKey[] = [
  'raw',
  'manufacturing',
  'transport',
  'installation',
  'inUse',
  'maintenance',
  'endOfLife',
];

const deriveHotspotsFromProfile = (profile?: LifecycleProfile | null) => {
  if (!profile) return [];
  return LIFECYCLE_STAGE_ORDER
    .map((stage) => ({
      stage,
      score: profile[stage]?.impact ?? 0,
      confidence: profile[stage]?.confidence ?? 'medium',
    }))
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};

const defaultHotspotReason = (stage: LifecycleStageKey, materialName?: string) => {
  const subject = materialName ? materialName.toLowerCase() : 'this material';
  switch (stage) {
    case 'raw':
      return `Raw material intensity for ${subject}`;
    case 'manufacturing':
      return `Manufacturing intensity for ${subject}`;
    case 'transport':
      return `Transport and logistics for ${subject}`;
    case 'installation':
      return `Installation complexity for ${subject}`;
    case 'inUse':
      return `In-use performance for ${subject}`;
    case 'maintenance':
      return `Maintenance and replacement for ${subject}`;
    case 'endOfLife':
      return `End-of-life processing for ${subject}`;
    default:
      return `Lifecycle impact for ${subject}`;
  }
};

const buildSustainabilityPayload = (materials: BoardItem[]) =>
  materials.map((mat) => {
    const profile = MATERIAL_LIFECYCLE_PROFILES[mat.id];
    const metrics = profile ? calculateMaterialMetrics(profile, [], mat) : null;
    return {
      id: mat.id,
      name: mat.name,
      category: mat.category,
      finish: mat.finish,
      description: mat.description,
      tone: mat.tone,
      lifecycleFingerprint: profile || null,
      hotspotCandidates: deriveHotspotsFromProfile(profile),
      serviceLifeYears: metrics?.service_life ?? null,
      replacementCycleYears: metrics?.replacement_cycle ?? null,
      lifecycleMultiplier: metrics?.lifecycle_multiplier ?? null
    };
  });

const buildSustainabilityPromptText = (materialsPayload: ReturnType<typeof buildSustainabilityPayload>) => `You are a UK architecture sustainability assistant for early-stage design (RIBA Stage 1–2).

Return ONLY valid JSON. No markdown. No prose outside JSON.

You are given selected materials. Each material includes:
- lifecycleFingerprint with impact (1–5) and confidence (high/medium/low) for stages: raw, manufacturing, transport, installation, inUse, maintenance, endOfLife.
- hotspotCandidates (precomputed; must be used as the ONLY hotspots).
- serviceLifeYears / replacementCycleYears / lifecycleMultiplier (precomputed; do not change).

IMPORTANT RULES:
- Do NOT change or recalculate any fingerprint scores.
- Do NOT add new hotspot stages or scores beyond hotspotCandidates.
- Do NOT invent kgCO2e, EPD figures, or percentage splits.
- Your role is to interpret the fingerprint for designers and give practical actions.
- ALWAYS include specific lifecycle stage names (raw/manufacturing/transport/installation/inUse/maintenance/endOfLife) when discussing impacts.
- NEVER use vague language without referencing a specific stage, score, and reason.

Output schema:
{
  "items": [
    {
      "id": "string",
      "title": "string",
      "headline": "string (max 120 chars)",
      "hotspots": [
        {
          "stage": "raw|manufacturing|transport|installation|inUse|maintenance|endOfLife",
          "score": 1-5,
          "reason": "string (max 80 chars explaining why this stage is a hotspot)"
        }
      ],
      "whyItLooksLikeThis": "string (max 200 chars)",
      "designLevers": ["string", "string"],
      "whatCouldChange": ["string", "string"],
      "design_risk": "string (max 140 chars, stage-specific, material-specific)",
      "design_response": "string (max 140 chars, action-oriented, material-specific)",
      "ukChecks": [
        {
          "label": "string",
          "standard_code": "string (e.g., 'EN 15804', 'FSC COC', 'ISO 14025')"
        }
      ],
      "benefits": [
        {
          "type": "biodiversity|circularity|durability|operational_carbon|health_voc",
          "score_1to5": 1-5,
          "note": "string (max 60 chars)"
        }
      ],
      "risks": [
        {
          "type": "supply_chain|durability|maintenance|disposal|regulatory|cost",
          "severity_1to5": 1-5,
          "note": "string (max 60 chars)"
        }
      ]
    }
  ]
}

Guidance:
- Use hotspotCandidates as the hotspot list. Copy stage and score, only add the reason.
- Include 1-3 hotspots per material, focusing on stages with impact >= 3.
- Include at least 1 design lever per material.
- design_risk should reference the top hotspot stage and avoid generic wording.
- design_response should be a concrete spec action tied to that material (verb-first).
- For benefits: score biodiversity/circularity/durability based on material properties.
- For landscape materials: always include a biodiversity benefit.
- For risks: identify supply chain, durability, or regulatory concerns where relevant.
- If confidence is medium/low for any stage, note this in risks with type "supply_chain" or relevant type.
- Use UK-relevant checks only (FSC/PEFC, EPD to EN 15804, recycled content declarations, demountable fixings, take-back schemes).
- If lifecycleFingerprint is null, return headline "Fingerprint not available" and minimal fields with empty arrays.

MATERIALS:
${JSON.stringify(materialsPayload, null, 2)}`;

const Moodboard: React.FC<MoodboardProps> = ({
  onNavigate,
  initialBoard,
  onBoardChange,
  moodboardRenderUrl: moodboardRenderUrlProp,
  onMoodboardRenderUrlChange,
  sustainabilityBriefing: sustainabilityBriefingProp,
  onSustainabilityBriefingChange,
  briefingPayload: briefingPayloadProp,
  onBriefingPayloadChange,
  onBriefingMaterialsKeyChange,
  briefingInvalidatedMessage,
  onBriefingInvalidatedMessageChange
}) => {
  // Auth hook for authenticated saves
  const { isAuthenticated, getAccessToken } = useAuth();
  const { refreshUsage } = useUsage();

  const [board, setBoard] = useState<BoardItem[]>(() => normalizeBoardItems(initialBoard || []));
  const [sustainabilityInsights, setSustainabilityInsights] = useState<SustainabilityInsight[] | null>(null);
  const sustainabilityInsightsRef = useRef<SustainabilityInsight[] | null>(null);
  const [, setPaletteSummary] = useState<string | null>(null);
  const paletteSummaryRef = useRef<string | null>(null);
  const reportProseRef = useRef<ReportProse | null>(null);
  const [, setSummaryReviewed] = useState(false);
  const [moodboardRenderUrlState, setMoodboardRenderUrlState] = useState<string | null>(
    moodboardRenderUrlProp ?? null
  );
  const [sustainabilityBriefingState, setSustainabilityBriefingState] =
    useState<SustainabilityBriefingResponse | null>(sustainabilityBriefingProp ?? null);
  const [briefingPayloadState, setBriefingPayloadState] = useState<SustainabilityBriefingPayload | null>(
    briefingPayloadProp ?? null
  );
  const [moodboardEditPrompt, setMoodboardEditPrompt] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'sustainability' | 'summary' | 'summary-review' | 'report-prose' | 'render' | 'all' | 'detecting'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [materialsAccordionOpen, setMaterialsAccordionOpen] = useState(true);
  const [isCreatingMoodboard, setIsCreatingMoodboard] = useState(false);
  const [flowProgress, setFlowProgress] = useState<MoodboardFlowProgress | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [exportingBriefingPdf, setExportingBriefingPdf] = useState(false);
  const [exportingMaterialsSheetPdf, setExportingMaterialsSheetPdf] = useState(false);
  const requireAuthForMoodboard = () => {
    if (isAuthenticated) return true;
    setError('You need an account to create moodboards. Please sign in to continue.');
    return false;
  };

  const ensureQuotaForMoodboard = async () => {
    if (!isAuthenticated) return false;
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Please sign in to continue.');
        return false;
      }
      const quota = await checkQuota(token);
      if (!quota.canGenerate) {
        setError('Monthly generation limit reached. Your quota resets on the 1st of next month.');
        return false;
      }
      return true;
    } catch (err) {
      console.error('Quota check failed:', err);
      setError('Could not verify your remaining credits. Please try again.');
      return false;
    }
  };

  useEffect(() => {
    if (initialBoard) {
      const normalized = normalizeBoardItems(initialBoard);
      setBoard((prev) => (areBoardsEquivalent(prev, normalized) ? prev : normalized));
    }
  }, [initialBoard]);

  useEffect(() => {
    onBoardChange?.(board);
  }, [board, onBoardChange]);

  // Generate AI thumbnails for custom/detected materials that are missing them
  const generatingIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const materialsNeedingThumbnails = board.filter(
      item =>
        !item.customImage &&
        (item.id.startsWith('custom-') || item.id.startsWith('detected-'))
    );

    if (materialsNeedingThumbnails.length === 0) return;

    materialsNeedingThumbnails.forEach(mat => {
      if (generatingIdsRef.current.has(mat.id)) return;
      generatingIdsRef.current.add(mat.id);

      generateMaterialIcon({
        id: mat.id,
        name: mat.name,
        description: mat.description,
        tone: mat.tone,
        finish: mat.finish,
        keywords: mat.keywords,
      }).then(icon => {
        setBoard(prev =>
          prev.map(item =>
            item.id === mat.id
              ? { ...item, customImage: icon.dataUri }
              : item
          )
        );
      }).catch(err => {
        console.error(`Failed to generate thumbnail for ${mat.name}:`, err);
      }).finally(() => {
        generatingIdsRef.current.delete(mat.id);
      });
    });
  }, [board]);

  const handleRemove = (idxToRemove: number) => {
    setBoard((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleToggleExclude = (idxToToggle: number, value: boolean) => {
    setBoard((prev) =>
      prev.map((item, idx) =>
        idx === idxToToggle ? { ...item, excludeFromMoodboardRender: value } : item
      )
    );
  };

  const renderMaterials = useMemo(
    () => board.filter((item) => !item.excludeFromMoodboardRender),
    [board]
  );

  const summaryText = useMemo(() => {
    if (!renderMaterials.length) return 'No materials selected yet.';
    const grouped = renderMaterials.reduce<Record<string, MaterialOption[]>>((acc, mat) => {
      acc[mat.category] = acc[mat.category] || [];
      acc[mat.category].push(mat);
      return acc;
    }, {});
    const lines = (Object.entries(grouped) as Array<[string, MaterialOption[]]>).map(
      ([cat, items]) => `${cat}: ${items.map((i) => `${i.name} (${i.finish}) [color: ${i.tone}]`).join(', ')}`
    );
    return lines.join('\n');
  }, [renderMaterials]);
  const sustainabilityPayload = useMemo(() => buildSustainabilityPayload(board), [board]);

  const moodboardRenderUrl = moodboardRenderUrlProp ?? moodboardRenderUrlState;
  const sustainabilityBriefing = sustainabilityBriefingProp ?? sustainabilityBriefingState;
  const briefingPayload = briefingPayloadProp ?? briefingPayloadState;

  const setMoodboardRenderUrl = (url: string | null) => {
    setMoodboardRenderUrlState(url);
    onMoodboardRenderUrlChange?.(url);
  };

  const setSustainabilityBriefing = (value: SustainabilityBriefingResponse | null) => {
    setSustainabilityBriefingState(value);
    onSustainabilityBriefingChange?.(value);
  };

  const setBriefingPayload = (value: SustainabilityBriefingPayload | null) => {
    setBriefingPayloadState(value);
    onBriefingPayloadChange?.(value);
  };

  useEffect(() => {
    if (moodboardRenderUrlProp !== undefined) {
      setMoodboardRenderUrlState(moodboardRenderUrlProp);
    }
  }, [moodboardRenderUrlProp]);

  useEffect(() => {
    if (sustainabilityBriefingProp !== undefined) {
      setSustainabilityBriefingState(sustainabilityBriefingProp);
    }
  }, [sustainabilityBriefingProp]);

  useEffect(() => {
    if (briefingPayloadProp !== undefined) {
      setBriefingPayloadState(briefingPayloadProp);
    }
  }, [briefingPayloadProp]);

  const buildMaterialKey = () => {
    if (!renderMaterials.length) return 'No materials selected yet.';
    return renderMaterials.map((item) => `${item.name} — ${item.finish}`).join('\n');
  };

  const persistGeneration = async (imageDataUri: string, prompt: string) => {
    const metadata = {
      renderMode: 'moodboard',
      materialKey: buildMaterialKey(),
      summary: summaryText,
      generatedPrompt: prompt,
      sustainabilityInsights: sustainabilityInsightsRef.current || undefined,
      board
    };

    if (!isAuthenticated) {
      console.warn('Skipping save-generation: user not authenticated.');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        console.warn('Skipping save-generation: missing access token.');
        return;
      }
      await saveGenerationAuth({
        prompt,
        imageDataUri,
        materials: metadata,
        generationType: 'moodboard'
      }, token);
      await refreshUsage();
    } catch (err) {
      console.error('Authenticated save failed:', err);
    }
  };

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const words = text.split(' ');
    let line = '';
    let cursorY = y;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, cursorY);
    return cursorY;
  };

  const formatCategoryLabel = (category: string) => {
    if (category === 'external') return 'External Envelope';
    return category
      ? category
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : '';
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const generateBriefingPdf = () => {
    if (!sustainabilityBriefing || !briefingPayload) return null;
    return buildBriefingPdf({
      sustainabilityBriefing,
      briefingPayload,
      board,
    });
  };

  const generateMaterialsSheetPdf = async () => buildMaterialsSheetPdf({ board });

  const handleDownloadBriefingPdf = async () => {
    if (!sustainabilityBriefing || !briefingPayload) return;
    setExportingBriefingPdf(true);
    try {
      const doc = generateBriefingPdf();
      if (doc) {
        // Save locally
        doc.save('sustainability-briefing.pdf');

        // Save to backend for authenticated users
        if (isAuthenticated) {
          const token = await getAccessToken();
          if (token) {
            const pdfDataUri = doc.output('datauristring');
            await savePdfAuth({
              pdfDataUri,
              pdfType: 'sustainabilityBriefing',
              materials: { board, briefingPayload }
            }, token);
          }
        }
      }
    } catch (err) {
      console.error('Could not create briefing PDF', err);
      setError('Could not create the briefing PDF download.');
    } finally {
      setExportingBriefingPdf(false);
    }
  };

  const handleDownloadMaterialsSheetPdf = async () => {
    if (!board.length) return;
    setExportingMaterialsSheetPdf(true);
    try {
      const doc = await generateMaterialsSheetPdf();
      if (doc) {
        // Save locally
        doc.save('materials-sheet.pdf');

        // Save to backend for authenticated users
        if (isAuthenticated) {
          const token = await getAccessToken();
          if (token) {
            const pdfDataUri = doc.output('datauristring');
            await savePdfAuth({
              pdfDataUri,
              pdfType: 'materialsSheet',
              materials: { board }
            }, token);
          }
        }
      }
    } catch (err) {
      console.error('Could not create materials sheet PDF', err);
      setError('Could not create the materials sheet PDF download.');
    } finally {
      setExportingMaterialsSheetPdf(false);
    }
  };

  const handleDownloadBoard = async (url: string, renderId?: string) => {
    if (!url) return;
    setDownloadingId(renderId || null);
    try {
      const image = await loadImage(url);
      const padding = 32;
      const minPanelWidth = 400;
      const targetWidth = Math.max(
        Math.round(image.height * 1.414),
        image.width + minPanelWidth + padding * 3
      );
      const height = image.height + padding * 2;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported in this browser.');

      // Background
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, targetWidth, height);

      // Rendered image on the left
      const imageX = padding;
      const imageY = (height - image.height) / 2;
      ctx.drawImage(image, imageX, imageY, image.width, image.height);

      // Brand tag anchored to the rendered image
      const brand = 'created by moodboard-lab.com';
      ctx.font = '600 13px "Helvetica Neue", Arial, sans-serif';
      const brandMetrics = ctx.measureText(brand);
      const brandPadding = 8;
      const brandMargin = 16;
      const brandTextHeight =
        (brandMetrics.actualBoundingBoxAscent || 0) +
          (brandMetrics.actualBoundingBoxDescent || 0) ||
        14;
      const brandBoxWidth = brandMetrics.width + brandPadding * 2;
      const brandBoxHeight = brandTextHeight + brandPadding * 2;
      const brandX = imageX + brandMargin;
      const brandY = imageY + image.height - brandMargin - brandBoxHeight;
      ctx.fillStyle = 'rgba(17, 24, 39, 0.7)';
      ctx.fillRect(brandX, brandY, brandBoxWidth, brandBoxHeight);
      ctx.fillStyle = '#f9fafb';
      ctx.textBaseline = 'top';
      ctx.fillText(brand, brandX + brandPadding, brandY + brandPadding);
      ctx.textBaseline = 'alphabetic';

      // Key panel on the right
      const panelX = imageX + image.width + padding;
      const panelY = padding;
      const panelWidth = targetWidth - panelX - padding;
      const panelHeight = height - padding * 2;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

      ctx.fillStyle = '#111827';
      ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('MOODBOARD-LAB.COM', panelX + 20, panelY + 36);

      ctx.fillStyle = '#111827';
      ctx.font = '600 18px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('Material Key', panelX + 20, panelY + 68);

      const list = renderMaterials.length
        ? renderMaterials
        : buildMaterialKey()
            .split('\n')
            .filter(Boolean)
            .map((line, idx) => {
              const cleaned = line.replace(/^[0-9]+\\.\\s*/, '');
              const [rawName, rawFinish] = cleaned.split(' — ');
              return {
                id: `fallback-${idx}`,
                name: (rawName || cleaned).trim(),
                finish: (rawFinish || '').trim(),
                tone: '#e5e7eb',
                description: cleaned,
                keywords: [],
                category: 'finish' as MaterialOption['category']
              };
            });

      let cursorY = panelY + 96;
      const swatchX = panelX + 20;
      const swatchSize = 18;
      const textX = swatchX + swatchSize + 12;
      const textWidth = panelWidth - (textX - panelX) - 20;

      list.forEach((item) => {
        const centerY = cursorY - 6;
        ctx.fillStyle = item.tone;
        ctx.beginPath();
        ctx.arc(swatchX + swatchSize / 2, centerY, swatchSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#111827';
        ctx.font = '600 14px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(item.name, textX, cursorY);

        const sublineParts = [];
        if (item.finish) sublineParts.push(item.finish);
        if (item.category) sublineParts.push(formatCategoryLabel(item.category));
        const subline = sublineParts.join(' • ');

        if (subline) {
          ctx.fillStyle = '#4b5563';
          ctx.font = '12px "Helvetica Neue", Arial, sans-serif';
          const lastY = wrapText(ctx, subline, textX, cursorY + 16, textWidth, 16);
          cursorY = lastY + 28;
        } else {
          cursorY += 36;
        }
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'moodboard-sheet.png';
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create download.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Helper to generate sustainability briefing
  const generateBriefing = async (): Promise<boolean> => {
    try {
      console.log('[Sustainability Briefing] Starting generation...');
      setIsBriefingLoading(true);
      const payload = prepareBriefingPayload(board, 'Material Palette');
      setBriefingPayload(payload);
      console.log('[Sustainability Briefing] Payload prepared:', payload);

      const response = await generateSustainabilityBriefing({
        systemInstruction: getSustainabilityBriefingSystemInstruction(),
        materials: payload.materials,
        averageScores: payload.averageScores,
        projectName: 'Material Palette',
      });

      console.log('[Sustainability Briefing] Raw response:', response);

      // Extract text from Gemini response structure
      let textContent = '';
      if (response && typeof response === 'object') {
        // Handle Gemini API response structure: {candidates: [{content: {parts: [{text: "..."}]}}]}
        const geminiResponse = response as Record<string, unknown>;
        if (geminiResponse.candidates && Array.isArray(geminiResponse.candidates)) {
          const firstCandidate = (geminiResponse.candidates as unknown[])[0] as Record<string, unknown> | undefined;
          if (firstCandidate?.content) {
            const content = firstCandidate.content as Record<string, unknown>;
            if (content.parts && Array.isArray(content.parts)) {
              const firstPart = (content.parts as unknown[])[0] as Record<string, unknown> | undefined;
              if (firstPart?.text && typeof firstPart.text === 'string') {
                textContent = firstPart.text;
              }
            }
          }
        }
        // Fallback to other possible structures
        if (!textContent) {
          textContent = (geminiResponse.text || geminiResponse.result || geminiResponse.response || '') as string;
        }
      } else if (typeof response === 'string') {
        textContent = response;
      }

      console.log('[Sustainability Briefing] Extracted text:', textContent);

      if (!textContent) {
        throw new Error('No text content in response');
      }

      // Clean up markdown code blocks if present
      let jsonText = textContent;
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      // Parse the JSON
      const parsed: SustainabilityBriefingResponse = JSON.parse(jsonText);
      console.log('[Sustainability Briefing] Parsed response:', parsed);

      setSustainabilityBriefing(parsed);
      onBriefingMaterialsKeyChange?.(getBriefingMaterialsKey(board));
      onBriefingInvalidatedMessageChange?.(null);
      setMaterialsAccordionOpen(false);
      // Track sustainability briefing generation in Google Analytics
      window.gtag?.('event', 'generate_briefing', {
        event_category: 'generation',
        event_label: 'sustainabilityBriefing',
      });
      return true;
    } catch (err) {
      console.error('[Sustainability Briefing] Generation failed:', err);
      return false;
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const runMoodboardFlow = async () => {
    if (!requireAuthForMoodboard()) {
      return;
    }
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return;
    }
    setError(null);
    const canGenerate = await ensureQuotaForMoodboard();
    if (!canGenerate) return;
    setIsCreatingMoodboard(true);
    setSustainabilityInsights(null);
    setPaletteSummary(null);
    paletteSummaryRef.current = null;
    reportProseRef.current = null;
    setSummaryReviewed(false);
    setSustainabilityBriefing(null);
    setBriefingPayload(null);
    onBriefingMaterialsKeyChange?.(null);
    onBriefingInvalidatedMessageChange?.(null);
    setStatus('all');
    setError(null);
    try {
      // Step 1: Generate moodboard image
      setFlowProgress({
        step: 1,
        total: MOODBOARD_FLOW_TOTAL_STEPS,
        label: 'Generating moodboard image',
        state: 'running'
      });

      const renderOk = await runGemini('render', { onRender: setMoodboardRenderUrl });

      if (!renderOk) {
        setFlowProgress({
          step: 1,
          total: MOODBOARD_FLOW_TOTAL_STEPS,
          label: 'Image generation failed',
          state: 'error'
        });
        return;
      }

      // Step 2: Generate sustainability briefing
      setFlowProgress({
        step: 2,
        total: MOODBOARD_FLOW_TOTAL_STEPS,
        label: 'Generating sustainability briefing',
        state: 'running'
      });
      const briefingOk = await generateBriefing();
      if (!briefingOk) {
        setFlowProgress({
          step: 2,
          total: MOODBOARD_FLOW_TOTAL_STEPS,
          label: 'Briefing generation failed',
          state: 'error'
        });
        return;
      }

      setFlowProgress({
        step: 2,
        total: MOODBOARD_FLOW_TOTAL_STEPS,
        label: 'Complete',
        state: 'complete'
      });
      setMaterialsAccordionOpen(false);
    } finally {
      setIsCreatingMoodboard(false);
      setStatus('idle');
    }
  };

  const handleMoodboardEdit = async () => {
    if (!requireAuthForMoodboard()) {
      return;
    }
    const trimmed = moodboardEditPrompt.trim();
    if (!moodboardRenderUrl) {
      setError('Generate a moodboard render first.');
      return;
    }
    if (!trimmed) {
      setError('Add text instructions to update the moodboard render.');
      return;
    }
    const canGenerate = await ensureQuotaForMoodboard();
    if (!canGenerate) return;
    setIsCreatingMoodboard(true);
    try {
      await runGemini('render', {
        onRender: setMoodboardRenderUrl,
        baseImageDataUrl: moodboardRenderUrl,
        editPrompt: trimmed
      });
    } finally {
      setIsCreatingMoodboard(false);
    }
  };

  const runGemini = async (
    mode: 'sustainability' | 'summary' | 'summary-review' | 'report-prose' | 'render',
    options?: {
      onRender?: (url: string) => void;
      retryAttempt?: number;
      editPrompt?: string;
      baseImageDataUrl?: string;
      summaryDraft?: string;
      requestTimeoutMs?: number;
    }
  ): Promise<boolean> => {
    if (mode === 'render' && !requireAuthForMoodboard()) {
      return false;
    }
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return false;
    }
    if (mode === 'render' && renderMaterials.length === 0) {
      setError('All materials are excluded from the moodboard image. Uncheck at least one material.');
      return false;
    }
    setStatus(mode);
    if (!options?.retryAttempt) setError(null);

    // Group materials by category for better AI understanding
    const materialsForPrompt = mode === 'render' ? renderMaterials : board;
    const materialsByCategory: Record<string, MaterialOption[]> = {};
    materialsForPrompt.forEach((item) => {
      if (!materialsByCategory[item.category]) {
        materialsByCategory[item.category] = [];
      }
      materialsByCategory[item.category].push(item);
    });

    const perMaterialLines = Object.entries(materialsByCategory)
      .map(([category, items]) => {
        const categoryHeader = `\n[${category.toUpperCase()}]`;
        const itemLines = items.map((item) => {
          // Only include color if it's explicitly selected:
          // - finish contains " — " (color label was added)
          // - finish contains hex in parentheses like "(#ffffff)"
          // - finish contains "colour" or "color" (paint materials)
          // - finish contains "select" (materials that require color selection)
          const finishHasColorInfo = item.finish.includes(' — ') ||
                                      item.finish.match(/\(#[0-9a-fA-F]{6}\)/) ||
                                      item.finish.toLowerCase().includes('colour') ||
                                      item.finish.toLowerCase().includes('color') ||
                                      item.finish.toLowerCase().includes('select');

          // For materials with explicit color selection, extract and include the color
          let colorInfo = '';
          if (finishHasColorInfo) {
            // If finish has a color label (e.g., "— White"), extract it
            const labelMatch = item.finish.match(/ — ([^(]+)/);
            if (labelMatch) {
              colorInfo = ` | color: ${labelMatch[1].trim()}`;
            }
            // Otherwise if it has a hex color in parentheses, use that
            else if (item.finish.match(/\(#[0-9a-fA-F]{6}\)/)) {
              colorInfo = ` | color: ${item.tone}`;
            }
          }

          return `- ${item.name} (${item.finish})${colorInfo} | description: ${item.description}`;
        }).join('\n');
        return `${categoryHeader}\n${itemLines}`;
      })
      .join('\n');

    const isEditingRender = mode === 'render' && options?.editPrompt && options?.baseImageDataUrl;
    const noTextRule =
      'CRITICAL REQUIREMENT - ABSOLUTELY NO TEXT WHATSOEVER in the image: no words, letters, numbers, labels, captions, logos, watermarks, signatures, stamps, or typographic marks of ANY kind. NO pseudo-text, NO scribbles, NO marks that resemble writing. This is a STRICT requirement that must be followed. The image must be completely free of all textual elements, letters, numbers, and symbols.';

    // Build sustainability prompt with lifecycle fingerprints (enhanced schema)
    const buildSustainabilityPrompt = () => buildSustainabilityPromptText(sustainabilityPayload);

    const buildPaletteSummaryContext = () => {
      const insights = sustainabilityInsightsRef.current || sustainabilityInsights || [];
      const insightById = new Map<string, SustainabilityInsight>();
      insights.forEach((insight) => {
        if (insight?.id) insightById.set(insight.id, insight);
      });

      const materialById = new Map<string, BoardItem>();
      board.forEach((material) => materialById.set(material.id, material));

      const metrics = new Map<string, MaterialMetrics>();
      board.forEach((material) => {
        const profile = MATERIAL_LIFECYCLE_PROFILES[material.id];
        if (!profile) return;
        const benefits = insightById.get(material.id)?.benefits || [];
        metrics.set(material.id, calculateMaterialMetrics(profile, benefits, material));
      });

      const labelFor = (id: string) =>
        materialById.get(id)?.name || insightById.get(id)?.title || 'Material';

      const stageOrder = ['raw', 'manufacturing', 'transport', 'installation', 'inUse', 'maintenance', 'endOfLife'] as const;
      const getTopStages = (profile?: (typeof MATERIAL_LIFECYCLE_PROFILES)[string]) => {
        if (!profile) return [];
        return stageOrder
          .map((stage) => ({
            stage,
            impact: profile[stage]?.impact ?? 0,
            confidence: profile[stage]?.confidence ?? 'unknown'
          }))
          .sort((a, b) => b.impact - a.impact)
          .filter((stage) => stage.impact > 0)
          .slice(0, 2);
      };

      const isLandscapeId = (id: string) => {
        const material = materialById.get(id);
        return material ? isLandscapeMaterial(material) : false;
      };

      const nonLandscapeEmbodied = [...metrics.entries()]
        .filter(([id]) => !isLandscapeId(id))
        .sort((a, b) => b[1].embodied_proxy - a[1].embodied_proxy);
      const allEmbodiedSorted = [...metrics.entries()].sort(
        (a, b) => b[1].embodied_proxy - a[1].embodied_proxy
      );
      const embodiedFallback = nonLandscapeEmbodied.length > 0 ? nonLandscapeEmbodied : allEmbodiedSorted;

      const highestImpactIds = embodiedFallback.slice(0, 3).map(([id]) => id);
      const highestImpact = highestImpactIds.map(labelFor);

      const lowCarbonCandidates = [...metrics.entries()]
        .filter(([id, metric]) => {
          const material = materialById.get(id);
          if (!material) return false;
          if (highestImpactIds.includes(id)) return false;
          return (
            metric.traffic_light === 'green' ||
            metric.environmental_benefit_score >= 2 ||
            isLandscapeMaterial(material)
          );
        })
        .sort((a, b) => a[1].embodied_proxy - b[1].embodied_proxy);

      const lowCarbonSystems = (lowCarbonCandidates.length > 0
        ? lowCarbonCandidates
        : [...metrics.entries()].filter(([id]) => !highestImpactIds.includes(id))
      )
        .slice(0, 3)
        .map(([id]) => labelFor(id));

      const driverStages = highestImpactIds.map((id) => {
        const material = materialById.get(id);
        const profile = MATERIAL_LIFECYCLE_PROFILES[id];
        return {
          name: labelFor(id),
          category: material?.category || '',
          topStages: getTopStages(profile)
        };
      });

      const lowConfidenceCount = board.reduce((count, material) => {
        const profile = MATERIAL_LIFECYCLE_PROFILES[material.id];
        if (!profile) return count;
        const hasLow = stageOrder.some((stage) => profile[stage]?.confidence === 'low');
        return count + (hasLow ? 1 : 0);
      }, 0);

      return {
        totalMaterials: board.length,
        highestImpact,
        lowCarbonSystems,
        driverStages,
        landscapePresent: board.some((material) => isLandscapeMaterial(material)),
        lowConfidenceCount
      };
    };

    const buildPaletteSummaryPrompt = () => {
      const summaryContext = buildPaletteSummaryContext();
      return `You are a UK architecture sustainability assistant writing concise dashboard + PDF intro copy for a concept-stage material palette.

Return ONLY valid JSON. No markdown. No prose outside JSON.

Output schema:
{
  "summarySentence": "string (max 220 chars)",
  "summaryParagraph": "string (2-3 sentences, max 420 chars)"
}

Rules:
- Mention at least one material name from highestImpact or lowCarbonSystems if provided.
- Mention at least one lifecycle stage (raw, manufacturing, transport, installation, inUse, maintenance, endOfLife) using the driverStages list.
- Keep it neutral and early-stage; avoid compliance claims, rankings, percentages, or numbers.
- summaryParagraph should include: key risk driver, one lower-carbon opportunity, and one clear next action.
- If highestImpact and lowCarbonSystems are empty, say the palette needs assessment.
- Keep the response compact and close the JSON object fully.

CONTEXT:
${JSON.stringify(summaryContext, null, 2)}`;
    };

    const buildFallbackPaletteSummary = () => {
      const summaryContext = buildPaletteSummaryContext();
      const primaryRiskMaterial = summaryContext.highestImpact[0] || '';
      const lowerCarbonMaterial = summaryContext.lowCarbonSystems[0] || '';
      const topStage = summaryContext.driverStages[0]?.topStages?.[0]?.stage || '';
      const stageLabel = topStage ? `${topStage} stage` : 'lifecycle profile';

      if (!primaryRiskMaterial && !lowerCarbonMaterial) {
        return 'This concept-stage palette needs assessment to identify key lifecycle drivers and next actions.';
      }

      if (primaryRiskMaterial && lowerCarbonMaterial && primaryRiskMaterial !== lowerCarbonMaterial) {
        return `This concept-stage palette indicates ${primaryRiskMaterial} as a key ${stageLabel} driver, while ${lowerCarbonMaterial} offers a lower-carbon direction. Next, confirm specification choices with supplier evidence and right-sized detailing.`;
      }

      const anchorMaterial = primaryRiskMaterial || lowerCarbonMaterial;
      return `This concept-stage palette indicates ${anchorMaterial} as a key ${stageLabel} driver. Next, confirm specification choices with supplier evidence and right-sized detailing.`;
    };

    const extractJsonStringField = (raw: string, field: string) => {
      const completeMatch = raw.match(
        new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`)
      );
      if (completeMatch?.[1]) {
        return completeMatch[1].replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();
      }

      const partialMatch = raw.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*)$`));
      if (!partialMatch?.[1]) return '';

      return partialMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/["}]*\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const extractSummaryField = (raw: string, field: 'summarySentence' | 'summaryParagraph') =>
      extractJsonStringField(raw, field);

    const isUsableSummaryText = (value?: string) => {
      const trimmed = (value || '').trim();
      if (!trimmed) return false;
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      return wordCount >= 8 || trimmed.length >= 70;
    };

    const buildPaletteSummaryReviewContext = () => {
      const summaryContext = buildPaletteSummaryContext();
      return {
        highestImpact: summaryContext.highestImpact,
        lowCarbonSystems: summaryContext.lowCarbonSystems,
        driverStages: summaryContext.driverStages.map((driver) => ({
          name: driver.name,
          topStages: driver.topStages.map((stage) => stage.stage)
        }))
      };
    };

    const buildPaletteSummaryReviewPrompt = (summaryDraft: string) => {
      const summaryContext = buildPaletteSummaryReviewContext();
      return `You are a QA reviewer checking a concept-stage sustainability summary against a provided context. Fix inaccuracies or contradictions.

Return ONLY valid JSON. No markdown. No prose outside JSON.

Output schema:
{
  "status": "ok|revise",
  "revisedSummary": "string (2-3 sentences, max 420 chars, empty if status=ok)",
  "issues": ["string"]
}

Rules:
- Only use material names listed in highestImpact or lowCarbonSystems.
- Summary must mention at least one lifecycle stage from driverStages.
- Keep revisedSummary as 2-3 concise sentences suitable for dashboard + PDF intro copy.
- Do not introduce numbers, rankings, or compliance claims.
- Keep issues to a maximum of 2 short items.
- If the draft is accurate, return status "ok" and empty revisedSummary.
- If not, return status "revise" with a corrected summary.

SUMMARY DRAFT:
${summaryDraft}

CONTEXT:
${JSON.stringify(summaryContext)}`;
    };

    const buildReportProseContext = () => {
      const summaryContext = buildPaletteSummaryContext();
      const insights = sustainabilityInsightsRef.current || sustainabilityInsights || [];
      const materialById = new Map<string, BoardItem>();
      board.forEach((material) => materialById.set(material.id, material));
      const compact = (value: string, maxChars: number) => {
        const cleaned = (value || '').replace(/\s+/g, ' ').trim();
        if (!cleaned) return '';
        return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars - 3)}...` : cleaned;
      };

      const materialHighlights = insights
        .map((insight) => {
          const material = materialById.get(insight.id);
          const hotspot = (insight.hotspots || []).slice().sort((a, b) => b.score - a.score)[0];
          return {
            name: material?.name || insight.title || '',
            category: material?.category || '',
            headline: compact(insight.headline || '', 120),
            whyItLooksLikeThis: compact(insight.whyItLooksLikeThis || '', 180),
            designRisk: compact(insight.design_risk || '', 160),
            designResponse: compact(insight.design_response || '', 160),
            topHotspot: hotspot
              ? {
                  stage: hotspot.stage,
                  score: hotspot.score,
                  reason: compact(hotspot.reason, 90)
                }
              : null,
            ukChecks: (insight.ukChecks || []).map((check) => check.label).slice(0, 3),
            riskNotes: (insight.risks || [])
              .map((risk) => compact(risk.note || '', 90))
              .filter(Boolean)
              .slice(0, 2)
          };
        })
        .filter((item) => item.name)
        .slice(0, 6);

      return {
        totalMaterials: summaryContext.totalMaterials,
        highestImpact: summaryContext.highestImpact,
        lowCarbonSystems: summaryContext.lowCarbonSystems,
        driverStages: summaryContext.driverStages.map((driver) => ({
          name: driver.name,
          category: driver.category,
          topStages: driver.topStages.map((stage) => stage.stage)
        })),
        materialHighlights
      };
    };

    const buildReportProsePrompt = () => {
      const proseContext = buildReportProseContext();
      return `You are writing page-level prose for a UK concept-stage architecture sustainability PDF.

Return ONLY valid JSON. No markdown. No prose outside JSON.

Output schema:
{
  "strategicOverview": {
    "narrative": "string (2-3 sentences, max 420 chars)",
    "strengthsLead": "string (1 sentence, max 160 chars)",
    "watchoutsLead": "string (1 sentence, max 160 chars)",
    "specNotesLead": "string (1 sentence, max 160 chars)"
  },
  "complianceReadiness": {
    "intro": "string (2 sentences, max 320 chars)",
    "evidencePriorityNote": "string (1 sentence, max 180 chars)",
    "deferNote": "string (1 sentence, max 180 chars)"
  }
}

Tone requirements:
- strategicOverview: architect-to-client tone, design-led, concise, concrete trade-offs.
- complianceReadiness: evidence-first procurement/compliance tone, plain language, no legal claims.

Rules:
- Mention at least one material from highestImpact or lowCarbonSystems across the output.
- Mention at least one lifecycle stage from driverStages across the output.
- Avoid rankings, percentages, and compliance guarantees.
- Keep wording UK-appropriate and concept-stage cautious.
- Keep wording concise and ensure valid, fully closed JSON.

CONTEXT:
${JSON.stringify(proseContext)}`;
    };

    const prompt =
      mode === 'sustainability'
        ? buildSustainabilityPrompt()
      : mode === 'summary'
        ? buildPaletteSummaryPrompt()
      : mode === 'summary-review'
        ? buildPaletteSummaryReviewPrompt(options?.summaryDraft || paletteSummaryRef.current || '')
      : mode === 'report-prose'
      ? buildReportProsePrompt()
      : isEditingRender
        ? `You are in a multi-turn render conversation. Use the provided previous render as the base image and update it while preserving the composition, camera, and lighting. Keep material assignments consistent with the list below and do not remove existing context unless explicitly requested.\n\n${noTextRule}\n\nMaterials to respect:\n${summaryText}\n\nNew instruction:\n${options.editPrompt}`
        : `Create one clean, standalone moodboard image showcasing these materials together. Materials are organized by their architectural category. White background, balanced composition, soft lighting.\n\n${noTextRule}\n\nMaterials (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- Arrange materials logically based on their categories (floors, walls, ceilings, external elements, etc.)\n- Show materials at realistic scales and with appropriate textures\n- Include subtle context to demonstrate how materials work together in an architectural setting\n`;

    if (mode === 'render') {
      // Image render call
      try {
        // Determine aspect ratio based on context
        const aspectRatio = '1:1';
        const payload = {
          contents: [
            {
              parts: [
                { text: prompt },
                ...(isEditingRender && options?.baseImageDataUrl
                  ? [dataUrlToInlineData(options.baseImageDataUrl)]
                  : [])
              ]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            candidateCount: 1,
            // Newer Gemini endpoints reject image MIME hints here; request image-only output via response modalities instead.
            responseModalities: ['IMAGE']
          },
          imageConfig: {
            aspectRatio,
            imageSize: '1K'
          }
        };
        const data = await callGeminiImage(payload);
        let img: string | null = null;
        let mime: string | null = null;
        const candidates = data?.candidates || [];
        for (const c of candidates) {
          const parts = c?.content?.parts || c?.parts || [];
          for (const p of parts) {
            const inline = p.inlineData || p.inline_data;
            if (inline?.data) {
              img = inline.data;
              mime = inline.mimeType || inline.mime_type || 'image/png';
              break;
            }
          }
          if (img) break;
        }
        if (!img) throw new Error('Gemini did not return an image payload.');
        const newUrl = `data:${mime || 'image/png'};base64,${img}`;
        options?.onRender?.(newUrl);
        void persistGeneration(newUrl, prompt);
        // Track moodboard generation in Google Analytics
        window.gtag?.('event', 'generate_image', {
          event_category: 'generation',
          event_label: 'moodboard',
        });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reach the Gemini image backend.');
        return false;
      } finally {
        setStatus('idle');
      }
    }

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: mode === 'summary-review' ? 0.2 : mode === 'report-prose' ? 0.28 : 0.45,
        ...(mode === 'summary' || mode === 'summary-review'
          ? { maxOutputTokens: 512 }
          : mode === 'report-prose'
          ? { maxOutputTokens: 720 }
          : {})
      }
    };
    const promptType =
      mode === 'summary'
        ? 'summary'
        : mode === 'summary-review'
        ? 'summary-review'
        : mode === 'report-prose'
        ? 'report-prose'
        : 'sustainability';
    try {
      const data = await callGeminiText(payload, { timeoutMs: options?.requestTimeoutMs });
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n');
      if (!text) throw new Error('Gemini did not return text.');
      const cleaned = text.replace(/```json|```/g, '').trim();
      const retryAttempt = options?.retryAttempt || 0;
      const canRetry = retryAttempt < 1;

      if (mode === 'sustainability') {
        try {
          const parsed = JSON.parse(cleaned);
          const items = parsed?.items;
          if (Array.isArray(items) && items.length > 0) {
            const hotspotCandidatesById = new Map<string, { stage: LifecycleStageKey; score: number }[]>();
            sustainabilityPayload.forEach((entry) => {
              const candidates = Array.isArray(entry.hotspotCandidates) ? entry.hotspotCandidates : [];
              hotspotCandidatesById.set(String(entry.id), candidates);
            });
            // Parse enhanced sustainability insights with new schema
            const validated: SustainabilityInsight[] = items.map((item: any) => {
              const rawHotspots = Array.isArray(item.hotspots) ? item.hotspots : [];
              const reasonByStage = new Map<string, string>();
              const legacyReasons: string[] = [];
              rawHotspots.forEach((h: any) => {
                if (typeof h === 'string') {
                  legacyReasons.push(h);
                  return;
                }
                if (h && h.stage && h.reason) {
                  reasonByStage.set(String(h.stage), String(h.reason));
                }
              });
              const materialForConsequences = board.find(m => m.id === item.id);
              const computedHotspots = hotspotCandidatesById.get(String(item.id)) || [];
              const hotspots: Hotspot[] = computedHotspots.map((computed, idx) => {
                const fallbackLegacy = legacyReasons[idx];
                const scoreValue = Math.round(Number(computed.score) || 3);
                const clampedScore = Math.min(5, Math.max(1, scoreValue)) as 1 | 2 | 3 | 4 | 5;
                const reason =
                  reasonByStage.get(computed.stage) ||
                  (rawHotspots[idx] && typeof rawHotspots[idx] === 'object' ? String(rawHotspots[idx].reason || '') : '') ||
                  fallbackLegacy ||
                  defaultHotspotReason(computed.stage, materialForConsequences?.name);
                return {
                  stage: computed.stage,
                  score: clampedScore,
                  reason: reason,
                };
              });

              // Parse UK checks - handle both old string[] and new object[] format
              const ukChecks: UKCheck[] = Array.isArray(item.ukChecks)
                ? item.ukChecks.map((c: any) => {
                    if (typeof c === 'string') {
                      return { label: c };
                    }
                    return {
                      label: String(c.label || ''),
                      standard_code: c.standard_code ? String(c.standard_code) : undefined,
                      url: c.url ? String(c.url) : undefined,
                    };
                  })
                : [];

              // Parse benefits
              const benefits: Benefit[] = Array.isArray(item.benefits)
                ? item.benefits.map((b: any) => ({
                    type: b.type || 'durability',
                    score_1to5: Number(b.score_1to5) || 1,
                    note: b.note ? String(b.note) : undefined,
                  }))
                : [];

              // Parse risks
              const risks: Risk[] = Array.isArray(item.risks)
                ? item.risks.map((r: any) => ({
                    type: r.type || 'supply_chain',
                    severity_1to5: Number(r.severity_1to5) || 1,
                    note: r.note ? String(r.note) : undefined,
                  }))
                : [];

              const designLevers = Array.isArray(item.designLevers)
                ? item.designLevers
                    .map((value: unknown) => String(value || '').trim())
                    .filter(Boolean)
                : [];
              const whatCouldChange = Array.isArray(item.whatCouldChange)
                ? item.whatCouldChange
                    .map((value: unknown) => String(value || '').trim())
                    .filter(Boolean)
                : [];

              const aiDesignRisk =
                typeof item.design_risk === 'string' ? item.design_risk.trim() : '';
              const aiDesignResponse =
                typeof item.design_response === 'string' ? item.design_response.trim() : '';
              const topRiskNote = risks.find((risk) => risk.note?.trim())?.note?.trim() || '';

              // Use AI-authored copy when present, then fall back to deterministic templates.
              const design_risk =
                aiDesignRisk ||
                topRiskNote ||
                generateDesignRisk(hotspots, materialForConsequences);
              const design_response =
                aiDesignResponse ||
                designLevers[0] ||
                whatCouldChange[0] ||
                generateDesignResponse(hotspots, materialForConsequences);

              return {
                id: String(item.id || ''),
                title: String(item.title || ''),
                headline: String(item.headline || ''),
                hotspots,
                whyItLooksLikeThis: String(item.whyItLooksLikeThis || ''),
                designLevers,
                whatCouldChange,
                ukChecks,
                benefits,
                risks,
                design_risk,
                design_response,
              };
            });
            setSustainabilityInsights(validated);
            sustainabilityInsightsRef.current = validated;
            if (retryAttempt) setError(null);
          } else {
            throw new Error('Invalid items array');
          }
        } catch (parseError) {
          setSustainabilityInsights(null);
          sustainabilityInsightsRef.current = null;
          setPaletteSummary(null);
          reportProseRef.current = null;
          const message = 'Gemini returned malformed sustainability JSON.';
          if (canRetry) {
            setError(`${message} Retrying once...`);
            return await runGemini(mode, { ...options, retryAttempt: retryAttempt + 1 });
          } else {
            setError(`${message} Please try again.`);
          }
          return false;
        }
      } else if (mode === 'summary') {
        try {
          const parsed = JSON.parse(cleaned);
          const summarySentence = typeof parsed?.summarySentence === 'string' ? parsed.summarySentence.trim() : '';
          const summaryParagraph = typeof parsed?.summaryParagraph === 'string' ? parsed.summaryParagraph.trim() : '';
          const summaryCandidate = summaryParagraph || summarySentence;
          const summary = isUsableSummaryText(summaryCandidate)
            ? summaryCandidate
            : buildFallbackPaletteSummary();
          if (!summary) {
            throw new Error('Invalid summary content');
          }
          setPaletteSummary(summary);
          paletteSummaryRef.current = summary;
          if (retryAttempt) setError(null);
        } catch (parseError) {
          const message = 'Gemini returned malformed summary JSON.';
          if (canRetry) {
            setError(`${message} Retrying once...`);
            return await runGemini(mode, { ...options, retryAttempt: retryAttempt + 1 });
          } else {
            const recoveredCandidate =
              extractSummaryField(cleaned, 'summaryParagraph') ||
              extractSummaryField(cleaned, 'summarySentence');
            const recoveredSummary = isUsableSummaryText(recoveredCandidate)
              ? recoveredCandidate
              : buildFallbackPaletteSummary();

            if (recoveredSummary) {
              setPaletteSummary(recoveredSummary);
              paletteSummaryRef.current = recoveredSummary;
              setError(null);
              console.warn('Malformed summary JSON; using recovered/fallback summary.', parseError);
              return true;
            }

            setPaletteSummary(null);
            paletteSummaryRef.current = null;
            setError(`${message} Please try again.`);
          }
          return false;
        }
      } else if (mode === 'summary-review') {
        try {
          const parsed = JSON.parse(cleaned);
          const status = parsed?.status;
          const revised = typeof parsed?.revisedSummary === 'string' ? parsed.revisedSummary.trim() : '';
          if (status === 'revise' && isUsableSummaryText(revised)) {
            setPaletteSummary(revised);
            paletteSummaryRef.current = revised;
          }
          if (status === 'ok' || (status === 'revise' && isUsableSummaryText(revised))) {
            setSummaryReviewed(true);
          } else {
            throw new Error('Invalid summary review response');
          }
        } catch (parseError) {
          const recoveredStatusMatch = cleaned.match(/"status"\s*:\s*"(ok|revise)"/i);
          const recoveredStatus = recoveredStatusMatch?.[1]?.toLowerCase();
          const recoveredRevised = extractJsonStringField(cleaned, 'revisedSummary');

          if (recoveredStatus === 'ok') {
            setSummaryReviewed(true);
            setError(null);
            console.warn('Malformed summary review JSON; using recovered status=ok.', parseError);
            return true;
          }

          if (recoveredStatus === 'revise' && isUsableSummaryText(recoveredRevised)) {
            setPaletteSummary(recoveredRevised);
            paletteSummaryRef.current = recoveredRevised;
            setSummaryReviewed(true);
            setError(null);
            console.warn('Malformed summary review JSON; using recovered revised summary.', parseError);
            return true;
          }

          setSummaryReviewed(false);
          setError('Summary QA failed. Please try again.');
          console.warn('Gemini returned malformed summary review JSON.', parseError);
          return false;
        }
      } else if (mode === 'report-prose') {
        try {
          const parsed = JSON.parse(cleaned);
          const strategicSource = parsed?.strategicOverview || {};
          const complianceSource = parsed?.complianceReadiness || {};
          const prose: ReportProse = {
            strategicOverview: {
              narrative:
                typeof strategicSource?.narrative === 'string' ? strategicSource.narrative.trim() : '',
              strengthsLead:
                typeof strategicSource?.strengthsLead === 'string'
                  ? strategicSource.strengthsLead.trim()
                  : '',
              watchoutsLead:
                typeof strategicSource?.watchoutsLead === 'string'
                  ? strategicSource.watchoutsLead.trim()
                  : '',
              specNotesLead:
                typeof strategicSource?.specNotesLead === 'string'
                  ? strategicSource.specNotesLead.trim()
                  : ''
            },
            complianceReadiness: {
              intro:
                typeof complianceSource?.intro === 'string' ? complianceSource.intro.trim() : '',
              evidencePriorityNote:
                typeof complianceSource?.evidencePriorityNote === 'string'
                  ? complianceSource.evidencePriorityNote.trim()
                  : '',
              deferNote:
                typeof complianceSource?.deferNote === 'string'
                  ? complianceSource.deferNote.trim()
                  : ''
            }
          };
          if (!prose.strategicOverview.narrative && !prose.complianceReadiness.intro) {
            throw new Error('Invalid report prose response');
          }
          reportProseRef.current = prose;
        } catch (parseError) {
          const recoveredProse: ReportProse = {
            strategicOverview: {
              narrative: extractJsonStringField(cleaned, 'narrative'),
              strengthsLead: extractJsonStringField(cleaned, 'strengthsLead'),
              watchoutsLead: extractJsonStringField(cleaned, 'watchoutsLead'),
              specNotesLead: extractJsonStringField(cleaned, 'specNotesLead')
            },
            complianceReadiness: {
              intro: extractJsonStringField(cleaned, 'intro'),
              evidencePriorityNote: extractJsonStringField(cleaned, 'evidencePriorityNote'),
              deferNote: extractJsonStringField(cleaned, 'deferNote')
            }
          };

          const hasRecoveredCopy = Boolean(
            recoveredProse.strategicOverview.narrative ||
            recoveredProse.complianceReadiness.intro ||
            recoveredProse.strategicOverview.strengthsLead ||
            recoveredProse.strategicOverview.watchoutsLead ||
            recoveredProse.strategicOverview.specNotesLead ||
            recoveredProse.complianceReadiness.evidencePriorityNote ||
            recoveredProse.complianceReadiness.deferNote
          );

          if (hasRecoveredCopy) {
            reportProseRef.current = recoveredProse;
            console.warn('Malformed report prose JSON; using recovered text fields.', parseError);
            return true;
          }

          reportProseRef.current = null;
          console.warn('Gemini returned malformed report prose JSON.', parseError);
          return false;
        }
      }
      return true;
    } catch (err) {
      if (mode === 'summary-review') {
        setSummaryReviewed(false);
        setError('Summary QA failed. Please try again.');
        console.warn('Summary review failed', err);
      } else if (mode === 'report-prose') {
        console.warn('Report prose generation failed', err);
      } else {
        if (mode === 'summary') {
          const fallbackSummary = buildFallbackPaletteSummary();
          if (fallbackSummary) {
            setPaletteSummary(fallbackSummary);
            paletteSummaryRef.current = fallbackSummary;
            setError(null);
            console.warn('Summary request failed; using fallback summary.', err);
            return true;
          }
        }
        setError(err instanceof Error ? err.message : 'Could not reach the Gemini backend.');
      }
      return false;
    } finally {
      setStatus('idle');
    }
  };

  const isRenderInFlight = status === 'render' && isCreatingMoodboard;

  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 md:px-8 lg:px-12 py-12 space-y-10">
        <div className="flex flex-col lg:flex-row gap-6 border-b border-gray-200 pb-6">
          <div>
            <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter">
              Moodboard Lab
            </h1>
            <p className="font-sans text-gray-600 max-w-2xl mt-3">
              Review the materials you've selected, then let Ai (Nano Banana) assemble a moodboard plus UK-focused sustainability briefing.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={() => onNavigate?.('materials')}
                className="px-4 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
              >
                Back to materials
              </button>
              <button
                onClick={() => onNavigate?.('concept')}
                className="px-4 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
              >
                Home
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
            <ChosenMaterialsList
              board={board}
              materialsAccordionOpen={materialsAccordionOpen}
              setMaterialsAccordionOpen={setMaterialsAccordionOpen}
              onNavigate={onNavigate}
              onRemove={handleRemove}
              onToggleExclude={handleToggleExclude}
            />

            {board.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={runMoodboardFlow}
                    disabled={isCreatingMoodboard || status !== 'idle' || !board.length}
                    className="inline-flex items-center gap-2 px-4 py-3 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                  >
                    {isCreatingMoodboard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Create Moodboard
                      </>
                    )}
                  </button>
                </div>
                {flowProgress && (
                  <div
                    className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[11px] uppercase tracking-widest ${
                      flowProgress.state === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : flowProgress.state === 'complete'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {flowProgress.state === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>
                      {flowProgress.step}/{flowProgress.total} {flowProgress.label}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

            {error && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-[2px]" />
                <span>{error}</span>
              </div>
            )}

            {briefingInvalidatedMessage && (
              <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-[2px]" />
                <span>{briefingInvalidatedMessage}</span>
              </div>
            )}

            <SustainabilityBriefingSection
              sustainabilityBriefing={sustainabilityBriefing}
              briefingPayload={briefingPayload}
              isBriefingLoading={isBriefingLoading}
              exportingBriefingPdf={exportingBriefingPdf}
              exportingMaterialsSheetPdf={exportingMaterialsSheetPdf}
              board={board}
              onDownloadBriefingPdf={handleDownloadBriefingPdf}
              onDownloadMaterialsSheetPdf={handleDownloadMaterialsSheetPdf}
            />

            {moodboardRenderUrl && (
              <MoodboardRenderSection
                moodboardRenderUrl={moodboardRenderUrl}
                isRenderInFlight={isRenderInFlight}
                isCreatingMoodboard={isCreatingMoodboard}
                status={status}
                moodboardEditPrompt={moodboardEditPrompt}
                setMoodboardEditPrompt={setMoodboardEditPrompt}
                downloadingId={downloadingId}
                onDownloadBoard={handleDownloadBoard}
                onNavigate={onNavigate}
                onMoodboardEdit={handleMoodboardEdit}
              />
            )}
        </div>
      </div>

    </div>
  );
};

export default Moodboard;
