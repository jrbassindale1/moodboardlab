import type { MaterialOption } from '../../types';
import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  PDFContext,
  LifecycleStageKey,
  LifecycleProfile,
  TrafficLight,
} from '../../types/sustainability';
import { STAGE_LABELS } from '../designConsequences';
import { isLandscapeMaterial } from '../lifecycleDurations';
import { TRAFFIC_LIGHT_COLORS, ensureSpace } from './layout';
import { COMPLIANCE_BADGE_KEY, getComplianceStatus } from './pageCompliance';

export function renderLifecycleFingerprint(
  ctx: PDFContext,
  materialId: string,
  materialName: string,
  profile: LifecycleProfile | null,
  lowConfidence?: boolean
): void {
  if (!profile) {
    const materialText = `${materialId} ${materialName}`.toLowerCase();
    const proxyClass = materialText.includes('terracotta')
      ? 'Terracotta cladding'
      : materialText.includes('timber') || materialText.includes('wood')
      ? 'Timber system'
      : materialText.includes('aluminium') || materialText.includes('aluminum')
      ? 'Aluminium support system'
      : materialText.includes('steel') || materialText.includes('stair') || materialText.includes('tread')
      ? 'Steel stair system'
      : materialText.includes('rail') || materialText.includes('support')
      ? 'Metal support rails'
      : materialText.includes('glass') || materialText.includes('glazing')
      ? 'Glazing system'
      : 'Generic material system';

    const isMetal = materialText.includes('aluminium') || materialText.includes('aluminum') || materialText.includes('steel');
    const isCeramic = materialText.includes('terracotta') || materialText.includes('ceramic') || materialText.includes('clay');
    const isGlass = materialText.includes('glass') || materialText.includes('glazing');
    const isTimber = materialText.includes('timber') || materialText.includes('wood');

    const proxyProfile: LifecycleProfile = {
      raw: { impact: isTimber ? 2 : isMetal ? 4 : 3, confidence: 'low' },
      manufacturing: { impact: isTimber ? 2 : isMetal || isCeramic || isGlass ? 4 : 3, confidence: 'low' },
      transport: { impact: isCeramic || isGlass ? 3 : 2, confidence: 'low' },
      installation: { impact: 2, confidence: 'low' },
      inUse: { impact: 2, confidence: 'low' },
      maintenance: { impact: isTimber ? 3 : 2, confidence: 'low' },
      endOfLife: { impact: isTimber ? 2 : 3, confidence: 'low' },
    };

    const proxyLine = `Proxy lifecycle scores (very low confidence): RAW ${proxyProfile.raw.impact} | MFG ${proxyProfile.manufacturing.impact} | TRN ${proxyProfile.transport.impact} | INS ${proxyProfile.installation.impact} | USE ${proxyProfile.inUse.impact} | MNT ${proxyProfile.maintenance.impact} | EOL ${proxyProfile.endOfLife.impact}`;
    const cardWidth = ctx.pageWidth - ctx.margin * 2;
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    const scoreLines = ctx.doc.splitTextToSize(proxyLine, cardWidth - 16);
    const requestItems = [
      'Evidence key items: 1, 2, 3',
      'Supplier data for service life and maintenance assumptions',
    ];

    const cardHeight =
      8 + // top padding
      8 + // banner
      10 + // class line
      scoreLines.length * 9 +
      9 + // "What to request" label
      requestItems.length * 9 +
      6; // bottom padding

    ensureSpace(ctx, cardHeight + 8);

    // Card background
    ctx.doc.setFillColor(248, 248, 248);
    ctx.doc.setDrawColor(220, 220, 220);
    ctx.doc.roundedRect(ctx.margin, ctx.cursorY, cardWidth, cardHeight, 2, 2, 'FD');

    let y = ctx.cursorY + 8;

    // Banner
    ctx.doc.setFillColor(255, 240, 220);
    ctx.doc.roundedRect(ctx.margin + 6, y - 5, cardWidth - 12, 8, 2, 2, 'F');
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(160, 90, 0);
    ctx.doc.text('Profile missing: proxy scores used', ctx.margin + 10, y);
    ctx.doc.setTextColor(0);
    y += 10;

    // Typical class
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text(`Typical class: ${proxyClass}`, ctx.margin + 10, y);
    y += 10;

    // Proxy scores
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(90);
    scoreLines.forEach((line: string) => {
      ctx.doc.text(line, ctx.margin + 10, y);
      y += 9;
    });

    // What to request
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(80);
    ctx.doc.text('What to request:', ctx.margin + 10, y);
    y += 9;

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(80);
    requestItems.forEach((item) => {
      ctx.doc.text(`- ${item}`, ctx.margin + 14, y);
      y += 9;
    });

    ctx.doc.setTextColor(0);
    ctx.cursorY += cardHeight + 10;
    return;
  }

  ensureSpace(ctx, 50);

  // Material name (optional)
  if (materialName) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10);
    ctx.doc.text(materialName, ctx.margin, ctx.cursorY);
    ctx.cursorY += 14;
  } else {
    ctx.cursorY += 4;
  }

  // Draw fingerprint dots
  const stageKeys: Array<keyof LifecycleProfile> = [
    'raw',
    'manufacturing',
    'transport',
    'installation',
    'inUse',
    'maintenance',
    'endOfLife',
  ];
  const dotSize = 4;
  const dotGap = 2;
  const stageWidth = 50;
  const startX = ctx.margin;

  stageKeys.forEach((key, stageIndex) => {
    const stageData = profile[key];
    const xPos = startX + stageIndex * stageWidth;
    const label = STAGE_LABELS[key];

    // Stage label
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(7);
    ctx.doc.setTextColor(110);
    ctx.doc.text(label, xPos, ctx.cursorY);
    ctx.doc.setTextColor(0);

    // Draw dots (greyed out if overall low confidence)
    for (let i = 1; i <= 5; i++) {
      const dotX = xPos + (i - 1) * (dotSize + dotGap);
      const dotY = ctx.cursorY + 6 - dotSize / 2;
      const isFilled = i <= stageData.impact;

      if (isFilled) {
        if (lowConfidence) {
          // Overall low confidence - grey out all filled dots
          ctx.doc.setFillColor(200, 200, 200);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        } else if (stageData.confidence === 'low') {
          ctx.doc.setDrawColor(170);
          ctx.doc.setFillColor(245, 245, 245);
          ctx.doc.setLineWidth(0.5);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
        } else if (stageData.confidence === 'medium') {
          ctx.doc.setFillColor(140, 140, 140);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        } else {
          ctx.doc.setFillColor(70, 70, 70);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        }
      } else {
        ctx.doc.setDrawColor(220, 220, 220);
        ctx.doc.setFillColor(255, 255, 255);
        ctx.doc.setLineWidth(0.5);
        ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
      }
    }

    // Confidence indicator
    if (stageData.confidence === 'low' || stageData.confidence === 'medium') {
      ctx.doc.setFontSize(6);
      ctx.doc.setTextColor(120);
      ctx.doc.text('?', xPos + 5 * (dotSize + dotGap) + 2, ctx.cursorY + 7);
      ctx.doc.setTextColor(0);
    }
  });

  ctx.cursorY += 18;
}

/**
 * Palette context for material ranking
 */
export interface MaterialPaletteContext {
  rank: number; // 1 = highest embodied impact
  totalMaterials: number;
  contributionPercent: number; // Percentage of total embodied impact
  thumbnailDataUri?: string; // Optional material thumbnail
  isCarbonDominant?: boolean; // True if in top 3 contributors (>15% each)
}

/**
 * Cost/feasibility bands for practical implementation
 */
export interface PracticalityBands {
  costBand: '£' | '££' | '£££'; // Low / Medium / High relative cost
  buildComplexity: 'Low' | 'Medium' | 'Specialist';
  procurementRisk: 'Low' | 'Medium' | 'High';
}

/**
 * Estimate practicality bands based on material category and properties
 * This is a heuristic approach - actual costs vary by project
 */
export function estimatePracticalityBands(material: MaterialOption): PracticalityBands {
  // Cost bands by category (rough estimates)
  const costByCategory: Record<string, '£' | '££' | '£££'> = {
    'paint-wall': '£',
    'paint-ceiling': '£',
    'plaster': '£',
    'floor': '££',
    'tile': '££',
    'wallpaper': '£',
    'ceiling': '££',
    'acoustic-panel': '£££',
    'timber-slat': '££',
    'timber-panel': '££',
    'microcement': '£££',
    'window': '£££',
    'door': '££',
    'joinery': '£££',
    'structure': '£££',
    'external': '££',
    'external-ground': '££',
    'landscape': '£',
    'roof': '£££',
    'insulation': '££',
    'finish': '££',
    'wall-internal': '££',
    'soffit': '££',
    'balustrade': '£££',
    'exposed-structure': '££',
    'fixture': '££',
    'furniture': '££',
  };

  // Complexity by category
  const complexityByCategory: Record<string, 'Low' | 'Medium' | 'Specialist'> = {
    'paint-wall': 'Low',
    'paint-ceiling': 'Low',
    'plaster': 'Medium',
    'floor': 'Medium',
    'tile': 'Medium',
    'wallpaper': 'Low',
    'ceiling': 'Medium',
    'acoustic-panel': 'Medium',
    'timber-slat': 'Specialist',
    'timber-panel': 'Medium',
    'microcement': 'Specialist',
    'window': 'Specialist',
    'door': 'Low',
    'joinery': 'Specialist',
    'structure': 'Specialist',
    'external': 'Medium',
    'external-ground': 'Medium',
    'landscape': 'Low',
    'roof': 'Specialist',
    'insulation': 'Medium',
    'finish': 'Medium',
    'wall-internal': 'Medium',
    'soffit': 'Medium',
    'balustrade': 'Specialist',
    'exposed-structure': 'Specialist',
    'fixture': 'Low',
    'furniture': 'Low',
  };

  // Procurement risk by category
  const riskByCategory: Record<string, 'Low' | 'Medium' | 'High'> = {
    'paint-wall': 'Low',
    'paint-ceiling': 'Low',
    'plaster': 'Low',
    'floor': 'Medium',
    'tile': 'Medium',
    'wallpaper': 'Low',
    'ceiling': 'Low',
    'acoustic-panel': 'Medium',
    'timber-slat': 'Medium',
    'timber-panel': 'Medium',
    'microcement': 'High',
    'window': 'High',
    'door': 'Low',
    'joinery': 'High',
    'structure': 'High',
    'external': 'Medium',
    'external-ground': 'Low',
    'landscape': 'Low',
    'roof': 'High',
    'insulation': 'Low',
    'finish': 'Medium',
    'wall-internal': 'Medium',
    'soffit': 'Medium',
    'balustrade': 'High',
    'exposed-structure': 'High',
    'fixture': 'Low',
    'furniture': 'Medium',
  };

  // Check for custom material (higher risk)
  const isCustom = material.isCustom === true;

  return {
    costBand: costByCategory[material.category] || '££',
    buildComplexity: complexityByCategory[material.category] || 'Medium',
    procurementRisk: isCustom ? 'High' : (riskByCategory[material.category] || 'Medium'),
  };
}

/**
 * Render low confidence watermark/indicator
 */
function renderLowConfidenceIndicator(ctx: PDFContext, metrics: MaterialMetrics): void {
  if (!metrics.low_confidence_flag) return;

  // Draw subtle advisory note
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(170, 120, 0);
  ctx.doc.text('Note: Indicative only (low data confidence).', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;
  ctx.doc.setTextColor(0);
}

const STAGE_LONG_LABELS: Record<LifecycleStageKey, string> = {
  raw: 'Raw material',
  manufacturing: 'Manufacturing',
  transport: 'Transport',
  installation: 'Installation',
  inUse: 'In-use',
  maintenance: 'Maintenance',
  endOfLife: 'End of life',
};

function fitSingleLineText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ellipsis = '...';
  let trimmed = text;
  while (trimmed.length > 0 && doc.getTextWidth(`${trimmed}${ellipsis}`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed.trimEnd()}${ellipsis}`;
}

function decapitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getImpactCharacter(metrics?: MaterialMetrics): string {
  if (!metrics) return 'moderate';
  if (metrics.traffic_light === 'green') return 'low';
  if (metrics.traffic_light === 'amber') return 'moderate';
  return 'high';
}

function getContextFocus(material: MaterialOption, metrics?: MaterialMetrics): string {
  if (!metrics) return 'embodied carbon';
  if (isLandscapeMaterial(material)) return 'biodiversity and ecosystem performance';
  if (metrics.lifecycle_multiplier >= 2) return 'replacement-driven embodied carbon';
  const maxValue = Math.max(metrics.embodied_proxy, metrics.in_use_proxy, metrics.end_of_life_proxy);
  if (metrics.in_use_proxy === maxValue && metrics.in_use_proxy >= metrics.embodied_proxy + 0.3) {
    return 'in-use performance';
  }
  if (metrics.end_of_life_proxy === maxValue && metrics.end_of_life_proxy >= metrics.embodied_proxy + 0.3) {
    return 'end-of-life handling';
  }
  return 'embodied carbon';
}

function buildContextLine(material: MaterialOption, metrics?: MaterialMetrics): string {
  const focus = getContextFocus(material, metrics);
  return `In this palette, this material primarily affects: ${focus}.`;
}

function getComparativeCueLine(paletteContext?: MaterialPaletteContext): string | null {
  if (!paletteContext) return null;
  const { rank, totalMaterials } = paletteContext;
  if (!totalMaterials || totalMaterials <= 0) return null;
  const upperBand = Math.ceil(totalMaterials / 3);
  const midBand = Math.ceil((totalMaterials * 2) / 3);
  if (rank <= upperBand) return 'Above-average impact relative to palette.';
  if (rank <= midBand) return 'Mid-range impact relative to palette.';
  return 'Lower-impact relative to palette.';
}

function formatHotspotDriver(hotspot: Hotspot): string {
  const stageLabel = STAGE_LONG_LABELS[hotspot.stage] || 'Manufacturing';
  const reason = (hotspot.reason || '').trim();
  if (!reason) return stageLabel;
  const cleaned = reason.replace(/[.]+$/, '');
  const objectMatch = cleaned.match(
    /^(processing|manufacturing|transport|installation|use|maintenance|end of life|raw material|raw)\s+of\s+(.+)/i
  );
  if (objectMatch) {
    return `${stageLabel} of ${objectMatch[2]}`;
  }
  return cleaned;
}

function buildMaterialSummaryLine(
  material: MaterialOption,
  insight: EnhancedSustainabilityInsight | undefined,
  metrics: MaterialMetrics | undefined
): string {
  const roleSource = material.finish || material.description || material.name;
  let role = roleSource.split(/[.;]/)[0].trim();
  if (!role) role = material.name;
  role = capitalizeFirst(role);
  const impactLabel = getImpactCharacter(metrics);
  const drivers: string[] = [];

  if (insight?.hotspots?.length) {
    drivers.push(decapitalize(formatHotspotDriver(insight.hotspots[0])));
  }

  if (metrics && !isLandscapeMaterial(material) && metrics.lifecycle_multiplier > 1) {
    drivers.push('repeat replacement');
  }

  if (drivers.length === 0) {
    drivers.push('manufacturing');
  }

  const driverText = drivers.slice(0, 2).join(' and ');
  return `${role} with ${impactLabel} embodied impact, driven by ${driverText}.`;
}

function buildLifecycleDrivers(
  material: MaterialOption,
  insight: EnhancedSustainabilityInsight | undefined,
  metrics: MaterialMetrics | undefined
): string[] {
  const primaryDriver = insight?.hotspots?.length ? formatHotspotDriver(insight.hotspots[0]) : '';
  let replacementClause = '';

  if (metrics) {
    const lifeText = metrics.service_life >= 100 ? '100+ year' : `${metrics.service_life}-year`;
    const multiplier = Math.round(metrics.lifecycle_multiplier * 10) / 10;
    if (isLandscapeMaterial(material)) {
      replacementClause = `establishment and maintenance factor (${multiplier}x over 60 years)`;
    } else if (metrics.lifecycle_multiplier > 1) {
      const replText =
        Number.isInteger(multiplier)
          ? `${multiplier} replacements over 60 years`
          : `${multiplier}x over 60 years`;
      replacementClause = `${lifeText} service life with ${replText}`;
    } else {
      replacementClause = `${lifeText} service life over the building life`;
    }
  }

  if (primaryDriver && replacementClause) {
    return [`${primaryDriver}, combined with ${replacementClause}.`];
  }
  if (primaryDriver) return [`${primaryDriver}.`];
  if (replacementClause) return [`${replacementClause}.`];
  return [];
}

function normalizeDesignAction(text: string): string {
  const cleaned = text.trim().replace(/[.;]+$/, '');
  const lower = cleaned.toLowerCase();
  const isImperative = /^(use|design|specify|select|choose|avoid|reduce|minimise|minimize|limit|source|prioritise|prioritize|standardise|standardize|detail|ensure|allow|enable|plan|provide|target|optimize|optimise|prefer|reuse|demount|disassemble|size|set|keep|replace|shift)\b/.test(
    lower
  );
  if (isImperative) return capitalizeFirst(cleaned);
  if (lower.startsWith('to ')) return `Use ${cleaned.slice(3)}`;
  return `Use ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

function getDeliveryComplexityLabel(
  bands: ReturnType<typeof estimatePracticalityBands>
): 'Low' | 'Moderate' | 'High' {
  const costScore = bands.costBand === '£' ? 1 : bands.costBand === '££' ? 2 : 3;
  const buildScore = bands.buildComplexity === 'Low' ? 1 : bands.buildComplexity === 'Medium' ? 2 : 3;
  const procurementScore =
    bands.procurementRisk === 'Low' ? 1 : bands.procurementRisk === 'Medium' ? 2 : 3;
  const avg = (costScore + buildScore + procurementScore) / 3;
  if (avg <= 1.4) return 'Low';
  if (avg <= 2.3) return 'Moderate';
  return 'High';
}

function buildDesignOpportunity(
  insight: EnhancedSustainabilityInsight | undefined,
  material: MaterialOption
): string | null {
  const benefits = insight?.benefits || [];
  if (benefits.length === 0) {
    if (isLandscapeMaterial(material)) {
      return 'Design opportunity: supports biodiversity uplift and site performance.';
    }
    return null;
  }

  const topBenefit = [...benefits].sort((a, b) => b.score_1to5 - a.score_1to5)[0];
  if (!topBenefit || topBenefit.score_1to5 < 3) return null;

  let phrase = '';
  switch (topBenefit.type) {
    case 'biodiversity':
      phrase = 'supports biodiversity uplift and habitat value.';
      break;
    case 'sequestration':
      phrase = 'supports long-term carbon storage.';
      break;
    case 'circularity':
      phrase = 'supports demountable and reuse strategies.';
      break;
    case 'durability':
      phrase = 'supports longer-life finishes and fewer replacements.';
      break;
    case 'operational_carbon':
      phrase = 'supports operational energy performance.';
      break;
    case 'health_voc':
      phrase = 'supports healthier indoor air quality.';
      break;
    default:
      phrase = 'supports low-impact detailing strategies.';
      break;
  }

  return `Design opportunity: ${phrase}`;
}

function renderComplianceBadges(
  ctx: PDFContext,
  insight: EnhancedSustainabilityInsight,
  material: MaterialOption
): void {
  ensureSpace(ctx, 20);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(80);
  ctx.doc.text('Compliance badges (see readiness key):', ctx.margin, ctx.cursorY);
  ctx.cursorY += 10;
  ctx.doc.setTextColor(0);

  const startX = ctx.margin + 4;
  const centerY = ctx.cursorY;
  const radius = 6;
  const isLandscape = material.category === 'landscape' || material.category === 'external-ground';

  COMPLIANCE_BADGE_KEY.forEach(({ key, code }, idx) => {
    const x = startX + idx * 22;
    let status: TrafficLight | 'na' = 'amber';
    if (key === 'biodiversity' && !isLandscape) {
      status = 'na';
    } else {
      status = getComplianceStatus(insight, material, key);
    }

    if (status === 'na') {
      ctx.doc.setFillColor(230, 230, 230);
      ctx.doc.circle(x, centerY, radius, 'F');
      ctx.doc.setTextColor(140);
    } else {
      const [r, g, b] = TRAFFIC_LIGHT_COLORS[status];
      ctx.doc.setFillColor(r, g, b);
      ctx.doc.circle(x, centerY, radius, 'F');
      ctx.doc.setTextColor(status === 'amber' ? 0 : 255);
    }

    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(7);
    ctx.doc.text(code, x, centerY + 2, { align: 'center' });
    ctx.doc.setTextColor(0);
  });

  ctx.cursorY += 12;
}

/**
 * Render enhanced material section with design consequences
 */
export function renderEnhancedMaterialSection(
  ctx: PDFContext,
  material: MaterialOption,
  insight: EnhancedSustainabilityInsight | undefined,
  metrics: MaterialMetrics | undefined,
  profile: LifecycleProfile | null,
  paletteContext?: MaterialPaletteContext
): void {
  const slotHeight = (ctx.pageHeight - ctx.margin * 2) / 2;
  const topSlotY = ctx.margin;
  const bottomSlotY = ctx.margin + slotHeight;
  const isNear = (a: number, b: number) => Math.abs(a - b) < 2;

  if (!isNear(ctx.cursorY, topSlotY) && !isNear(ctx.cursorY, bottomSlotY)) {
    ctx.doc.addPage();
    ctx.cursorY = topSlotY;
  }

  const slotTop = isNear(ctx.cursorY, bottomSlotY) ? bottomSlotY : topSlotY;
  const slotBottom = slotTop + slotHeight;

  // Dashed separator between the two halves
  const midY = bottomSlotY;
  ctx.doc.setDrawColor(210);
  ctx.doc.setLineWidth(0.5);
  const docAny = ctx.doc as unknown as { setLineDash?: (dash: number[], phase: number) => void };
  if (docAny.setLineDash) {
    docAny.setLineDash([2, 2], 0);
  }
  ctx.doc.line(ctx.margin, midY, ctx.pageWidth - ctx.margin, midY);
  if (docAny.setLineDash) {
    docAny.setLineDash([], 0);
  }

  const contentWidth = ctx.pageWidth - ctx.margin * 2;
  const leftWidth = contentWidth * 0.3;
  const gutter = 8;
  const rightWidth = contentWidth - leftWidth - gutter;
  const leftX = ctx.margin;
  const rightX = ctx.margin + leftWidth + gutter;

  const headerY = slotTop + 12;

  // Header: material name + badges
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(0);
  ctx.doc.text(material.name, leftX, headerY);

  const isLandscape = material.category === 'landscape' || material.category === 'external-ground';
  const badgeRadius = 3.5;
  const badgeGap = 4;
  const badgesWidth =
    COMPLIANCE_BADGE_KEY.length * badgeRadius * 2 + (COMPLIANCE_BADGE_KEY.length - 1) * badgeGap;
  const badgeStartX = ctx.pageWidth - ctx.margin - badgesWidth;
  const badgeCenterY = headerY - 2;

  COMPLIANCE_BADGE_KEY.forEach(({ key, code }, idx) => {
    const x = badgeStartX + idx * (badgeRadius * 2 + badgeGap) + badgeRadius;
    let status: TrafficLight | 'na' = 'amber';
    if (key === 'biodiversity' && !isLandscape) {
      status = 'na';
    } else if (insight) {
      status = getComplianceStatus(insight, material, key);
    }

    if (status === 'na') {
      ctx.doc.setFillColor(230, 230, 230);
      ctx.doc.circle(x, badgeCenterY, badgeRadius, 'F');
      ctx.doc.setTextColor(150);
    } else {
      const [r, g, b] = TRAFFIC_LIGHT_COLORS[status];
      ctx.doc.setFillColor(r, g, b);
      ctx.doc.circle(x, badgeCenterY, badgeRadius, 'F');
      ctx.doc.setTextColor(status === 'amber' ? 0 : 255);
    }

    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(6);
    ctx.doc.text(code, x, badgeCenterY + 2, { align: 'center' });
    ctx.doc.setTextColor(0);
  });

  const contentTop = headerY + 8;
  const thumbnailSize = 40;
  let thumbnailRendered = false;

  if (paletteContext?.thumbnailDataUri) {
    try {
      ctx.doc.addImage(
        paletteContext.thumbnailDataUri,
        'PNG',
        leftX,
        contentTop,
        thumbnailSize,
        thumbnailSize
      );
      thumbnailRendered = true;
    } catch (e) {
      console.warn('Failed to add material thumbnail to PDF:', e);
    }
  }

  if (!thumbnailRendered && material.tone) {
    try {
      const hex = material.tone.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      ctx.doc.setFillColor(r, g, b);
      ctx.doc.setDrawColor(220, 220, 220);
      ctx.doc.setLineWidth(0.5);
      ctx.doc.rect(leftX, contentTop, thumbnailSize, thumbnailSize, 'FD');
      thumbnailRendered = true;
    } catch (e) {
      console.warn('Failed to draw color swatch:', e);
    }
  }

  if (!thumbnailRendered) {
    ctx.doc.setFillColor(243, 244, 246);
    ctx.doc.setDrawColor(220, 220, 220);
    ctx.doc.setLineWidth(0.5);
    ctx.doc.rect(leftX, contentTop, thumbnailSize, thumbnailSize, 'FD');
  }

  // Compact fingerprint (left column)
  const fingerprintTop = contentTop + thumbnailSize + 6;
  const stageKeys: Array<keyof LifecycleProfile> = [
    'raw',
    'manufacturing',
    'transport',
    'installation',
    'inUse',
    'maintenance',
    'endOfLife',
  ];
  const lineHeight = 7;
  const dotSize = 2.8;
  const dotGap = 1.4;
  const labelWidth = 18;
  const dotsStartX = leftX + labelWidth;

  if (!profile) {
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(6);
    ctx.doc.setTextColor(150);
    ctx.doc.text('Fingerprint unavailable', leftX, fingerprintTop + 6);
    ctx.doc.setTextColor(0);
  } else {
    stageKeys.forEach((key, stageIndex) => {
      const stageData = profile[key];
      const lineY = fingerprintTop + stageIndex * lineHeight;

      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(6);
      ctx.doc.setTextColor(120);
      ctx.doc.text(STAGE_LABELS[key], leftX, lineY);
      ctx.doc.setTextColor(0);

      for (let i = 1; i <= 5; i++) {
        const dotX = dotsStartX + (i - 1) * (dotSize + dotGap);
        const dotY = lineY - dotSize + 2;
        const isFilled = i <= stageData.impact;

        if (isFilled) {
          if (metrics?.low_confidence_flag) {
            ctx.doc.setFillColor(200, 200, 200);
            ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
          } else if (stageData.confidence === 'low') {
            ctx.doc.setDrawColor(170);
            ctx.doc.setFillColor(245, 245, 245);
            ctx.doc.setLineWidth(0.5);
            ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
          } else if (stageData.confidence === 'medium') {
            ctx.doc.setFillColor(140, 140, 140);
            ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
          } else {
            ctx.doc.setFillColor(70, 70, 70);
            ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
          }
        } else {
          ctx.doc.setDrawColor(220, 220, 220);
          ctx.doc.setFillColor(255, 255, 255);
          ctx.doc.setLineWidth(0.5);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
        }
      }

      if (stageData.confidence === 'low' || stageData.confidence === 'medium') {
        ctx.doc.setFontSize(5);
        ctx.doc.setTextColor(140);
        ctx.doc.text('?', dotsStartX + 5 * (dotSize + dotGap) + 2, lineY);
        ctx.doc.setTextColor(0);
      }
    });
  }

  // Right column: summary + design actions
  let rightY = contentTop;
  const summaryText = `In this palette: ${buildMaterialSummaryLine(material, insight, metrics)}`;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(40);
  let summaryLines = ctx.doc.splitTextToSize(summaryText, rightWidth);
  if (summaryLines.length > 2) {
    summaryLines = summaryLines.slice(0, 2);
    summaryLines[1] = fitSingleLineText(ctx.doc, summaryLines[1], rightWidth);
  }
  summaryLines.forEach((line: string) => {
    ctx.doc.text(line, rightX, rightY);
    rightY += 10;
  });
  ctx.doc.setTextColor(0);
  rightY += 2;

  const compliancePhrase = /(epd|en 15804|iso 14025|fsc|pefc|chain of custody|certification|certificate)/i;
  const filteredLevers = insight?.designLevers
    ? insight.designLevers.filter((lever) => !compliancePhrase.test(lever))
    : [];
  let actions = filteredLevers.map((lever) => normalizeDesignAction(lever)).slice(0, 2);

  const actionHeaderSize = 8;
  const actionBodySize = 8;
  const actionPad = 6;
  const actionIndent = 6;
  const actionWidth = rightWidth - actionPad * 2 - actionIndent;
  const lineHeightAction = 9;
  let actionLinesPerItem = actions.map((action) =>
    ctx.doc.splitTextToSize(action, actionWidth).slice(0, 2)
  );

  const computeActionBoxHeight = (linesPerItem: string[][]) => {
    const bodyLineCount = linesPerItem.reduce((sum, lines) => sum + lines.length, 0);
    const bodyHeight =
      actions.length === 0
        ? lineHeightAction
        : bodyLineCount * lineHeightAction + (actions.length - 1) * 2;
    return actionPad + actionHeaderSize + 4 + bodyHeight + actionPad;
  };

  const footerTextY = slotBottom - 6;
  const maxBoxHeight = footerTextY - 8 - rightY;
  let actionBoxHeight = computeActionBoxHeight(actionLinesPerItem);

  if (actionBoxHeight > maxBoxHeight && actions.length > 1) {
    actions = actions.slice(0, 1);
    actionLinesPerItem = actions.map((action) =>
      ctx.doc.splitTextToSize(action, actionWidth).slice(0, 1)
    );
    actionBoxHeight = computeActionBoxHeight(actionLinesPerItem);
  }

  if (actionBoxHeight > maxBoxHeight && actions.length === 1) {
    actionLinesPerItem = actions.map((action) => [fitSingleLineText(ctx.doc, action, actionWidth)]);
    actionBoxHeight = computeActionBoxHeight(actionLinesPerItem);
  }

  ctx.doc.setFillColor(243, 244, 246);
  ctx.doc.roundedRect(rightX, rightY, rightWidth, actionBoxHeight, 2, 2, 'F');

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(actionHeaderSize);
  ctx.doc.setTextColor(80);
  ctx.doc.text('Design actions', rightX + actionPad, rightY + actionPad + actionHeaderSize);

  let actionTextY = rightY + actionPad + actionHeaderSize + 4;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(actionBodySize);
  ctx.doc.setTextColor(60);

  if (actions.length === 0) {
    ctx.doc.text('No actions yet', rightX + actionPad, actionTextY);
    actionTextY += lineHeightAction;
  } else {
    actions.forEach((action, idx) => {
      const lines = actionLinesPerItem[idx] || [];
      ctx.doc.text('-', rightX + actionPad, actionTextY);
      lines.forEach((line: string, lineIndex: number) => {
        ctx.doc.text(line, rightX + actionPad + actionIndent, actionTextY + lineIndex * lineHeightAction);
      });
      actionTextY += lines.length * lineHeightAction + 2;
    });
  }
  ctx.doc.setTextColor(0);

  // Footer line and metadata
  ctx.doc.setDrawColor(229, 231, 235);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, footerTextY - 4, ctx.pageWidth - ctx.margin, footerTextY - 4);

  const rankText = paletteContext
    ? `Carbon rank: #${paletteContext.rank} of ${paletteContext.totalMaterials}`
    : 'Carbon rank: n/a';
  const deliveryComplexity = getDeliveryComplexityLabel(estimatePracticalityBands(material));
  const practicalityText = `Practicality: ${deliveryComplexity}`;

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(110);
  ctx.doc.text(rankText, ctx.margin, footerTextY);
  ctx.doc.text(practicalityText, ctx.pageWidth - ctx.margin, footerTextY, { align: 'right' });
  ctx.doc.setTextColor(0);

  ctx.cursorY = slotTop === topSlotY ? bottomSlotY : topSlotY;
  if (slotTop === bottomSlotY) {
    ctx.doc.addPage();
    ctx.cursorY = topSlotY;
  }
}

/**
 * Add disclaimer footer
 */
