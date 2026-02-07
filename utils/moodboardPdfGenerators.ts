/**
 * Extracted PDF generation functions from Moodboard.tsx
 *
 * Each function previously lived as a closure inside the Moodboard component
 * and accessed component state directly. They are now standalone exported
 * functions that receive all required data through typed parameter objects.
 */

import { jsPDF } from 'jspdf';
import {
  MATERIAL_LIFECYCLE_PROFILES,
  LifecycleStageKey,
} from '../lifecycleProfiles';
import { MaterialOption, MaterialCategory } from '../types';
import { buildMaterialFact } from '../data/materialFacts';
import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  SystemLevelSummary,
  ReportProse,
} from '../types/sustainability';
import { calculateMaterialMetrics } from './sustainabilityScoring';
import { detectSynergies, detectConflicts, generateNetStatement } from './synergyConflictRules';
import { validateInsights } from './qaValidation';
import { generateClientSummary } from './clientSummary';
import { isLandscapeMaterial } from './lifecycleDurations';
import { loadMaterialIcons } from './materialIconGenerator';
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
} from './pdfSections';
import {
  renderMaterialSheetHalf,
  renderMaterialSheetFooter,
  type MaterialPdfModel,
  type LifecycleKey,
} from './pdf/materialSheetHalf';
import type {
  SustainabilityBriefingResponse,
  SustainabilityBriefingPayload,
} from './sustainabilityBriefing';

// ---------------------------------------------------------------------------
// Constants (used only by generateSummaryPdf)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Param interfaces
// ---------------------------------------------------------------------------

/** Shape of the computed `sustainabilityPreview` value inside Moodboard. */
export interface SustainabilityPreview {
  snapshot: {
    summarySentence: string;
    highestImpact: string[];
    lowCarbonSystems: string[];
    actionPriorities: string[];
  };
  highlights: Array<{
    id: string;
    title: string;
    line: string;
  }>;
}

export interface SummaryPdfParams {
  board: MaterialOption[];
  insights: EnhancedSustainabilityInsight[];
  paletteSummary: string | null;
  sustainabilityPreview: SustainabilityPreview | null;
}

export interface ReportPdfParams {
  board: MaterialOption[];
  insights: EnhancedSustainabilityInsight[];
  paletteSummary: string | null;
  reportProse: ReportProse | null;
  moodboardRenderUrl: string | null;
  onProgress?: (step: string, percent: number) => void;
}

export interface BriefingPdfParams {
  sustainabilityBriefing: SustainabilityBriefingResponse;
  briefingPayload: SustainabilityBriefingPayload;
  board: MaterialOption[];
}

export interface MaterialsSheetPdfParams {
  board: MaterialOption[];
  projectName?: string;
}

// ---------------------------------------------------------------------------
// 1) generateSummaryPdf
// ---------------------------------------------------------------------------

export function generateSummaryPdf(params: SummaryPdfParams): jsPDF {
  const { board, insights, sustainabilityPreview } = params;

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const ctx = createPDFContext(doc);

  type SustainabilityInsight = EnhancedSustainabilityInsight;

  const insightById = new Map<string, SustainabilityInsight>();
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

  type BoardItem = MaterialOption;
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
}

// ---------------------------------------------------------------------------
// 2) generateReportPdf
// ---------------------------------------------------------------------------

export async function generateReportPdf(params: ReportPdfParams): Promise<jsPDF> {
  const { board, insights, paletteSummary, reportProse, moodboardRenderUrl, onProgress } = params;

  type SustainabilityInsight = EnhancedSustainabilityInsight;

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const ctx = createPDFContext(doc);
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
    paletteSummary
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
    paletteSummary,
    reportProse
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
    renderComplianceReadinessSummary(ctx, insights, board, reportProse);
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
}

// ---------------------------------------------------------------------------
// 3) generateBriefingPdf
// ---------------------------------------------------------------------------

export function generateBriefingPdf(params: BriefingPdfParams): jsPDF | null {
  const { sustainabilityBriefing, briefingPayload, board } = params;

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

  // Lifecycle section -- measure first, then draw once at the correct height.
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
      : 'No single stage dominates -- the palette has a balanced impact profile. ') +
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

  // Insight box -- anchored within the right column.
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
    items: Array<{ name: string; intensity: 'low' | 'medium' | 'high'; body: string; label: string }>,
    headingIcon?: (centerX: number, centerY: number, size: number, color?: RGB) => void,
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
    heroColumnData,
    drawLeafIcon,
  );

  const challengeUsed = drawMaterialColumn(
    marginX + materialColW + materialGridGap,
    'Challenge Materials',
    [249, 115, 22],
    [255, 247, 237],
    [254, 215, 170],
    [194, 65, 12],
    challengeColumnData,
    drawTriangleAlertIcon,
  );

  y += Math.max(heroUsed, challengeUsed) + sectionGap;

  // Synergies
  const briefingSynergies = sustainabilityBriefing.synergies || [];
  if (briefingSynergies.length > 0) {
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

    for (let index = 0; index < briefingSynergies.length; index += 2) {
      const left = briefingSynergies[index];
      const right = briefingSynergies[index + 1];
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
}

// ---------------------------------------------------------------------------
// 4) generateMaterialsSheetPdf
// ---------------------------------------------------------------------------

export async function generateMaterialsSheetPdf(
  params: MaterialsSheetPdfParams
): Promise<jsPDF | null> {
  const { board } = params;

  if (!board || board.length === 0) return null;

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const generatedOnText = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const buildRisks = (
    material: MaterialOption,
    confidence: 'High' | 'Medium' | 'Low'
  ): Array<{ risk: string; mitigation: string }> => {
    const risks: Array<{ risk: string; mitigation: string }> = [];

    if (material.carbonIntensity === 'high') {
      risks.push({
        risk: 'High embodied carbon intensity relative to alternatives.',
        mitigation: 'Investigate lower-carbon suppliers or recycled content options.',
      });
    }

    if (confidence === 'Low') {
      risks.push({
        risk: 'Lifecycle data confidence is low.',
        mitigation: 'Verify with supplier EPDs and updated project data.',
      });
    }

    return risks.slice(0, 2);
  };

  const iconMap = await prefetchMaterialIcons(
    board.filter((material) => !material.customImage).map((material) => material.id)
  );

  const models: MaterialPdfModel[] = await Promise.all(
    board.map(async (material) => {
      const fact = buildMaterialFact(material);
      const lifecycle = fact.lifecycle.scores as Record<LifecycleKey, number>;
      const lifecycleConfidence = fact.dataConfidence;

      let imageDataUri = material.customImage || iconMap.get(material.id);
      if (imageDataUri) {
        imageDataUri = await optimizeImageDataUriForPdf(imageDataUri, {
          maxDimension: 512,
          mimeType: 'image/jpeg',
          quality: 0.8,
        });
      }

      const imageCaption = material.finish || material.colorLabel || undefined;
      const epdAvailable = fact.epdStatus === 'Yes' ? true : fact.epdStatus === 'No' ? false : undefined;

      return {
        name: material.name,
        category: fact.systemRole,
        formVariant: fact.formVariant,
        carbonLabel:
          material.carbonIntensity === 'low'
            ? 'Low Carbon'
            : material.carbonIntensity === 'high'
            ? 'High Carbon'
            : 'Medium Carbon',
        imageDataUri,
        imageCaption,
        whatItIs: fact.whatItIs,
        typicalUses: fact.typicalUses,
        performanceNote: fact.performanceNote,
        lifecycle,
        hotspots: fact.lifecycle.hotspots as LifecycleKey[],
        strengths: fact.lifecycle.strengths as LifecycleKey[],
        lifecycleConfidence,
        lifecycleInsight: fact.insight,
        epdAvailable,
        epdStatus: fact.epdStatus,
        specActions: fact.actions,
        risks: buildRisks(material, lifecycleConfidence),
        healthRiskLevel: fact.healthRiskLevel,
        healthConcerns: fact.healthConcerns,
        healthNote: fact.healthNote,
      };
    })
  );

  models.forEach((material, index) => {
    if (index > 0 && index % 2 === 0) {
      doc.addPage();
    }

    renderMaterialSheetHalf(doc, material, {
      sheetIndex: (index % 2) as 0 | 1,
      generatedOnText,
    });
  });

  // If odd number of materials, render footer on last page (top material only)
  if (models.length % 2 === 1) {
    renderMaterialSheetFooter(doc, generatedOnText);
  }

  return doc;
}
