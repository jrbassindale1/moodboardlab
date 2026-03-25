import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search, ShoppingCart, X, Camera, Leaf } from 'lucide-react';
import { MATERIAL_PALETTE, RAL_COLOR_OPTIONS } from '../constants';
import { MaterialOption, UploadedImage } from '../types';
import { CATEGORIES } from '../data/categories';
import { migrateAllMaterials } from '../data/categoryMigration';
import { callGeminiText, checkQuota, consumeCredits, getMaterials } from '../api';
import { getMaterialIconUrls } from '../utils/materialIconUrls';
import { formatDescriptionForDisplay, formatFinishForDisplay } from '../utils/materialDisplay';
import { buildMaterialFact, type MaterialFact } from '../data/materialFacts';
import MaterialSustainabilityModal from './MaterialSustainabilityModal';
import { useAuth, useUsage } from '../auth';
import { trackEvent } from '../utils/analytics';
import { CARBON_IMPACT_CLASSES, CARBON_IMPACT_LABELS } from '../utils/materialCarbon';

interface MaterialSelectionProps {
  onNavigate: (page: string) => void;
  board: MaterialOption[];
  onBoardChange: (items: MaterialOption[]) => void;
  onStartNewProject?: () => void;
}

type CustomMaterialMode = 'upload' | 'describe' | 'analyse' | null;
type FlyToBoardAnimation = {
  key: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  tone: string;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';
const SMALL_SCREEN_QUERY = '(max-width: 639px)';

const CARBON_SORT_ORDER: Record<NonNullable<MaterialOption['carbonIntensity']>, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const DEFAULT_LOW_CARBON_PICK_COUNT = 16;

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

const MaterialSelection: React.FC<MaterialSelectionProps> = ({ onNavigate, board, onBoardChange, onStartNewProject }) => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const { remaining, refreshUsage, incrementLocalUsage, isAnonymous } = useUsage();
  const boardRef = useRef<MaterialOption[]>(board);
  const cartButtonRef = useRef<HTMLDivElement | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const hasScrolledToTop = useRef(false);
  const [isSmallScreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(SMALL_SCREEN_QUERY).matches;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [recentlyAdded, setRecentlyAdded] = useState<MaterialOption | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CATEGORIES.forEach((section) => {
      initial[section.id] = false;
    });
    return initial;
  });
  const [customMaterialMode, setCustomMaterialMode] = useState<CustomMaterialMode>(null);
  const [materialPalette, setMaterialPalette] = useState<MaterialOption[]>(MATERIAL_PALETTE);
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [customMaterialDescription, setCustomMaterialDescription] = useState('');
  const [isUsingFallbackPalette, setIsUsingFallbackPalette] = useState(false);
  const [detectionImage, setDetectionImage] = useState<UploadedImage | null>(null);
  const [detectedMaterials, setDetectedMaterials] = useState<MaterialOption[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [sustainabilityMaterial, setSustainabilityMaterial] = useState<{ material: MaterialOption; fact: MaterialFact } | null>(null);
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null);
  const [selectedFinishOption, setSelectedFinishOption] = useState<string | null>(null);
  const [selectedColorOption, setSelectedColorOption] = useState<{ label: string; tone: string } | null>(null);
  const [flyToBoardAnimation, setFlyToBoardAnimation] = useState<FlyToBoardAnimation | null>(null);
  const [isCartPulsing, setIsCartPulsing] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  const handleClearAllMaterials = () => {
    onBoardChange([]);
    setShowClearConfirmation(false);
    // Reset project so next moodboard starts a new project
    onStartNewProject?.();
  };

  const PAINTED_FINISH_RE = /(paint|powder|ral|pvdf|polyester)/i;
  const NATURAL_METAL_FINISH_RE = /(galvan|exposed|stainless|anodis|mill|natural metal|weathering|corten)/i;
  const getColorSelectionMode = (
    material?: MaterialOption | null,
    finishOption?: string | null
  ): 'none' | 'curated' | 'ral' => {
    if (!material) return 'none';
    const hasCuratedColors = Boolean(material.colorOptions?.length);
    const hasRalPalette = Boolean(material.supportsColor);

    if (!hasCuratedColors && !hasRalPalette) return 'none';
    if (!hasRalPalette) return 'curated';
    if (!hasCuratedColors) return 'ral';

    // Materials with both curated colors and RAL are finish-dependent.
    const finish = (finishOption || '').trim();
    if (!finish) return 'curated';
    if (PAINTED_FINISH_RE.test(finish)) return 'ral';
    if (NATURAL_METAL_FINISH_RE.test(finish)) return 'curated';
    return 'curated';
  };
  const supportsFreeColor = (material?: MaterialOption | null, finishOption?: string | null) =>
    getColorSelectionMode(material, finishOption) === 'ral';
  const hasSelectableOptions = (material?: MaterialOption | null) =>
    Boolean(
      material?.varietyOptions?.length ||
      material?.finishOptions?.length ||
      material?.colorOptions?.length ||
      supportsFreeColor(material, selectedFinishOption)
    );
  const triggerAddFeedback = (sourceElement?: HTMLElement | null, tone = '#4b5563') => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (animationTimeoutRef.current) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    setIsCartPulsing(false);
    window.requestAnimationFrame(() => setIsCartPulsing(true));

    if (!prefersReducedMotion && sourceElement && cartButtonRef.current) {
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = cartButtonRef.current.getBoundingClientRect();
      const startX = sourceRect.left + sourceRect.width / 2;
      const startY = sourceRect.top + sourceRect.height / 2;
      const endX = targetRect.left + targetRect.width / 2;
      const endY = targetRect.top + targetRect.height / 2;
      setFlyToBoardAnimation({
        key: Date.now(),
        startX,
        startY,
        deltaX: endX - startX,
        deltaY: endY - startY,
        tone,
      });
    } else {
      setFlyToBoardAnimation(null);
    }

    animationTimeoutRef.current = window.setTimeout(() => {
      setFlyToBoardAnimation(null);
      setIsCartPulsing(false);
      animationTimeoutRef.current = null;
    }, 620);
  };

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSmallScreen || hasScrolledToTop.current) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    hasScrolledToTop.current = true;
  }, [isSmallScreen]);

  useEffect(() => {
    if (!selectedCategory || !selectedCategory.startsWith('Custom>')) return;
    if (selectedCategory.endsWith('Analyse Photo')) {
      setCustomMaterialMode('analyse');
    } else {
      setCustomMaterialMode('describe');
    }
  }, [selectedCategory]);

  useEffect(() => {
    let mounted = true;
    const loadMaterials = async () => {
      try {
        const dbMaterials = await getMaterials();
        if (!mounted) return;
        if (Array.isArray(dbMaterials) && dbMaterials.length > 0) {
          // Merge API materials with the local fallback palette so curated local additions
          // (including sustainability fields) remain available even when the API list lags.
          const fallbackById = new Map(MATERIAL_PALETTE.map((mat) => [mat.id, mat] as const));
          const merged = dbMaterials.map((mat) => {
            const fallback = fallbackById.get(mat.id);
            fallbackById.delete(mat.id);
            return fallback ? { ...fallback, ...mat } : mat;
          });
          merged.push(...fallbackById.values());
          setMaterialPalette(merged);
          setIsUsingFallbackPalette(false);
          return;
        }
        setIsUsingFallbackPalette(true);
      } catch (error) {
        console.warn('Falling back to hardcoded material palette:', error);
        setIsUsingFallbackPalette(true);
      }
    };
    void loadMaterials();
    return () => {
      mounted = false;
    };
  }, []);

  // Helper to get user-friendly category display names
  const getCategoryDisplayName = (category: MaterialOption['category']): string => {
    const categoryMap: Record<MaterialOption['category'], string> = {
      'floor': 'Floors',
      'structure': 'Structure',
      'finish': 'Finishes',
      'wall-internal': 'Internal Walls',
      'external': 'External',
      'soffit': 'Soffits',
      'ceiling': 'Ceilings',
      'window': 'Windows',
      'roof': 'Roofing',
      'paint-wall': 'Paint - Walls',
      'paint-ceiling': 'Paint - Ceilings',
      'plaster': 'Plaster',
      'microcement': 'Microcement',
      'timber-panel': 'Timber Panels',
      'tile': 'Tiles',
      'wallpaper': 'Wallpaper',
      'acoustic-panel': 'Acoustic Panels',
      'timber-slat': 'Timber Slats',
      'exposed-structure': 'Exposed Structure',
      'joinery': 'Internal Walls',
      'fixture': 'Fixtures & Fittings',
      'landscape': 'Landscaping',
      'insulation': 'Insulation',
      'door': 'Doors',
      'balustrade': 'Balustrades & Railings',
      'external-ground': 'External Ground',
      'furniture': 'Fixtures & Fittings'
    };
    return categoryMap[category] || category;
  };

  // Drag and drop state for basket materials
  const [draggedMaterial, setDraggedMaterial] = useState<{ material: MaterialOption; boardIndex: number } | null>(null);

  const handleBasketDragStart = (e: React.DragEvent, material: MaterialOption, boardIndex: number) => {
    setDraggedMaterial({ material, boardIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleBasketDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleBasketDrop = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (!draggedMaterial) return;

    const { material, boardIndex } = draggedMaterial;

    // Find the category key from the display name
    const categoryKey = Object.entries({
      'floor': 'Floors',
      'structure': 'Structure',
      'finish': 'Finishes',
      'wall-internal': 'Internal Walls',
      'external': 'External',
      'soffit': 'Soffits',
      'ceiling': 'Ceilings',
      'window': 'Windows',
      'roof': 'Roofing',
      'paint-wall': 'Paint - Walls',
      'paint-ceiling': 'Paint - Ceilings',
      'plaster': 'Plaster',
      'microcement': 'Microcement',
      'timber-panel': 'Timber Panels',
      'tile': 'Tiles',
      'wallpaper': 'Wallpaper',
      'acoustic-panel': 'Acoustic Panels',
      'timber-slat': 'Timber Slats',
      'exposed-structure': 'Exposed Structure',
      'joinery': 'Internal Walls',
      'fixture': 'Fixtures & Fittings',
      'landscape': 'Landscaping',
      'insulation': 'Insulation',
      'door': 'Doors',
      'balustrade': 'Balustrades & Railings',
      'external-ground': 'External Ground',
      'furniture': 'Fixtures & Fittings'
    } as const).find(([_, display]) => display === targetCategory)?.[0] as MaterialOption['category'];

    if (categoryKey && material.category !== categoryKey) {
      // Update the material's category
      const updatedBoard = [...board];
      updatedBoard[boardIndex] = { ...material, category: categoryKey };
      onBoardChange(updatedBoard);
    }

    setDraggedMaterial(null);
  };

  // Migrate materials to new category structure
  const migratedMaterials = useMemo(() => migrateAllMaterials(materialPalette), [materialPalette]);

  // Organize materials by category path
  const materialsByPath = useMemo(() => {
    const map: Record<string, MaterialOption[]> = {};
    migratedMaterials.forEach((mat) => {
      const paths = mat.treePaths || [];
      paths.forEach((path) => {
        if (!map[path]) {
          map[path] = [];
        }
        map[path].push(mat);
      });
    });
    return map;
  }, [migratedMaterials]);

  // Get all category children as flat list
  const allCategories = useMemo(
    () =>
      CATEGORIES.flatMap((parent) =>
        (parent.children || []).map((child) => ({
          id: child.id,
          label: child.label,
          path: `${parent.label}>${child.label}`,
          parentId: parent.id,
        }))
      ),
    []
  );

  // Filter materials by search
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const searchTokens = useMemo(() => normalizedSearch.split(/\s+/).filter(Boolean), [normalizedSearch]);
  const ralColorLabels = useMemo(() => RAL_COLOR_OPTIONS.map((color) => color.label), []);
  const materialMatchesSearch = useCallback((mat: MaterialOption) => {
    if (!searchTokens.length) return true;
    const hasRalChoices = Boolean(mat.supportsColor);
    const haystack = [
      mat.name,
      mat.finish,
      mat.description,
      mat.category,
      ...(mat.keywords || []),
      ...(mat.tags || []),
      ...(mat.colorOptions?.map((c) => c.label) || []),
      ...(hasRalChoices ? ralColorLabels : []),
    ]
      .join(' ')
      .toLowerCase();
    return searchTokens.every((token) => haystack.includes(token));
  }, [searchTokens, ralColorLabels]);

  const filteredMaterialsByPath: Record<string, MaterialOption[]> = useMemo(() => {
    if (!searchTokens.length) return materialsByPath;

    const next: Record<string, MaterialOption[]> = {};
    Object.entries(materialsByPath).forEach(([path, list]) => {
      const filtered = list.filter((item) => materialMatchesSearch(item));
      if (filtered.length > 0) {
        next[path] = filtered;
      }
    });
    return next;
  }, [searchTokens, materialsByPath, materialMatchesSearch]);

  const defaultLowCarbonPicks = useMemo(() => {
    const lowCarbonMaterials = migratedMaterials.filter((mat) => mat.carbonIntensity === 'low');
    const candidates = (lowCarbonMaterials.length > 0 ? lowCarbonMaterials : migratedMaterials)
      .slice()
      .sort((a, b) => {
        const categoryComparison = a.category.localeCompare(b.category);
        if (categoryComparison !== 0) {
          return categoryComparison;
        }
        return a.name.localeCompare(b.name);
      });

    const groupedByCategory = new Map<string, MaterialOption[]>();
    candidates.forEach((mat) => {
      const group = groupedByCategory.get(mat.category) || [];
      group.push(mat);
      groupedByCategory.set(mat.category, group);
    });

    const picks: MaterialOption[] = [];
    while (picks.length < DEFAULT_LOW_CARBON_PICK_COUNT) {
      let addedInPass = false;

      groupedByCategory.forEach((group) => {
        if (picks.length >= DEFAULT_LOW_CARBON_PICK_COUNT) return;
        const next = group.shift();
        if (!next) return;
        picks.push(next);
        addedInPass = true;
      });

      if (!addedInPass) {
        break;
      }
    }

    return picks;
  }, [migratedMaterials]);

  // Use category browsing when a category is selected, otherwise search the full library.
  const displayedMaterials = useMemo(() => {
    if (selectedCategory) {
      return filteredMaterialsByPath[selectedCategory] || [];
    }
    if (!searchTokens.length) {
      return defaultLowCarbonPicks;
    }
    return migratedMaterials.filter((mat) => materialMatchesSearch(mat));
  }, [selectedCategory, filteredMaterialsByPath, searchTokens, defaultLowCarbonPicks, migratedMaterials, materialMatchesSearch]);

  // Sort materials
  const sortedMaterials = useMemo(() => {
    const materials = [...displayedMaterials];
    return materials.sort((a, b) => {
      const aCarbon = a.carbonIntensity ? CARBON_SORT_ORDER[a.carbonIntensity] : Number.MAX_SAFE_INTEGER;
      const bCarbon = b.carbonIntensity ? CARBON_SORT_ORDER[b.carbonIntensity] : Number.MAX_SAFE_INTEGER;
      if (aCarbon !== bCarbon) {
        return aCarbon - bCarbon;
      }
      return a.name.localeCompare(b.name);
    });
  }, [displayedMaterials]);

  // Get category label
  const getCategoryLabel = () => {
    if (!selectedCategory) return 'All Materials';
    const category = allCategories.find((c) => c.path === selectedCategory);
    return category?.label || 'Materials';
  };

  const isDuplicateSelection = (candidate: MaterialOption, boardSnapshot = boardRef.current) =>
    boardSnapshot.some((item) => {
      if (item.id !== candidate.id) return false;
      const itemTone = item.tone?.toLowerCase().trim() || '';
      const candidateTone = candidate.tone?.toLowerCase().trim() || '';
      const itemFinish = item.finish?.trim() || '';
      const candidateFinish = candidate.finish?.trim() || '';
      return itemTone === candidateTone && itemFinish === candidateFinish;
    });

  const trackAddToBoard = (material: MaterialOption, boardCount: number) => {
    const source = material.isCustom
      ? 'custom'
      : material.id.startsWith('detected-')
        ? 'photo_detection'
        : 'catalog';
    trackEvent('add_to_board', {
      material_id: material.id,
      material_category: material.category,
      board_count: boardCount,
      is_first_material: boardCount === 1,
      source,
    });
  };

  const handleAdd = (
    material: MaterialOption,
    customization?: { tone?: string; colorLabel?: string; finishOption?: string; variety?: string },
    skipModal?: boolean,
    sourceElement?: HTMLElement | null
  ) => {
    // Only show the options modal when this material actually has selectable options.
    if (!customization && !skipModal && hasSelectableOptions(material)) {
      setRecentlyAdded(material);
      setSelectedVariety(null); // Reset variety when opening modal
      setSelectedFinishOption(null);
      setSelectedColorOption(null);
      return;
    }

    // Build the material to add
    let materialToAdd = material;

    // If customization is provided, create a new material with custom finish/tone
    const baseBoard = boardRef.current;

    // Get variety from customization or from selectedVariety state
    const varietyToUse = customization?.variety || selectedVariety;
    const finishOptionToUse = customization?.finishOption || selectedFinishOption;
    const colorLabelToUse = customization?.colorLabel || selectedColorOption?.label;
    const colorToneToUse = customization?.tone || selectedColorOption?.tone;

    if (customization || varietyToUse || finishOptionToUse || colorLabelToUse || colorToneToUse) {
      const finishParts = [material.finish];
      if (finishOptionToUse) finishParts.push(finishOptionToUse);
      if (colorLabelToUse) finishParts.push(colorLabelToUse);

      const finishBody = finishParts.filter(Boolean).join(' — ');
      const finishWithVariety = varietyToUse ? `${varietyToUse} — ${finishBody}` : finishBody;
      const finishText = finishWithVariety;

      // Create a colorVariantId for icon loading (e.g., 'steel-yellow')
      const colorVariantId = colorLabelToUse
        ? `${material.id}-${colorLabelToUse.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
        : undefined;

      materialToAdd = {
        ...material,
        tone: colorToneToUse || material.tone,
        finish: finishText,
        colorVariantId,
        colorLabel: colorLabelToUse,
        selectedVariety: varietyToUse || undefined,
      };
    }

    if (isDuplicateSelection(materialToAdd, baseBoard)) {
      return;
    }

    // Add to board
    const nextBoard = [...baseBoard, materialToAdd];
    onBoardChange(nextBoard);
    boardRef.current = nextBoard;
    triggerAddFeedback(sourceElement, materialToAdd.tone || '#4b5563');
    trackAddToBoard(materialToAdd, nextBoard.length);

    // Close the modal and reset variety
    setRecentlyAdded(null);
    setSelectedVariety(null);
    setSelectedFinishOption(null);
    setSelectedColorOption(null);
  };

  const maybeAutoAddFromModal = (overrides?: {
    variety?: string | null;
    finishOption?: string | null;
    colorOption?: { label: string; tone: string } | null;
  }) => {
    if (!recentlyAdded) return;

    const varietyToUse = overrides?.variety ?? selectedVariety;
    const finishOptionToUse = overrides?.finishOption ?? selectedFinishOption;
    const colorOptionToUse = overrides?.colorOption ?? selectedColorOption;

    const requiresVariety = Boolean(recentlyAdded.varietyOptions?.length);
    const requiresFinish = Boolean(recentlyAdded.finishOptions?.length);
    const requiresColor = getColorSelectionMode(recentlyAdded, finishOptionToUse) !== 'none';

    const isReady =
      (!requiresVariety || Boolean(varietyToUse)) &&
      (!requiresFinish || Boolean(finishOptionToUse)) &&
      (!requiresColor || Boolean(colorOptionToUse));

    if (!isReady) return;

    handleAdd(
      recentlyAdded,
      {
        variety: varietyToUse || undefined,
        finishOption: finishOptionToUse || undefined,
        colorLabel: colorOptionToUse?.label,
        tone: colorOptionToUse?.tone,
      },
      true
    );
  };


  const handleCreateCustomMaterial = () => {
    if (!customMaterialName.trim()) {
      alert('Please enter a material name');
      return;
    }

    const customMaterial: MaterialOption = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: customMaterialName,
      tone: '#e5e7eb',
      finish: 'Custom Material',
      description: customMaterialDescription || 'Custom user-created material',
      keywords: ['custom'],
      category: 'finish',
      treePaths: ['Custom>Custom Material'],
      isCustom: true,
      customDescription: customMaterialDescription || undefined,
    };

    handleAdd(customMaterial, undefined, true);

    // Reset form
    setCustomMaterialMode(null);
    setCustomMaterialName('');
    setCustomMaterialDescription('');
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setDetectionError('File exceeds 5 MB limit.');
      return;
    }

    setDetectionError(null);

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
        height: resized.height,
      };

      setDetectionImage(uploadedImg);
    } catch (err) {
      console.error('Could not process upload', err);
      setDetectionError(`Could not process "${file.name}".`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    handlePhotoUpload(files);
  };

  const DETECTION_CREDIT_COST = 2;

  const startMaterialDetection = async () => {
    if (!detectionImage) return;
    setDetectionError(null);

    if (isAuthenticated) {
      try {
        const token = await getAccessToken();
        if (!token) {
          setDetectionError('Please sign in to continue.');
          return;
        }
        const quota = await checkQuota(token);
        if (quota.remaining < DETECTION_CREDIT_COST) {
          setDetectionError('Not enough credits. This action costs 2 credits.');
          return;
        }
      } catch (err) {
        console.error('Quota check failed:', err);
        setDetectionError('Could not verify your remaining credits. Please try again.');
        return;
      }
    } else if (remaining < DETECTION_CREDIT_COST) {
      setDetectionError('Not enough credits. This action costs 2 credits.');
      return;
    }

    setIsDetecting(true);

    const prompt = `Analyze this image and identify all architectural materials visible. For each material, provide:
1. name: The specific material name (e.g., "Oak Timber Flooring", "Polished Concrete")
2. finish: The finish or surface treatment, INCLUDING the color in the description (e.g., "Oiled oak planks in warm honey tone", "Polished concrete slab in light grey")
3. description: A detailed 1-2 sentence description of the material and its characteristics
4. tone: A hex color code representing the EXACT dominant color of the material as seen in the photo (e.g., "#d8b185" for natural oak, "#c5c0b5" for light grey concrete). CRITICAL: Analyze the actual color in the image carefully.
5. category: One of these categories: floor, structure, finish, wall-internal, external, ceiling, window, roof, paint-wall, paint-ceiling, plaster, microcement, timber-panel, tile, wallpaper, acoustic-panel, timber-slat, fixture, landscape, insulation, door, balustrade, external-ground
6. keywords: An array of 3-5 relevant keywords describing the material (e.g., ["timber", "flooring", "oak", "natural"])
7. carbonIntensity: Either "low", "medium", or "high" based on the material's embodied carbon (e.g., timber is "low", zinc cladding is "medium", concrete is "high")

Return ONLY a JSON array with this structure (no markdown, no explanation):
{
  "materials": [
    {
      "name": "material name",
      "finish": "finish description with color mentioned",
      "description": "detailed description",
      "tone": "#hexcolor",
      "category": "category-name",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "carbonIntensity": "low, medium, or high"
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
                mimeType: detectionImage.mimeType,
                data: detectionImage.dataUrl.split(',')[1],
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
      },
    };

    try {
      const data = await callGeminiText(payload);
      let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean up the response to extract JSON
      textResult = textResult.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(textResult);
      const materials = parsed.materials || [];

      if (isAuthenticated) {
        try {
          const token = await getAccessToken();
          if (token) {
            await consumeCredits(token, {
              generationType: 'materialDetection',
              credits: DETECTION_CREDIT_COST,
              reason: 'material-detection',
            });
            await refreshUsage();
          }
        } catch (err) {
          console.error('Failed to consume credits:', err);
        }
      } else if (isAnonymous) {
        incrementLocalUsage(DETECTION_CREDIT_COST, 'materialDetection');
      }

      if (materials.length === 0) {
        setDetectionError('No materials detected in the image. Try a different photo.');
        return;
      }

      // Convert to MaterialOption format
      const detectedMats: MaterialOption[] = materials.map((mat: any, idx: number) => ({
        id: `detected-${Date.now()}-${idx}`,
        name: mat.name || 'Unknown Material',
        tone: mat.tone || '#cccccc',
        finish: mat.finish || '',
        description: mat.description || '',
        keywords: mat.keywords || [],
        category: (mat.category || 'finish') as any,
        carbonIntensity: mat.carbonIntensity,
        treePaths: ['Custom>Analyse Photo'],
      }));

      setDetectedMaterials(detectedMats);
      // Select all materials by default
      setSelectedMaterialIds(new Set(detectedMats.map(mat => mat.id)));

      // Track material detection in Google Analytics
      trackEvent('generate_detection', {
        event_category: 'generation',
        event_label: 'materialIcon',
        value: detectedMats.length,
      });
    } catch (err) {
      console.error('Material detection error:', err);
      setDetectionError('Failed to analyse materials. Please try again.');
    } finally {
      setIsDetecting(false);
    }
  };

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterialIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMaterialIds.size === detectedMaterials.length) {
      setSelectedMaterialIds(new Set());
    } else {
      setSelectedMaterialIds(new Set(detectedMaterials.map(mat => mat.id)));
    }
  };

  const isCustomCategory = selectedCategory?.startsWith('Custom>');
  const isDefaultLibraryView = !selectedCategory && searchTokens.length === 0;
  const isLibrarySearchMode = !selectedCategory && searchTokens.length > 0;
  const showMaterialGrid = Boolean(selectedCategory || isLibrarySearchMode || isDefaultLibraryView);
  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const hasColorOptions = Boolean(recentlyAdded?.colorOptions?.length);
  const hasFinishOptions = Boolean(recentlyAdded?.finishOptions?.length);
  const hasVarietyOptions = Boolean(recentlyAdded?.varietyOptions?.length);
  const colorSelectionMode = getColorSelectionMode(recentlyAdded, selectedFinishOption);
  const hasFreeColor = colorSelectionMode === 'ral';
  const hasCuratedColourStep = colorSelectionMode === 'curated' && hasColorOptions;
  // If variety options exist but none selected, we need to pick variety first
  const needsVarietySelection = hasVarietyOptions && !selectedVariety;
  const needsFinishSelection = hasFinishOptions && !selectedFinishOption;
  const hasColourStep = hasCuratedColourStep || hasFreeColor;
  const canSelectFinish = !needsVarietySelection;
  const canSelectColour = !needsVarietySelection && (!hasFinishOptions || !needsFinishSelection);
  const needsColourSelection = hasColourStep && !selectedColorOption;

  return (
    <div className="min-h-screen bg-white">
      {/* Main content area with sidebar + grid */}
      <div className="max-w-screen-2xl mx-auto px-6 py-8 pt-24">
        <div className="flex flex-col gap-6 lg:gap-8 lg:flex-row">
          {/* Left Sidebar - Category filters */}
          <aside className="w-full space-y-4 lg:space-y-6 lg:w-64 lg:flex-shrink-0">
            {/* Categories */}
            <div className="space-y-1">
              <h3 className="font-display text-sm uppercase tracking-widest mb-3">Material Categories</h3>
              {isUsingFallbackPalette && (
                <p className="mb-3 border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-amber-800">
                  Live database unavailable. Showing fallback materials.
                </p>
              )}
              {CATEGORIES.map((section) => (
                <div key={section.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={Boolean(openSections[section.id])}
                    aria-controls={`category-section-${section.id}`}
                    className="w-full flex items-center justify-between gap-2 font-mono text-sm uppercase tracking-widest text-gray-700 mt-4 mb-2 hover:text-gray-800"
                  >
                    <span>{section.label}</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${openSections[section.id] ? 'rotate-90' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {openSections[section.id] && (
                    <div id={`category-section-${section.id}`} className="space-y-0.5">
                      {(section.children || []).map((child) => {
                        const path = `${section.label}>${child.label}`;
                        const count = (filteredMaterialsByPath[path] || []).length;
                        if (count === 0 && normalizedSearch) return null;

                        return (
                          <button
                            key={child.id}
                            onClick={() => {
                              if (!selectedCategory) {
                                // From empty state to category
                                setIsFadingOut(true);
                                setTimeout(() => {
                                  setSelectedCategory(path);
                                  setIsFadingOut(false);
                                }, 400);
                              } else if (selectedCategory !== path) {
                                // Switching between categories
                                setIsFadingOut(true);
                                setTimeout(() => {
                                  setSelectedCategory(path);
                                  setIsFadingOut(false);
                                }, 400);
                              }
                            }}
                            className={`block w-full text-left px-2 py-1.5 text-xs font-sans text-gray-500 hover:text-gray-700 hover:underline ${
                              selectedCategory === path ? 'font-medium text-gray-700' : ''
                            }`}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Board summary */}
            <div className="border-t border-gray-200 pt-6 lg:sticky lg:top-24 lg:z-20 lg:bg-white">
              <div
                ref={cartButtonRef}
                className={`mb-4 border border-gray-200 bg-white p-4 transition-transform ${isCartPulsing ? 'animate-cart-pulse' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">My board</p>
                    <p className="text-sm font-sans text-gray-900">
                      {board.length === 0
                        ? 'Add materials to start your moodboard'
                        : `${board.length} material${board.length === 1 ? '' : 's'} selected`}
                    </p>
                  </div>
                </div>

                {board.length > 0 && (
                  <div className="mt-3">
                    {showClearConfirmation ? (
                      <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-sm text-amber-800">Clear all {board.length} materials?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleClearAllMaterials}
                            className="rounded bg-red-600 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-red-700"
                          >
                            Yes, Clear All
                          </button>
                          <button
                            onClick={() => setShowClearConfirmation(false)}
                            className="rounded border border-gray-300 bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClearConfirmation(true)}
                        className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                      >
                        Clear all materials
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => onNavigate('moodboard')}
                  disabled={!board.length}
                  className="mt-4 inline-flex w-full items-center justify-between border border-black bg-black px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <span>Create moodboard</span>
                  <ChevronRight className="h-4 w-4" />
                </button>

                <p className="mt-2 text-xs font-sans text-gray-500">
                  {board.length === 0
                    ? 'Select at least one material to continue.'
                    : 'Continue to the next page to generate your moodboard and sustainability report.'}
                </p>
              </div>

              {/* Materials basket grouped by category */}
              {board.length > 0 && (
                <div className="space-y-4">
                  {(() => {
                    const grouped = board.reduce((acc, material, boardIndex) => {
                      const categoryLabel = getCategoryDisplayName(material.category);
                      if (!acc[categoryLabel]) {
                        acc[categoryLabel] = [];
                      }
                      acc[categoryLabel].push({ material, boardIndex });
                      return acc;
                    }, {} as Record<string, Array<{ material: MaterialOption; boardIndex: number }>>);

                    return Object.entries(grouped).map(([categoryName, items]) => (
                    <div key={categoryName} className="space-y-2">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-500 px-2">
                        {categoryName}
                      </h4>
                      <div
                        className="space-y-1"
                        onDragOver={(e) => handleBasketDragOver(e)}
                        onDrop={(e) => handleBasketDrop(e, categoryName)}
                      >
                        {items.map(({ material, boardIndex }) => (
                          <div
                            key={`${material.id}-${boardIndex}`}
                            draggable
                            onDragStart={(e) => handleBasketDragStart(e, material, boardIndex)}
                            className="flex items-center gap-2 p-2 bg-white border border-gray-100 hover:border-gray-300 cursor-move group"
                          >
                            <div
                              className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0"
                              style={{ backgroundColor: material.tone }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-sans truncate">{material.name}</p>
                              <p className="text-[10px] font-mono text-gray-500 truncate">
                                {formatFinishForDisplay(material.finish)}
                              </p>
                            </div>
                            <button
                              onClick={() => onBoardChange(board.filter((_, i) => i !== boardIndex))}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </aside>

          {/* Right side - Product grid or custom material form */}
          <main className="flex-1 space-y-6">
            {/* Page title + search */}
            {!isCustomCategory && (
              <>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-arch-line">
                  <div>
                    <h1 className="text-3xl font-display uppercase tracking-tight mb-2">
                      {selectedCategory ? getCategoryLabel() : isDefaultLibraryView ? 'Low Carbon Picks' : 'Material Library'}
                    </h1>
                    <p className="text-sm text-gray-600 font-sans">
                      {selectedCategory
                        ? `${sortedMaterials.length} product${sortedMaterials.length === 1 ? '' : 's'}`
                        : searchTokens.length
                        ? `${sortedMaterials.length} result${sortedMaterials.length === 1 ? '' : 's'} across all categories`
                        : `${sortedMaterials.length} curated low-carbon pick${sortedMaterials.length === 1 ? '' : 's'} to start with. Search the whole library or choose a category to browse all materials.`}
                    </p>
                  </div>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="px-3 py-1.5 border border-gray-200 text-[10px] font-mono uppercase tracking-widest text-gray-600 hover:text-black hover:border-black transition-colors"
                    >
                      Search Whole Library
                    </button>
                  )}
                </div>

                {/* Search bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={
                      selectedCategory
                        ? 'Search materials in this category...'
                        : 'Search the whole material library...'
                    }
                    className="w-full border-0 border-b border-arch-line pl-10 pr-3 py-2 text-sm font-sans focus:outline-none focus:border-black"
                  />
                </div>
              </>
            )}

            {/* Custom Material Creation */}
            {isCustomCategory ? (
              <div className="space-y-6">
                {customMaterialMode === 'analyse' ? (
                  /* AI Photo Analysis */
                  <div className="max-w-2xl space-y-6 border border-arch-line p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display uppercase tracking-widest text-lg">Analyze Photo</h3>
                        <p className="text-xs text-gray-500 font-sans mt-1">Uses 2 credits</p>
                      </div>
                      <button
                        onClick={() => {
                          setCustomMaterialMode('analyse');
                          setDetectionImage(null);
                          setDetectedMaterials([]);
                          setDetectionError(null);
                        }}
                        className="text-sm text-gray-600 hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Photo Upload */}
                    <label
                      className="border-2 border-dashed border-gray-300 p-12 hover:border-black transition-colors cursor-pointer flex flex-col items-center"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <Camera className="w-16 h-16 mb-4 text-gray-400" />
                      <span className="text-base font-display uppercase tracking-wide mb-2">Upload Photo</span>
                      <span className="text-sm text-gray-600 font-sans">Click to select or drag and drop an image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e.target.files)}
                      />
                    </label>

                    {/* Uploaded Image Preview */}
                    {detectionImage && (
                      <div className="relative border border-arch-line">
                        <img
                          src={detectionImage.dataUrl}
                          alt="Uploaded"
                          className="w-full h-64 object-cover"
                        />
                        <button
                          onClick={() => {
                            setDetectionImage(null);
                            setDetectedMaterials([]);
                            setDetectionError(null);
                          }}
                          className="absolute top-2 right-2 bg-white p-2 border border-gray-200 hover:bg-gray-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Analyse Button */}
                    {detectionImage && (
                      <button
                        onClick={startMaterialDetection}
                        disabled={isDetecting}
                        className="w-full bg-arch-black text-white py-3 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDetecting ? 'Analysing...' : 'Analyse Photo'}
                      </button>
                    )}

                    {/* Error Message */}
                    {detectionError && (
                      <div className="bg-red-50 border border-red-200 p-4">
                        <p className="text-sm font-sans text-red-800">{detectionError}</p>
                      </div>
                    )}

                    {/* Detected Materials - Ask user to add */}
                    {detectedMaterials.length > 0 && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-display uppercase tracking-widest text-sm">
                              Found {detectedMaterials.length} Material{detectedMaterials.length !== 1 ? 's' : ''}
                            </h4>
                            <button
                              onClick={toggleSelectAll}
                              className="text-xs font-sans text-blue-700 hover:underline"
                            >
                              {selectedMaterialIds.size === detectedMaterials.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          <p className="text-sm font-sans text-gray-700">
                            Select materials to add to your board ({selectedMaterialIds.size} selected)
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {detectedMaterials.map((mat) => (
                            <div
                              key={mat.id}
                              className={`border p-4 cursor-pointer transition-colors ${
                                selectedMaterialIds.has(mat.id)
                                  ? 'border-black bg-gray-50'
                                  : 'border-arch-line hover:border-gray-400'
                              }`}
                              onClick={() => toggleMaterialSelection(mat.id)}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedMaterialIds.has(mat.id)}
                                  onChange={() => toggleMaterialSelection(mat.id)}
                                  className="mt-1 w-4 h-4 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div
                                  className="w-12 h-12 border border-arch-line flex-shrink-0"
                                  style={{ backgroundColor: mat.tone }}
                                />
                                <div className="flex-1">
                                  <h5 className="font-display uppercase tracking-wide text-sm">{mat.name}</h5>
                                  <p className="text-xs text-gray-600 font-sans">{formatFinishForDisplay(mat.finish)}</p>
                                  {mat.description && (
                                    <p className="text-xs text-gray-500 font-sans mt-1">
                                      {formatDescriptionForDisplay(mat.description)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setDetectionImage(null);
                              setDetectedMaterials([]);
                              setSelectedMaterialIds(new Set());
                              setDetectionError(null);
                            }}
                            className="flex-1 border border-gray-200 py-3 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const selectedMaterials = detectedMaterials.filter(mat => selectedMaterialIds.has(mat.id));
                              selectedMaterials.forEach((mat) => handleAdd(mat, undefined, true));

                              setCustomMaterialMode('analyse');
                              setDetectionImage(null);
                              setDetectedMaterials([]);
                              setSelectedMaterialIds(new Set());
                            }}
                            disabled={selectedMaterialIds.size === 0}
                            className="flex-1 py-3 text-xs font-mono uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-arch-black text-white hover:bg-gray-900"
                          >
                            Add Selected to Board
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Custom Material Form */
                  <div className="max-w-2xl space-y-6 border border-arch-line p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display uppercase tracking-widest text-lg">
                        Add Custom Material
                      </h3>
                      <button
                        onClick={() => {
                          setCustomMaterialMode(null);
                          setCustomMaterialName('');
                          setCustomMaterialDescription('');
                        }}
                        className="text-sm text-gray-600 hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Material Name */}
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                        Material Name *
                      </label>
                      <input
                        type="text"
                        value={customMaterialName}
                        onChange={(e) => setCustomMaterialName(e.target.value)}
                        placeholder="e.g., Reclaimed Oak Flooring"
                        className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                        Description {customMaterialMode === 'describe' ? '*' : '(Optional)'}
                      </label>
                      <textarea
                        value={customMaterialDescription}
                        onChange={(e) => setCustomMaterialDescription(e.target.value)}
                        placeholder="Describe the material, its properties, source, etc."
                        rows={4}
                        className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>

                    {/* Create Button */}
                    <button
                      onClick={handleCreateCustomMaterial}
                      className="w-full py-3 text-xs font-mono uppercase tracking-widest transition-colors bg-arch-black text-white hover:bg-gray-900"
                    >
                      Create & Add to Board
                    </button>
                  </div>
                )}
              </div>
            ) : showMaterialGrid ? (
              <>
                {/* Product Grid */}
                <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 ${isFadingOut ? 'animate-fade-out' : 'animate-fade-in'}`}>
                  {sortedMaterials.map((mat) => {
                    const { webpUrl, pngUrl } = getMaterialIconUrls(mat);
                    return (
                    <article key={mat.id} className="group space-y-3">
                      {/* Product image/swatch */}
                      <div className="aspect-square bg-arch-gray relative overflow-hidden border border-arch-line">
                        {mat.customImage ? (
                          <img src={mat.customImage} alt={mat.name} className="w-full h-full object-cover" />
                        ) : (
                          <picture>
                            <source srcSet={webpUrl} type="image/webp" />
                            <img
                              src={pngUrl}
                              alt={mat.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Fallback to color swatch if icon fails to load
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.parentElement?.nextElementSibling as HTMLElement | null;
                                if (fallback) {
                                  fallback.style.display = 'block';
                                }
                              }}
                            />
                          </picture>
                        )}
                        <div
                          className="w-full h-full hidden"
                          style={{ backgroundColor: mat.tone }}
                        />
                      </div>

                      {/* Product info */}
                      <div className="space-y-2">
                        {(isLibrarySearchMode || isDefaultLibraryView) && (
                          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
                            {getCategoryDisplayName(mat.category)}
                          </p>
                        )}
                        <h3 className="font-display uppercase tracking-wide text-sm">{mat.name}</h3>
                        <p className="text-xs text-gray-600 font-sans line-clamp-2">
                          {formatFinishForDisplay(mat.finish)}
                        </p>
                        {mat.description && (
                          <p className="text-xs text-gray-500 font-sans line-clamp-2">
                            {formatDescriptionForDisplay(mat.description)}
                          </p>
                        )}
                      </div>

                      {mat.carbonIntensity && (
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center border px-2 py-1 text-[10px] font-mono uppercase tracking-widest ${CARBON_IMPACT_CLASSES[mat.carbonIntensity]}`}
                          >
                            {CARBON_IMPACT_LABELS[mat.carbonIntensity]}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const fact = buildMaterialFact(mat);
                              setSustainabilityMaterial({ material: mat, fact });
                            }}
                            className="p-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors group"
                            title="Click to view material sustainability credentials"
                          >
                            <Leaf className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
                          </button>
                        </div>
                      )}

                      {/* Add to board button */}
                      <button
                        onClick={(e) => handleAdd(mat, undefined, undefined, e.currentTarget)}
                        className="w-full py-3 text-xs font-mono uppercase tracking-widest transition-colors bg-arch-black text-white hover:bg-gray-900"
                      >
                        Add to board
                      </button>
                    </article>
                    );
                  })}
                </div>

                {/* Empty state when no results */}
                {sortedMaterials.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-gray-600 font-sans">
                      {isDefaultLibraryView
                        ? 'No low-carbon picks are available yet.'
                        : selectedCategory
                        ? 'No materials found in this category.'
                        : `No materials found for "${searchTerm.trim()}".`}
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </main>
        </div>
      </div>

      {flyToBoardAnimation && (
        <div
          key={flyToBoardAnimation.key}
          aria-hidden
          className="pointer-events-none fixed z-[60] h-3.5 w-3.5 rounded-full border border-black/20 shadow-sm animate-fly-to-board"
          style={
            {
              left: `${flyToBoardAnimation.startX}px`,
              top: `${flyToBoardAnimation.startY}px`,
              backgroundColor: flyToBoardAnimation.tone,
              ['--fly-x' as any]: `${flyToBoardAnimation.deltaX}px`,
              ['--fly-y' as any]: `${flyToBoardAnimation.deltaY}px`,
            } as React.CSSProperties
          }
        />
      )}

      {/* Added to board modal */}
      {recentlyAdded && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 px-4 py-4 sm:py-6 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white shadow-2xl my-auto">
            <div className="max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
            <button
              onClick={() => {
                setRecentlyAdded(null);
                setSelectedVariety(null);
                setSelectedFinishOption(null);
                setSelectedColorOption(null);
              }}
              className="absolute top-3 right-3 p-1 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-arch-line pb-4">
              <ShoppingCart className="w-5 h-5" />
              <div className="font-display uppercase tracking-widest text-base">
                Select Options
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {/* Material Icon */}
                {(() => {
                  const { webpUrl, pngUrl } = getMaterialIconUrls(recentlyAdded);
                  return (
                    <div className="w-20 h-20 border border-arch-line overflow-hidden bg-arch-gray flex-shrink-0">
                      {recentlyAdded.customImage ? (
                        <img src={recentlyAdded.customImage} alt={recentlyAdded.name} className="w-full h-full object-cover" />
                      ) : (
                        <picture>
                          <source srcSet={webpUrl} type="image/webp" />
                          <img
                            src={pngUrl}
                            alt={recentlyAdded.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const fallback = target.parentElement?.nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = 'block';
                            }}
                          />
                        </picture>
                      )}
                      <div
                        className="w-full h-full hidden"
                        style={{ backgroundColor: recentlyAdded.tone }}
                      />
                    </div>
                  );
                })()}
                <div className="flex-1">
                  <div className="font-display uppercase tracking-wide text-sm">{recentlyAdded.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mt-1">
                    {formatFinishForDisplay(recentlyAdded.finish)}
                  </div>
                  {recentlyAdded.description && (
                    <p className="font-sans text-xs text-gray-600 mt-2">
                      {formatDescriptionForDisplay(recentlyAdded.description)}
                    </p>
                  )}
                </div>
              </div>

              {/* Show instruction */}
              <div className="bg-gray-50 border border-gray-200 p-3">
                <p className="font-sans text-xs text-gray-700">
                  {needsVarietySelection
                    ? 'Select a material variety.'
                    : needsFinishSelection
                    ? 'Select a finish option.'
                    : needsColourSelection
                    ? 'Select a colour option.'
                    : 'This material is added automatically.'}
                </p>
              </div>

              {/* Variety options - show first if available */}
              {hasVarietyOptions && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    Material Variety
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {recentlyAdded.varietyOptions?.map((variety, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedVariety(variety);
                          setSelectedFinishOption(null);
                          setSelectedColorOption(null);
                          maybeAutoAddFromModal({
                            variety,
                            finishOption: null,
                            colorOption: null,
                          });
                        }}
                        className={`border px-3 py-2 transition-colors ${
                          selectedVariety === variety
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 hover:border-black'
                        }`}
                      >
                        <span className="font-sans text-xs">{variety}</span>
                      </button>
                    ))}
                  </div>
                  {selectedVariety && (
                    <p className="font-sans text-xs text-emerald-600 mt-2">
                      Selected: {selectedVariety}
                    </p>
                  )}
                </div>
              )}

              {/* Finish options - step 2 */}
              {hasFinishOptions && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    Finish Options
                  </label>
                  <div className={`flex flex-wrap gap-2 ${canSelectFinish ? '' : 'opacity-50 pointer-events-none'}`}>
                    {recentlyAdded.finishOptions?.map((finish, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedFinishOption(finish);
                          setSelectedColorOption(null);
                          maybeAutoAddFromModal({
                            finishOption: finish,
                            colorOption: null,
                          });
                        }}
                        className={`border px-3 py-2 transition-colors ${
                          selectedFinishOption === finish
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 hover:border-black'
                        }`}
                      >
                        <span className="font-sans text-xs">{finish}</span>
                      </button>
                    ))}
                  </div>
                  {!canSelectFinish && (
                    <p className="font-sans text-xs text-gray-500 mt-2">
                      Select a material variety first.
                    </p>
                  )}
                  {canSelectFinish && selectedFinishOption && (
                    <p className="font-sans text-xs text-emerald-600 mt-2">
                      Selected: {selectedFinishOption}
                    </p>
                  )}
                </div>
              )}

              {/* Curated color options - step 3 */}
              {hasCuratedColourStep && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    Colour Options
                  </label>
                  <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${canSelectColour ? '' : 'opacity-50 pointer-events-none'}`}>
                    {recentlyAdded.colorOptions?.map((colorOption, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedColorOption(colorOption);
                          maybeAutoAddFromModal({
                            colorOption,
                          });
                        }}
                        className="flex flex-col items-start gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors text-left"
                        title={`Select ${colorOption.label}`}
                      >
                        <span
                          className="h-8 w-full border border-gray-200"
                          style={{ backgroundColor: colorOption.tone }}
                          aria-hidden
                        />
                        <span className="font-sans text-xs">{colorOption.label}</span>
                      </button>
                    ))}
                  </div>
                  {!canSelectColour && (
                    <p className="font-sans text-xs text-gray-500 mt-2">
                      {needsVarietySelection ? 'Select a material variety first.' : 'Select the finish option first.'}
                    </p>
                  )}
                  {canSelectColour && selectedColorOption && (
                    <p className="font-sans text-xs text-emerald-600 mt-2">
                      Selected: {selectedColorOption.label}
                    </p>
                  )}
                </div>
              )}

              {/* RAL palette for free color selection - step 3 */}
              {hasFreeColor && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    RAL Colour Options
                  </label>
                  <div className={`grid max-h-80 grid-cols-2 gap-3 overflow-y-auto pr-2 sm:grid-cols-3 ${canSelectColour ? '' : 'opacity-50 pointer-events-none'}`}>
                    {RAL_COLOR_OPTIONS.map((colorOption, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedColorOption(colorOption);
                          maybeAutoAddFromModal({
                            colorOption,
                          });
                        }}
                        className="flex flex-col items-start gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors text-left"
                        title={`Select ${colorOption.label}`}
                      >
                        <span
                          className="h-8 w-full border border-gray-200"
                          style={{ backgroundColor: colorOption.tone }}
                          aria-hidden
                        />
                        <span className="font-sans text-xs">{colorOption.label}</span>
                      </button>
                    ))}
                  </div>
                  {!canSelectColour && (
                    <p className="font-sans text-xs text-gray-500 mt-2">
                      {needsVarietySelection ? 'Select a material variety first.' : 'Select the finish option first.'}
                    </p>
                  )}
                  {canSelectColour && selectedColorOption && (
                    <p className="font-sans text-xs text-emerald-600 mt-2">
                      Selected: {selectedColorOption.label}
                    </p>
                  )}
                  <p className="font-sans text-xs text-gray-500 mt-2">
                    Select a colour to add this material.
                  </p>
                </div>
              )}

            </div>
            </div>
          </div>
        </div>
      )}

      {sustainabilityMaterial && (
        <MaterialSustainabilityModal
          material={sustainabilityMaterial.material}
          fact={sustainabilityMaterial.fact}
          onClose={() => setSustainabilityMaterial(null)}
        />
      )}
    </div>
  );
};

export default MaterialSelection;
