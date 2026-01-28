import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { AlertCircle, Loader2, Trash2, ImageDown, Wand2, Search, ShoppingCart } from 'lucide-react';
import { MATERIAL_PALETTE } from '../constants';
import { MATERIAL_LIFECYCLE_PROFILES, LifecycleStageKey } from '../lifecycleProfiles';
import { callGeminiImage, callGeminiText, saveGeneration } from '../api';
import { MaterialOption, MaterialCategory, UploadedImage } from '../types';
import { generateMaterialIcon } from '../utils/materialIconGenerator';
import LifecycleFingerprint from './LifecycleFingerprint';

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

type SustainabilityInsight = {
  id: string;
  title: string;
  headline: string;
  hotspots: string[];
  whyItLooksLikeThis: string;
  designLevers: string[];
  whatCouldChange: string[];
  ukChecks: string[];
};

interface MoodboardProps {
  onNavigate?: (page: string) => void;
  initialBoard?: BoardItem[];
  onBoardChange?: (items: BoardItem[]) => void;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';

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

/**
 * Calculate the closest matching aspect ratio from Gemini's supported list
 * Valid ratios: "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
 */
const calculateAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;

  const validRatios: { label: string; value: number }[] = [
    { label: '1:1', value: 1 },
    { label: '3:2', value: 3 / 2 },
    { label: '2:3', value: 2 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '4:5', value: 4 / 5 },
    { label: '5:4', value: 5 / 4 },
    { label: '9:16', value: 9 / 16 },
    { label: '16:9', value: 16 / 9 },
    { label: '21:9', value: 21 / 9 }
  ];

  // Find the closest matching ratio
  let closest = validRatios[0];
  let minDiff = Math.abs(ratio - closest.value);

  for (const validRatio of validRatios) {
    const diff = Math.abs(ratio - validRatio.value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validRatio;
    }
  }

  return closest.label;
};

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

const Moodboard: React.FC<MoodboardProps> = ({ onNavigate, initialBoard, onBoardChange }) => {
  const [board, setBoard] = useState<BoardItem[]>(initialBoard || []);
  const [sustainabilityInsights, setSustainabilityInsights] = useState<SustainabilityInsight[] | null>(null);
  const sustainabilityInsightsRef = useRef<SustainabilityInsight[] | null>(null);
  const [materialKey, setMaterialKey] = useState<string | null>(null);
  const [moodboardRenderUrl, setMoodboardRenderUrl] = useState<string | null>(null);
  const [appliedRenderUrl, setAppliedRenderUrl] = useState<string | null>(null);
  const [renderNote, setRenderNote] = useState('');
  const [moodboardEditPrompt, setMoodboardEditPrompt] = useState('');
  const [appliedEditPrompt, setAppliedEditPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [status, setStatus] = useState<'idle' | 'sustainability' | 'render' | 'all' | 'detecting'>('idle');
  const [exportingReport, setExportingReport] = useState(false);
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
      finishText = `${mat.finish}${finishVariant ? ` ${finishVariant}` : ''} (${customization.tone})`;
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
  const [applyAccordionOpen, setApplyAccordionOpen] = useState(true);
  const [sustainabilityAccordionOpen, setSustainabilityAccordionOpen] = useState(true);

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

  const persistGeneration = async (imageDataUri: string, prompt: string, useUploads: boolean) => {
    const trimmedNote = renderNote.trim();
    const includeSustainability = !useUploads;
    const metadata = {
      renderMode: useUploads ? 'apply-to-upload' : 'moodboard',
      materialKey: buildMaterialKey(),
      summary: summaryText,
      renderNote: trimmedNote || undefined,
      userNote: trimmedNote || undefined,
      generatedPrompt: prompt,
      ...(includeSustainability
        ? {
            sustainabilityInsights: sustainabilityInsightsRef.current || undefined
          }
        : {}),
      board,
      uploads: useUploads
        ? uploadedImages.map((img) => ({
            id: img.id,
            name: img.name,
            mimeType: img.mimeType,
            sizeBytes: img.sizeBytes,
            originalSizeBytes: img.originalSizeBytes,
            width: img.width,
            height: img.height,
            dataUrl: img.dataUrl
          }))
        : undefined
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

  const generateReportPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    let cursorY = margin;

    const ensureSpace = (needed = 0) => {
      if (cursorY + needed > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };

    const addHeading = (text: string, size = 16) => {
      ensureSpace(size * 1.6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.text(text, margin, cursorY);
      cursorY += size + 10;
    };

    const addParagraph = (text: string, size = 12, gap = 8) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      const maxWidth = pageWidth - margin * 2;
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line) => {
        ensureSpace(size * 1.2);
        doc.text(line, margin, cursorY);
        cursorY += size + 4;
      });
      cursorY += gap;
    };

    const renderLifecycleFingerprint = (materialId: string, materialName: string) => {
      const profile = MATERIAL_LIFECYCLE_PROFILES[materialId];
      if (!profile) return;

      const stageLabels = ['RAW', 'MFG', 'TRN', 'INS', 'USE', 'MNT', 'EOL'];
      const stageKeys: LifecycleStageKey[] = ['raw', 'manufacturing', 'transport', 'installation', 'inUse', 'maintenance', 'endOfLife'];

      ensureSpace(60);

      // Material name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(materialName, margin, cursorY);
      cursorY += 16;

      // Draw fingerprint
      const dotSize = 4;
      const dotGap = 2;
      const stageWidth = 50;
      const startX = margin;

      stageKeys.forEach((key, stageIndex) => {
        const stageData = profile[key];
        const xPos = startX + stageIndex * stageWidth;

        // Stage label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(stageLabels[stageIndex], xPos, cursorY);

        // Draw dots as small squares
        for (let i = 1; i <= 5; i++) {
          const dotX = xPos + (i - 1) * (dotSize + dotGap);
          const dotY = cursorY + 6 - dotSize / 2;
          const isFilled = i <= stageData.impact;

          if (isFilled) {
            if (stageData.confidence === 'low') {
              // Outline only
              doc.setDrawColor(100);
              doc.setFillColor(255, 255, 255);
              doc.setLineWidth(0.5);
              doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
            } else if (stageData.confidence === 'medium') {
              // Lighter fill
              doc.setFillColor(150, 150, 150);
              doc.rect(dotX, dotY, dotSize, dotSize, 'F');
            } else {
              // Solid
              doc.setFillColor(0, 0, 0);
              doc.rect(dotX, dotY, dotSize, dotSize, 'F');
            }
          } else {
            // Empty dot
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(255, 255, 255);
            doc.setLineWidth(0.5);
            doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
          }
        }

        // Confidence indicator
        if (stageData.confidence === 'low' || stageData.confidence === 'medium') {
          doc.setFontSize(7);
          doc.text('?', xPos + 5 * (dotSize + dotGap) + 2, cursorY + 8);
        }
      });

      cursorY += 20;
    };

    // Header - moved title down to avoid clash
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const brand = 'MOODBOARD-LAB.COM';
    doc.text(brand, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 20;

    doc.setFontSize(20);
    doc.text('Sustainability & Lifecycle Report', margin, cursorY);
    cursorY += 24;

    // Material Lifecycle Fingerprints
    if (board.length > 0) {
      addHeading('Material Lifecycle Fingerprints', 15);
      addParagraph('Impact scale: 1 = very low, 5 = very high. ? indicates lower confidence.', 9, 10);

      board.forEach((material) => {
        renderLifecycleFingerprint(material.id, material.name);
      });

      cursorY += 10;
    }

    // Sustainability Insights
    const insights = sustainabilityInsightsRef.current || [];
    if (insights.length) {
      addHeading('Sustainability Insights', 15);
      insights.forEach((insight) => {
        addHeading(insight.title, 13);

        if (insight.headline) {
          addParagraph(insight.headline, 12, 8);
        }

        if (insight.hotspots && insight.hotspots.length > 0) {
          addParagraph(`Hotspots: ${insight.hotspots.join(', ')}`, 11, 8);
        }

        if (insight.whyItLooksLikeThis) {
          addParagraph(insight.whyItLooksLikeThis, 12, 8);
        }

        if (insight.designLevers && insight.designLevers.length > 0) {
          addParagraph('Design Levers:', 11, 4);
          insight.designLevers.forEach(lever => {
            addParagraph(`• ${lever}`, 11, 2);
          });
          cursorY += 4;
        }

        if (insight.ukChecks && insight.ukChecks.length > 0) {
          addParagraph('UK Checks:', 11, 4);
          insight.ukChecks.forEach(check => {
            addParagraph(`• ${check}`, 11, 2);
          });
          cursorY += 4;
        }

        if (insight.whatCouldChange && insight.whatCouldChange.length > 0) {
          addParagraph('What Could Change:', 10, 4);
          insight.whatCouldChange.forEach(change => {
            addParagraph(`• ${change}`, 10, 2);
          });
          cursorY += 8;
        }
      });
    }

    // Footer with AI caveat
    ensureSpace(60);
    cursorY = pageHeight - margin - 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    const disclaimerText = 'Important: AI-generated content requires professional verification. All sustainability insights, lifecycle assessments, and recommendations should be validated by qualified professionals before use in design decisions or client communications.';
    const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - margin * 2);
    disclaimerLines.forEach((line: string) => {
      doc.text(line, margin, cursorY);
      cursorY += 11;
    });

    cursorY += 5;
    doc.setFont('helvetica', 'medium');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('Generated with Moodboard-Lab', margin, cursorY);

    return doc;
  };

  const handleDownloadReport = async () => {
    if (!hasTextContent()) {
      setError('Generate sustainability insights first.');
      return;
    }
    setExportingReport(true);
    try {
      const doc = generateReportPdf();
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
      const doc = generateReportPdf();
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
    setStatus('all');
    setError(null);
    try {
      await runGemini('sustainability');
      await runGemini('render', { useUploads: false, onRender: setMoodboardRenderUrl });
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

  const handleAppliedEdit = async () => {
    const trimmed = appliedEditPrompt.trim();
    if (!appliedRenderUrl) {
      setError('Render with an upload first.');
      return;
    }
    if (!trimmed) {
      setError('Add text instructions to update the applied render.');
      return;
    }
    await runGemini('render', {
      onRender: setAppliedRenderUrl,
      baseImageDataUrl: appliedRenderUrl,
      editPrompt: trimmed,
      useUploads: true
    });
  };

  const handleFileInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list: UploadedImage[] = [];
    let errorMessage: string | null = null;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_UPLOAD_BYTES) {
        errorMessage = `Upload "${file.name}" is over the 5 MB limit.`;
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const resized = await downscaleImage(dataUrl);
        list.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          dataUrl: resized.dataUrl,
          mimeType: resized.mimeType,
          sizeBytes: resized.sizeBytes,
          originalSizeBytes: file.size,
          width: resized.width,
          height: resized.height
        });
      } catch (err) {
        console.error('Could not process upload', err);
        errorMessage = `Could not process "${file.name}".`;
      }
    }
    if (errorMessage) setError(errorMessage);
    if (list.length) setUploadedImages(list.slice(-3)); // keep latest
  };

  const onDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileInput(e.dataTransfer.files);
  };
  const onFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) =>
    handleFileInput(e.target.files);

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
    mode: 'sustainability' | 'render',
    options?: {
      useUploads?: boolean;
      onRender?: (url: string) => void;
      retryAttempt?: number;
      editPrompt?: string;
      baseImageDataUrl?: string;
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

    const trimmedNote = renderNote.trim();
    const isEditingRender = mode === 'render' && options?.editPrompt && options?.baseImageDataUrl;
    const noTextRule =
      'CRITICAL REQUIREMENT - ABSOLUTELY NO TEXT WHATSOEVER in the image: no words, letters, numbers, labels, captions, logos, watermarks, signatures, stamps, or typographic marks of ANY kind. NO pseudo-text, NO scribbles, NO marks that resemble writing. This is a STRICT requirement that must be followed. The image must be completely free of all textual elements, letters, numbers, and symbols.';

    // Build sustainability prompt with lifecycle fingerprints
    const buildSustainabilityPrompt = () => {
      const materialsPayload = board.map(mat => {
        const profile = MATERIAL_LIFECYCLE_PROFILES[mat.id];
        return {
          id: mat.id,
          name: mat.name,
          category: mat.category,
          finish: mat.finish,
          description: mat.description,
          tone: mat.tone,
          lifecycleFingerprint: profile || null
        };
      });

      return `You are a UK architecture sustainability assistant for early-stage design (RIBA Stage 1–2).

Return ONLY valid JSON. No markdown. No prose outside JSON.

You are given selected materials. Each material includes a lifecycleFingerprint with impact (1–5) and confidence (high/medium/low) for stages:
raw, manufacturing, transport, installation, inUse, maintenance, endOfLife.

IMPORTANT RULES:
- Do NOT change or recalculate any fingerprint scores.
- Do NOT invent kgCO2e, EPD figures, or percentage splits.
- Your role is to interpret the fingerprint for designers and give practical actions.

Output schema:
{
  "items": [
    {
      "id": "string",
      "title": "string",
      "headline": "string (max 120 chars)",
      "hotspots": ["string", "string"],
      "whyItLooksLikeThis": "string (max 200 chars)",
      "designLevers": ["string", "string"],
      "whatCouldChange": ["string", "string"],
      "ukChecks": ["string", "string"]
    }
  ]
}

Guidance:
- Keep language concise and decision-useful.
- If confidence is medium/low for transport or endOfLife, explicitly mention uncertainty in whatCouldChange.
- Use UK-relevant checks only (e.g., FSC/PEFC, EPD to EN 15804, recycled content declarations, demountable fixings, take-back schemes).
- If lifecycleFingerprint is null, return headline "Fingerprint not available" and leave other fields minimal.

MATERIALS:
${JSON.stringify(materialsPayload, null, 2)}`;
    };

    const prompt =
      mode === 'sustainability'
        ? buildSustainabilityPrompt()
        : isEditingRender
        ? `You are in a multi-turn render conversation. Use the provided previous render as the base image and update it while preserving the composition, camera, and lighting. Keep material assignments consistent with the list below and do not remove existing context unless explicitly requested.\n\n${noTextRule}\n\nMaterials to respect:\n${summaryText}\n\nNew instruction:\n${options.editPrompt}${trimmedNote ? `\nAdditional render note: ${trimmedNote}` : ''}`
        : options?.useUploads
        ? `Transform the provided base image(s) into a PHOTOREALISTIC architectural render while applying the materials listed below. Materials are organized by their architectural category to help you understand where each should be applied. If the input is a line drawing, sketch, CAD export (SketchUp, Revit, AutoCAD), or diagram, you MUST convert it into a fully photorealistic visualization with realistic lighting, textures, depth, and atmosphere.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- OUTPUT MUST BE PHOTOREALISTIC: realistic lighting, shadows, reflections, material textures, and depth of field\n- APPLY MATERIALS ACCORDING TO THEIR CATEGORIES: floors to horizontal surfaces, walls to vertical surfaces, ceilings to overhead surfaces, external materials to facades, etc.\n- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to photorealistic render\n- If input is already photorealistic: enhance and apply materials while maintaining realism\n- Preserve the original composition, camera angle, proportions, and spatial relationships from the input\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n- Add realistic environmental lighting (natural daylight, ambient occlusion, soft shadows)\n- Include atmospheric effects: subtle depth haze, realistic sky, natural color grading\n- Materials must look tactile and realistic with proper surface properties (roughness, reflectivity, texture detail)\n- Maintain architectural accuracy while achieving photographic quality\n- White background not required; enhance or maintain contextual environment from base image\n${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`
        : `Create one clean, standalone moodboard image showcasing these materials together. Materials are organized by their architectural category. White background, balanced composition, soft lighting.\n\n${noTextRule}\n\nMaterials (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- Arrange materials logically based on their categories (floors, walls, ceilings, external elements, etc.)\n- Show materials at realistic scales and with appropriate textures\n- Include subtle context to demonstrate how materials work together in an architectural setting\n`;

    if (mode === 'render') {
      // Image render call
      try {
        // Determine aspect ratio based on context
        let aspectRatio = '1:1'; // Default for moodboard generation

        if (options?.useUploads && uploadedImages.length > 0) {
          // For "Apply your materials" - calculate aspect ratio from first uploaded image
          const firstImage = uploadedImages[0];
          if (firstImage.width && firstImage.height) {
            aspectRatio = calculateAspectRatio(firstImage.width, firstImage.height);
            console.log('[Aspect Ratio]', {
              source: 'uploaded image',
              dimensions: `${firstImage.width}x${firstImage.height}`,
              calculated: aspectRatio
            });
          }
        } else {
          // For moodboard generation or editing - always use 1:1
          console.log('[Aspect Ratio]', { source: 'moodboard generation', fixed: '1:1' });
        }

        const payload = {
          contents: [
            {
              parts: [
                { text: prompt },
                ...(isEditingRender && options?.baseImageDataUrl
                  ? [dataUrlToInlineData(options.baseImageDataUrl)]
                  : options?.useUploads
                  ? uploadedImages.map((img) => dataUrlToInlineData(img.dataUrl))
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
          promptType: isEditingRender ? 'edit-render' : options?.useUploads ? 'apply-to-base' : 'moodboard',
          prompt,
          uploadedImages: uploadedImages.length
        });
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
        void persistGeneration(newUrl, prompt, !!options?.useUploads);
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
    console.log('[Gemini prompt]', { mode, promptType: 'sustainability', prompt });

    try {
      const data = await callGeminiText(payload);
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
            const validated: SustainabilityInsight[] = items.map((item: any) => ({
              id: String(item.id || ''),
              title: String(item.title || ''),
              headline: String(item.headline || ''),
              hotspots: Array.isArray(item.hotspots) ? item.hotspots.map(String) : [],
              whyItLooksLikeThis: String(item.whyItLooksLikeThis || ''),
              designLevers: Array.isArray(item.designLevers) ? item.designLevers.map(String) : [],
              whatCouldChange: Array.isArray(item.whatCouldChange) ? item.whatCouldChange.map(String) : [],
              ukChecks: Array.isArray(item.ukChecks) ? item.ukChecks.map(String) : []
            }));
            setSustainabilityInsights(validated);
            sustainabilityInsightsRef.current = validated;
            if (retryAttempt) setError(null);
          } else {
            throw new Error('Invalid items array');
          }
        } catch (parseError) {
          setSustainabilityInsights(null);
          sustainabilityInsightsRef.current = null;
          const message = 'Gemini returned malformed sustainability JSON.';
          if (canRetry) {
            setError(`${message} Retrying once...`);
            await runGemini(mode, { ...options, retryAttempt: retryAttempt + 1 });
          } else {
            setError(`${message} Please try again.`);
          }
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the Gemini backend.');
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
                {board.map((item, idx) => (
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
                              <source srcSet={`/icons/${item.id}.webp`} type="image/webp" />
                              <img
                                src={`/icons/${item.id}.png`}
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
                ))}
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

            {sustainabilityInsights && sustainabilityInsights.length > 0 && (
              <div className="border border-gray-200">
                <button
                  onClick={() => setSustainabilityAccordionOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Sustainability Insights
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {sustainabilityAccordionOpen ? '−' : '+'}
                  </span>
                </button>
                {sustainabilityAccordionOpen && (
                  <div className="p-4 bg-white border-t border-gray-200 space-y-6">
                    {sustainabilityInsights.map((insight) => {
                      const material = board.find(m => m.id === insight.id);
                      return (
                        <div key={insight.id} className="space-y-3">
                          <div className="font-display text-sm font-semibold uppercase tracking-wide text-gray-900">
                            {insight.title}
                          </div>

                          {/* Lifecycle Fingerprint as hero */}
                          {material && (
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                                Design-stage lifecycle fingerprint (relative)
                              </p>
                              <LifecycleFingerprint material={material} />
                            </div>
                          )}

                          {/* Insights below fingerprint */}
                          <div className="space-y-3">
                            {insight.headline && (
                              <p className="font-sans text-sm font-medium text-gray-900">
                                {insight.headline}
                              </p>
                            )}

                            {insight.hotspots && insight.hotspots.length > 0 && (
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                                  Hotspots
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {insight.hotspots.map((hotspot, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans"
                                    >
                                      {hotspot}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {insight.whyItLooksLikeThis && (
                              <p className="font-sans text-sm text-gray-700 leading-relaxed">
                                {insight.whyItLooksLikeThis}
                              </p>
                            )}

                            {insight.designLevers && insight.designLevers.length > 0 && (
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                                  Design Levers
                                </p>
                                <ul className="list-disc list-inside space-y-1">
                                  {insight.designLevers.map((lever, idx) => (
                                    <li key={idx} className="font-sans text-sm text-gray-800">
                                      {lever}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {insight.ukChecks && insight.ukChecks.length > 0 && (
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                                  UK Checks
                                </p>
                                <ul className="list-disc list-inside space-y-1">
                                  {insight.ukChecks.map((check, idx) => (
                                    <li key={idx} className="font-sans text-sm text-gray-800">
                                      {check}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {insight.whatCouldChange && insight.whatCouldChange.length > 0 && (
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                                  What Could Change
                                </p>
                                <div className="space-y-1">
                                  {insight.whatCouldChange.map((change, idx) => (
                                    <p key={idx} className="font-sans text-xs text-gray-600">
                                      {change}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
                    'Download report (PDF)'
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

            {moodboardRenderUrl && (
              <div className="space-y-4">
                <div className="border border-gray-200 p-4 bg-white space-y-3">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Moodboard Render
                  </div>
                  <div className="w-full border border-gray-200 bg-gray-50 relative overflow-hidden">
                    <img
                      src={moodboardRenderUrl}
                      alt="Moodboard"
                      className={`w-full h-auto object-contain transition ${
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
                {materialKey && (
                  <div className="border border-gray-200 p-4 bg-white">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
                      Material Key
                    </div>
                    <p className="font-sans text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                      {materialKey}
                    </p>
                  </div>
                )}
              </div>
            )}
            {appliedRenderUrl && (
              <div className="space-y-4">
                <div className="border border-gray-200 p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                      Applied Render
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadBoard(appliedRenderUrl, 'applied')}
                        disabled={downloadingId === 'applied'}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                      >
                        {downloadingId === 'applied' ? (
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
                        onClick={handleMobileSaveReport}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden"
                      >
                        Save report (PDF)
                      </button>
                    </div>
                  </div>
                  <div className="w-full border border-gray-200 bg-gray-50">
                    <img src={appliedRenderUrl} alt="Applied render" className="w-full h-auto object-contain" />
                  </div>
                  <div className="space-y-2">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                      Edit applied render (multi-turn)
                    </div>
                    <p className="font-sans text-sm text-gray-700">
                      Send another instruction to refine this render without losing the palette application.
                    </p>
                    <textarea
                      value={appliedEditPrompt}
                      onChange={(e) => setAppliedEditPrompt(e.target.value)}
                      placeholder="E.g., increase contrast and add dusk lighting."
                      className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
                    />
                    <button
                      onClick={handleAppliedEdit}
                      disabled={status !== 'idle' || !appliedRenderUrl}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                    >
                      {status === 'render' ? (
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
              </div>
            )}

            {moodboardRenderUrl && (
              <div className="space-y-4">
                <button
                  onClick={() => setApplyAccordionOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 text-left"
                >
                  <span className="font-mono text-xs uppercase tracking-widest text-gray-600">
                    Apply Your Materials
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {applyAccordionOpen ? '−' : '+'}
                  </span>
                </button>
                {applyAccordionOpen && (
                  <div className="space-y-3 border-2 border-dashed border-gray-300 bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                        Upload Base Image (JPG/PNG)
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onFileInputChange}
                        className="text-sm font-sans file:mr-3 file:rounded-none file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:font-mono file:text-gray-700 file:hover:bg-gray-50"
                      />
                    </div>
                    <p className="font-sans text-sm text-gray-600">
                      Drag and drop an image to apply your own base on the next render.
                    </p>
                    <div className="space-y-2">
                      <label className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                        Custom render instructions (optional)
                      </label>
                      <textarea
                        value={renderNote}
                        onChange={(e) => setRenderNote(e.target.value)}
                        placeholder="E.g., set the building next to a river in a natural environment."
                        className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
                      />
                    </div>
                    {uploadedImages.length > 0 && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {uploadedImages.map((img) => (
                            <div key={img.id} className="border border-gray-200 bg-white p-2">
                              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                                <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mt-1 truncate">
                                {img.name}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() =>
                            runGemini('render', {
                              useUploads: true,
                              onRender: setAppliedRenderUrl
                            })
                          }
                          disabled={status !== 'idle' || !board.length}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                        >
                          {status === 'render' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Rendering with Upload
                            </>
                          ) : (
                            <>
                              <ImageDown className="w-4 h-4" />
                              Render with Upload
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Moodboard;
