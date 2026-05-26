import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Concept from './components/Concept';
import Moodboard from './components/Moodboard';
import ApplyMaterials from './components/ApplyMaterials';
import MaterialSelection from './components/MaterialSelection';
import Product from './components/Product';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Contact from './components/Contact';
import Pricing from './components/Pricing';
import CookieBanner from './components/CookieBanner';
import Dashboard from './components/Dashboard';
import MaterialAdmin from './components/MaterialAdmin';
import BrandPage from './components/BrandPage';
import BrandSubmissionForm from './components/BrandSubmissionForm';
import BrandAdmin from './components/BrandAdmin';
import { useAuth, useUsage } from './auth';
import { MaterialOption, UploadedImage, StyleReferenceSource } from './types';
import type { PrecedentResult } from './api';
import type {
  SustainabilityBriefingPayload,
  SustainabilityBriefingResponse,
} from './utils/sustainabilityBriefing';
import { getBriefingMaterialsKey } from './utils/sustainabilityBriefing';
import { trackPageView } from './utils/analytics';
import { clearMoodboardCache } from './utils/clearCache';
import { applyPageSeo, getPageFromPath, getPathForPage } from './utils/siteSeo';
import { resolveImageSourceToDataUrl } from './utils/imageUtils';

// Scene control types (shared with ApplyMaterials)
type SceneControl = {
  enabled: boolean;
  value: number;
};

type SceneControls = {
  weather: SceneControl;
  activity: SceneControl;
  timeOfDay: SceneControl;
  season: SceneControl;
  viewCharacter: SceneControl;
};

const DEFAULT_SCENE_CONTROLS: SceneControls = {
  weather: { enabled: false, value: 0 },
  activity: { enabled: false, value: 0 },
  timeOfDay: { enabled: false, value: 0 },
  season: { enabled: false, value: 0 },
  viewCharacter: { enabled: false, value: 0 }
};

const BRIEFING_CACHE_KEY = 'moodboard_sustainability_briefing_v1';
const BOARD_CACHE_KEY = 'moodboard_selected_materials_v1';
const RENDER_URL_CACHE_KEY = 'moodboard_render_url_v1';
const APPLIED_URL_CACHE_KEY = 'moodboard_applied_url_v1';
const APPLY_STATE_CACHE_KEY = 'moodboard_apply_state_v1';
const PROJECT_CACHE_KEY = 'moodboard_current_project_v1';

// Project type for grouping generations
type Project = {
  id: string;
  name: string;
  createdAt: string;
};

const generateProjectId = (): string => {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const formatProjectDate = (): string => {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString('en-GB', { month: 'short' });
  const year = now.getFullYear();
  return `${day} ${month} ${year}`;
};

const PROJECT_COUNTER_KEY = 'moodboard_project_counter_v1';

type ProjectCounter = {
  date: string; // YYYY-MM-DD format
  count: number;
};

const getTodayDateKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getNextProjectNumber = (): number => {
  if (typeof window === 'undefined') return 1;

  const todayKey = getTodayDateKey();

  try {
    const raw = window.localStorage.getItem(PROJECT_COUNTER_KEY);
    if (raw) {
      const counter = JSON.parse(raw) as ProjectCounter;
      if (counter.date === todayKey) {
        // Same day, increment counter
        const newCount = counter.count + 1;
        window.localStorage.setItem(PROJECT_COUNTER_KEY, JSON.stringify({ date: todayKey, count: newCount }));
        return newCount;
      }
    }
    // New day or no counter, start at 1
    window.localStorage.setItem(PROJECT_COUNTER_KEY, JSON.stringify({ date: todayKey, count: 1 }));
    return 1;
  } catch {
    return 1;
  }
};

const formatProjectName = (): string => {
  const dateStr = formatProjectDate();
  const projectNumber = getNextProjectNumber();

  if (projectNumber === 1) {
    return `Moodboard ${dateStr}`;
  }
  return `Moodboard ${dateStr} (${projectNumber})`;
};

const readProjectCache = (): Project | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Project>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id || !parsed.name) return null;
    return parsed as Project;
  } catch {
    return null;
  }
};

type ApplyStateCache = {
  uploadedImages: UploadedImage[];
  styleReferenceImage: UploadedImage | null;
  styleReferenceSource: StyleReferenceSource | null;
  styleReferenceSourceId: string | null;
  sceneControls: SceneControls;
  renderNote: string;
  appliedEditPrompt: string;
  savedAt: string;
};

const readApplyStateCache = (): ApplyStateCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(APPLY_STATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ApplyStateCache>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ApplyStateCache;
  } catch {
    return null;
  }
};

const readRenderUrlCache = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(RENDER_URL_CACHE_KEY);
  } catch {
    return null;
  }
};

const readAppliedUrlCache = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(APPLIED_URL_CACHE_KEY);
  } catch {
    return null;
  }
};

type BriefingCache = {
  materialsKey: string;
  briefing: SustainabilityBriefingResponse;
  payload: SustainabilityBriefingPayload;
  savedAt: string;
};

type BoardCache = {
  board: MaterialOption[];
  savedAt: string;
};

const readBriefingCache = (): BriefingCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BriefingCache>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.materialsKey || !parsed.briefing || !parsed.payload) return null;
    return parsed as BriefingCache;
  } catch {
    return null;
  }
};

const readBoardCache = (): BoardCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoardCache>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.board)) return null;
    return { board: parsed.board as MaterialOption[], savedAt: parsed.savedAt || '' };
  } catch {
    return null;
  }
};

const getInitialPage = (): string => {
  if (typeof window === 'undefined') return 'concept';
  return getPageFromPath(window.location.pathname);
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { checkoutStatus, dismissCheckoutStatus } = useUsage();
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialOption[]>([]);
  const [moodboardRenderUrl, setMoodboardRenderUrl] = useState<string | null>(null);
  const [restoredWithoutMoodboard, setRestoredWithoutMoodboard] = useState(false);
  const [appliedRenderUrl, setAppliedRenderUrl] = useState<string | null>(null);
  const [sustainabilityBriefing, setSustainabilityBriefing] =
    useState<SustainabilityBriefingResponse | null>(null);
  const [briefingPayload, setBriefingPayload] = useState<SustainabilityBriefingPayload | null>(null);
  const [briefingMaterialsKey, setBriefingMaterialsKey] = useState<string | null>(null);
  const [briefingInvalidatedMessage, setBriefingInvalidatedMessage] = useState<string | null>(null);
  const [savedPrecedents, setSavedPrecedents] = useState<PrecedentResult[] | null>(null);
  const [openConsentPreferences, setOpenConsentPreferences] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Lifted state from ApplyMaterials (persists across navigation)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [styleReferenceImage, setStyleReferenceImage] = useState<UploadedImage | null>(null);
  const [styleReferenceSource, setStyleReferenceSource] = useState<StyleReferenceSource | null>(null);
  const [styleReferenceSourceId, setStyleReferenceSourceId] = useState<string | null>(null);
  const [sceneControls, setSceneControls] = useState<SceneControls>(DEFAULT_SCENE_CONTROLS);
  const [renderNote, setRenderNote] = useState('');
  const [appliedEditPrompt, setAppliedEditPrompt] = useState('');

  // Lifted state from Moodboard (persists across navigation)
  const [moodboardEditPrompt, setMoodboardEditPrompt] = useState('');

  // Project state - groups all generations under a single project
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const briefingCacheRef = useRef<BriefingCache | null>(null);
  const boardCacheRestoredRef = useRef(false);
  const hasSyncedLocationRef = useRef(false);
  const projectCacheRestoredRef = useRef(false);
  const hasInitializedAuthStateRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);

  const materialsKey = useMemo(() => getBriefingMaterialsKey(selectedMaterials), [selectedMaterials]);

  const clearWorkspaceAfterSignOut = useCallback(() => {
    clearMoodboardCache();
    briefingCacheRef.current = null;
    setCurrentPage('concept');
    setSelectedMaterials([]);
    setMoodboardRenderUrl(null);
    setRestoredWithoutMoodboard(false);
    setAppliedRenderUrl(null);
    setSustainabilityBriefing(null);
    setBriefingPayload(null);
    setBriefingMaterialsKey(null);
    setBriefingInvalidatedMessage(null);
    setSavedPrecedents(null);
    setUploadedImages([]);
    setStyleReferenceImage(null);
    setStyleReferenceSource(null);
    setStyleReferenceSourceId(null);
    setSceneControls(DEFAULT_SCENE_CONTROLS);
    setRenderNote('');
    setAppliedEditPrompt('');
    setMoodboardEditPrompt('');
    setCurrentProject(null);
  }, []);

  useEffect(() => {
    briefingCacheRef.current = readBriefingCache();
  }, []);

  useEffect(() => {
    if (!hasInitializedAuthStateRef.current) {
      hasInitializedAuthStateRef.current = true;
      wasAuthenticatedRef.current = isAuthenticated;
      return;
    }

    if (wasAuthenticatedRef.current && !isAuthenticated) {
      clearWorkspaceAfterSignOut();
    }

    wasAuthenticatedRef.current = isAuthenticated;
  }, [clearWorkspaceAfterSignOut, isAuthenticated]);

  // Restore project from localStorage on mount
  useEffect(() => {
    if (projectCacheRestoredRef.current) return;
    projectCacheRestoredRef.current = true;
    const cached = readProjectCache();
    if (cached) {
      setCurrentProject(cached);
    }
  }, []);

  // Persist project to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentProject) {
        window.localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(currentProject));
      } else {
        window.localStorage.removeItem(PROJECT_CACHE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentProject]);

  // Create a new project (called when generating first moodboard)
  const createNewProject = (): Project => {
    const project: Project = {
      id: generateProjectId(),
      name: formatProjectName(),
      createdAt: new Date().toISOString(),
    };
    setCurrentProject(project);
    return project;
  };

  // Start a fresh project (clears current project and related state)
  const startNewProject = () => {
    setCurrentProject(null);
    setMoodboardRenderUrl(null);
    setAppliedRenderUrl(null);
    setSustainabilityBriefing(null);
    setBriefingPayload(null);
    setBriefingMaterialsKey(null);
    setSavedPrecedents(null);
    setUploadedImages([]);
    setStyleReferenceImage(null);
    setStyleReferenceSource(null);
    setStyleReferenceSourceId(null);
    setSceneControls(DEFAULT_SCENE_CONTROLS);
    setRenderNote('');
    setAppliedEditPrompt('');
    setMoodboardEditPrompt('');
    // Keep materials - user might want to reuse them
  };

  // Track page views in Google Analytics
  useEffect(() => {
    const pagePath = getPathForPage(currentPage);
    const pageLabel = currentPage.startsWith('brand:')
      ? `Brand: ${currentPage.slice(6)}`
      : currentPage.charAt(0).toUpperCase() + currentPage.slice(1);
    trackPageView(pagePath, pageLabel);
  }, [currentPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const path = getPathForPage(currentPage);
    const currentPath = window.location.pathname;
    if (currentPath !== path) {
      const historyMethod = hasSyncedLocationRef.current ? 'pushState' : 'replaceState';
      window.history[historyMethod](null, '', path);
    }
    hasSyncedLocationRef.current = true;
    applyPageSeo(currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      setCurrentPage(getPageFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (boardCacheRestoredRef.current) return;
    boardCacheRestoredRef.current = true;
    const cached = readBoardCache();
    if (!cached) return;
    setSelectedMaterials((prev) => (prev.length ? prev : cached.board));
  }, []);

  useEffect(() => {
    if (sustainabilityBriefing || briefingPayload) return;
    if (!selectedMaterials.length) return;
    const cached = briefingCacheRef.current;
    if (!cached || cached.materialsKey !== materialsKey) return;
    setSustainabilityBriefing(cached.briefing);
    setBriefingPayload(cached.payload);
    setBriefingMaterialsKey(cached.materialsKey);
    setBriefingInvalidatedMessage(null);
  }, [materialsKey, selectedMaterials.length, sustainabilityBriefing, briefingPayload]);

  useEffect(() => {
    if (!briefingMaterialsKey || !sustainabilityBriefing || !briefingPayload) return;
    if (typeof window === 'undefined') return;
    const cache: BriefingCache = {
      materialsKey: briefingMaterialsKey,
      briefing: sustainabilityBriefing,
      payload: briefingPayload,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(cache));
      briefingCacheRef.current = cache;
    } catch {
      // Ignore storage errors (quota, private mode, etc.)
    }
  }, [briefingMaterialsKey, sustainabilityBriefing, briefingPayload]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Strip icon URLs before caching - they contain SAS tokens that expire after 24 hours
    const boardWithoutIconUrls = selectedMaterials.map(
      ({ iconWebpUrl, iconPngUrl, ...rest }) => rest
    );
    const cache: BoardCache = {
      board: boardWithoutIconUrls as MaterialOption[],
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(BOARD_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Ignore storage errors (quota, private mode, etc.)
    }
  }, [selectedMaterials]);

  // Restore render URLs from localStorage on mount
  useEffect(() => {
    const cachedRenderUrl = readRenderUrlCache();
    if (cachedRenderUrl && !moodboardRenderUrl) {
      setMoodboardRenderUrl(cachedRenderUrl);
    }
    const cachedAppliedUrl = readAppliedUrlCache();
    if (cachedAppliedUrl && !appliedRenderUrl) {
      setAppliedRenderUrl(cachedAppliedUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist moodboardRenderUrl to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (moodboardRenderUrl) {
        window.localStorage.setItem(RENDER_URL_CACHE_KEY, moodboardRenderUrl);
      } else {
        window.localStorage.removeItem(RENDER_URL_CACHE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [moodboardRenderUrl]);

  // Persist appliedRenderUrl to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (appliedRenderUrl) {
        window.localStorage.setItem(APPLIED_URL_CACHE_KEY, appliedRenderUrl);
      } else {
        window.localStorage.removeItem(APPLIED_URL_CACHE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [appliedRenderUrl]);

  // Restore Apply page state from localStorage on mount
  useEffect(() => {
    const cached = readApplyStateCache();
    if (!cached) return;
    if (cached.uploadedImages?.length) setUploadedImages(cached.uploadedImages.slice(0, 1));
    setStyleReferenceImage(cached.styleReferenceImage ?? null);
    setStyleReferenceSource(
      cached.styleReferenceImage
        ? cached.styleReferenceSource ?? (cached.styleReferenceSourceId ? 'project' : 'external')
        : null
    );
    setStyleReferenceSourceId(cached.styleReferenceSourceId ?? null);
    if (cached.sceneControls) setSceneControls(cached.sceneControls);
    if (cached.renderNote) setRenderNote(cached.renderNote);
    if (cached.appliedEditPrompt) setAppliedEditPrompt(cached.appliedEditPrompt);
  }, []);

  // Persist Apply page state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cache: ApplyStateCache = {
      uploadedImages,
      styleReferenceImage,
      styleReferenceSource,
      styleReferenceSourceId,
      sceneControls,
      renderNote,
      appliedEditPrompt,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(APPLY_STATE_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Ignore storage errors
    }
  }, [uploadedImages, styleReferenceImage, styleReferenceSource, styleReferenceSourceId, sceneControls, renderNote, appliedEditPrompt]);

  useEffect(() => {
    if (!briefingMaterialsKey) return;
    if (materialsKey !== briefingMaterialsKey) {
      setSustainabilityBriefing(null);
      setBriefingPayload(null);
      setBriefingMaterialsKey(null);
      setBriefingInvalidatedMessage(
        'Materials palette changed. Please create a new moodboard and sustainability briefing.'
      );
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(BRIEFING_CACHE_KEY);
        } catch {
          // Ignore storage errors (quota, private mode, etc.)
        }
      }
      briefingCacheRef.current = null;
    }
  }, [materialsKey, briefingMaterialsKey]);

  useEffect(() => {
    if (!isHelpOpen || typeof window === 'undefined') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHelpOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isHelpOpen]);

  const handleRestoreGeneration = async ({
    targetPage,
    board,
    generationImageUrl,
    sourceType,
    sustainabilityBriefing: restoredBriefing,
    briefingPayload: restoredPayload,
    moodboardRenderUrl: restoredMoodboardUrl,
    savedPrecedents: restoredPrecedents,
    projectId: restoredProjectId,
    projectName: restoredProjectName,
  }: {
    targetPage: 'moodboard' | 'apply';
    board: MaterialOption[];
    generationImageUrl: string | null;
    sourceType: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing' | 'precedentSearch';
    sustainabilityBriefing?: SustainabilityBriefingResponse | null;
    briefingPayload?: SustainabilityBriefingPayload | null;
    moodboardRenderUrl?: string | null;
    savedPrecedents?: PrecedentResult[] | null;
    projectId?: string | null;
    projectName?: string | null;
  }) => {
    setSelectedMaterials(board);

    // Restore project context if available
    if (restoredProjectId && restoredProjectName) {
      setCurrentProject({
        id: restoredProjectId,
        name: restoredProjectName,
        createdAt: new Date().toISOString() // We don't have the original, use now
      });
    }

    if (targetPage === 'moodboard') {
      // Convert to data URI to prevent "Load failed" errors when the URL expires
      if (generationImageUrl) {
        try {
          const dataUri = await resolveImageSourceToDataUrl(generationImageUrl);
          setMoodboardRenderUrl(dataUri);
        } catch (err) {
          console.warn('Failed to convert restored moodboard image to data URI:', err);
          // Fallback to using the original URL
          setMoodboardRenderUrl(generationImageUrl);
        }
      } else {
        setMoodboardRenderUrl(null);
      }
      // Restore sustainability briefing if available
      if (restoredBriefing) {
        setSustainabilityBriefing(restoredBriefing);
      }
      if (restoredPayload) {
        setBriefingPayload(restoredPayload);
      }
      // Update the briefing materials key to match the restored board
      if (restoredBriefing && restoredPayload) {
        setBriefingMaterialsKey(getBriefingMaterialsKey(board));
        setBriefingInvalidatedMessage(null);
      }
      // Restore precedents if available
      if (restoredPrecedents) {
        setSavedPrecedents(restoredPrecedents);
      }
      setCurrentPage('moodboard');
      return;
    }

    if (generationImageUrl && (sourceType === 'applyMaterials' || sourceType === 'upscale')) {
      // Convert to data URI eagerly to ensure the image is available for editing
      // This prevents "Load failed" errors when the URL expires
      try {
        const dataUri = await resolveImageSourceToDataUrl(generationImageUrl);
        setAppliedRenderUrl(dataUri);
      } catch (err) {
        console.warn('Failed to convert restored image to data URI:', err);
        // Fallback to using the original URL
        setAppliedRenderUrl(generationImageUrl);
      }
    }
    // Always set moodboard URL when restoring (clears any existing if none saved)
    console.log('=== RESTORE FROM DASHBOARD ===');
    console.log('restoredMoodboardUrl:', restoredMoodboardUrl ? `${restoredMoodboardUrl.substring(0, 100)}...` : 'null');
    setMoodboardRenderUrl(restoredMoodboardUrl || null);
    // Track if we restored without a moodboard so we can show appropriate message
    setRestoredWithoutMoodboard(!restoredMoodboardUrl);
    setCurrentPage('apply');
  };

  const renderPage = () => {
    if (currentPage.startsWith('brand:')) {
      return (
        <BrandPage
          brandSlug={currentPage.slice(6)}
          onNavigate={setCurrentPage}
        />
      );
    }
    switch(currentPage) {
      case 'concept':
        return (
          <Concept
            onNavigate={setCurrentPage}
            onViewBrand={(slug) => setCurrentPage(`brand:${slug}`)}
          />
        );
      case 'materials':
        return (
          <MaterialSelection
            onNavigate={setCurrentPage}
            board={selectedMaterials}
            onBoardChange={setSelectedMaterials}
            onStartNewProject={startNewProject}
          />
        );
      case 'moodboard':
        return (
          <Moodboard
            onNavigate={setCurrentPage}
            initialBoard={selectedMaterials}
            onBoardChange={setSelectedMaterials}
            moodboardRenderUrl={moodboardRenderUrl}
            onMoodboardRenderUrlChange={setMoodboardRenderUrl}
            sustainabilityBriefing={sustainabilityBriefing}
            onSustainabilityBriefingChange={setSustainabilityBriefing}
            briefingPayload={briefingPayload}
            onBriefingPayloadChange={setBriefingPayload}
            onBriefingMaterialsKeyChange={setBriefingMaterialsKey}
            briefingInvalidatedMessage={briefingInvalidatedMessage}
            onBriefingInvalidatedMessageChange={setBriefingInvalidatedMessage}
            initialPrecedents={savedPrecedents}
            onPrecedentsChange={setSavedPrecedents}
            moodboardEditPrompt={moodboardEditPrompt}
            onMoodboardEditPromptChange={setMoodboardEditPrompt}
            currentProject={currentProject}
            onCreateProject={createNewProject}
          />
        );
      case 'apply':
        return (
          <ApplyMaterials
            onNavigate={setCurrentPage}
            board={selectedMaterials}
            onBoardChange={setSelectedMaterials}
            moodboardRenderUrl={moodboardRenderUrl}
            appliedRenderUrl={appliedRenderUrl}
            onAppliedRenderUrlChange={setAppliedRenderUrl}
            restoredWithoutMoodboard={restoredWithoutMoodboard}
            onClearRestoredFlag={() => setRestoredWithoutMoodboard(false)}
            uploadedImages={uploadedImages}
            onUploadedImagesChange={setUploadedImages}
            styleReferenceImage={styleReferenceImage}
            onStyleReferenceImageChange={setStyleReferenceImage}
            styleReferenceSource={styleReferenceSource}
            onStyleReferenceSourceChange={setStyleReferenceSource}
            styleReferenceSourceId={styleReferenceSourceId}
            onStyleReferenceSourceIdChange={setStyleReferenceSourceId}
            sceneControls={sceneControls}
            onSceneControlsChange={setSceneControls}
            renderNote={renderNote}
            onRenderNoteChange={setRenderNote}
            appliedEditPrompt={appliedEditPrompt}
            onAppliedEditPromptChange={setAppliedEditPrompt}
            currentProject={currentProject}
          />
        );
      case 'product':
        return <Product onNavigate={setCurrentPage} />;
      case 'privacy':
        return <PrivacyPolicy />;
      case 'terms':
        return <TermsOfService />;
      case 'contact':
        return <Contact />;
      case 'pricing':
        return <Pricing />;
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} onRestoreGeneration={handleRestoreGeneration} />;
      case 'material-admin':
        return <MaterialAdmin onNavigate={setCurrentPage} />;
      case 'brand-register':
        return <BrandSubmissionForm onNavigate={setCurrentPage} />;
      case 'brand-admin':
        return <BrandAdmin onNavigate={setCurrentPage} />;
      default:
        return <Concept onNavigate={setCurrentPage} onViewBrand={(slug) => setCurrentPage(`brand:${slug}`)} />;
    }
  };

  const handlePageLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    page: string
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    setCurrentPage(page);
  };

  const checkoutBannerClasses = checkoutStatus
    ? {
        wrapper:
          checkoutStatus.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-900'
            : checkoutStatus.type === 'cancelled'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : checkoutStatus.type === 'processing'
            ? 'border-sky-200 bg-sky-50 text-sky-900'
            : 'border-red-200 bg-red-50 text-red-900',
        eyebrow:
          checkoutStatus.type === 'success'
            ? 'text-green-700'
            : checkoutStatus.type === 'cancelled'
            ? 'text-amber-700'
            : checkoutStatus.type === 'processing'
            ? 'text-sky-700'
            : 'text-red-700',
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        boardCount={selectedMaterials.length}
      />

      {checkoutStatus && checkoutBannerClasses && (
        <div className="fixed inset-x-0 top-20 z-40 px-4 sm:px-6">
          <div className="mx-auto max-w-screen-2xl">
            <div className={`border shadow-sm ${checkoutBannerClasses.wrapper}`}>
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className={`font-mono text-[11px] uppercase tracking-widest ${checkoutBannerClasses.eyebrow}`}>
                    Credit Checkout
                  </p>
                  <p className="mt-1 text-sm font-sans">{checkoutStatus.message}</p>
                </div>
                <button
                  onClick={dismissCheckoutStatus}
                  className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-current opacity-70 transition-opacity hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className={`flex-grow relative ${checkoutStatus ? 'pt-20 sm:pt-16' : ''}`}>
        <div className="relative">
          {renderPage()}
        </div>
      </main>

      <CookieBanner
        openPreferences={openConsentPreferences}
        onClosePreferences={() => setOpenConsentPreferences(false)}
      />

      <footer className="bg-arch-black text-white py-12 border-t border-gray-800">
        <div className="max-w-screen-2xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 md:items-center">
          <div>
            <h4 className="font-display font-bold uppercase tracking-widest text-lg">Moodboard Lab</h4>
            <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] uppercase tracking-widest text-gray-400">
              <a
                href={getPathForPage('product')}
                onClick={(event) => handlePageLinkClick(event, 'product')}
                className="hover:text-white transition-colors"
              >
                Product
              </a>
              <a
                href={getPathForPage('pricing')}
                onClick={(event) => handlePageLinkClick(event, 'pricing')}
                className="hover:text-white transition-colors"
              >
                Pricing
              </a>
              <button onClick={() => setIsHelpOpen(true)} className="hover:text-white transition-colors">Help</button>
              <a
                href={getPathForPage('privacy')}
                onClick={(event) => handlePageLinkClick(event, 'privacy')}
                className="hover:text-white transition-colors"
              >
                Privacy
              </a>
              <a
                href={getPathForPage('terms')}
                onClick={(event) => handlePageLinkClick(event, 'terms')}
                className="hover:text-white transition-colors"
              >
                Terms
              </a>
              <a
                href={getPathForPage('contact')}
                onClick={(event) => handlePageLinkClick(event, 'contact')}
                className="hover:text-white transition-colors"
              >
                Contact
              </a>
              <button onClick={() => setOpenConsentPreferences(true)} className="hover:text-white transition-colors">Privacy & Cookies</button>
            </div>
          </div>
          <div className="font-mono text-xs text-gray-500 uppercase tracking-widest text-center md:text-right">
            <p>&copy; {new Date().getFullYear()} Moodboard & Material Workspace.</p>
            <p className="mt-1">Built for fast material curation and rendering.</p>
          </div>
        </div>
      </footer>

      {isHelpOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsHelpOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
        >
          <div className="w-full max-w-2xl bg-white text-gray-900 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2
                  id="help-modal-title"
                  className="font-display text-xl uppercase tracking-widest"
                >
                  Student Quick Guide
                </h2>
                <p className="mt-1 text-xs font-mono uppercase tracking-widest text-gray-500">
                  Moodboard Lab
                </p>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-xs font-mono uppercase tracking-widest text-gray-600 hover:text-black"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div>
                <h3 className="font-display uppercase tracking-widest text-sm mb-2">What You Can Do</h3>
                <ul className="text-sm text-gray-700 font-sans space-y-2 list-disc list-inside">
                  <li>Build a materials board by browsing categories and adding items.</li>
                  <li>Generate a photorealistic moodboard render and download the image.</li>
                  <li>Create a Sustainability Briefing and download the PDF.</li>
                  <li>Download a Materials Sheet PDF for documentation or presentations.</li>
                  <li>Apply your palette to a sketch/photo, then edit or upscale the render.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-display uppercase tracking-widest text-sm mb-2">Quick Steps</h3>
                <ol className="text-sm text-gray-700 font-sans space-y-2 list-decimal list-inside">
                  <li>Go to `Materials`, search or browse, then click `Add to Board`.</li>
                  <li>Open `Workspace` and click `Create Moodboard`.</li>
                  <li>In the Sustainability Briefing section, review the summary and download PDFs.</li>
                  <li>Open `Render`, upload a JPG/PNG, then `Render with Upload` and refine.</li>
                </ol>
              </div>

              <div>
                <h3 className="font-display uppercase tracking-widest text-sm mb-2">Important Notes</h3>
                <ul className="text-sm text-gray-700 font-sans space-y-2 list-disc list-inside">
                  <li>Sign in may be required to add materials or generate images.</li>
                  <li>The `Render` tab unlocks only after you create a moodboard.</li>
                  <li>Generations are limited and reset on a schedule.</li>
                  <li>
                    AI-generated content must be used carefully. Verify materials, performance claims,
                    and sustainability insights with reliable sources before using in real projects.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
