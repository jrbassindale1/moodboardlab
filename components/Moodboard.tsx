import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { AlertCircle, Loader2, Trash2, ImageDown, Wand2, Search, ShoppingCart } from 'lucide-react';
import { MATERIAL_PALETTE } from '../constants';
import {
  MATERIAL_LIFECYCLE_PROFILES,
  LifecycleProfile,
  LifecycleStageKey,
} from '../lifecycleProfiles';
import { callGeminiImage, callGeminiText, saveGeneration } from '../api';
import { MaterialOption, MaterialCategory, UploadedImage } from '../types';
import { generateMaterialIcon, loadMaterialIcons } from '../utils/materialIconGenerator';

// Sustainability report utilities
import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  SystemLevelSummary,
  ClientSummary,
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
} from '../utils/pdfSections';

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

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';
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
  const [summaryReviewed, setSummaryReviewed] = useState(false);
  const [materialKey, setMaterialKey] = useState<string | null>(null);
  const [moodboardRenderUrlState, setMoodboardRenderUrlState] = useState<string | null>(
    moodboardRenderUrlProp ?? null
  );
  const [moodboardEditPrompt, setMoodboardEditPrompt] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'sustainability' | 'summary' | 'summary-review' | 'render' | 'all' | 'detecting'
  >('idle');
  const [exportingReport, setExportingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState<{ step: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [materialsAccordionOpen, setMaterialsAccordionOpen] = useState(true);
  const [steelColor, setSteelColor] = useState('#ffffff');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingMoodboard, setIsCreatingMoodboard] = useState(false);
  const [detectionImage, setDetectionImage] = useState<UploadedImage | null>(null);
  const [detectedMaterials, setDetectedMaterials] = useState<MaterialOption[] | null>(null);
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [addedDetectedIds, setAddedDetectedIds] = useState<Set<string>>(new Set());

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
    if (!sustainabilityInsights || sustainabilityInsights.length === 0) return null;

    const materialById = new Map<string, BoardItem>();
    board.forEach((material) => materialById.set(material.id, material));

    const insightById = new Map<string, SustainabilityInsight>();
    sustainabilityInsights.forEach((insight) => {
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

    const getRiskLine = (material: BoardItem | undefined, insight?: SustainabilityInsight) => {
      if (material && isWildflowerMeadow(material)) {
        return 'High upfront establishment impact if pre-grown systems are used.';
      }
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

  const generateReportPdf = async (
    onProgress?: (step: string, percent: number) => void
  ) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const ctx = createPDFContext(doc);
    const insights = sustainabilityInsightsRef.current || [];
    const metrics = new Map<string, MaterialMetrics>();
    board.forEach((material) => {
      const profile = MATERIAL_LIFECYCLE_PROFILES[material.id];
      if (profile) {
        const insight = insights.find((i) => i.id === material.id);
        const benefits = insight?.benefits || [];
        metrics.set(material.id, calculateMaterialMetrics(profile, benefits, material));
      }
    });

    // ========== PAGE 1: Specifier's Snapshot ==========
    onProgress?.('Building specifier snapshot...', 5);
    renderSpecifiersSnapshot(ctx, moodboardRenderUrl, board, metrics);

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
    renderStrategicOverview(ctx, clientSummary, board, metrics);

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
      renderComplianceReadinessSummary(ctx, insights, board);
    }

    // ========== PAGES 6+: Material Details (one material per page) ==========
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

      // Prefetch static icons for thumbnails (async)
      const materialIconUris = await prefetchMaterialIcons(board.map((m) => m.id));

      // Also check localStorage for AI-generated icons as fallback
      const storedIcons = loadMaterialIcons();

      // Render each material on its own page
      board.forEach((material) => {
        doc.addPage();
        ctx.cursorY = ctx.margin;

        // Page header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Material Detail', ctx.margin, ctx.cursorY);
        ctx.cursorY += 20;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text(
          'Impact scale: 1 (very low) to 5 (very high). "?" marks lower confidence.',
          ctx.margin,
          ctx.cursorY
        );
        doc.setTextColor(0);
        ctx.cursorY += 16;

        const insight = insights.find((i) => i.id === material.id);
        const metric = metrics.get(material.id);
        const profile = MATERIAL_LIFECYCLE_PROFILES[material.id] || null;

        // Get thumbnail - priority: custom image > static icon > stored icon
        let thumbnailDataUri: string | undefined;
        if (material.customImage) {
          thumbnailDataUri = material.customImage;
        } else if (materialIconUris.has(material.id)) {
          thumbnailDataUri = materialIconUris.get(material.id);
        } else {
          const icon = storedIcons.get(material.id);
          if (icon?.dataUri) {
            thumbnailDataUri = icon.dataUri;
          }
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

  const handleSaveImage = (dataUrl: string, filename: string) => {
    if (!dataUrl) return;
    try {
      const [meta, content] = dataUrl.split(',');
      if (!meta || !content) throw new Error('Invalid image data.');
      const mimeMatch = meta.match(/data:(.*);base64/);
      const mimeType = mimeMatch?.[1] || 'image/png';
      const byteCharacters = atob(content);
      const byteArrays = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteArrays[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArrays], { type: mimeType });
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

  const runMoodboardFlow = async () => {
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return;
    }
    setIsCreatingMoodboard(true);
    setMaterialKey(buildMaterialKey());
    setSustainabilityInsights(null);
    setPaletteSummary(null);
    paletteSummaryRef.current = null;
    setSummaryReviewed(false);
    setStatus('all');
    setError(null);
    try {
      await runGemini('sustainability');
      await runGemini('summary');
      await runGemini('summary-review', { summaryDraft: paletteSummaryRef.current || '' });
      await runGemini('render', { onRender: setMoodboardRenderUrl });
      setMaterialsAccordionOpen(false);
    } finally {
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
    mode: 'sustainability' | 'summary' | 'summary-review' | 'render',
    options?: {
      onRender?: (url: string) => void;
      retryAttempt?: number;
      editPrompt?: string;
      baseImageDataUrl?: string;
      summaryDraft?: string;
    }
  ) => {
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return;
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
      return `You are a UK architecture sustainability assistant writing a single-sentence dashboard summary for a concept-stage material palette. This copy is for the UI only (not the PDF report).

Return ONLY valid JSON. No markdown. No prose outside JSON.

Output schema:
{
  "summarySentence": "string (max 200 chars)"
}

Rules:
- Mention at least one material name from highestImpact or lowCarbonSystems if provided.
- Mention at least one lifecycle stage (raw, manufacturing, transport, installation, inUse, maintenance, endOfLife) using the driverStages list.
- Keep it neutral and early-stage; avoid compliance claims, rankings, percentages, or numbers.
- If highestImpact and lowCarbonSystems are empty, say the palette needs assessment.

CONTEXT:
${JSON.stringify(summaryContext, null, 2)}`;
    };

    const buildPaletteSummaryReviewPrompt = (summaryDraft: string) => {
      const summaryContext = buildPaletteSummaryContext();
      return `You are a QA reviewer checking a concept-stage sustainability summary against a provided context. Fix inaccuracies or contradictions.

Return ONLY valid JSON. No markdown. No prose outside JSON.

Output schema:
{
  "status": "ok|revise",
  "revisedSummary": "string (max 200 chars, empty if status=ok)",
  "issues": ["string"]
}

Rules:
- Only use material names listed in highestImpact or lowCarbonSystems.
- Summary must mention at least one lifecycle stage from driverStages.
- Do not introduce numbers, rankings, or compliance claims.
- If the draft is accurate, return status "ok" and empty revisedSummary.
- If not, return status "revise" with a corrected summary.

SUMMARY DRAFT:
${summaryDraft}

CONTEXT:
${JSON.stringify(summaryContext, null, 2)}`;
    };

    const prompt =
      mode === 'sustainability'
        ? buildSustainabilityPrompt()
        : mode === 'summary'
        ? buildPaletteSummaryPrompt()
        : mode === 'summary-review'
        ? buildPaletteSummaryReviewPrompt(options?.summaryDraft || paletteSummaryRef.current || '')
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reach the Gemini image backend.');
      } finally {
        setStatus('idle');
      }
      return;
    }

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.45
      }
    };
    const promptType =
      mode === 'summary'
        ? 'summary'
        : mode === 'summary-review'
        ? 'summary-review'
        : 'sustainability';
    console.log('[Gemini prompt]', { mode, promptType, prompt });
    if (mode === 'sustainability' || mode === 'summary' || mode === 'summary-review') {
      console.log('[Gemini prompt text]', prompt);
    }

    try {
      const data = await callGeminiText(payload);
      console.log('[Gemini response]', { mode, data });
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n');
      if (!text) throw new Error('Gemini did not return text.');
      if (mode === 'sustainability' || mode === 'summary' || mode === 'summary-review') {
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

              // Generate design consequences from hotspots and material type
              const design_risk = generateDesignRisk(hotspots, materialForConsequences);
              const design_response = generateDesignResponse(hotspots, materialForConsequences);

              return {
                id: String(item.id || ''),
                title: String(item.title || ''),
                headline: String(item.headline || ''),
                hotspots,
                whyItLooksLikeThis: String(item.whyItLooksLikeThis || ''),
                designLevers: Array.isArray(item.designLevers) ? item.designLevers.map(String) : [],
                whatCouldChange: Array.isArray(item.whatCouldChange) ? item.whatCouldChange.map(String) : [],
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
          const message = 'Gemini returned malformed sustainability JSON.';
          if (canRetry) {
            setError(`${message} Retrying once...`);
            await runGemini(mode, { ...options, retryAttempt: retryAttempt + 1 });
          } else {
            setError(`${message} Please try again.`);
          }
          return;
        }
      } else if (mode === 'summary') {
        try {
          const parsed = JSON.parse(cleaned);
          const summary = typeof parsed?.summarySentence === 'string' ? parsed.summarySentence.trim() : '';
          if (!summary) {
            throw new Error('Invalid summary sentence');
          }
          setPaletteSummary(summary);
          paletteSummaryRef.current = summary;
          if (retryAttempt) setError(null);
        } catch (parseError) {
          setPaletteSummary(null);
          paletteSummaryRef.current = null;
          const message = 'Gemini returned malformed summary JSON.';
          if (canRetry) {
            setError(`${message} Retrying once...`);
            await runGemini(mode, { ...options, retryAttempt: retryAttempt + 1 });
          } else {
            setError(`${message} Please try again.`);
          }
          return;
        }
      } else if (mode === 'summary-review') {
        try {
          const parsed = JSON.parse(cleaned);
          const status = parsed?.status;
          const revised = typeof parsed?.revisedSummary === 'string' ? parsed.revisedSummary.trim() : '';
          if (status === 'revise' && revised) {
            setPaletteSummary(revised);
            paletteSummaryRef.current = revised;
          }
          if (status === 'ok' || (status === 'revise' && revised)) {
            setSummaryReviewed(true);
          } else {
            throw new Error('Invalid summary review response');
          }
        } catch (parseError) {
          setSummaryReviewed(false);
          setError('Summary QA failed. Please try again.');
          console.warn('Gemini returned malformed summary review JSON.', parseError);
        }
      }
    } catch (err) {
      if (mode === 'summary-review') {
        setSummaryReviewed(false);
        setError('Summary QA failed. Please try again.');
        console.warn('Summary review failed', err);
      } else {
        setError(err instanceof Error ? err.message : 'Could not reach the Gemini backend.');
      }
    } finally {
      setStatus('idle');
    }
  };

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
              <div className="inline-flex items-center gap-2 border border-black px-3 py-1 uppercase font-mono text-[11px] tracking-widest">
                <ShoppingCart className="w-4 h-4" />
                Chosen Materials
              </div>
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

            {board.length > 0 && (
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
            )}
          </section>

            {error && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-[2px]" />
                <span>{error}</span>
              </div>
            )}

            {sustainabilityInsights && sustainabilityInsights.length > 0 && sustainabilityPreview && (
              <div className="border border-gray-200 bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Sustainability Insights (Preview)
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    Report ready
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
                        {sustainabilityPreview.highlights.map((highlight) => (
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
                        ))}
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
                    {hasTextContent() && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleDownloadReport}
                          disabled={exportingReport}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                        >
                          {exportingReport ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Building report…
                            </>
                          ) : (
                            'Download full report (PDF)'
                          )}
                        </button>
                        <button
                          onClick={handleMobileSaveReport}
                          disabled={exportingReport}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                        >
                          {exportingReport ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            'Save report (PDF)'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
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
                        isCreatingMoodboard ? 'opacity-40 grayscale' : ''
                      }`}
                    />
                    {isCreatingMoodboard && (
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
                    onClick={() => onNavigate?.('apply')}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black"
                  >
                    <Wand2 className="w-4 h-4" />
                    Apply your materials
                  </button>
                  <button
                    onClick={handleMobileSaveReport}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden"
                  >
                    Save report (PDF)
                  </button>
                </div>
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
                    disabled={status !== 'idle' || !moodboardRenderUrl}
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
