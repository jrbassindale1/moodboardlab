import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Trash2, ImageDown, Wand2, Search } from 'lucide-react';
import { MATERIAL_PALETTE } from '../constants';
import { callGeminiImage, callGeminiText, saveGeneration } from '../api';
import { MaterialOption, UploadedImage } from '../types';

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
      { id: 'envelope-substructure', label: 'Envelope Substructure', path: 'Structure>Envelope Substructure' }
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
      }
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
      { id: 'exposed-structure', label: 'Exposed Structure', path: 'Internal>Exposed Structure' },
      { id: 'joinery', label: 'Joinery & Furniture', path: 'Internal>Joinery & Furniture' },
      { id: 'fixtures', label: 'Fixtures & Fittings', path: 'Internal>Fixtures & Fittings' }
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

interface MoodboardProps {
  onNavigate?: (page: string) => void;
}

const Moodboard: React.FC<MoodboardProps> = ({ onNavigate }) => {
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisStructured, setAnalysisStructured] = useState<
    { title: string; explanation: string }[] | null
  >(null);
  const [lifecycleAnalysis, setLifecycleAnalysis] = useState<string | null>(null);
  const [lifecycleStructured, setLifecycleStructured] = useState<
    | {
        material: string;
        sourcing: string;
        fabrication: string;
        transport: string;
        inUse: string;
        maintenance: string;
        endOfLife: string;
        ukTip: string;
      }[]
    | null
  >(null);
  const [materialKey, setMaterialKey] = useState<string | null>(null);
  const [moodboardRenderUrl, setMoodboardRenderUrl] = useState<string | null>(null);
  const [appliedRenderUrl, setAppliedRenderUrl] = useState<string | null>(null);
  const [renderNote, setRenderNote] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [status, setStatus] = useState<'idle' | 'analysis' | 'render' | 'lifecycle' | 'all'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [materialsAccordionOpen, setMaterialsAccordionOpen] = useState(true);
  const [steelColor, setSteelColor] = useState('#ffffff');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingMoodboard, setIsCreatingMoodboard] = useState(false);

  const treePathFallbacks = useMemo(
    () => ({
      structure: ['Structure>Primary Structure', 'Internal>Exposed Structure'],
      floor: ['Internal>Floors', 'External>External Ground / Landscaping'],
      'wall-internal': ['Internal>Walls'],
      external: ['External>Façade'],
      ceiling: ['Internal>Ceilings'],
      soffit: ['Internal>Exposed Structure'],
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
      'exposed-structure': ['Internal>Exposed Structure'],
      joinery: ['Internal>Joinery & Furniture'],
      fixture: ['Internal>Fixtures & Fittings'],
      landscape: ['External>External Ground / Landscaping']
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
    setBoard((prev) => [...prev, next]);
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
      ([cat, items]) => `${cat}: ${items.map((i) => `${i.name} (${i.finish})`).join(', ')}`
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
      { id: 'exposed-structure', label: 'Exposed Structure' },
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
  const [analysisAccordionOpen, setAnalysisAccordionOpen] = useState(true);
  const [lifecycleAccordionOpen, setLifecycleAccordionOpen] = useState(true);

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
    const metadata = {
      renderMode: useUploads ? 'apply-to-upload' : 'moodboard',
      materialKey: buildMaterialKey(),
      summary: summaryText,
      renderNote: renderNote.trim() || undefined,
      board,
      uploads: useUploads
        ? uploadedImages.map((img) => ({
            id: img.id,
            name: img.name,
            mimeType: img.mimeType
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
    setAnalysis(null);
    setAnalysisStructured(null);
    setLifecycleAnalysis(null);
    setLifecycleStructured(null);
    setStatus('all');
    setError(null);
    try {
      await runGemini('analysis');
      await runGemini('lifecycle');
      await runGemini('render', { useUploads: false, onRender: setMoodboardRenderUrl });
      setMaterialsAccordionOpen(false);
    } finally {
      setIsCreatingMoodboard(false);
      setStatus('idle');
    }
  };

  const handleFileInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      list.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        dataUrl,
        mimeType: file.type
      });
    }
    setUploadedImages(list.slice(-3)); // keep latest
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

  const parseAnalysisJson = (cleaned: string) => {
    try {
      const parsed = JSON.parse(cleaned);
      const items = Array.isArray(parsed?.items) ? parsed.items : null;
      if (!items) return null;
      const normalized = items
        .map((entry: any) => ({
          title: String(entry.title || entry.material || '').trim(),
          explanation: String(entry.explanation || entry.analysis || entry.detail || '').trim()
        }))
        .filter((entry) => entry.title && entry.explanation);
      return normalized.length ? normalized : null;
    } catch {
      return null;
    }
  };

  const parseLifecycleJson = (cleaned: string) => {
    try {
      const parsed = JSON.parse(cleaned);
      const items = Array.isArray(parsed?.items) ? parsed.items : null;
      if (!items) return null;
      const normalized = items
        .map((entry: any) => ({
          material: String(entry.material || '').trim(),
          sourcing: String(entry.sourcing || '').trim(),
          fabrication: String(entry.fabrication || '').trim(),
          transport: String(entry.transport || '').trim(),
          inUse: String(entry.inUse || entry['in-use'] || '').trim(),
          maintenance: String(entry.maintenance || entry['maintenance/refurb'] || entry.refurb || '').trim(),
          endOfLife: String(entry.endOfLife || entry['end-of-life'] || '').trim(),
          ukTip: String(entry.ukTip || entry['uk tip'] || '').trim()
        }))
        .filter((e) => e.material);
      return normalized.length ? normalized : null;
    } catch {
      return null;
    }
  };

  const runGemini = async (
    mode: 'analysis' | 'render' | 'lifecycle',
    options?: { useUploads?: boolean; onRender?: (url: string) => void; retryAttempt?: number }
  ) => {
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return;
    }
    setStatus(mode);
    if (!options?.retryAttempt) setError(null);
    if (mode === 'analysis') setAnalysisStructured(null);

    const perMaterialLines = board
      .map(
        (item) =>
          `- ${item.name} (${item.finish}) | category: ${item.category} | description: ${item.description}`
      )
      .join('\n');

    const trimmedNote = renderNote.trim();
    const prompt =
      mode === 'analysis'
        ? `Return ONLY a JSON object with a single key "items" mapping to an array. Each array item must be an object with keys "title" and "explanation". Use the material name (and finish if useful) as the title. The explanation should be one concise UK-focused sustainability assessment covering embodied carbon, circularity/reuse potential, relevant UK certifications/standards (e.g., BREEAM credits, BES 6001, FSC/PEFC, UKCA/CE), and a specific improvement or lower-impact alternative. No introductions, no Markdown, no bullet points—JSON only.\nFormat example:\n{"items":[{"title":"Glulam Timber Structure","explanation":"Low embodied carbon, renewable resource; ensure FSC/PEFC certification, design for disassembly/reuse, and prioritise locally sourced timber to cut transport emissions."}]}\n\nMaterials:\n${perMaterialLines}`
        : mode === 'lifecycle'
        ? `For each material below, return ONLY a JSON object with a single key "items" mapping to an array of lifecycle entries. Each entry must be an object with keys: "material", "sourcing", "fabrication", "transport", "inUse", "maintenance", "endOfLife", "ukTip". Keep text concise (one short clause per key), UK practice oriented, and strictly lifecycle-focused.\nFormat example:\n{"items":[{"material":"Brick","sourcing":"...","fabrication":"...","transport":"...","inUse":"...","maintenance":"...","endOfLife":"...","ukTip":"..."}]}\nNo prose, no markdown, no bullet points—only JSON.\n\nMaterials:\n${perMaterialLines}`
        : options?.useUploads
        ? `Apply the following materials to the provided base image(s). Respect the existing composition and lighting. Do not invent new scenes.\n\nMaterials:\n${summaryText}\n\nInstructions:\n- Keep proportions, camera angle, and key features from the uploaded image(s).\n- Apply materials accurately; preserve scale cues like joints, brick coursing, and panel seams.\n- White background not required; keep base context.\n${trimmedNote ? `- Custom instructions: ${trimmedNote}\n` : ''}`
        : `Create one clean, standalone moodboard image showcasing these materials together. White background, balanced composition, soft lighting, no text or labels at all on the image.\n\nMaterials:\n${summaryText}\n`;

    if (mode === 'render') {
      // Image render call
      try {
        const payload = {
          contents: [
            {
              parts: [
                { text: prompt },
                ...(options?.useUploads
                  ? uploadedImages.map((img) => ({
                      inlineData: {
                        mimeType: img.mimeType,
                        data: img.dataUrl.split(',')[1]
                      }
                    }))
                  : [])
              ]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            candidateCount: 1
          }
        };
        console.log('[Gemini prompt]', {
          mode,
          promptType: options?.useUploads ? 'apply-to-base' : 'moodboard',
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
        temperature: mode === 'analysis' ? 0.5 : 0.45
      }
    };
    console.log('[Gemini prompt]', { mode, promptType: 'analysis', prompt, uploadedImages: uploadedImages.length });

    try {
      const data = await callGeminiText(payload);
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n');
      if (!text) throw new Error('Gemini did not return text.');
      const cleaned = text.replace(/```json|```/g, '').trim();
      const retryAttempt = options?.retryAttempt || 0;
      const canRetry = retryAttempt < 1;
      if (mode === 'analysis') {
        const parsed = parseAnalysisJson(cleaned);
        if (parsed) {
          setAnalysis(cleaned);
          setAnalysisStructured(parsed);
          if (retryAttempt) setError(null);
        } else {
          setAnalysis(null);
          setAnalysisStructured(null);
          const message = 'Gemini returned malformed analysis JSON.';
          if (canRetry) {
            setError(`${message} Retrying once...`);
            await runGemini(mode, { ...options, retryAttempt: retryAttempt + 1 });
          } else {
            setError(`${message} Please try again.`);
          }
          return;
        }
      }
      if (mode === 'lifecycle') {
        const parsed = parseLifecycleJson(cleaned);
        if (parsed) {
          setLifecycleAnalysis(cleaned);
          setLifecycleStructured(parsed);
          if (retryAttempt) setError(null);
        } else {
          setLifecycleAnalysis(null);
          setLifecycleStructured(null);
          const message = 'Gemini returned malformed lifecycle JSON.';
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
      <div className="max-w-screen-2xl mx-auto px-6 py-12 space-y-10">
        <div className="flex flex-col lg:flex-row gap-6 border-b border-gray-200 pb-6">
          <div>
            <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter">
              Moodboard Lab
            </h1>
            <p className="font-sans text-gray-600 max-w-2xl mt-3">
              Drag materials to the board and let AI assemble a material key plus UK-focused
              sustainability analysis.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
          <div className="lg:col-span-4 space-y-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-2">
            <div className="border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 border border-gray-300 bg-gray-50 px-3 py-2">
                <Search className="w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search materials by name, finish, or keyword"
                  className="flex-1 bg-transparent focus:outline-none font-sans text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="font-mono text-[11px] uppercase tracking-widest text-gray-600 hover:text-black"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="font-sans text-xs text-gray-600">
                Filter the material list instantly without scrolling through every category.
              </p>
              {hasSearch && (
                <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                  {totalSearchResults
                    ? `${totalSearchResults} match${totalSearchResults === 1 ? '' : 'es'} found`
                    : 'No materials match that search.'}
                </div>
              )}
            </div>
            {MATERIAL_TREE.map((section) => (
            <div key={section.id} className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 px-4">
                {section.label}
              </div>
              {section.groups.map((group) => {
                const items = filteredMaterialsByPath[group.path] || [];
                if (hasSearch && items.length === 0) return null;
                const primaryItems = items.filter((m) => m.carbonIntensity !== 'high');
                const carbonHeavy = items.filter((m) => m.carbonIntensity === 'high');
                const isCustom = section.id === 'custom';
                return (
                  <div key={group.id} className="border border-gray-200">
                    <button
                      onClick={() => setOpenSections((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                    >
                      <span className="font-mono text-xs uppercase tracking-widest text-gray-600">{group.label}</span>
                      <span className="font-mono text-xs text-gray-500">{openSections[group.id] ? '−' : '+'}</span>
                    </button>
                    {openSections[group.id] && (
                      <div className="space-y-4 p-4">
                        {primaryItems.length > 0 ? (
                          primaryItems.map((mat) => renderMaterialCard(mat))
                        ) : !isCustom ? (
                          <p className="font-sans text-sm text-gray-600">No materials in this group yet.</p>
                        ) : (
                          <div className="space-y-2 text-sm text-gray-700">
                            <p>Use uploads or the custom material form below to drop supplier products here.</p>
                            <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                              Upload reference images or add a URL in "Add Custom Material".
                            </p>
                          </div>
                        )}

                        {carbonHeavy.length > 0 && (
                          <div className="border border-amber-200 bg-amber-50 p-3">
                            <button
                              onClick={() =>
                                setCarbonSectionsOpen((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                              }
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="font-mono text-[11px] uppercase tracking-widest text-amber-900">
                                Carbon-intensive options (click to view)
                              </span>
                              <span className="font-mono text-xs text-amber-900">
                                {carbonSectionsOpen[group.id] ? '−' : '+'}
                              </span>
                            </button>
                            {carbonSectionsOpen[group.id] && (
                              <div className="space-y-3 mt-3">
                                {carbonHeavy.map((mat) => renderMaterialCard(mat))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

            <div className="border border-gray-200">
              <button
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, custom: !prev.custom }))
                }
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
              >
                <span className="font-mono text-xs uppercase tracking-widest text-gray-600">
                  Add Custom Material
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {openSections.custom ? '−' : '+'}
                </span>
              </button>
              {openSections.custom && (
                <div className="p-4 space-y-3 bg-white">
                  <input
                    type="text"
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    placeholder="One-sentence material description"
                    className="w-full border border-gray-300 px-3 py-2 font-sans text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <label className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                      Category
                    </label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value as any)}
                      className="border border-gray-300 px-2 py-2 font-sans text-sm"
                    >
                      {manualCategoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                      Colour
                    </label>
                    <input
                      type="color"
                      value={manualTone}
                      onChange={(e) => setManualTone(e.target.value)}
                      className="w-12 h-10 border border-gray-300"
                    />
                  </div>
                  <button
                    onClick={addManualMaterial}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900"
                  >
                    Add Custom
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:self-start lg:pl-2">
            <div className="space-y-4">
              <button
                onClick={() => setMaterialsAccordionOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 text-left"
              >
                <span className="font-mono text-xs uppercase tracking-widest text-gray-600">
                  Your Materials
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {materialsAccordionOpen ? '−' : '+'}
                </span>
              </button>
              {materialsAccordionOpen && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="min-h-[320px] border-2 border-dashed border-gray-300 bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                  >
                    {board.length === 0 && (
                      <div className="col-span-full text-center text-gray-500 font-mono text-xs uppercase tracking-widest">
                        Drag materials here
                      </div>
                    )}
                    {board.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="border border-gray-200 bg-white p-3 relative">
                        <div className="flex items-start gap-2">
                          <span
                            className="w-8 h-8 rounded-full border border-gray-200 shadow-inner"
                            style={{ backgroundColor: item.tone }}
                            aria-hidden
                          />
                          <div>
                            <div className="font-display uppercase text-sm">{item.name}</div>
                            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                              {item.finish}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(idx)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-black"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

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
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-[2px]" />
                <span>{error}</span>
              </div>
            )}

            {(analysisStructured || analysis) && (
              <div className="border border-gray-200">
                <button
                  onClick={() => setAnalysisAccordionOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Material Sustainability Analysis
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {analysisAccordionOpen ? '−' : '+'}
                  </span>
                </button>
                {analysisAccordionOpen && (
                  <div className="p-4 bg-white border-t border-gray-200">
                    {analysisStructured ? (
                      <div className="space-y-4">
                        {analysisStructured.map((item) => (
                          <div key={item.title} className="space-y-1">
                            <div className="font-display text-sm font-semibold uppercase tracking-wide text-gray-900">
                              {item.title}
                            </div>
                            <p className="font-sans text-sm text-gray-800 leading-relaxed">
                              {item.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-sans text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {analysis}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {(lifecycleStructured || lifecycleAnalysis) && (
              <div className="border border-gray-200">
                <button
                  onClick={() => setLifecycleAccordionOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Material Lifecycle Analysis
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {lifecycleAccordionOpen ? '−' : '+'}
                  </span>
                </button>
                {lifecycleAccordionOpen && (
                  <div className="p-4 bg-white border-t border-gray-200 space-y-3">
                    {lifecycleStructured ? (
                      <div className="space-y-4">
                        {lifecycleStructured.map((item) => (
                          <div key={item.material} className="space-y-2">
                            <div className="font-display text-sm font-semibold uppercase tracking-wide text-gray-900">
                              {item.material}
                            </div>
                            <div className="font-sans text-sm text-gray-800 space-y-1 leading-relaxed">
                              <div>
                                <span className="font-semibold">Sourcing:</span> {item.sourcing}
                              </div>
                              <div>
                                <span className="font-semibold">Fabrication:</span> {item.fabrication}
                              </div>
                              <div>
                                <span className="font-semibold">Transport:</span> {item.transport}
                              </div>
                              <div>
                                <span className="font-semibold">In-use:</span> {item.inUse}
                              </div>
                              <div>
                                <span className="font-semibold">Maintenance/Refurb:</span> {item.maintenance}
                              </div>
                              <div>
                                <span className="font-semibold">End-of-life:</span> {item.endOfLife}
                              </div>
                              <div>
                                <span className="font-semibold">UK tip:</span> {item.ukTip}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-sans text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {lifecycleAnalysis}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {moodboardRenderUrl && (
              <div className="space-y-4">
                <div className="border border-gray-200 p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                      Moodboard Render
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadBoard(moodboardRenderUrl, 'moodboard')}
                        disabled={downloadingId === 'moodboard'}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
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
                        onClick={() => handleSaveImage(moodboardRenderUrl, 'moodboard.png')}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black"
                      >
                        Save Image
                      </button>
                    </div>
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
                        onClick={() => handleSaveImage(appliedRenderUrl, 'applied-render.png')}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black"
                      >
                        Save Image
                      </button>
                    </div>
                  </div>
                  <div className="w-full border border-gray-200 bg-gray-50">
                    <img src={appliedRenderUrl} alt="Applied render" className="w-full h-auto object-contain" />
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
      </div>
  );
};

export default Moodboard;
