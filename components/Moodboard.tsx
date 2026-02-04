import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { AlertCircle, Loader2, Trash2, ImageDown, Wand2, Search, ShoppingCart, Leaf, Download, Lightbulb, CheckCircle2, AlertTriangle, ArrowRight, ChevronDown, ChevronUp, Instagram } from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { MATERIAL_PALETTE } from '../constants';
import {
  MATERIAL_LIFECYCLE_PROFILES,
  LifecycleProfile,
  LifecycleStageKey,
} from '../lifecycleProfiles';
import { callGeminiImage, callGeminiText, saveGeneration, generateSustainabilityBriefing } from '../api';
import { MaterialOption, MaterialCategory, UploadedImage } from '../types';
import { generateMaterialIcon, loadMaterialIcons } from '../utils/materialIconGenerator';

// Sustainability report utilities
import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  SystemLevelSummary,
  ClientSummary,
  ReportProse,
  Hotspot,
  UKCheck,
  Benefit,
  Risk,
} from '../types/sustainability';
import { calculateMaterialMetrics } from '../utils/sustainabilityScoring';
import { generateDesignRisk, generateDesignResponse } from '../utils/designConsequences';
import { detectSynergies, detectConflicts, generateNetStatement } from '../utils/synergyConflictRules';
import { validateInsights } from '../utils/qaValidation';
import { generateClientSummary } from '../utils/clientSummary';
import { isLandscapeMaterial } from '../utils/lifecycleDurations';
import { getMaterialIconId } from '../utils/materialIconMapping';
import {
  createPDFContext,
  calculateProjectMetrics,
  renderSpecifiersSnapshot,
  renderStrategicOverview,
  renderComparativeDashboard,
  renderDesignDirectionPage,
  renderSystemSummaryPage,
  renderComplianceReadinessSummary,
  renderEnhancedMaterialSection,
  addDisclaimer,
  MaterialPaletteContext,
  prefetchMaterialIcons,
  optimizeImageDataUriForPdf,
} from '../utils/pdfSections';
import {
  prepareBriefingPayload,
  getSustainabilityBriefingSystemInstruction,
  type SustainabilityBriefingResponse,
  type SustainabilityBriefingPayload,
} from '../utils/sustainabilityBriefing';

type BoardItem = MaterialOption;

type MaterialTreeGroup = {
  id: string;
  label: string;
  path: string;
  description?: string;
};

const MATERIAL_TREE: { id: string; label: string; groups: MaterialTreeGroup[] }[] = [
  {
    id: 'structure',
    label: 'Structure',
    groups: [
      { id: 'primary-structure', label: 'Primary Structure', path: 'Structure>Primary Structure' },
      { id: 'secondary-structure', label: 'Secondary Structure', path: 'Structure>Secondary Structure' },
      { id: 'floors-roofs', label: 'Floors and Roofs', path: 'Structure>Floors and Roofs' },
      { id: 'stability-bracing', label: 'Stability and Bracing', path: 'Structure>Stability and Bracing' },
      {
        id: 'envelope-lightweight',
        label: 'Envelope and Lightweight Structure',
        path: 'Structure>Envelope and Lightweight Structure'
      }
    ]
  },
  {
    id: 'external',
    label: 'External',
    groups: [
      { id: 'facade', label: 'Façade', path: 'External>Façade' },
      { id: 'glazing', label: 'Glazing', path: 'External>Glazing' },
      { id: 'roofing', label: 'Roofing', path: 'External>Roofing' },
      {
        id: 'landscape',
        label: 'External Ground / Landscaping',
        path: 'External>External Ground / Landscaping'
      },
      { id: 'insulation', label: 'Insulation', path: 'External>Insulation' }
    ]
  },
  {
    id: 'internal',
    label: 'Internal',
    groups: [
      { id: 'floors', label: 'Floors', path: 'Internal>Floors' },
      { id: 'walls', label: 'Walls', path: 'Internal>Walls' },
      { id: 'paint-standard', label: 'Paint – Standard', path: 'Internal>Paint – Standard' },
      { id: 'paint-custom', label: 'Paint – Custom Colour', path: 'Internal>Paint – Custom Colour' },
      { id: 'plaster', label: 'Plaster / Microcement', path: 'Internal>Plaster / Microcement' },
      { id: 'timber-panels', label: 'Timber Panels', path: 'Internal>Timber Panels' },
      { id: 'tiles', label: 'Tiles', path: 'Internal>Tiles' },
      { id: 'wallpaper', label: 'Wallpaper', path: 'Internal>Wallpaper' },
      { id: 'ceilings', label: 'Ceilings', path: 'Internal>Ceilings' },
      { id: 'acoustic-panels', label: 'Acoustic Panels', path: 'Internal>Acoustic Panels' },
      { id: 'timber-slats', label: 'Timber Slats', path: 'Internal>Timber Slats' },
      { id: 'joinery', label: 'Joinery & Furniture', path: 'Internal>Joinery & Furniture' },
      { id: 'fixtures', label: 'Fixtures & Fittings', path: 'Internal>Fixtures & Fittings' },
      { id: 'doors', label: 'Doors', path: 'Internal>Doors' },
      { id: 'balustrade', label: 'Balustrade & Railings', path: 'Internal>Balustrade & Railings' }
    ]
  },
  {
    id: 'custom',
    label: 'Custom',
    groups: [
      { id: 'upload-image', label: 'Upload Image', path: 'Custom>Upload Image' },
      {
        id: 'brand-material',
        label: 'Brand / Supplier Material',
        path: 'Custom>Brand / Supplier Material'
      },
  { id: 'custom-finish', label: 'Custom Finish / Product Link', path: 'Custom>Custom Finish / Product Link' }
    ]
  }
];

// Use enhanced sustainability insight type from types/sustainability.ts
type SustainabilityInsight = EnhancedSustainabilityInsight;

interface MoodboardProps {
  onNavigate?: (page: string) => void;
  initialBoard?: BoardItem[];
  onBoardChange?: (items: BoardItem[]) => void;
  moodboardRenderUrl?: string | null;
  onMoodboardRenderUrlChange?: (url: string | null) => void;
}

type MoodboardFlowProgress = {
  step: number;
  total: number;
  label: string;
  state: 'running' | 'complete' | 'error';
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';
const MOODBOARD_FLOW_TOTAL_STEPS = 3;
const REPORT_PROSE_TIMEOUT_MS = 25000;
const REPORT_PREVIEW_INCLUDES = [
  'Comparative lifecycle dashboard',
  'Carbon dominance ranking',
  'System-level synergies and risks',
  'Design actions and alternatives',
  'Confidence and compliance notes'
];
const ASSESSMENT_NOTES = [
  'Relative lifecycle impacts across key stages',
  'Early-stage proxies, not product EPDs',
  'Separate models for industrial materials and landscape systems',
  'Benefits are not allowed to greenwash high-carbon items',
  'Full assumptions and confidence levels in the downloadable report'
];
const BENEFIT_LABELS: Record<Benefit['type'], string> = {
  biodiversity: 'Biodiversity and habitat uplift potential',
  circularity: 'Strong reuse and circularity potential',
  durability: 'Durable system with long service life',
  operational_carbon: 'Operational carbon savings potential',
  health_voc: 'Lower VOC and indoor health benefit',
  sequestration: 'Biogenic carbon storage potential'
};

const SUMMARY_STRIP_GROUPS: Array<{ label: string; categories: MaterialCategory[] }> = [
  { label: 'Structure', categories: ['structure', 'exposed-structure'] },
  {
    label: 'Envelope',
    categories: [
      'external',
      'wall-internal',
      'finish',
      'ceiling',
      'soffit',
      'paint-wall',
      'paint-ceiling',
      'plaster',
      'microcement',
      'timber-panel',
      'tile',
      'wallpaper',
      'acoustic-panel',
      'timber-slat',
      'landscape',
      'external-ground'
    ]
  },
  { label: 'Openings', categories: ['window', 'door', 'balustrade'] },
  { label: 'Roof', categories: ['roof'] },
  { label: 'Insulation', categories: ['insulation'] }
];

const dataUrlSizeBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
};

const downscaleImage = (
  dataUrl: string,
  targetMime = RESIZE_MIME,
  quality = RESIZE_QUALITY
): Promise<{ dataUrl: string; width: number; height: number; mimeType: string; sizeBytes: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported in this browser.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const mime = targetMime || 'image/jpeg';
      const resizedUrl = canvas.toDataURL(mime, quality);
      resolve({
        dataUrl: resizedUrl,
        width,
        height,
        mimeType: mime,
        sizeBytes: dataUrlSizeBytes(resizedUrl)
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

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
  onMoodboardRenderUrlChange
}) => {
  const [board, setBoard] = useState<BoardItem[]>(initialBoard || []);
  const [sustainabilityInsights, setSustainabilityInsights] = useState<SustainabilityInsight[] | null>(null);
  const sustainabilityInsightsRef = useRef<SustainabilityInsight[] | null>(null);
  const [paletteSummary, setPaletteSummary] = useState<string | null>(null);
  const paletteSummaryRef = useRef<string | null>(null);
  const [reportProse, setReportProse] = useState<ReportProse | null>(null);
  const reportProseRef = useRef<ReportProse | null>(null);
  const [summaryReviewed, setSummaryReviewed] = useState(false);
  const [materialKey, setMaterialKey] = useState<string | null>(null);
  const [moodboardRenderUrlState, setMoodboardRenderUrlState] = useState<string | null>(
    moodboardRenderUrlProp ?? null
  );
  const [moodboardEditPrompt, setMoodboardEditPrompt] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'sustainability' | 'summary' | 'summary-review' | 'report-prose' | 'render' | 'all' | 'detecting'
  >('idle');
  const [exportingReport, setExportingReport] = useState(false);
  const [exportingSummaryReport, setExportingSummaryReport] = useState(false);
  const [reportProgress, setReportProgress] = useState<{ step: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [materialsAccordionOpen, setMaterialsAccordionOpen] = useState(true);
  const [steelColor, setSteelColor] = useState('#ffffff');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingMoodboard, setIsCreatingMoodboard] = useState(false);
  const [isBuildingFullReport, setIsBuildingFullReport] = useState(false);
  const [flowProgress, setFlowProgress] = useState<MoodboardFlowProgress | null>(null);
  const [detectionImage, setDetectionImage] = useState<UploadedImage | null>(null);
  const [detectedMaterials, setDetectedMaterials] = useState<MaterialOption[] | null>(null);
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [addedDetectedIds, setAddedDetectedIds] = useState<Set<string>>(new Set());
  const [sustainabilityBriefing, setSustainabilityBriefing] = useState<SustainabilityBriefingResponse | null>(null);
  const [briefingPayload, setBriefingPayload] = useState<SustainabilityBriefingPayload | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [exportingBriefingPdf, setExportingBriefingPdf] = useState(false);

  useEffect(() => {
    if (initialBoard) {
      setBoard(initialBoard);
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

  const treePathFallbacks = useMemo(
    () => ({
      structure: ['Structure>Primary Structure'],
      floor: ['Internal>Floors', 'External>External Ground / Landscaping'],
      'wall-internal': ['Internal>Walls'],
      external: ['External>Façade'],
      ceiling: ['Internal>Ceilings'],
      soffit: ['Internal>Ceilings'],
      window: ['External>Glazing'],
      roof: ['External>Roofing'],
      finish: ['Internal>Timber Panels', 'Internal>Acoustic Panels', 'Internal>Timber Slats'],
      'paint-wall': ['Internal>Paint – Standard'],
      'paint-ceiling': ['Internal>Ceilings'],
      plaster: ['Internal>Plaster / Microcement'],
      microcement: ['Internal>Plaster / Microcement'],
      'timber-panel': ['Internal>Timber Panels'],
      tile: ['Internal>Tiles'],
      wallpaper: ['Internal>Wallpaper'],
      'acoustic-panel': ['Internal>Acoustic Panels'],
      'timber-slat': ['Internal>Timber Slats'],
      'exposed-structure': ['Structure>Secondary Structure'],
      joinery: ['Internal>Joinery & Furniture'],
      fixture: ['Internal>Fixtures & Fittings'],
      landscape: ['External>External Ground / Landscaping'],
      insulation: ['External>Insulation'],
      door: ['Internal>Doors'],
      balustrade: ['Internal>Balustrade & Railings'],
      'external-ground': ['External>External Ground / Landscaping']
    }),
    []
  );

  const materialsByPath = useMemo(() => {
    const map: Record<string, MaterialOption[]> = {};
    MATERIAL_PALETTE.forEach((mat) => {
      const paths = mat.treePaths?.length ? mat.treePaths : treePathFallbacks[mat.category] || ['Unsorted>Other'];
      paths.forEach((path) => {
        map[path] = map[path] || [];
        map[path].push(mat);
      });
    });
    return map;
  }, [treePathFallbacks]);

  const [customFinishes, setCustomFinishes] = useState<Record<string, { color: string; finish: string }>>(() => {
    const initial: Record<string, { color: string; finish: string }> = {};
    MATERIAL_PALETTE.filter((m) => m.supportsColor && m.finishOptions?.length).forEach((mat) => {
      initial[mat.id] = { color: mat.tone, finish: mat.finishOptions?.[0] || 'Matte' };
    });
    return initial;
  });

  const handleAdd = (
    mat: MaterialOption,
    customization?: { label?: string; tone?: string; finishVariant?: string }
  ) => {
    const baseSteel = MATERIAL_PALETTE.find((m) => m.id === 'steel-frame');
    const baseTone = customization?.tone || mat.tone;
    const finishVariant = customization?.finishVariant ? ` (${customization.finishVariant})` : '';
    const labelSuffix = customization?.label ? ` — ${customization.label}` : '';
    let finishText = `${mat.finish}${labelSuffix}${finishVariant}`;
    let tone = baseTone;

    if (mat.id === 'steel-frame') {
      tone = customization?.tone || steelColor;
      finishText = `${baseSteel?.finish || mat.finish} (${tone})`;
    } else if (mat.supportsColor && customization?.tone) {
      finishText = `${mat.finish}${labelSuffix}${finishVariant ? ` ${finishVariant}` : ''} (${customization.tone})`;
    }

    const next: MaterialOption = {
      ...mat,
      tone,
      finish: finishText
    };
    setBoard((prev) => {
      const nextTone = next.tone?.toLowerCase().trim() || '';
      const alreadyAdded = prev.some((item) => {
        if (item.id !== next.id) return false;
        const itemTone = item.tone?.toLowerCase().trim() || '';
        return itemTone === nextTone;
      });
      if (alreadyAdded) return prev;
      return [...prev, next];
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/material-id');
    const found = MATERIAL_PALETTE.find((m) => m.id === id);
    if (found) handleAdd(found);
  };

  const handleDragStart = (id: string, e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/material-id', id);
  };

  const handleRemove = (idxToRemove: number) => {
    setBoard((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const renderMaterialCard = (mat: MaterialOption) => {
    const customFinish = customFinishes[mat.id] || { color: mat.tone, finish: mat.finishOptions?.[0] || 'Matte' };
    return (
      <div
        key={mat.id}
        draggable
        onDragStart={(e) => handleDragStart(mat.id, e)}
        className="border border-gray-200 bg-white p-4 flex items-start gap-3 cursor-grab active:cursor-grabbing"
      >
        <span
          className="w-10 h-10 rounded-full border border-gray-200 shadow-inner"
          style={{ backgroundColor: mat.id === 'steel-frame' ? steelColor : customFinish.color || mat.tone }}
          aria-hidden
        />
        <div className="space-y-2 flex-1">
          <div>
            <div className="font-display uppercase tracking-wide text-sm">{mat.name}</div>
            <div className="font-mono text-[11px] uppercase tracking-widest">{mat.finish}</div>
            <p className="font-sans text-sm text-gray-600 mt-1">{mat.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                handleAdd(mat, {
                  tone: mat.supportsColor ? (mat.id === 'steel-frame' ? steelColor : customFinish.color) : undefined,
                  finishVariant: mat.finishOptions?.length ? customFinish.finish : undefined
                })
              }
              className="font-mono text-[11px] uppercase tracking-widest border px-2 py-1 hover:bg-black hover:text-white"
            >
              Add to board
            </button>
            {mat.supportsColor && mat.finishOptions?.length ? (
              <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                Custom colour + finish ready
              </span>
            ) : null}
          </div>

          {mat.colorOptions?.length ? (
            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                {mat.id === 'brick-veneer' ? 'Brick Colours' : 'Colour Options'}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {mat.colorOptions.map((option) => (
                  <button
                    key={`${mat.id}-${option.label}`}
                    onClick={() => handleAdd(mat, { label: option.label, tone: option.tone })}
                    className="inline-flex items-center gap-2 px-2 py-1 border border-gray-200 hover:border-black"
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-gray-200 shadow-inner"
                      style={{ backgroundColor: option.tone }}
                      aria-hidden
                    />
                    <span className="font-mono text-[11px] uppercase tracking-widest">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {mat.id === 'steel-frame' ? (
            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">Steel Colour</div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: 'White', value: '#ffffff' },
                  { label: 'Charcoal', value: '#333333' },
                  { label: 'Oxide Red', value: '#7a2c20' }
                ].map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setSteelColor(preset.value)}
                    className={`px-3 py-1 border text-xs font-mono uppercase tracking-widest ${
                      steelColor.toLowerCase() === preset.value.toLowerCase()
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 hover:border-black'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={steelColor}
                  onChange={(e) => setSteelColor(e.target.value)}
                  className="w-12 h-10 border border-gray-300"
                />
                <input
                  type="text"
                  value={steelColor}
                  onChange={(e) => setSteelColor(e.target.value)}
                  className="flex-1 border border-gray-300 px-3 py-2 font-mono text-sm"
                />
              </div>
            </div>
          ) : null}

          {mat.supportsColor && mat.finishOptions?.length ? (
            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                Custom colour & finish
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  value={customFinish.color}
                  onChange={(e) =>
                    setCustomFinishes((prev) => ({
                      ...prev,
                      [mat.id]: { color: e.target.value, finish: customFinish.finish }
                    }))
                  }
                  className="w-12 h-10 border border-gray-300"
                />
                <input
                  type="text"
                  value={customFinish.color}
                  onChange={(e) =>
                    setCustomFinishes((prev) => ({
                      ...prev,
                      [mat.id]: { color: e.target.value, finish: customFinish.finish }
                    }))
                  }
                  className="flex-1 border border-gray-300 px-3 py-2 font-mono text-sm"
                />
                <select
                  value={customFinish.finish}
                  onChange={(e) =>
                    setCustomFinishes((prev) => ({
                      ...prev,
                      [mat.id]: { color: customFinish.color, finish: e.target.value }
                    }))
                  }
                  className="border border-gray-300 px-2 py-2 text-sm font-sans"
                >
                  {mat.finishOptions.map((option) => (
                    <option key={`${mat.id}-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <p className="font-sans text-xs text-gray-600">
                Custom paint colour rule: pick any HEX/RGB value and finish (matte, satin, gloss) for walls or ceilings.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const summaryText = useMemo(() => {
    if (!board.length) return 'No materials selected yet.';
    const grouped = board.reduce((acc: Record<string, MaterialOption[]>, mat) => {
      acc[mat.category] = acc[mat.category] || [];
      acc[mat.category].push(mat);
      return acc;
    }, {});
    const lines = Object.entries(grouped).map(
      ([cat, items]) => `${cat}: ${items.map((i) => `${i.name} (${i.finish}) [color: ${i.tone}]`).join(', ')}`
    );
    return lines.join('\n');
  }, [board]);
  const sustainabilityPayload = useMemo(() => buildSustainabilityPayload(board), [board]);
  const allGroups = useMemo(
    () => MATERIAL_TREE.flatMap((section) => section.groups.map((g) => g)),
    []
  );
  const manualCategoryOptions: { id: MaterialOption['category']; label: string }[] = useMemo(
    () => [
      { id: 'structure', label: 'Structure' },
      { id: 'floor', label: 'Floors' },
      { id: 'wall-internal', label: 'Internal Walls' },
      { id: 'external', label: 'External Envelope' },
      { id: 'ceiling', label: 'Ceilings' },
      { id: 'soffit', label: 'Soffits' },
      { id: 'window', label: 'Window Frames / Glazing' },
      { id: 'roof', label: 'Roofing' },
      { id: 'finish', label: 'Internal Finishes' },
      { id: 'paint-wall', label: 'Paint – Walls' },
      { id: 'paint-ceiling', label: 'Paint – Ceilings' },
      { id: 'plaster', label: 'Plaster' },
      { id: 'microcement', label: 'Microcement' },
      { id: 'timber-panel', label: 'Timber Panels' },
      { id: 'tile', label: 'Tiles' },
      { id: 'wallpaper', label: 'Wallpaper' },
      { id: 'acoustic-panel', label: 'Acoustic Panels' },
      { id: 'timber-slat', label: 'Timber Slats' },
      { id: 'joinery', label: 'Joinery & Furniture' },
      { id: 'fixture', label: 'Fixtures & Fittings' },
      { id: 'landscape', label: 'External Ground / Landscaping' }
    ],
    []
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const acc: Record<string, boolean> = {};
    allGroups.forEach((group) => {
      acc[group.id] = false;
    });
    acc.custom = false;
    return acc;
  });
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMaterialsByPath: Record<string, MaterialOption[]> = useMemo(() => {
    const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
    if (!tokens.length) return materialsByPath;

    const matchesSearch = (mat: MaterialOption) => {
      const haystack = [
        mat.name,
        mat.finish,
        mat.description,
        mat.category,
        ...(mat.keywords || []),
        ...(mat.colorOptions?.map((c) => c.label) || [])
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    };

    const next: Record<string, MaterialOption[]> = {};
    Object.entries(materialsByPath).forEach(([path, list]) => {
      next[path] = list.filter((item) => matchesSearch(item));
    });
    return next;
  }, [normalizedSearch, materialsByPath]);
  const hasSearch = normalizedSearch.length > 0;
  const totalSearchResults = useMemo(
    () => Object.values(filteredMaterialsByPath).reduce((acc, list) => acc + list.length, 0),
    [filteredMaterialsByPath]
  );
  const [manualLabel, setManualLabel] = useState('');
  const [manualCategory, setManualCategory] = useState<MaterialOption['category']>('finish');
  const [manualTone, setManualTone] = useState('#e5e7eb');
  const [carbonSectionsOpen, setCarbonSectionsOpen] = useState<Record<string, boolean>>(() => {
    const acc: Record<string, boolean> = {};
    allGroups.forEach((group) => {
      acc[group.id] = false;
    });
    return acc;
  });
  const [materialFlagsOpen, setMaterialFlagsOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  const moodboardRenderUrl = moodboardRenderUrlProp ?? moodboardRenderUrlState;

  const setMoodboardRenderUrl = (url: string | null) => {
    setMoodboardRenderUrlState(url);
    onMoodboardRenderUrlChange?.(url);
  };

  useEffect(() => {
    if (moodboardRenderUrlProp !== undefined) {
      setMoodboardRenderUrlState(moodboardRenderUrlProp);
    }
  }, [moodboardRenderUrlProp]);

  useEffect(() => {
    if (!hasSearch) return;
    setOpenSections((prev) => {
      const next = { ...prev };
      allGroups.forEach((group) => {
        next[group.id] = (filteredMaterialsByPath[group.path] || []).length > 0;
      });
      return next;
    });
    setCarbonSectionsOpen((prev) => {
      const next = { ...prev };
      allGroups.forEach((group) => {
        const list = filteredMaterialsByPath[group.path] || [];
        next[group.id] = list.some((m) => m.carbonIntensity === 'high');
      });
      return next;
    });
  }, [hasSearch, filteredMaterialsByPath, allGroups]);

  useEffect(() => {
    if (hasSearch) return;
    setOpenSections((prev) => {
      const anyOpen = allGroups.some((group) => prev[group.id]);
      if (!anyOpen) return prev;
      const next = { ...prev };
      allGroups.forEach((group) => {
        next[group.id] = false;
      });
      next.custom = prev.custom;
      return next;
    });
    setCarbonSectionsOpen((prev) => {
      const anyOpen = allGroups.some((group) => prev[group.id]);
      if (!anyOpen) return prev;
      const next = { ...prev };
      allGroups.forEach((group) => {
        next[group.id] = false;
      });
      return next;
    });
  }, [hasSearch, allGroups]);

  const buildMaterialKey = () => {
    if (!board.length) return 'No materials selected yet.';
    return board.map((item) => `${item.name} — ${item.finish}`).join('\n');
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

    try {
      await saveGeneration({
        prompt,
        imageDataUri,
        materials: metadata
      });
    } catch (err) {
      console.error('Failed to save generation to backend', err);
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

  const hasTextContent = () =>
    Boolean(sustainabilityInsightsRef.current && sustainabilityInsightsRef.current.length > 0);

  const sustainabilityPreview = useMemo(() => {
    if (!summaryReviewed) return null;
    const availableInsights = sustainabilityInsights || [];

    const materialById = new Map<string, BoardItem>();
    board.forEach((material) => materialById.set(material.id, material));

    const insightById = new Map<string, SustainabilityInsight>();
    availableInsights.forEach((insight) => {
      if (insight?.id) insightById.set(insight.id, insight);
    });

    const metrics = new Map<string, MaterialMetrics>();
    board.forEach((material) => {
      const profile = MATERIAL_LIFECYCLE_PROFILES[material.id];
      if (!profile) return;
      const insight = insightById.get(material.id);
      const benefits = insight?.benefits || [];
      metrics.set(material.id, calculateMaterialMetrics(profile, benefits, material));
    });

    const labelFor = (id: string) =>
      materialById.get(id)?.name || insightById.get(id)?.title || 'Material';

    const isLandscapeId = (id: string) => {
      const material = materialById.get(id);
      return material ? isLandscapeMaterial(material) : false;
    };

    const uniqueList = (items: string[]) => {
      const seen = new Set<string>();
      const result: string[] = [];
      items.forEach((item) => {
        const trimmed = item.trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        result.push(trimmed);
      });
      return result;
    };

    const isWildflowerMeadow = (material?: BoardItem) => {
      if (!material) return false;
      if (material.id === 'wildflower-meadow') return true;
      return /wildflower|meadow/i.test(material.name);
    };

    const stageLabelMap: Record<LifecycleStageKey, string> = {
      raw: 'Raw stage',
      manufacturing: 'Manufacturing stage',
      transport: 'Transport stage',
      installation: 'Installation stage',
      inUse: 'In-use stage',
      maintenance: 'Maintenance stage',
      endOfLife: 'End-of-life stage'
    };

    const cleanSentence = (value?: string) => {
      const trimmed = (value || '').trim();
      if (!trimmed) return '';
      return trimmed.replace(/[.]+$/, '');
    };

    const getTopHotspotLine = (insight?: SustainabilityInsight) => {
      if (!insight?.hotspots?.length) return '';
      const topHotspot = [...insight.hotspots].sort((a, b) => b.score - a.score)[0];
      if (!topHotspot) return '';
      const reason = cleanSentence(topHotspot.reason);
      if (!reason) return '';
      return `${stageLabelMap[topHotspot.stage]}: ${reason}`;
    };

    const getRiskLine = (material: BoardItem | undefined, insight?: SustainabilityInsight) => {
      if (material && isWildflowerMeadow(material)) {
        return 'High upfront establishment impact if pre-grown systems are used.';
      }
      const headline = cleanSentence(insight?.headline);
      if (headline) return headline;
      const hotspotLine = getTopHotspotLine(insight);
      if (hotspotLine) return hotspotLine;
      if (insight?.design_risk) return insight.design_risk;
      const topRisk = insight?.risks?.reduce((best, risk) => {
        if (!best || risk.severity_1to5 > best.severity_1to5) return risk;
        return best;
      }, undefined as Risk | undefined);
      if (topRisk?.note) return topRisk.note;
      return 'Performance justification is required at concept stage.';
    };

    const getBenefitLine = (material: BoardItem | undefined, insight?: SustainabilityInsight) => {
      if (material && isWildflowerMeadow(material)) {
        return 'Long-term ecological, water, and biodiversity benefits dominate lifecycle performance.';
      }
      const rationale = cleanSentence(insight?.whyItLooksLikeThis);
      if (rationale) return rationale;
      const benefits = insight?.benefits || [];
      if (benefits.length > 0) {
        const topBenefit = [...benefits].sort((a, b) => b.score_1to5 - a.score_1to5)[0];
        if (topBenefit.note) return topBenefit.note;
        return BENEFIT_LABELS[topBenefit.type] || 'Documented sustainability benefits are available.';
      }
      return 'Documented sustainability benefits are limited at concept stage.';
    };

    const getActionLine = (material: BoardItem | undefined, insight?: SustainabilityInsight) => {
      if (material && isWildflowerMeadow(material)) {
        return 'Avoid pre-grown mats. Use plug planting in site-won soil.';
      }
      if (insight?.design_response) return insight.design_response;
      if (insight?.designLevers?.length) return insight.designLevers[0];
      if (insight?.whatCouldChange?.length) return insight.whatCouldChange[0];
      return 'Validate alternatives and avoid over-specification.';
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

    // Conservative threshold: only genuinely low embodied materials qualify as "low-carbon".
    const LOW_CARBON_EMBODIED_MAX = 2.2;

    const lowCarbonCandidates = [...metrics.entries()]
      .filter(([id, metric]) => {
        const material = materialById.get(id);
        if (!material) return false;
        if (highestImpactIds.includes(id)) return false;
        return metric.traffic_light === 'green' || metric.embodied_proxy <= LOW_CARBON_EMBODIED_MAX;
      })
      .sort((a, b) => a[1].embodied_proxy - b[1].embodied_proxy);

    const lowCarbonSystems = lowCarbonCandidates.slice(0, 3).map(([id]) => labelFor(id));

    const actionPriorities = uniqueList(
      highestImpactIds.map((id) => getActionLine(materialById.get(id), insightById.get(id)))
    ).slice(0, 3);

    const summarySentence = paletteSummary?.trim()
      ? paletteSummary.trim()
      : highestImpact.length > 0 && lowCarbonSystems.length > 0
        ? 'This palette combines performance-led finishes with lower-carbon structural and landscape systems. Several components will need justification or refinement at later stages.'
        : highestImpact.length > 0
          ? 'Several high-impact components will need justification or refinement at later stages.'
          : 'Early-stage sustainability signals are available once materials are assessed.';

    const goodPracticeIds = lowCarbonCandidates
      .filter(([id]) => !highestImpactIds.includes(id))
      .sort((a, b) => {
        const benefitDiff = b[1].environmental_benefit_score - a[1].environmental_benefit_score;
        if (benefitDiff !== 0) return benefitDiff;
        return a[1].embodied_proxy - b[1].embodied_proxy;
      })
      .slice(0, 2)
      .map(([id]) => id);

    const highlightIds = [...highestImpactIds, ...goodPracticeIds];
    const highlights = highlightIds.map((id) => {
      const material = materialById.get(id);
      const insight = insightById.get(id);
      const isHighImpact = highestImpactIds.includes(id);
      const left = isHighImpact ? getRiskLine(material, insight) : getBenefitLine(material, insight);
      const right = getActionLine(material, insight);
      const clean = (value: string) => value.trim().replace(/\.$/, '');
      return {
        id,
        title: material?.name || insight?.title || 'Material',
        line: `${clean(left)} → ${clean(right)}`
      };
    });

    return {
      snapshot: {
        summarySentence,
        highestImpact,
        lowCarbonSystems,
        actionPriorities
      },
      highlights
    };
  }, [board, sustainabilityInsights, paletteSummary, summaryReviewed]);

  const generateSummaryPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const ctx = createPDFContext(doc);

    const insightById = new Map<string, SustainabilityInsight>();
    const insights = sustainabilityInsightsRef.current || sustainabilityInsights || [];
    insights.forEach((insight) => {
      if (insight?.id) insightById.set(insight.id, insight);
    });

    const metrics = new Map<string, MaterialMetrics>();
    board.forEach((material) => {
      const profile = MATERIAL_LIFECYCLE_PROFILES[material.id];
      if (!profile) return;
      const benefits = insightById.get(material.id)?.benefits || [];
      metrics.set(material.id, calculateMaterialMetrics(profile, benefits, material));
    });

    const projectMetrics = calculateProjectMetrics(board, metrics);
    const metricValues = Array.from(metrics.values());
    const avgEmbodied =
      metricValues.length > 0
        ? metricValues.reduce((sum, metric) => sum + metric.embodied_proxy, 0) / metricValues.length
        : 0;

    const toBadgeRating = (value: number, lowMax: number, highMin: number): 'Low' | 'Med' | 'High' => {
      if (value >= highMin) return 'High';
      if (value <= lowMax) return 'Low';
      return 'Med';
    };

    const productionImpact = toBadgeRating(avgEmbodied, 2.5, 3.8);
    const circularity = toBadgeRating(projectMetrics.circularRatio, 0.3, 0.6);
    const biogenicStorage = toBadgeRating(projectMetrics.bioRatio, 0.1, 0.3);

    const materialById = new Map<string, BoardItem>();
    board.forEach((material) => materialById.set(material.id, material));
    const labelFor = (id: string) =>
      materialById.get(id)?.name || insightById.get(id)?.title || 'Material';

    const nonLandscapeEmbodied = [...metrics.entries()]
      .filter(([id]) => {
        const material = materialById.get(id);
        return material ? !isLandscapeMaterial(material) : true;
      })
      .sort((a, b) => b[1].embodied_proxy - a[1].embodied_proxy);
    const allEmbodiedSorted = [...metrics.entries()].sort((a, b) => b[1].embodied_proxy - a[1].embodied_proxy);
    const embodiedFallback = nonLandscapeEmbodied.length > 0 ? nonLandscapeEmbodied : allEmbodiedSorted;
    const fallbackHotspots = embodiedFallback.slice(0, 3).map(([id]) => labelFor(id));
    const hotspotItems =
      sustainabilityPreview?.snapshot.highestImpact?.slice(0, 3) && sustainabilityPreview.snapshot.highestImpact.length > 0
        ? sustainabilityPreview.snapshot.highestImpact.slice(0, 3)
        : fallbackHotspots;

    const truncateWords = (value: string, maxWords = 10) =>
      value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, maxWords)
        .join(' ');

    const defaultActions = [
      'Reduce high-impact components before layout is fixed',
      'Specify verified evidence requirements in procurement schedules',
      'Detail reversible connections for future disassembly'
    ];
    const actionCandidates = [
      ...(sustainabilityPreview?.snapshot.actionPriorities || []),
      ...defaultActions
    ];
    const actionSet = new Set<string>();
    const quickActions: string[] = [];
    actionCandidates.forEach((candidate) => {
      const trimmed = truncateWords(candidate, 10).trim();
      if (!trimmed || actionSet.has(trimmed)) return;
      actionSet.add(trimmed);
      quickActions.push(trimmed);
    });
    while (quickActions.length < 3) {
      const fallback = truncateWords(defaultActions[quickActions.length], 10);
      if (!actionSet.has(fallback)) {
        actionSet.add(fallback);
        quickActions.push(fallback);
      } else {
        break;
      }
    }

    const stageOrder: LifecycleStageKey[] = [
      'raw',
      'manufacturing',
      'transport',
      'installation',
      'inUse',
      'maintenance',
      'endOfLife'
    ];
    const lowConfidenceCount = board.reduce((count, material) => {
      const profile = MATERIAL_LIFECYCLE_PROFILES[material.id];
      if (!profile) return count;
      const hasLowConfidence = stageOrder.some((stage) => profile[stage]?.confidence === 'low');
      return count + (hasLowConfidence ? 1 : 0);
    }, 0);
    const lowConfidenceRatio = board.length > 0 ? lowConfidenceCount / board.length : 1;
    const confidence: 'Low' | 'Med' | 'High' = lowConfidenceRatio > 0.5 ? 'Low' : lowConfidenceRatio > 0.2 ? 'Med' : 'High';

    const toRgb = (hexColor: string): [number, number, number] => {
      const raw = (hexColor || '').trim();
      const normalized = /^#[0-9a-fA-F]{3}$/.test(raw)
        ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
        : raw;
      if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return [209, 213, 219];
      return [
        Number.parseInt(normalized.slice(1, 3), 16),
        Number.parseInt(normalized.slice(3, 5), 16),
        Number.parseInt(normalized.slice(5, 7), 16)
      ];
    };

    const truncateLabel = (value: string, maxChars = 20) =>
      value.length > maxChars ? `${value.slice(0, Math.max(0, maxChars - 3))}...` : value;

    const maxWidth = ctx.pageWidth - ctx.margin * 2;
    const dateLabel = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const baseOptionName = board.length
      ? `${board[0].name}${board.length > 1 ? ` + ${board.length - 1} more` : ''}`
      : 'Palette Option';
    let optionName = baseOptionName;
    let headerLine = `Sustainability Snapshot | ${optionName} | ${dateLabel} | Concept / RIBA 2`;
    while (doc.getTextWidth(headerLine) > maxWidth && optionName.length > 14) {
      optionName = `${optionName.slice(0, Math.max(0, optionName.length - 4))}...`;
      headerLine = `Sustainability Snapshot | ${optionName} | ${dateLabel} | Concept / RIBA 2`;
    }

    let y = ctx.margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(headerLine, ctx.margin, y);
    y += 12;

    doc.setDrawColor(226, 232, 240);
    doc.line(ctx.margin, y, ctx.pageWidth - ctx.margin, y);
    y += 14;

    const badges = [
      { label: 'Production impact (A1-A3)', rating: productionImpact },
      { label: 'Circularity', rating: circularity },
      { label: 'Biogenic storage', rating: biogenicStorage }
    ];
    const badgeGap = 10;
    const badgeWidth = (maxWidth - badgeGap * 2) / 3;
    const badgeHeight = 50;
    badges.forEach((badge, index) => {
      const x = ctx.margin + index * (badgeWidth + badgeGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, badgeWidth, badgeHeight, 3, 3, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(badge.label, x + 7, y + 13);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(badge.rating, x + 7, y + 35);
    });
    y += badgeHeight + 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text('Top 3 carbon-dominant components', ctx.margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    hotspotItems.slice(0, 3).forEach((item, index) => {
      doc.text(`${index + 1}) ${item}`, ctx.margin, y);
      y += 13;
    });
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Do next (highest leverage)', ctx.margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    quickActions.slice(0, 3).forEach((action) => {
      doc.text(`- ${action}`, ctx.margin, y);
      y += 13;
    });
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Palette strip', ctx.margin, y);
    y += 10;

    const stripHeight = 58;
    const stripY = y;
    const stripColWidth = maxWidth / SUMMARY_STRIP_GROUPS.length;
    SUMMARY_STRIP_GROUPS.forEach((group, index) => {
      const groupX = ctx.margin + index * stripColWidth;
      const swatches = board.filter((material) => group.categories.includes(material.category)).slice(0, 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(group.label.toUpperCase(), groupX + 2, stripY + 10);

      if (swatches.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('-', groupX + 2, stripY + 24);
        return;
      }

      swatches.forEach((material, swatchIndex) => {
        const rowY = stripY + 22 + swatchIndex * 14;
        const [r, g, b] = toRgb(material.tone);
        doc.setFillColor(r, g, b);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(groupX + 2, rowY - 7, 8, 8, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(truncateLabel(material.name, 17), groupX + 14, rowY);
      });
    });
    y += stripHeight;

    const footerY = Math.max(y + 12, ctx.pageHeight - ctx.margin - 16);
    doc.setDrawColor(226, 232, 240);
    doc.line(ctx.margin, footerY - 14, ctx.pageWidth - ctx.margin, footerY - 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Confidence: ${confidence}`, ctx.margin, footerY);
    doc.setFont('helvetica', 'normal');
    doc.text('Scope: Early-stage comparative guidance, not a full LCA/EPD calculation.', ctx.margin, footerY + 12);

    return doc;
  };

  const generateReportPdf = async (
    onProgress?: (step: string, percent: number) => void
  ) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const ctx = createPDFContext(doc);
    const insights = sustainabilityInsightsRef.current || [];
    const insightsById = new Map<string, SustainabilityInsight>();
    insights.forEach((insight) => {
      if (insight?.id) insightsById.set(insight.id, insight);
    });
    const metrics = new Map<string, MaterialMetrics>();
    board.forEach((material) => {
      const profile = MATERIAL_LIFECYCLE_PROFILES[material.id];
      if (profile) {
        const benefits = insightsById.get(material.id)?.benefits || [];
        metrics.set(material.id, calculateMaterialMetrics(profile, benefits, material));
      }
    });

    // ========== PAGE 1: Specifier's Snapshot ==========
    onProgress?.('Building specifier snapshot...', 5);
    const optimizedSnapshotImage = moodboardRenderUrl
      ? await optimizeImageDataUriForPdf(moodboardRenderUrl, {
          maxDimension: 720,
          quality: 0.82,
        })
      : moodboardRenderUrl;
    renderSpecifiersSnapshot(
      ctx,
      optimizedSnapshotImage,
      board,
      metrics,
      paletteSummaryRef.current
    );

    // Detect synergies and conflicts (pass metrics for fallback generation)
    const synergies = detectSynergies(board, metrics);
    const conflicts = detectConflicts(board, metrics);

    // Sort materials by metrics for top lists
    const sortedByEmbodied = [...board]
      .filter((m) => metrics.has(m.id))
      .sort(
        (a, b) =>
          (metrics.get(b.id)?.embodied_proxy || 0) -
          (metrics.get(a.id)?.embodied_proxy || 0)
      )
      .slice(0, 3)
      .map((m) => m.id);

    // Use ENVIRONMENTAL benefit score for top benefit contributors
    // Only environmental benefits (biodiversity, sequestration, operational savings)
    // can offset embodied carbon - practical benefits (durability, circularity) cannot
    const sortedByBenefit = [...board]
      .filter((m) => metrics.has(m.id))
      .sort(
        (a, b) =>
          (metrics.get(b.id)?.environmental_benefit_score || 0) -
          (metrics.get(a.id)?.environmental_benefit_score || 0)
      )
      .slice(0, 3)
      .filter((m) => (metrics.get(m.id)?.environmental_benefit_score || 0) > 0)
      .map((m) => m.id);

    // Generate system-level summary
    const systemSummary: SystemLevelSummary = {
      top_embodied_items: sortedByEmbodied,
      top_benefit_items: sortedByBenefit,
      net_statement: generateNetStatement(sortedByEmbodied, sortedByBenefit, synergies, board),
      synergies,
      conflicts,
    };

    // Generate client summary
    const clientSummary = generateClientSummary(
      board,
      insights,
      metrics,
      synergies,
      conflicts
    );

    // QA validation (log warnings but don't block)
    const qaResult = validateInsights(insights, board, metrics);
    if (!qaResult.valid) {
      console.warn('[PDF QA] Validation issues:', qaResult.errors);
    }
    if (qaResult.warnings.length > 0) {
      console.warn('[PDF QA] Warnings:', qaResult.warnings);
    }

    // ========== PAGE 2: Client Summary ==========
    onProgress?.('Generating sustainability summary...', 15);
    renderStrategicOverview(
      ctx,
      clientSummary,
      board,
      metrics,
      insights,
      paletteSummaryRef.current,
      reportProseRef.current
    );

    // ========== PAGE 3: Comparative Dashboard ==========
    onProgress?.('Building comparative dashboard...', 25);
    if (board.length > 0 && metrics.size > 0) {
      renderComparativeDashboard(ctx, board, metrics);
    }

    // ========== PAGE 4: System-Level Summary ==========
    onProgress?.('Analysing system-level impacts...', 35);
    renderSystemSummaryPage(ctx, systemSummary, board, metrics);

    // ========== PAGE 5: Design Direction ==========
    onProgress?.('Generating design recommendations...', 45);
    if (board.length > 0 && metrics.size > 0 && insights.length > 0) {
      renderDesignDirectionPage(ctx, board, metrics, insights);
    }

    // ========== PAGE 6: Compliance Readiness Summary ==========
    onProgress?.('Checking compliance readiness...', 55);
    if (insights.length > 0) {
      renderComplianceReadinessSummary(ctx, insights, board, reportProseRef.current);
    }

    // ========== PAGES 6+: Material Details (two materials per page) ==========
    if (board.length > 0) {
      // Calculate palette context for rankings
      const totalEmbodied = Array.from(metrics.values()).reduce(
        (sum, m) => sum + m.embodied_proxy,
        0
      );
      const sortedByEmbodiedForRanking = [...board]
        .filter((m) => metrics.has(m.id))
        .sort(
          (a, b) =>
            (metrics.get(b.id)?.embodied_proxy || 0) -
            (metrics.get(a.id)?.embodied_proxy || 0)
        );
      const rankMap = new Map<string, number>();
      sortedByEmbodiedForRanking.forEach((m, idx) => {
        rankMap.set(m.id, idx + 1);
      });

      onProgress?.('Preparing material thumbnails...', 60);

      // Prefetch static icons for thumbnails (async + already resized for PDF)
      const materialIconUris = await prefetchMaterialIcons(board.map((m) => m.id));

      // Also check localStorage for AI-generated icons as fallback
      const storedIcons = loadMaterialIcons();
      const fallbackThumbnailUris = new Map<string, string>();

      await Promise.all(
        board.map(async (material) => {
          const sourceDataUri = material.customImage || storedIcons.get(material.id)?.dataUri;
          if (!sourceDataUri) return;

          const optimized = await optimizeImageDataUriForPdf(sourceDataUri, {
            maxDimension: 96,
            quality: 0.72,
          });
          fallbackThumbnailUris.set(material.id, optimized);
        })
      );

      // Start material detail pages (two cards per page).
      doc.addPage();
      ctx.cursorY = ctx.margin;

      board.forEach((material) => {

        const insight = insightsById.get(material.id);
        const metric = metrics.get(material.id);
        const profile = MATERIAL_LIFECYCLE_PROFILES[material.id] || null;

        // Get thumbnail - priority: custom image > static icon > stored icon
        let thumbnailDataUri: string | undefined;
        if (material.customImage) {
          thumbnailDataUri = fallbackThumbnailUris.get(material.id) || material.customImage;
        } else if (materialIconUris.has(material.id)) {
          thumbnailDataUri = materialIconUris.get(material.id);
        } else {
          thumbnailDataUri = fallbackThumbnailUris.get(material.id);
        }

        // Build palette context with thumbnail
        const contributionPercent =
          totalEmbodied > 0 ? (metric?.embodied_proxy || 0) / totalEmbodied * 100 : 0;
        const paletteContext: MaterialPaletteContext | undefined = metric
          ? {
              rank: rankMap.get(material.id) || 1,
              totalMaterials: board.length,
              contributionPercent,
              thumbnailDataUri,
              isCarbonDominant: contributionPercent >= 15, // Flag materials contributing >=15%
            }
          : undefined;

        renderEnhancedMaterialSection(
          ctx,
          material,
          insight,
          metric,
          profile,
          paletteContext
        );
      });
    }

    // ========== FINAL PAGE: Disclaimer ==========
    addDisclaimer(ctx);

    return doc;
  };

  const handleDownloadSummaryReport = async () => {
    if (!sustainabilityPreview) {
      setError('Generate the sustainability summary first.');
      return;
    }
    setExportingSummaryReport(true);
    try {
      const doc = generateSummaryPdf();
      doc.save('moodboard-summary.pdf');
    } catch (err) {
      console.error('Could not create summary PDF', err);
      setError('Could not create the summary download.');
    } finally {
      setExportingSummaryReport(false);
    }
  };

  const handleMobileSaveSummaryReport = async () => {
    if (!sustainabilityPreview) {
      setError('Generate the sustainability summary first.');
      return;
    }
    setExportingSummaryReport(true);
    try {
      const doc = generateSummaryPdf();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        doc.save('moodboard-summary.pdf');
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('Could not create summary PDF', err);
      setError('Could not create the mobile summary.');
    } finally {
      setExportingSummaryReport(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!hasTextContent()) {
      setError('Generate sustainability insights first.');
      return;
    }
    setExportingReport(true);
    try {
      const doc = await generateReportPdf();
      doc.save('moodboard-report.pdf');
    } catch (err) {
      console.error('Could not create report PDF', err);
      setError('Could not create the report download.');
    } finally {
      setExportingReport(false);
    }
  };

  const handleMobileSaveReport = async () => {
    if (!hasTextContent()) {
      setError('Generate sustainability insights first.');
      return;
    }
    setExportingReport(true);
    try {
      const doc = await generateReportPdf();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        doc.save('moodboard-report.pdf');
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('Could not create report PDF', err);
      setError('Could not create the mobile report.');
    } finally {
      setExportingReport(false);
    }
  };

  const generateBriefingPdf = () => {
    if (!sustainabilityBriefing || !briefingPayload) return null;

    type RGB = [number, number, number];
    type StageKey =
      | 'raw'
      | 'manufacturing'
      | 'transport'
      | 'installation'
      | 'inUse'
      | 'maintenance'
      | 'endOfLife';
    type StageScore = {
      key: StageKey;
      label: string;
      chartLabel: string[];
      score: number;
    };

    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 20;
    const topMargin = 20;
    const bottomMargin = 10;
    const contentW = pageW - marginX * 2;
    const sectionGap = 20;
    let y = topMargin;

    const stageScores: StageScore[] = [
      { key: 'raw', label: 'Raw Materials', chartLabel: ['Raw', 'Materials'], score: briefingPayload.averageScores.raw },
      { key: 'manufacturing', label: 'Manufacturing', chartLabel: ['Manufacturing'], score: briefingPayload.averageScores.manufacturing },
      { key: 'transport', label: 'Transport', chartLabel: ['Transport'], score: briefingPayload.averageScores.transport },
      { key: 'installation', label: 'Installation', chartLabel: ['Installation'], score: briefingPayload.averageScores.installation },
      { key: 'inUse', label: 'In Use', chartLabel: ['In Use'], score: briefingPayload.averageScores.inUse },
      { key: 'maintenance', label: 'Maintenance', chartLabel: ['Maintenance'], score: briefingPayload.averageScores.maintenance },
      { key: 'endOfLife', label: 'End of Life', chartLabel: ['End of', 'Life'], score: briefingPayload.averageScores.endOfLife },
    ];

    const contributors = [...stageScores].sort((a, b) => b.score - a.score).slice(0, 3);
    const opportunities = [...stageScores].sort((a, b) => a.score - b.score).slice(0, 3);
    const topStage = contributors[0]?.key;
    const topDrivers = topStage
      ? briefingPayload.materials
          .filter((material) => (material.lifecycleScores[topStage] ?? 0) >= 4)
          .map((material) => material.name)
          .slice(0, 3)
      : [];

    const splitLines = (value: string, maxWidth: number) => doc.splitTextToSize(value || '', maxWidth) as string[];

    const fitSingleLine = (value: string, maxWidth: number) => {
      if (!value) return '';
      let fitted = value;
      while (fitted.length > 3 && doc.getTextWidth(fitted) > maxWidth) {
        fitted = `${fitted.slice(0, Math.max(0, fitted.length - 4))}...`;
      }
      return fitted;
    };

    const ensureSpace = (requiredHeight: number) => {
      if (y + requiredHeight <= pageH - bottomMargin) return;
      doc.addPage();
      y = topMargin;
    };

    const drawPolygon = (points: Array<{ x: number; y: number }>, style: 'S' | 'F' | 'FD') => {
      if (points.length < 2) return;
      const segments = points.slice(1).map((point, index) => [
        point.x - points[index].x,
        point.y - points[index].y,
      ]);
      doc.lines(segments, points[0].x, points[0].y, [1, 1], style, true);
    };

    const drawPolyline = (points: Array<{ x: number; y: number }>) => {
      if (points.length < 2) return;
      const segments = points.slice(1).map((point, index) => [
        point.x - points[index].x,
        point.y - points[index].y,
      ]);
      doc.lines(segments, points[0].x, points[0].y, [1, 1], 'S', false);
    };

    const sampleSvgPath = (pathD: string, samples: number) => {
      const svgNS = 'http://www.w3.org/2000/svg';
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', pathD);
      const totalLength = path.getTotalLength();
      if (!Number.isFinite(totalLength) || totalLength <= 0) return [];

      const points: Array<{ x: number; y: number }> = [];
      for (let index = 0; index <= samples; index += 1) {
        const point = path.getPointAtLength((totalLength * index) / samples);
        points.push({ x: point.x, y: point.y });
      }
      return points;
    };

    const drawLeafIcon = (centerX: number, centerY: number, size: number) => {
      const leafOutlinePath =
        'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z';
      const leafVeinPath = 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12';
      const iconViewBox = 24;
      const scale = size / iconViewBox;
      const originX = centerX - (iconViewBox * scale) / 2;
      const originY = centerY - (iconViewBox * scale) / 2;
      const toDocPoint = (point: { x: number; y: number }) => ({
        x: originX + point.x * scale,
        y: originY + point.y * scale,
      });
      const outlinePoints = sampleSvgPath(leafOutlinePath, 52).map(toDocPoint);
      const veinPoints = sampleSvgPath(leafVeinPath, 28).map(toDocPoint);

      doc.setDrawColor(22, 163, 74);
      doc.setLineCap('round');
      doc.setLineJoin('round');
      doc.setLineWidth(Math.max(1.1, size * 0.1));
      drawPolygon(outlinePoints, 'S');
      drawPolyline(veinPoints);
      doc.setLineCap('butt');
      doc.setLineJoin('miter');
      doc.setLineWidth(0.5);
    };

    const drawTriangleAlertIcon = (centerX: number, centerY: number, size: number, color: RGB = [249, 115, 22]) => {
      const iconViewBox = 24;
      const scale = size / iconViewBox;
      const originX = centerX - (iconViewBox * scale) / 2;
      const originY = centerY - (iconViewBox * scale) / 2;
      const toDocPoint = (point: { x: number; y: number }) => ({
        x: originX + point.x * scale,
        y: originY + point.y * scale,
      });

      const trianglePath = 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3';
      const exclamationPath = 'M12 9v4';
      const trianglePoints = sampleSvgPath(trianglePath, 46).map(toDocPoint);
      const exclamationPoints = sampleSvgPath(exclamationPath, 12).map(toDocPoint);

      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineCap('round');
      doc.setLineJoin('round');
      doc.setLineWidth(Math.max(0.95, size * 0.09));
      drawPolygon(trianglePoints, 'S');
      drawPolyline(exclamationPoints);
      doc.circle(originX + 12 * scale, originY + 17 * scale, Math.max(0.45, size * 0.05), 'S');
      doc.setLineCap('butt');
      doc.setLineJoin('miter');
      doc.setLineWidth(0.5);
    };

    const drawLightbulbIcon = (centerX: number, centerY: number, size: number, color: RGB = [245, 158, 11]) => {
      const iconViewBox = 24;
      const scale = size / iconViewBox;
      const originX = centerX - (iconViewBox * scale) / 2;
      const originY = centerY - (iconViewBox * scale) / 2;
      const toDocPoint = (point: { x: number; y: number }) => ({
        x: originX + point.x * scale,
        y: originY + point.y * scale,
      });

      const bulbOutlinePath =
        'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5';
      const baseTopPath = 'M9 18h6';
      const baseBottomPath = 'M10 22h4';

      const outlinePoints = sampleSvgPath(bulbOutlinePath, 28).map(toDocPoint);
      const baseTopPoints = sampleSvgPath(baseTopPath, 8).map(toDocPoint);
      const baseBottomPoints = sampleSvgPath(baseBottomPath, 8).map(toDocPoint);

      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineCap('round');
      doc.setLineJoin('round');
      doc.setLineWidth(Math.max(0.95, size * 0.09));
      drawPolyline(outlinePoints);
      drawPolyline(baseTopPoints);
      drawPolyline(baseBottomPoints);
      doc.setLineCap('butt');
      doc.setLineJoin('miter');
      doc.setLineWidth(0.5);
    };

    const drawCheckCircleIcon = (centerX: number, centerY: number, size: number, color: RGB = [37, 99, 235]) => {
      const iconViewBox = 24;
      const scale = size / iconViewBox;
      const originX = centerX - (iconViewBox * scale) / 2;
      const originY = centerY - (iconViewBox * scale) / 2;
      const toDocPoint = (point: { x: number; y: number }) => ({
        x: originX + point.x * scale,
        y: originY + point.y * scale,
      });

      const checkPath = 'm9 12 2 2 4-4';
      const checkPoints = sampleSvgPath(checkPath, 12).map(toDocPoint);

      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineCap('round');
      doc.setLineJoin('round');
      doc.setLineWidth(Math.max(0.95, size * 0.09));
      doc.circle(centerX, centerY, (10 * scale), 'S');
      drawPolyline(checkPoints);
      doc.setLineCap('butt');
      doc.setLineJoin('miter');
      doc.setLineWidth(0.5);
    };

    const drawSmallSectionHeading = (
      label: string,
      color: RGB = [75, 85, 99],
      iconDrawer?: (centerX: number, centerY: number, size: number, color?: RGB) => void,
      iconColor?: RGB
    ) => {
      let textX = marginX;
      if (iconDrawer) {
        iconDrawer(marginX + 5, y - 2.6, 10, iconColor || color);
        textX = marginX + 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(label.toUpperCase(), textX, y);
      y += 12;
    };

    const intensityBadge = (intensity: 'low' | 'medium' | 'high') => {
      if (intensity === 'low') {
        return {
          label: 'Low Carbon',
          bg: [220, 252, 231] as RGB,
          text: [22, 101, 52] as RGB,
        };
      }
      if (intensity === 'high') {
        return {
          label: 'High Carbon',
          bg: [255, 237, 213] as RGB,
          text: [154, 52, 18] as RGB,
        };
      }
      return {
        label: 'Medium',
        bg: [254, 249, 195] as RGB,
        text: [133, 77, 14] as RGB,
      };
    };

    const drawRadarChart = (x: number, top: number, width: number, height: number) => {
      const centerX = x + width / 2;
      const centerY = top + height / 2;
      const radius = Math.min(width, height) * 0.34;
      const stageCount = stageScores.length;

      const pointFor = (stageIndex: number, valueOutOfFive: number) => {
        const angle = -Math.PI / 2 + (stageIndex * Math.PI * 2) / stageCount;
        const distance = radius * (valueOutOfFive / 5);
        return {
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          angle,
        };
      };

      doc.setLineWidth(0.5);
      doc.setDrawColor(229, 231, 235);
      for (let level = 1; level <= 5; level += 1) {
        const ring = stageScores.map((_, index) => pointFor(index, level));
        drawPolygon(ring, 'S');
      }

      stageScores.forEach((_, index) => {
        const end = pointFor(index, 5);
        doc.line(centerX, centerY, end.x, end.y);
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      for (let level = 1; level <= 5; level += 1) {
        const levelPoint = pointFor(0, level);
        doc.text(String(level), centerX + 4, levelPoint.y + 2);
      }

      const radarPoints = stageScores.map((stage, index) => pointFor(index, stage.score));
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(1.2);
      drawPolygon(radarPoints, 'S');
      doc.setLineWidth(0.5);

      doc.setFillColor(5, 150, 105);
      radarPoints.forEach((point) => {
        doc.circle(point.x, point.y, 1.8, 'F');
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(75, 85, 99);
      stageScores.forEach((stage, index) => {
        const labelPoint = pointFor(index, 6.15);
        const cosVal = Math.cos(labelPoint.angle);
        const align: 'left' | 'center' | 'right' =
          cosVal > 0.35 ? 'left' : cosVal < -0.35 ? 'right' : 'center';
        const topOffset = index === 0 ? -5 : 0;
        stage.chartLabel.forEach((line, lineIndex) => {
          doc.text(line, labelPoint.x, labelPoint.y + topOffset + lineIndex * 7, { align });
        });
      });
    };

    const drawScoreRow = (x: number, rowY: number, label: string, score: number, color: RGB) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      doc.text(label, x, rowY);

      const barX = x + 88;
      const barW = 48;
      const barH = 4.5;
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(barX, rowY - 3.4, barW, barH, 2, 2, 'F');
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(barX, rowY - 3.4, Math.max(2, (score / 5) * barW), barH, 2, 2, 'F');

      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(score.toFixed(1), barX + barW + 6, rowY);
    };

     
    // Header row + summary text in one compact green box
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const summaryInlineWidth = contentW - 24;
    const summaryInlineText = (sustainabilityBriefing.summary || '')
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim(); 
    const summaryInlineLines = splitLines(summaryInlineText, summaryInlineWidth);
    const summaryInlineHeight = Math.max(36, summaryInlineLines.length * 9.5 + 8);
    const headerHeight = 30 + summaryInlineHeight + 10;
    ensureSpace(headerHeight + sectionGap);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(marginX, y, contentW, headerHeight, 8, 8, 'F');
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(marginX + contentW * 0.45, y, contentW * 0.55, headerHeight, 8, 8, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(marginX, y, contentW, headerHeight, 8, 8, 'S');
    drawLeafIcon(marginX + 18, y + 16.2, 10.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    doc.text('SUSTAINABILITY BRIEFING', marginX + 34, y + 19.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text(summaryInlineLines, marginX + 12, y + 38);
    y += headerHeight + sectionGap - 5;

    // Lifecycle section — measure first, then draw once at the correct height.
    const lifecycleGap = 12;
    const lifecycleColW = (contentW - lifecycleGap) / 2;
    const rightColX = marginX + lifecycleColW + lifecycleGap;
    const analysisX = rightColX + 12;

    // Pre-calculate analysis column height to determine card size.
    let measuredH = 16; // top padding
    measuredH += 12; // "MAJOR CONTRIBUTORS" heading
    measuredH += contributors.length * 13; // contributor rows
    if (topDrivers.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const driverLines = splitLines(`Driven by: ${topDrivers.join(', ')}`, lifecycleColW - 28);
      measuredH += driverLines.length * 8 + 14;
    } else {
      measuredH += 8;
    }
    measuredH += 12; // "STRONGEST STAGES" heading
    measuredH += opportunities.length * 13; // opportunity rows
    measuredH += 8; // gap before insight box

    const insightText =
      (contributors[0] && contributors[0].score >= 3
        ? `The ${contributors[0].label.toLowerCase()} stage is the palette's largest carbon hotspot at ${contributors[0].score.toFixed(1)}/5. `
        : 'No single stage dominates — the palette has a balanced impact profile. ') +
      (opportunities[0] && opportunities[0].score <= 2
        ? `${opportunities[0].label} and ${String(opportunities[1]?.label || 'maintenance').toLowerCase()} stages perform well, reflecting good in-service material choices.`
        : 'Focus procurement on reducing embodied carbon through EPDs and recycled content specifications.');

    const insightBoxPadding = 10;
    const insightBoxWidth = lifecycleColW - insightBoxPadding * 2;
    const insightTextWidth = insightBoxWidth - 14;
    const insightFontSize = 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(insightFontSize);
    const insightLineHeight = insightFontSize + 1;
    const insightLines = splitLines(insightText, insightTextWidth);
    const insightHeight = Math.max(36, 12 + insightLines.length * insightLineHeight);

    const finalCardHeight = Math.max(188, measuredH + insightHeight + 10);

    ensureSpace(12 + finalCardHeight + sectionGap);
    drawSmallSectionHeading('Lifecycle Impact Profile');
    const lifecycleY = y;

    // Draw column backgrounds.
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(marginX, lifecycleY, lifecycleColW, finalCardHeight, 8, 8, 'FD');
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(rightColX, lifecycleY, lifecycleColW, finalCardHeight, 8, 8, 'FD');

    // Left column: radar chart.
    drawRadarChart(marginX + 12, lifecycleY + 16, lifecycleColW - 24, 140);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(
      'Lower scores = lower environmental impact (1 = minimal, 5 = significant)',
      marginX + lifecycleColW / 2,
      lifecycleY + finalCardHeight - 10,
      { align: 'center' }
    );

    // Right column: analysis.
    let analysisY = lifecycleY + 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(234, 88, 12);
    doc.text('MAJOR CONTRIBUTORS', analysisX, analysisY);
    analysisY += 12;

    contributors.forEach((stage) => {
      const scoreColor: RGB = stage.score >= 3 ? [249, 115, 22] : stage.score >= 2 ? [234, 179, 8] : [34, 197, 94];
      drawScoreRow(analysisX, analysisY, stage.label, stage.score, scoreColor);
      analysisY += 13;
    });

    if (topDrivers.length > 0) {
      const driverLines = splitLines(`Driven by: ${topDrivers.join(', ')}`, lifecycleColW - 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(driverLines, analysisX, analysisY);
      analysisY += driverLines.length * 8 + 14;
    } else {
      analysisY += 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 163, 74);
    doc.text('STRONGEST STAGES', analysisX, analysisY);
    analysisY += 12;

    opportunities.forEach((stage) => {
      drawScoreRow(analysisX, analysisY, stage.label, stage.score, [34, 197, 94]);
      analysisY += 13;
    });

    // Insight box — anchored within the right column.
    const insightY = analysisY + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(insightFontSize);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(rightColX + insightBoxPadding, insightY, insightBoxWidth, insightHeight, 4, 4, 'FD');
    doc.setTextColor(75, 85, 99);
    doc.text(insightLines, rightColX + insightBoxPadding + 7, insightY + 10);

    y = lifecycleY + finalCardHeight + sectionGap;

    // Hero + challenge columns
    const heroItems = sustainabilityBriefing.heroes || [];
    const challengeItems = sustainabilityBriefing.challenges || [];

    const materialGridGap = 10;
    const materialColW = (contentW - materialGridGap) / 2;

    const materialCardHeight = (bodyText: string) => {
      const lines = splitLines(bodyText, materialColW - 18);
      return Math.max(64, 38 + lines.length * 9);
    };

    const materialColumnHeight = (items: Array<{ body: string }>) => {
      if (items.length === 0) return 12;
      let height = 12;
      items.forEach((item, index) => {
        height += materialCardHeight(item.body);
        if (index < items.length - 1) height += 9;
      });
      return height;
    };

    const heroColumnData = heroItems.map((hero) => ({
      name: hero.name,
      intensity: hero.carbonIntensity,
      body: hero.strategicValue,
      label: 'Strategic Value',
    }));

    const challengeColumnData = challengeItems.map((challenge) => ({
      name: challenge.name,
      intensity: challenge.carbonIntensity,
      body: challenge.mitigationTip,
      label: 'Mitigation Tip',
    }));

    const heroColumnHeight = materialColumnHeight(heroColumnData);
    const challengeColumnHeight = materialColumnHeight(challengeColumnData);
    const materialSectionHeight = Math.max(heroColumnHeight, challengeColumnHeight);

    ensureSpace(materialSectionHeight + sectionGap);

    const drawMaterialColumn = (
      x: number,
      heading: string,
      headingColor: RGB,
      cardBg: RGB,
      cardBorder: RGB,
      labelColor: RGB,
      headingIcon?: (centerX: number, centerY: number, size: number, color?: RGB) => void,
      items: Array<{ name: string; intensity: 'low' | 'medium' | 'high'; body: string; label: string }>
    ) => {
      let localY = y;

      if (headingIcon) {
        headingIcon(x + 5, localY - 2.6, 10, headingColor);
      } else {
        doc.setFillColor(headingColor[0], headingColor[1], headingColor[2]);
        doc.circle(x + 4, localY - 2, 3, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.25);
      doc.setTextColor(75, 85, 99);
      doc.text(heading.toUpperCase(), x + 15, localY);
      localY += 12;

      items.forEach((item, index) => {
        const bodyLines = splitLines(item.body, materialColW - 18);
        const cardH = Math.max(64, 38 + bodyLines.length * 9);

        doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
        doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
        doc.roundedRect(x, localY, materialColW, cardH, 8, 8, 'FD');

        const badge = intensityBadge(item.intensity);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(17, 24, 39);
        const fittedName = fitSingleLine(item.name, materialColW - 112);
        doc.text(fittedName, x + 10, localY + 15);

        const badgeW = doc.getTextWidth(badge.label) + 10;
        const badgeX = x + materialColW - badgeW - 10;
        doc.setFillColor(badge.bg[0], badge.bg[1], badge.bg[2]);
        doc.roundedRect(badgeX, localY + 6, badgeW, 11, 5.5, 5.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(badge.text[0], badge.text[1], badge.text[2]);
        doc.text(badge.label, badgeX + 5, localY + 13.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.text(`${item.label}:`, x + 10, localY + 28);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        doc.text(bodyLines, x + 10, localY + 39);

        localY += cardH;
        if (index < items.length - 1) localY += 9;
      });

      return localY - y;
    };

    const heroUsed = drawMaterialColumn(
      marginX,
      'Hero Materials',
      [22, 163, 74],
      [240, 253, 244],
      [187, 247, 208],
      [21, 128, 61],
      drawLeafIcon,
      heroColumnData
    );

    const challengeUsed = drawMaterialColumn(
      marginX + materialColW + materialGridGap,
      'Challenge Materials',
      [249, 115, 22],
      [255, 247, 237],
      [254, 215, 170],
      [194, 65, 12],
      drawTriangleAlertIcon,
      challengeColumnData
    );

    y += Math.max(heroUsed, challengeUsed) + sectionGap;

    // Synergies
    const synergies = sustainabilityBriefing.synergies || [];
    if (synergies.length > 0) {
      ensureSpace(12 + 52 + sectionGap);
      drawSmallSectionHeading('Strategic Synergies', [75, 85, 99], drawLightbulbIcon, [245, 158, 11]);

      const synergyGap = 9;
      const synergyColW = (contentW - synergyGap) / 2;

      const synergyCardHeight = (explanation: string) => {
        const lines = splitLines(explanation, synergyColW - 18);
        return Math.max(58, 36 + lines.length * 9);
      };

      const drawSynergyCard = (x: number, top: number, synergy: { pair: [string, string]; explanation: string }) => {
        const mat1 = board.find((material) => material.id === synergy.pair[0]);
        const mat2 = board.find((material) => material.id === synergy.pair[1]);
        const pairLabel = `${mat1?.name || synergy.pair[0]} -> ${mat2?.name || synergy.pair[1]}`;
        const detailLines = splitLines(synergy.explanation, synergyColW - 18);
        const cardH = Math.max(58, 36 + detailLines.length * 9);

        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(x, top, synergyColW, cardH, 8, 8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(17, 24, 39);
        doc.text(fitSingleLine(pairLabel, synergyColW - 18), x + 10, top + 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        doc.text(detailLines, x + 10, top + 28);

        return cardH;
      };

      for (let index = 0; index < synergies.length; index += 2) {
        const left = synergies[index];
        const right = synergies[index + 1];
        const leftH = left ? synergyCardHeight(left.explanation) : 0;
        const rightH = right ? synergyCardHeight(right.explanation) : 0;
        const rowH = Math.max(52, leftH, rightH);

        ensureSpace(rowH + synergyGap);
        if (left) drawSynergyCard(marginX, y, left);
        if (right) drawSynergyCard(marginX + synergyColW + synergyGap, y, right);
        y += rowH + synergyGap;
      }

      y += sectionGap - synergyGap;
    }

    // Specifier checklist
    ensureSpace(12 + 88 + sectionGap);
    drawSmallSectionHeading('Specifier Checklist', [75, 85, 99], drawCheckCircleIcon, [37, 99, 235]);

    const checklistItems = (() => {
      const checklist: string[] = [];
      const materialTypes = new Set(board.map((material) => material.materialType).filter(Boolean));
      const categories = new Set(board.map((material) => material.category));

      if (materialTypes.has('metal') || board.some((material) => material.id.includes('steel'))) {
        checklist.push('Request EPD for recycled steel content (target: 85%+ recycled)');
      }
      if (materialTypes.has('timber') || board.some((material) => material.id.includes('timber') || material.id.includes('wood'))) {
        checklist.push('Confirm FSC or PEFC certification for all timber products');
      }
      if (materialTypes.has('concrete') || board.some((material) => material.id.includes('concrete'))) {
        checklist.push('Specify GGBS/PFA cement replacement (target: 50%+ replacement)');
      }
      if (materialTypes.has('glass') || categories.has('window')) {
        checklist.push('Verify glazing U-values meet or exceed building regs');
      }
      if (categories.has('insulation')) {
        checklist.push('Compare embodied carbon of insulation options (natural vs synthetic)');
      }
      checklist.push('Collect EPDs for all major material categories');
      checklist.push('Calculate transport distances for main structure materials');

      return checklist.slice(0, 5);
    })();

    const checklistItemHeight = (item: string) => {
      const lines = splitLines(item, contentW - 44);
      return Math.max(13, lines.length * 8 + 4);
    };

    const checklistTotalHeight = checklistItems.reduce((sum, item, index) => {
      const spacing = index < checklistItems.length - 1 ? 6 : 0;
      return sum + checklistItemHeight(item) + spacing;
    }, 0);

    const checklistBoxHeight = Math.max(82, 14 + checklistTotalHeight + 10);
    ensureSpace(checklistBoxHeight + sectionGap);

    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(marginX, y, contentW, checklistBoxHeight, 8, 8, 'FD');

    let checklistY = y + 18;
    checklistItems.forEach((item, index) => {
      const lines = splitLines(item, contentW - 44);
      const itemHeight = Math.max(13, lines.length * 8 + 4);

      doc.setDrawColor(96, 165, 250);
      doc.setLineWidth(1.4);
      doc.roundedRect(marginX + 12, checklistY - 7, 10, 10, 2, 2, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      doc.text(lines, marginX + 26, checklistY);

      checklistY += itemHeight;
      if (index < checklistItems.length - 1) checklistY += 6;
    });

    y += checklistBoxHeight + sectionGap;

    // Footer
    ensureSpace(34);
    doc.setDrawColor(229, 231, 235);
    doc.line(marginX, y, pageW - marginX, y);
    y += 12;

    const dateLabel = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated by MoodboardLab | ${dateLabel}`, pageW / 2, y, { align: 'center' });
    y += 10;

    const disclaimerLines = splitLines(
      'This briefing provides indicative guidance only. Verify all data with material-specific EPDs and certifications.',
      contentW - 44
    );
    doc.setFontSize(6.75);
    doc.setTextColor(156, 163, 175);
    doc.text(disclaimerLines, pageW / 2, y, { align: 'center' });

    return doc;
  };

  const handleDownloadBriefingPdf = () => {
    if (!sustainabilityBriefing || !briefingPayload) return;
    setExportingBriefingPdf(true);
    try {
      const doc = generateBriefingPdf();
      if (doc) doc.save('sustainability-briefing.pdf');
    } catch (err) {
      console.error('Could not create briefing PDF', err);
      setError('Could not create the briefing PDF download.');
    } finally {
      setExportingBriefingPdf(false);
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

      const list = board.length
        ? board
        : (materialKey || buildMaterialKey())
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

  const handleOpenImage = (url: string) => {
    if (!url) return;
    const opened = window.open(url, '_blank');
    if (!opened) setError('Unable to open image. Please allow pop-ups to save it.');
    else opened.focus?.();
  };

  const createImageBlobFromDataUrl = (dataUrl: string) => {
    const [meta, content] = dataUrl.split(',');
    if (!meta || !content) throw new Error('Invalid image data.');
    const mimeMatch = meta.match(/data:(.*);base64/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    const byteCharacters = atob(content);
    const byteArrays = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteArrays[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteArrays], { type: mimeType });
  };

  const handleSaveImage = (dataUrl: string, filename: string) => {
    if (!dataUrl) return;
    try {
      const blob = createImageBlobFromDataUrl(dataUrl);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      console.error('Save image failed, opening instead', err);
      handleOpenImage(dataUrl);
    }
  };

  const handleInstagramShare = async (url: string) => {
    if (!url) return;
    setDownloadingId('instagram');
    try {
      const blob = url.startsWith('data:')
        ? createImageBlobFromDataUrl(url)
        : await fetch(url).then(response => response.blob());
      const file = new File([blob], 'moodboard.png', { type: blob.type || 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: 'Moodboard',
          text: 'Created with Moodboard Lab'
        });
        return;
      }
      handleSaveImage(url, 'moodboard.png');
      const opened = window.open('https://www.instagram.com/', '_blank');
      if (!opened) {
        setError('Image downloaded. Open Instagram to upload your moodboard.');
      }
    } catch (err) {
      console.error('Instagram share failed', err);
      setError('Could not prepare the image for Instagram sharing.');
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
      setMaterialsAccordionOpen(false);
      return true;
    } catch (err) {
      console.error('[Sustainability Briefing] Generation failed:', err);
      return false;
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const runMoodboardFlow = async () => {
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return;
    }
    setIsCreatingMoodboard(true);
    setIsBuildingFullReport(false);
    setMaterialKey(buildMaterialKey());
    setSustainabilityInsights(null);
    setPaletteSummary(null);
    paletteSummaryRef.current = null;
    setReportProse(null);
    reportProseRef.current = null;
    setSummaryReviewed(false);
    setSustainabilityBriefing(null);
    setBriefingPayload(null);
    setStatus('all');
    setError(null);
    try {
      // Step 1: Generate moodboard image + sustainability briefing in parallel
      setFlowProgress({
        step: 1,
        total: MOODBOARD_FLOW_TOTAL_STEPS,
        label: 'Generating moodboard image + briefing',
        state: 'running'
      });

      const [renderOk] = await Promise.all([
        runGemini('render', { onRender: setMoodboardRenderUrl }),
        generateBriefing(),
      ]);

      if (!renderOk) {
        setFlowProgress({
          step: 1,
          total: MOODBOARD_FLOW_TOTAL_STEPS,
          label: 'Image generation failed',
          state: 'error'
        });
        return;
      }

      // Step 2: Build full sustainability report (per-material deep dive)
      setIsBuildingFullReport(true);
      setFlowProgress({
        step: 2,
        total: MOODBOARD_FLOW_TOTAL_STEPS,
        label: 'Building full sustainability report',
        state: 'running'
      });
      const reportOk = await runGemini('sustainability');
      if (!reportOk) {
        setFlowProgress({
          step: 2,
          total: MOODBOARD_FLOW_TOTAL_STEPS,
          label: 'Full report generation failed',
          state: 'error'
        });
        return;
      }

      // Step 3: Generate report prose for PDF
      setFlowProgress({
        step: 3,
        total: MOODBOARD_FLOW_TOTAL_STEPS,
        label: 'Writing report prose',
        state: 'running'
      });
      const proseOk = await runGemini('report-prose', { requestTimeoutMs: REPORT_PROSE_TIMEOUT_MS });
      if (!proseOk) {
        console.warn('Report prose generation skipped; using deterministic PDF copy.');
      }

      setFlowProgress({
        step: 3,
        total: MOODBOARD_FLOW_TOTAL_STEPS,
        label: 'Complete',
        state: 'complete'
      });
      setMaterialsAccordionOpen(false);
    } finally {
      setIsBuildingFullReport(false);
      setIsCreatingMoodboard(false);
      setStatus('idle');
    }
  };

  const handleMoodboardEdit = async () => {
    const trimmed = moodboardEditPrompt.trim();
    if (!moodboardRenderUrl) {
      setError('Generate a moodboard render first.');
      return;
    }
    if (!trimmed) {
      setError('Add text instructions to update the moodboard render.');
      return;
    }
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

  const addManualMaterial = () => {
    if (!manualLabel.trim()) return;
    const newMat: MaterialOption = {
      id: `custom-${Date.now()}`,
      name: manualLabel.trim(),
      tone: manualTone || '#e5e7eb',
      finish: manualLabel.trim(),
      description: manualLabel.trim(),
      keywords: ['custom'],
      category: manualCategory
    };
    handleAdd(newMat);
    setManualLabel('');
  };

  const handleMaterialDetectionUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File exceeds 5 MB limit.`);
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const resized = await downscaleImage(dataUrl);
      const uploadedImg: UploadedImage = {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        dataUrl: resized.dataUrl,
        mimeType: resized.mimeType,
        sizeBytes: resized.sizeBytes,
        originalSizeBytes: file.size,
        width: resized.width,
        height: resized.height
      };

      setDetectionImage(uploadedImg);
    } catch (err) {
      console.error('Could not process upload', err);
      setError(`Could not process "${file.name}".`);
    }
  };

  const startMaterialDetection = async () => {
    if (!detectionImage) return;
    await detectMaterialsFromImage(detectionImage);
  };

  const detectMaterialsFromImage = async (image: UploadedImage) => {
    setStatus('detecting');
    setError(null);

    const prompt = `Analyze this image and identify all architectural materials visible. For each material, provide:
1. name: The specific material name (e.g., "Oak Timber Flooring", "Polished Concrete")
2. finish: The finish or surface treatment, INCLUDING the color in the description (e.g., "Oiled oak planks in warm honey tone", "Polished concrete slab in light grey")
3. description: A detailed 1-2 sentence description of the material and its characteristics
4. tone: A hex color code representing the EXACT dominant color of the material as seen in the photo (e.g., "#d8b185" for natural oak, "#c5c0b5" for light grey concrete). CRITICAL: Analyze the actual color in the image carefully.
5. category: One of these categories: floor, structure, finish, wall-internal, external, ceiling, window, roof, paint-wall, paint-ceiling, plaster, microcement, timber-panel, tile, wallpaper, acoustic-panel, timber-slat, joinery, fixture, landscape, insulation, door, balustrade, external-ground
6. keywords: An array of 3-5 relevant keywords describing the material (e.g., ["timber", "flooring", "oak", "natural"])
7. carbonIntensity: Either "low", "medium", or "high" based on the material's embodied carbon (e.g., timber is "low", zinc cladding is "medium", concrete is "high")

Return ONLY a valid JSON object in this exact format:
{
  "materials": [
    {
      "name": "material name",
      "finish": "finish description with color mentioned",
      "description": "detailed description",
      "tone": "#hexcolor",
      "category": "category-name",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "carbonIntensity": "low"
    }
  ]
}

IMPORTANT:
- Analyze the ACTUAL colors in the image carefully and provide accurate hex codes
- Include color descriptions in the finish field (e.g., "White painted steel", "Charcoal powder-coated aluminum")
- Be specific and accurate. Only include materials you can clearly identify in the image.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.dataUrl.split(',')[1]
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40
      }
    };

    try {
      const data = await callGeminiText(payload);
      let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean up the response to extract JSON
      textResult = textResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const parsed = JSON.parse(textResult);
      const rawMaterials = Array.isArray(parsed?.materials) ? parsed.materials : [];

      if (rawMaterials.length > 0) {
        // Convert to full MaterialOption objects with all required fields
        const fullMaterials: MaterialOption[] = rawMaterials.map((mat: any) => {
          const category = mat.category as MaterialCategory;
          const treePaths = treePathFallbacks[category] || ['Custom>Brand / Supplier Material'];

          return {
            id: `detected-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: mat.name || 'Unknown Material',
            tone: mat.tone || '#e5e7eb',
            finish: mat.finish || '',
            description: mat.description || '',
            keywords: Array.isArray(mat.keywords) ? mat.keywords : ['detected', 'custom'],
            category: category,
            carbonIntensity: (mat.carbonIntensity === 'low' || mat.carbonIntensity === 'medium' || mat.carbonIntensity === 'high')
              ? mat.carbonIntensity
              : undefined,
            treePaths: treePaths
          };
        });

        setDetectedMaterials(fullMaterials);
        setShowDetectionModal(true);
        setAddedDetectedIds(new Set()); // Reset tracking when showing new materials
      } else {
        setError('No materials detected in the image. Please try another image.');
      }
    } catch (err) {
      console.error('Material detection error:', err);
      setError('Failed to analyze materials. Please try again.');
    } finally {
      setStatus('idle');
    }
  };

  const addSingleDetectedMaterial = (material: MaterialOption) => {
    if (addedDetectedIds.has(material.id)) {
      return; // Already added, don't add again
    }
    handleAdd(material);
    setAddedDetectedIds((prev) => new Set([...prev, material.id]));
  };

  const addDetectedMaterialsToBoard = (materials: MaterialOption[]) => {
    materials.forEach((mat) => {
      if (!addedDetectedIds.has(mat.id)) {
        handleAdd(mat);
        setAddedDetectedIds((prev) => new Set([...prev, mat.id]));
      }
    });
    setShowDetectionModal(false);
    setDetectedMaterials(null);
    setDetectionImage(null);
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
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return false;
    }
    setStatus(mode);
    if (!options?.retryAttempt) setError(null);

    // Group materials by category for better AI understanding
    const materialsByCategory: Record<string, MaterialOption[]> = {};
    board.forEach((item) => {
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
        console.log('[Aspect Ratio]', { source: 'moodboard generation', fixed: '1:1' });

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
        console.log('[Gemini prompt]', {
          mode,
          promptType: isEditingRender ? 'edit-render' : 'moodboard',
          prompt
        });
        const data = await callGeminiImage(payload);
        console.log('[Gemini response]', {
          mode: isEditingRender ? 'edit-render' : 'moodboard',
          data
        });
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
    console.log('[Gemini prompt]', { mode, promptType, prompt });
    if (mode === 'sustainability' || mode === 'summary' || mode === 'summary-review' || mode === 'report-prose') {
      console.log('[Gemini prompt text]', prompt);
    }

    try {
      const data = await callGeminiText(payload, { timeoutMs: options?.requestTimeoutMs });
      console.log('[Gemini response]', { mode, data });
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n');
      if (!text) throw new Error('Gemini did not return text.');
      if (mode === 'sustainability' || mode === 'summary' || mode === 'summary-review' || mode === 'report-prose') {
        console.log('[Gemini response text]', text);
      }
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
                const reason =
                  reasonByStage.get(computed.stage) ||
                  (rawHotspots[idx] && typeof rawHotspots[idx] === 'object' ? String(rawHotspots[idx].reason || '') : '') ||
                  fallbackLegacy ||
                  defaultHotspotReason(computed.stage, materialForConsequences?.name);
                return {
                  stage: computed.stage,
                  score: Number(computed.score) || 3,
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
          setReportProse(null);
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
          setReportProse(prose);
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
            setReportProse(recoveredProse);
            reportProseRef.current = recoveredProse;
            console.warn('Malformed report prose JSON; using recovered text fields.', parseError);
            return true;
          }

          setReportProse(null);
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

  const fullReportReady = hasTextContent();
  const summaryReportReady = Boolean(sustainabilityPreview);
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
              Review the materials you've already selected, then let AI assemble a material key plus UK-focused
              sustainability analysis.
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
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setMaterialsAccordionOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 border border-black px-3 py-1 uppercase font-mono text-[11px] tracking-widest hover:bg-gray-50 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Chosen Materials
                {materialsAccordionOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                )}
              </button>
              <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                {board.length} item{board.length === 1 ? '' : 's'} selected
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => onNavigate?.('materials')}
                  className="px-3 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
                >
                  Edit materials
                </button>
              </div>
            </div>

            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                maxHeight: materialsAccordionOpen ? '2000px' : '0px',
                opacity: materialsAccordionOpen ? 1 : 0,
              }}
            >
            {board.length === 0 ? (
              <div className="border border-dashed border-gray-300 bg-gray-50 p-6 text-center space-y-3">
                <p className="font-sans text-gray-700 text-sm">No materials have been added yet. Head to the Materials page to curate your selection before building the board.</p>
                <button
                  onClick={() => onNavigate?.('materials')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900"
                >
                  Go to Materials
                </button>
              </div>
            ) : (
              <div className="space-y-0 border border-gray-200">
                {board.map((item, idx) => {
                  const iconId = getMaterialIconId(item.id);
                  return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="border-b border-gray-200 last:border-b-0 bg-white hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Material swatch/image */}
                      <div className="w-20 h-20 flex-shrink-0 border border-gray-200 overflow-hidden bg-gray-50">
                        {item.customImage ? (
                          <img
                            src={item.customImage}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : item.colorOptions || item.supportsColor || item.finish.includes('(#') || item.finish.includes('—') ? (
                          // Show color swatch for materials with custom color variations
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: item.tone }}
                          />
                        ) : (
                          // Show material icon for standard materials
                          <>
                            <picture>
                              <source srcSet={`/icons/${iconId}.webp`} type="image/webp" />
                              <img
                                src={`/icons/${iconId}.png`}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // Fallback to color swatch if icon fails to load
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const fallback = target.parentElement?.parentElement?.querySelector('.fallback-swatch') as HTMLElement | null;
                                  if (fallback) {
                                    fallback.style.display = 'block';
                                  }
                                }}
                              />
                            </picture>
                            <div
                              className="w-full h-full fallback-swatch hidden"
                              style={{ backgroundColor: item.tone }}
                            />
                          </>
                        )}
                      </div>

                      {/* Material details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-display text-sm uppercase tracking-wide text-gray-900 mb-1">
                          {item.name}
                        </h4>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-1">
                          {item.finish}
                        </p>
                        {item.description && (
                          <p className="font-sans text-xs text-gray-500 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemove(idx)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            </div>

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

            {isBuildingFullReport && (moodboardRenderUrl || sustainabilityPreview) && (
              <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 mt-[2px]" />
                <span>
                  Moodboard preview is ready. Full sustainability report is still being generated.
                </span>
              </div>
            )}

            {sustainabilityPreview && (
              <div className="border border-gray-200 bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Sustainability Insights (Preview)
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    {isBuildingFullReport ? 'Full report generating…' : fullReportReady ? 'Report ready' : 'Preview only'}
                  </span>
                </div>
                <div className="p-4 space-y-6">
                  <div className="space-y-2">
                    <div className="font-display text-sm uppercase tracking-wide text-gray-900">
                      Sustainability snapshot
                    </div>
                    <p className="font-sans text-sm text-gray-700">
                      {sustainabilityPreview.snapshot.summarySentence}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                        Highest impact items (early-stage estimate)
                      </p>
                      <p className="font-sans text-sm text-gray-800">
                        {sustainabilityPreview.snapshot.highestImpact.length > 0
                          ? sustainabilityPreview.snapshot.highestImpact.join(' • ')
                          : 'No high-impact items flagged yet.'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                        Low-carbon systems
                      </p>
                      <p className="font-sans text-sm text-gray-800">
                        {sustainabilityPreview.snapshot.lowCarbonSystems.length > 0
                          ? sustainabilityPreview.snapshot.lowCarbonSystems.join(' • ')
                          : 'No low-carbon systems identified yet.'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                        Where to act first
                      </p>
                      {sustainabilityPreview.snapshot.actionPriorities.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {sustainabilityPreview.snapshot.actionPriorities.map((item) => (
                            <li key={item} className="font-sans text-sm text-gray-800">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-sans text-sm text-gray-800">
                          Prioritize refinements after reviewing the report.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200">
                    <button
                      onClick={() => setMaterialFlagsOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
                    >
                      <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                        Material highlights
                      </span>
                      <span className="font-mono text-xs text-gray-500">
                        {materialFlagsOpen ? '−' : '+'}
                      </span>
                    </button>
                    {materialFlagsOpen && (
                      <div className="p-4 bg-white border-t border-gray-200 space-y-4">
                        {sustainabilityPreview.highlights.length > 0 ? (
                          sustainabilityPreview.highlights.map((highlight) => (
                            <div
                              key={highlight.id}
                              className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0"
                            >
                              <div className="font-display text-sm uppercase tracking-wide text-gray-900">
                                {highlight.title}
                              </div>
                              <p className="mt-2 font-sans text-sm text-gray-700">
                                {highlight.line}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="font-sans text-sm text-gray-700">
                            {isBuildingFullReport
                              ? 'Detailed highlights will appear when the full report finishes.'
                              : 'Detailed highlights are not available yet.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border border-gray-200">
                    <button
                      onClick={() => setAssessmentOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
                    >
                      <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                        How this is assessed
                      </span>
                      <span className="font-mono text-xs text-gray-500">
                        {assessmentOpen ? '−' : '+'}
                      </span>
                    </button>
                    {assessmentOpen && (
                      <div className="p-4 bg-white border-t border-gray-200">
                        <ul className="list-disc list-inside space-y-1">
                          {ASSESSMENT_NOTES.map((note) => (
                            <li key={note} className="font-sans text-sm text-gray-700">
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                      What the full report includes
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {REPORT_PREVIEW_INCLUDES.map((item) => (
                        <li key={item} className="font-sans text-sm text-gray-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleDownloadSummaryReport}
                        disabled={!summaryReportReady || exportingSummaryReport}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                      >
                        {exportingSummaryReport ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Building summary...
                          </>
                        ) : (
                          'Download summary (1-page PDF)'
                        )}
                      </button>
                      <button
                        onClick={handleDownloadReport}
                        disabled={!fullReportReady || exportingReport}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                      >
                        {exportingReport ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Building report...
                          </>
                        ) : (
                          'Download full report (PDF)'
                        )}
                      </button>
                      <button
                        onClick={handleMobileSaveSummaryReport}
                        disabled={!summaryReportReady || exportingSummaryReport}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                      >
                        {exportingSummaryReport ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save summary (PDF)'
                        )}
                      </button>
                      <button
                        onClick={handleMobileSaveReport}
                        disabled={!fullReportReady || exportingReport}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                      >
                        {exportingReport ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save full report (PDF)'
                        )}
                      </button>
                    </div>
                    {!fullReportReady && (
                      <p className="font-sans text-sm text-gray-700">
                        {isBuildingFullReport
                          ? 'Full report download unlocks automatically when generation completes.'
                          : 'Run full sustainability analysis to unlock the full report download.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sustainability Briefing Section */}
            {(sustainabilityBriefing || isBriefingLoading) && (
              <div id="sustainability-report" className="sustainability-briefing border border-gray-200 bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-green-600" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-gray-700">
                      Sustainability Briefing
                    </span>
                  </div>
                  {sustainabilityBriefing && (
                    <button
                      onClick={handleDownloadBriefingPdf}
                      disabled={exportingBriefingPdf}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      {exportingBriefingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download PDF
                    </button>
                  )}
                </div>

                {isBriefingLoading && !sustainabilityBriefing ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                    <span className="ml-3 text-sm text-gray-600">Generating sustainability briefing...</span>
                  </div>
                ) : sustainabilityBriefing && briefingPayload ? (
                  <div className="p-6 space-y-8">
                    {/* Executive Summary */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5">
                      <h2 className="text-lg font-bold text-gray-900 mb-1">
                        Summary
                      </h2>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {sustainabilityBriefing.summary}
                      </p>
                    </div>

                    {/* Radar Chart + Explanation */}
                    <div>
                      <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3">
                        Lifecycle Impact Profile
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Chart */}
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart
                                data={[
                                  { stage: 'Raw Materials', score: briefingPayload.averageScores.raw, fullMark: 5 },
                                  { stage: 'Manufacturing', score: briefingPayload.averageScores.manufacturing, fullMark: 5 },
                                  { stage: 'Transport', score: briefingPayload.averageScores.transport, fullMark: 5 },
                                  { stage: 'Installation', score: briefingPayload.averageScores.installation, fullMark: 5 },
                                  { stage: 'In Use', score: briefingPayload.averageScores.inUse, fullMark: 5 },
                                  { stage: 'Maintenance', score: briefingPayload.averageScores.maintenance, fullMark: 5 },
                                  { stage: 'End of Life', score: briefingPayload.averageScores.endOfLife, fullMark: 5 },
                                ]}
                                cx="50%"
                                cy="50%"
                                outerRadius="70%"
                              >
                                <PolarGrid stroke="#e5e7eb" />
                                <PolarAngleAxis dataKey="stage" tick={{ fontSize: 10, fill: '#4b5563' }} />
                                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickCount={6} />
                                <Radar name="Impact" dataKey="score" stroke="#059669" fill="#10b981" fillOpacity={0.4} strokeWidth={2} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-[10px] text-gray-500 text-center mt-2">
                            Lower scores = lower environmental impact (1 = minimal, 5 = significant)
                          </p>
                        </div>

                        {/* Explanation */}
                        {(() => {
                          const stageLabels: Record<string, string> = {
                            raw: 'Raw Materials', manufacturing: 'Manufacturing', transport: 'Transport',
                            installation: 'Installation', inUse: 'In Use', maintenance: 'Maintenance', endOfLife: 'End of Life',
                          };
                          const scores = briefingPayload.averageScores;
                          type StageKey = 'raw' | 'manufacturing' | 'transport' | 'installation' | 'inUse' | 'maintenance' | 'endOfLife';
                          const stageKeys: StageKey[] = ['raw', 'manufacturing', 'transport', 'installation', 'inUse', 'maintenance', 'endOfLife'];
                          const sorted = stageKeys
                            .map((key) => ({ key, label: stageLabels[key] || key, score: scores[key] }))
                            .sort((a, b) => b.score - a.score);
                          const contributors = sorted.slice(0, 3);
                          const opportunities = [...sorted].sort((a, b) => a.score - b.score).slice(0, 3);

                          // Find which materials drive the top contributor stages
                          const topStage = contributors[0]?.key;
                          const topDrivers = topStage
                            ? briefingPayload.materials
                                .filter((m: { lifecycleScores: Record<string, number>; name: string }) => (m.lifecycleScores[topStage] ?? 0) >= 4)
                                .map((m: { name: string }) => m.name)
                                .slice(0, 3)
                            : [];

                          return (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col justify-between">
                              <div className="space-y-4">
                                {/* Top Contributors */}
                                <div>
                                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-orange-600 mb-2">
                                    Major Contributors
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {contributors.map(s => (
                                      <li key={s.key} className="flex items-center justify-between">
                                        <span className="text-xs text-gray-700">{s.label}</span>
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full"
                                              style={{
                                                width: `${(s.score / 5) * 100}%`,
                                                backgroundColor: s.score >= 3 ? '#f97316' : s.score >= 2 ? '#eab308' : '#22c55e',
                                              }}
                                            />
                                          </div>
                                          <span className="text-[10px] text-gray-500 w-6 text-right">{s.score.toFixed(1)}</span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                  {topDrivers.length > 0 && (
                                    <p className="text-[10px] text-gray-500 mt-1.5">
                                      Driven by: {topDrivers.join(', ')}
                                    </p>
                                  )}
                                </div>

                                {/* Opportunities */}
                                <div>
                                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-green-600 mb-2">
                                    Strongest Stages
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {opportunities.map(s => (
                                      <li key={s.key} className="flex items-center justify-between">
                                        <span className="text-xs text-gray-700">{s.label}</span>
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-green-500 rounded-full"
                                              style={{ width: `${(s.score / 5) * 100}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] text-gray-500 w-6 text-right">{s.score.toFixed(1)}</span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Insight */}
                                <div className="bg-white border border-gray-200 rounded p-2.5">
                                  <p className="text-[11px] text-gray-600 leading-relaxed">
                                    {contributors[0] && contributors[0].score >= 3
                                      ? `The ${String(contributors[0].label).toLowerCase()} stage is the palette's largest carbon hotspot at ${contributors[0].score.toFixed(1)}/5. `
                                      : `No single stage dominates — the palette has a balanced impact profile. `
                                    }
                                    {opportunities[0] && opportunities[0].score <= 2
                                      ? `${String(opportunities[0].label)} and ${String(opportunities[1]?.label || 'maintenance').toLowerCase()} stages perform well, reflecting good in-service material choices.`
                                      : `Focus procurement on reducing embodied carbon through EPDs and recycled content specifications.`
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Heroes and Challenges Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Heroes */}
                      <div>
                        <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                          <Leaf className="w-4 h-4 text-green-600" />
                          Hero Materials
                        </h3>
                        <div className="space-y-3">
                          {sustainabilityBriefing.heroes.map((hero, idx) => (
                            <div key={hero.id || idx} className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-medium text-sm text-gray-900">{hero.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  hero.carbonIntensity === 'low' ? 'bg-green-100 text-green-800' :
                                  hero.carbonIntensity === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {hero.carbonIntensity === 'low' ? 'Low Carbon' : hero.carbonIntensity === 'high' ? 'High Carbon' : 'Medium'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700">
                                <span className="font-medium text-green-700">Strategic Value:</span> {hero.strategicValue}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Challenges */}
                      <div>
                        <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          Challenge Materials
                        </h3>
                        <div className="space-y-3">
                          {sustainabilityBriefing.challenges.map((challenge, idx) => (
                            <div key={challenge.id || idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-medium text-sm text-gray-900">{challenge.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  challenge.carbonIntensity === 'low' ? 'bg-green-100 text-green-800' :
                                  challenge.carbonIntensity === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {challenge.carbonIntensity === 'low' ? 'Low Carbon' : challenge.carbonIntensity === 'high' ? 'High Carbon' : 'Medium'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700">
                                <span className="font-medium text-orange-700">Mitigation Tip:</span> {challenge.mitigationTip}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Strategic Synergies */}
                    {sustainabilityBriefing.synergies && sustainabilityBriefing.synergies.length > 0 && (
                      <div>
                        <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                          Strategic Synergies
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {sustainabilityBriefing.synergies.map((synergy, idx) => {
                            const mat1 = board.find(m => m.id === synergy.pair[0]);
                            const mat2 = board.find(m => m.id === synergy.pair[1]);
                            return (
                              <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-xs text-gray-900">{mat1?.name || synergy.pair[0]}</span>
                                  <ArrowRight className="w-3 h-3 text-amber-600" />
                                  <span className="font-medium text-xs text-gray-900">{mat2?.name || synergy.pair[1]}</span>
                                </div>
                                <p className="text-xs text-gray-700">{synergy.explanation}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Specifier Checklist */}
                    <div>
                      <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        Specifier Checklist
                      </h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <ul className="space-y-2">
                          {(() => {
                            const checklist: string[] = [];
                            const materialTypes = new Set(board.map(m => m.materialType).filter(Boolean));
                            const categories = new Set(board.map(m => m.category));

                            if (materialTypes.has('metal') || board.some(m => m.id.includes('steel'))) {
                              checklist.push('Request EPD for recycled steel content (target: 85%+ recycled)');
                            }
                            if (materialTypes.has('timber') || board.some(m => m.id.includes('timber') || m.id.includes('wood'))) {
                              checklist.push('Confirm FSC or PEFC certification for all timber products');
                            }
                            if (materialTypes.has('concrete') || board.some(m => m.id.includes('concrete'))) {
                              checklist.push('Specify GGBS/PFA cement replacement (target: 50%+ replacement)');
                            }
                            if (materialTypes.has('glass') || categories.has('window')) {
                              checklist.push('Verify glazing U-values meet or exceed building regs');
                            }
                            if (categories.has('insulation')) {
                              checklist.push('Compare embodied carbon of insulation options (natural vs synthetic)');
                            }
                            checklist.push('Collect EPDs for all major material categories');
                            checklist.push('Calculate transport distances for main structure materials');

                            return checklist.slice(0, 5).map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-4 h-4 rounded border-2 border-blue-400 bg-white mt-0.5" />
                                <span className="text-xs text-gray-700">{item}</span>
                              </li>
                            ));
                          })()}
                        </ul>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-4 text-center">
                      <p className="text-[10px] text-gray-500">
                        Generated by MoodboardLab | {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-1">
                        This briefing provides indicative guidance only. Verify all data with material-specific EPDs and certifications.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {moodboardRenderUrl && (
              <div className="space-y-4">
                <div className="border border-gray-200 p-4 bg-white space-y-3">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Moodboard Render
                  </div>
                  <div className="w-full border border-gray-200 bg-gray-50 relative flex items-center justify-center">
                    <img
                      src={moodboardRenderUrl}
                      alt="Moodboard"
                      className={`max-h-[80vh] max-w-full h-auto w-auto object-contain transition ${
                        isRenderInFlight ? 'opacity-40 grayscale' : ''
                      }`}
                    />
                    {isRenderInFlight && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60">
                        <Loader2 className="w-12 h-12 animate-spin text-gray-700" />
                        <span className="font-mono text-[11px] uppercase tracking-widest text-gray-700">
                          Updating moodboard…
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleDownloadBoard(moodboardRenderUrl, 'moodboard')}
                    disabled={downloadingId === 'moodboard'}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                  >
                    {downloadingId === 'moodboard' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <ImageDown className="w-4 h-4" />
                        Download
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleInstagramShare(moodboardRenderUrl)}
                    disabled={downloadingId === 'instagram'}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                  >
                    {downloadingId === 'instagram' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Instagram className="w-4 h-4" />
                        Share to Instagram
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onNavigate?.('apply')}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black"
                  >
                    <Wand2 className="w-4 h-4" />
                    Apply your materials
                  </button>
                  <button
                    onClick={handleMobileSaveSummaryReport}
                    disabled={!summaryReportReady || exportingSummaryReport}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                  >
                    Save summary (PDF)
                  </button>
                  <button
                    onClick={handleMobileSaveReport}
                    disabled={!fullReportReady || exportingReport}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                  >
                    Save full report (PDF)
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Instagram only allows direct posting from mobile. On desktop this will download the image so you can upload it in Instagram.
                </p>
                <div className="border border-gray-200 p-4 bg-white space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Edit moodboard render (multi-turn)
                  </div>
                  <p className="font-sans text-sm text-gray-700">
                    Provide new text instructions to adjust the latest moodboard image while keeping composition and materials consistent.
                  </p>
                  <textarea
                    value={moodboardEditPrompt}
                    onChange={(e) => setMoodboardEditPrompt(e.target.value)}
                    placeholder="E.g., warm up the lighting and add a softer vignette."
                    className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
                  />
                  <button
                    onClick={handleMoodboardEdit}
                    disabled={isCreatingMoodboard || status !== 'idle' || !moodboardRenderUrl}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                  >
                    {status === 'render' && isCreatingMoodboard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating render
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Apply text edit
                      </>
                    )} 
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

    </div>
  );
};

export default Moodboard;
