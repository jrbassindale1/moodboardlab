// PDF section renderers
// Modular functions for rendering each section of the sustainability report

import type { jsPDF } from 'jspdf';
import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  SystemLevelSummary,
  ClientSummary,
  TrafficLight,
  PDFContext,
  Hotspot,
  LifecycleProfile,
  CarbonPaybackCategory,
} from '../types/sustainability';
import type { MaterialOption } from '../types';
import { STAGE_LABELS } from './designConsequences';
import { getCircularityIndicator, formatScore, LANDSCAPE_CARBON_CAP_HARD } from './sustainabilityScoring';
import { isLandscapeMaterial } from './lifecycleDurations';

// PDF constants
const MARGIN = 48;
const TRAFFIC_LIGHT_COLORS: Record<TrafficLight, [number, number, number]> = {
  green: [34, 139, 34],
  amber: [255, 191, 0],
  red: [220, 53, 69],
};
const PAYBACK_CATEGORY_LABELS: Record<CarbonPaybackCategory, string> = {
  biogenic_storage: 'Biogenic storage',
  operational_offset: 'Operational offset',
  ecosystem_sequestration: 'Ecosystem sequestration',
};

/**
 * Fetch a static icon and convert to data URI for PDF embedding
 * Tries webp first, then falls back to png
 */
export async function fetchIconAsDataUri(materialId: string): Promise<string | null> {
  const formats = ['webp', 'png'];

  for (const format of formats) {
    try {
      const response = await fetch(`/icons/${materialId}.${format}`);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // Try next format
    }
  }
  return null;
}

/**
 * Pre-fetch icons for multiple materials (for PDF generation)
 */
export async function prefetchMaterialIcons(
  materialIds: string[]
): Promise<Map<string, string>> {
  const iconMap = new Map<string, string>();

  await Promise.all(
    materialIds.map(async (id) => {
      const dataUri = await fetchIconAsDataUri(id);
      if (dataUri) {
        iconMap.set(id, dataUri);
      }
    })
  );

  return iconMap;
}

/**
 * Create a new PDF context
 */
export function createPDFContext(doc: jsPDF): PDFContext {
  return {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    cursorY: MARGIN,
    margin: MARGIN,
  };
}

/**
 * Ensure space on page, add new page if needed
 */
export function ensureSpace(ctx: PDFContext, needed: number): void {
  if (ctx.cursorY + needed > ctx.pageHeight - ctx.margin) {
    ctx.doc.addPage();
    ctx.cursorY = ctx.margin;
  }
}

/**
 * Add a heading to the PDF
 */
function addHeading(ctx: PDFContext, text: string, size = 16): void {
  ensureSpace(ctx, size * 1.6);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  ctx.doc.text(text, ctx.margin, ctx.cursorY);
  ctx.cursorY += size + 10;
}

/**
 * Add a paragraph to the PDF
 */
function addParagraph(ctx: PDFContext, text: string, size = 11, gap = 8): void {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  const maxWidth = ctx.pageWidth - ctx.margin * 2;
  const lines = ctx.doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string) => {
    ensureSpace(ctx, size * 1.2);
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += size + 4;
  });
  ctx.cursorY += gap;
}

/**
 * Add a bullet point
 */
function addBullet(ctx: PDFContext, text: string, size = 10): void {
  ensureSpace(ctx, size * 1.4);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  const maxWidth = ctx.pageWidth - ctx.margin * 2 - 15;
  const lines = ctx.doc.splitTextToSize(text, maxWidth);
  ctx.doc.text('-', ctx.margin, ctx.cursorY);
  lines.forEach((line: string, i: number) => {
    ctx.doc.text(line, ctx.margin + 12, ctx.cursorY + i * (size + 3));
  });
  ctx.cursorY += lines.length * (size + 3) + 4;
}

/**
 * Draw a traffic light indicator
 */
function drawTrafficLight(
  ctx: PDFContext,
  x: number,
  y: number,
  status: TrafficLight,
  radius = 5
): void {
  const [r, g, b] = TRAFFIC_LIGHT_COLORS[status];
  ctx.doc.setFillColor(r, g, b);
  ctx.doc.circle(x, y, radius, 'F');
}

type ComplianceKey =
  | 'epd'
  | 'recycled'
  | 'fixings'
  | 'biodiversity'
  | 'certification';

const COMPLIANCE_BADGE_KEY: Array<{ key: ComplianceKey; code: string; label: string }> = [
  { key: 'epd', code: '1', label: 'EPD (EN 15804 / ISO 14025)' },
  { key: 'recycled', code: '2', label: 'Recycled content declaration' },
  { key: 'fixings', code: '3', label: 'Design for disassembly / reversible fixings' },
  { key: 'certification', code: '4', label: 'Chain of custody certification (FSC/PEFC)' },
  { key: 'biodiversity', code: '5', label: 'Biodiversity assessment (landscape only)' },
];

// ============== PAGE RENDERERS ==============

/**
 * Render Page 1: Client Summary
 */
export function renderClientSummaryPage(
  ctx: PDFContext,
  summary: ClientSummary
): void {
  // Brand header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(100);
  ctx.doc.text('MOODBOARD-LAB.COM', ctx.pageWidth - ctx.margin, ctx.cursorY, {
    align: 'right',
  });
  ctx.cursorY += 15;

  // Title
  ctx.doc.setTextColor(0);
  addHeading(ctx, 'Sustainability Summary', 20);
  ctx.cursorY += 5;

  // What this palette achieves
  addHeading(ctx, 'What this palette achieves', 13);
  summary.achievements.forEach((achievement) => {
    addBullet(ctx, achievement, 11);
  });
  ctx.cursorY += 10;

  // Key risks and mitigations
  addHeading(ctx, 'Key risks and how we mitigate', 13);
  summary.risks_and_mitigations.forEach((risk) => {
    addBullet(ctx, risk, 11);
  });
  ctx.cursorY += 10;

  // Evidence priorities
  addHeading(ctx, 'Evidence priorities', 13);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(80);
  const evidenceLines = ctx.doc.splitTextToSize(
    'See Compliance Readiness Summary for prioritised evidence items and badge key.',
    ctx.pageWidth - ctx.margin * 2
  );
  evidenceLines.forEach((line: string) => {
    ensureSpace(ctx, 12);
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });
  ctx.doc.setTextColor(0);
  ctx.cursorY += 10;

  // Confidence statement
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(80);
  const confLines = ctx.doc.splitTextToSize(
    summary.confidence_statement,
    ctx.pageWidth - ctx.margin * 2
  );
  confLines.forEach((line: string) => {
    ensureSpace(ctx, 12);
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });
  ctx.doc.setTextColor(0);
}

/**
 * Render Page 2: Comparative Dashboard
 */
export function renderComparativeDashboard(
  ctx: PDFContext,
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  // Header
  addHeading(ctx, 'Material Comparison Dashboard', 16);
  ctx.cursorY += 5;

  // ===== CARBON DOMINANT COMPONENTS CALLOUT =====
  // Identify materials contributing >15% of total embodied carbon
  // IMPORTANT: Landscape materials are EXCLUDED from this callout
  // because they use a different carbon model (regenerative, not industrial)
  const totalEmbodied = Array.from(metrics.values()).reduce(
    (sum, m) => sum + m.embodied_proxy,
    0
  );

  // Calculate landscape contribution for capping purposes
  let landscapeEmbodied = 0;
  materials.forEach((mat) => {
    if (isLandscapeMaterial(mat)) {
      const metric = metrics.get(mat.id);
      if (metric) landscapeEmbodied += metric.embodied_proxy;
    }
  });
  const landscapePercent = totalEmbodied > 0 ? (landscapeEmbodied / totalEmbodied) * 100 : 0;
  const landscapeCapped = landscapePercent > LANDSCAPE_CARBON_CAP_HARD * 100;

  // Only include INDUSTRIAL materials (not landscape) as carbon dominants
  const carbonDominants: { material: MaterialOption; percent: number }[] = [];
  materials.forEach((mat) => {
    // CRITICAL: Landscape materials cannot be "carbon dominant components"
    if (isLandscapeMaterial(mat)) return;

    const metric = metrics.get(mat.id);
    if (metric && totalEmbodied > 0) {
      const percent = (metric.embodied_proxy / totalEmbodied) * 100;
      if (percent >= 15) {
        carbonDominants.push({ material: mat, percent });
      }
    }
  });

  if (carbonDominants.length > 0) {
    // Draw attention box
    ctx.doc.setFillColor(255, 245, 238); // Light orange background
    ctx.doc.setDrawColor(220, 53, 69);
    ctx.doc.setLineWidth(1);
    const boxHeight = 15 + carbonDominants.length * 12;
    ctx.doc.roundedRect(ctx.margin, ctx.cursorY, ctx.pageWidth - ctx.margin * 2, boxHeight, 3, 3, 'FD');

    ctx.cursorY += 12;
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(220, 53, 69);
    ctx.doc.text('CARBON DOMINANT COMPONENTS - act here first:', ctx.margin + 8, ctx.cursorY);
    ctx.cursorY += 12;

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(0);
    carbonDominants.forEach(({ material, percent }) => {
      ctx.doc.text(`- ${material.name} (${percent.toFixed(0)}% of palette embodied carbon)`, ctx.margin + 15, ctx.cursorY);
      ctx.cursorY += 12;
    });
    ctx.cursorY += 4;
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(7);
    ctx.doc.setTextColor(90);
    ctx.doc.text(
      'Percentages reflect normalized early-stage weighting rather than detailed quantity take-offs.',
      ctx.margin + 15,
      ctx.cursorY
    );
    ctx.doc.setTextColor(0);
    ctx.cursorY += 10;
  }

  // Show landscape cap note if landscape contribution was significant
  if (landscapeCapped) {
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(100);
    ctx.doc.text(
      `Note: Landscape systems (${landscapePercent.toFixed(0)}% raw) capped at ${LANDSCAPE_CARBON_CAP_HARD * 100}% to prevent distortion without quantities.`,
      ctx.margin,
      ctx.cursorY
    );
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  // ===== TABLE 1: Impact & Rating =====
  addHeading(ctx, 'Impact Assessment', 12);

  const impactColWidths = [120, 55, 50, 45, 45, 45, 45];
  const impactHeaders = ['Material', 'Embodied', 'In-use', 'EOL', 'Benefit', 'Conf.', 'Rating'];
  const tableStartX = ctx.margin;

  // Table header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(60);
  let xPos = tableStartX;
  impactHeaders.forEach((header, i) => {
    ctx.doc.text(header, xPos, ctx.cursorY);
    xPos += impactColWidths[i];
  });
  ctx.cursorY += 12;

  // Header line
  ctx.doc.setDrawColor(180);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.cursorY - 5, ctx.pageWidth - ctx.margin, ctx.cursorY - 5);

  // Table rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(0);

  materials.forEach((material) => {
    ensureSpace(ctx, 14);
    const metric = metrics.get(material.id);
    if (!metric) return;

    xPos = tableStartX;

    // Material name (truncated)
    const truncatedName = material.name.length > 18 ? material.name.substring(0, 16) + '...' : material.name;
    ctx.doc.text(truncatedName, xPos, ctx.cursorY);
    xPos += impactColWidths[0];

    // Scores
    ctx.doc.text(formatScore(metric.embodied_proxy), xPos, ctx.cursorY);
    xPos += impactColWidths[1];

    ctx.doc.text(formatScore(metric.in_use_proxy), xPos, ctx.cursorY);
    xPos += impactColWidths[2];

    ctx.doc.text(formatScore(metric.end_of_life_proxy), xPos, ctx.cursorY);
    xPos += impactColWidths[3];

    ctx.doc.text(formatScore(metric.benefit_score), xPos, ctx.cursorY);
    xPos += impactColWidths[4];

    // Confidence
    const confPercent = Math.round(metric.confidence_score * 100);
    ctx.doc.text(`${confPercent}%`, xPos, ctx.cursorY);
    xPos += impactColWidths[5];

    // Traffic light
    drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, metric.traffic_light, 4);

    ctx.cursorY += 13;
  });

  // ===== TABLE 2: Lifecycle & Durability =====
  ctx.cursorY += 15;
  addHeading(ctx, 'Lifecycle & Durability', 12);

  const lifecycleColWidths = [120, 65, 70, 65, 100];
  const lifecycleHeaders = ['Material', 'Service Life', 'Replacements*', 'Circularity', 'Carbon Payback'];

  // Table header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(60);
  xPos = tableStartX;
  lifecycleHeaders.forEach((header, i) => {
    ctx.doc.text(header, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[i];
  });
  ctx.cursorY += 12;

  // Header line
  ctx.doc.line(ctx.margin, ctx.cursorY - 5, ctx.pageWidth - ctx.margin, ctx.cursorY - 5);

  // Table rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(0);

  materials.forEach((material) => {
    ensureSpace(ctx, 14);
    const metric = metrics.get(material.id);
    if (!metric) return;

    xPos = tableStartX;

    // Material name
    const truncatedName = material.name.length > 18 ? material.name.substring(0, 16) + '...' : material.name;
    ctx.doc.text(truncatedName, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[0];

    // Service life
    const lifeText = metric.service_life >= 100 ? '100+ years' : `${metric.service_life} years`;
    ctx.doc.text(lifeText, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[1];

    // Replacement cycles (over 60-year building life)
    // Landscape materials show "establishment + maintenance" not "replacements"
    const isLandscape = isLandscapeMaterial(material);
    const isPartial = !Number.isInteger(metric.lifecycle_multiplier);
    const replValue = metric.lifecycle_multiplier.toString();
    let replText: string;
    if (isLandscape) {
      replText = `${replValue}x (est. + maint.)`; // Landscape: establishment + maintenance
    } else if (metric.lifecycle_multiplier === 1) {
      replText = '1x (full life)';
    } else {
      replText = `${replValue}x${isPartial ? ' (partial system)' : ''}`;
    }
    ctx.doc.text(replText, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[2];

    // Circularity indicator
    const circ = getCircularityIndicator(metric.end_of_life_proxy);
    const circText = circ === 'high' ? 'High' : circ === 'medium' ? 'Medium' : 'Low';
    ctx.doc.text(circText, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[3];

    // Carbon payback
    if (metric.carbon_payback) {
      const payback = metric.carbon_payback;
      const paybackText = payback.years === 0
        ? 'Immediate'
        : payback.rangeYears
        ? `~${payback.rangeYears[0]}-${payback.rangeYears[1]} years`
        : `~${payback.years} years`;
      // Color code based on payback
      if (payback.years === 0) {
        ctx.doc.setTextColor(34, 139, 34); // Green
      } else if (payback.years <= 5) {
        ctx.doc.setTextColor(0, 128, 0);
      }
      ctx.doc.text(paybackText, xPos, ctx.cursorY);
      ctx.doc.setTextColor(0);
    } else {
      ctx.doc.setTextColor(150);
      ctx.doc.text('No payback claim', xPos, ctx.cursorY);
      ctx.doc.setTextColor(0);
    }

    ctx.cursorY += 13;
  });

  // Legend
  ctx.cursorY += 12;
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(80);
  ctx.doc.text(
    '* Industrial materials: Replacements = how many times installed over 60-year building life.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 10;
  ctx.doc.text(
    '* Landscape materials: "est. + maint." = establishment + maintenance factor (~1.8x), NOT full replacements. Re-seeding ≠ re-manufacturing.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 10;
  ctx.doc.text(
    'Carbon Payback: refers to biogenic storage, operational offsets, or ecosystem sequestration (depending on material type). If none, we show "No payback claim".',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 10;
  ctx.doc.text(
    'Rating: Green = low impact + env. benefit | Amber = moderate | Red = embodied >=3.6 or high impact. Landscape rated on ecosystem benefits.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 10;
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.text(
    'Note: Landscape contributions capped at 10% of palette carbon in early-stage mode (without quantities). Ecosystem benefits not captured in embodied metrics.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.doc.setTextColor(0);
}

/**
 * Render Page 3: System-Level Summary
 */
export function renderSystemSummaryPage(
  ctx: PDFContext,
  summary: SystemLevelSummary,
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'System-Level Analysis', 16);
  ctx.cursorY += 5;

  // Palette Strategy section
  addHeading(ctx, 'Palette Strategy', 13);

  // Top embodied materials
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.text('Highest embodied carbon:', ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

  ctx.doc.setFont('helvetica', 'normal');
  summary.top_embodied_items.slice(0, 3).forEach((id) => {
    const mat = materials.find((m) => m.id === id);
    if (mat) {
      ctx.doc.text(`  - ${mat.name}`, ctx.margin + 10, ctx.cursorY);
      ctx.cursorY += 12;
    }
  });

  if (summary.top_embodied_items.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('  No high-embodied materials identified', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  ctx.cursorY += 8;

  // Top environmental benefit materials (biodiversity, sequestration, operational savings)
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text('Highest environmental benefit:', ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

  ctx.doc.setFont('helvetica', 'normal');
  const envBenefitItems: MaterialOption[] = [];
  const functionalBenefitItems: MaterialOption[] = [];
  summary.top_benefit_items.slice(0, 3).forEach((id) => {
    const mat = materials.find((m) => m.id === id);
    const metric = metrics.get(id);
    if (!mat || !metric) return;
    const isLandscape = mat.category === 'landscape' || mat.category === 'external-ground';
    const isEnvironmental =
      metric.environmental_benefit_score >= 2 &&
      (isLandscape || (metric.embodied_proxy <= 2.8 && metric.end_of_life_proxy <= 3.5));
    if (isEnvironmental) {
      envBenefitItems.push(mat);
    } else {
      functionalBenefitItems.push(mat);
    }
  });

  envBenefitItems.forEach((mat) => {
    ctx.doc.text(`  - ${mat.name}`, ctx.margin + 10, ctx.cursorY);
    ctx.cursorY += 12;
  });

  if (envBenefitItems.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('  No materials with significant environmental benefits', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  if (functionalBenefitItems.length > 0) {
    ctx.cursorY += 6;
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Highest functional benefit (daylight / spatial flexibility, durability):', ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;

    ctx.doc.setFont('helvetica', 'normal');
    functionalBenefitItems.forEach((mat) => {
      ctx.doc.text(`  - ${mat.name}`, ctx.margin + 10, ctx.cursorY);
      ctx.cursorY += 12;
    });
  }

  // Net statement
  ctx.cursorY += 10;
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(10);
  const netLines = ctx.doc.splitTextToSize(
    summary.net_statement,
    ctx.pageWidth - ctx.margin * 2
  );
  netLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });

  // Synergies section
  ctx.cursorY += 15;
  addHeading(ctx, 'Synergies', 13);

  if (summary.synergies.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No synergies detected in current palette', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 15;
  } else {
    summary.synergies.forEach((synergy) => {
      ensureSpace(ctx, 30);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(10);
      ctx.doc.setTextColor(34, 139, 34); // Green
      ctx.doc.text(`SYNERGY: ${synergy.type.toUpperCase()}`, ctx.margin, ctx.cursorY);
      ctx.doc.setTextColor(0);
      ctx.cursorY += 12;

      ctx.doc.setFont('helvetica', 'normal');
      const descLines = ctx.doc.splitTextToSize(
        synergy.description,
        ctx.pageWidth - ctx.margin * 2 - 15
      );
      descLines.forEach((line: string) => {
        ctx.doc.text(line, ctx.margin + 15, ctx.cursorY);
        ctx.cursorY += 11;
      });
      ctx.cursorY += 5;
    });
  }

  // Watch-outs section
  ctx.cursorY += 10;
  addHeading(ctx, 'Watch-outs', 13);

  if (summary.conflicts.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No conflicts detected in current palette', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 15;
  } else {
    summary.conflicts.forEach((conflict) => {
      ensureSpace(ctx, 45);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(10);
      ctx.doc.setTextColor(220, 53, 69); // Red
      ctx.doc.text(`WATCH-OUT: ${conflict.type.toUpperCase()}`, ctx.margin, ctx.cursorY);
      ctx.doc.setTextColor(0);
      ctx.cursorY += 12;

      ctx.doc.setFont('helvetica', 'normal');
      const descLines = ctx.doc.splitTextToSize(
        conflict.description,
        ctx.pageWidth - ctx.margin * 2 - 15
      );
      descLines.forEach((line: string) => {
        ctx.doc.text(line, ctx.margin + 15, ctx.cursorY);
        ctx.cursorY += 11;
      });

      if (conflict.mitigation) {
        ctx.doc.setTextColor(80);
        ctx.doc.setFont('helvetica', 'italic');
        ctx.doc.text(`Mitigation: ${conflict.mitigation}`, ctx.margin + 15, ctx.cursorY);
        ctx.doc.setTextColor(0);
        ctx.cursorY += 11;
      }
      ctx.cursorY += 5;
    });
  }
}

/**
 * Design recommendation for the Design Direction page
 */
export interface DesignRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'reduce' | 'replace' | 'specify' | 'keep';
  recommendationId: string;
  action: string;
  rationale: string;
  driver: string;
  materialIds?: string[]; // Related materials
}

/**
 * Generate design recommendations from palette analysis
 */
export function generateDesignRecommendations(
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>,
  insights: EnhancedSustainabilityInsight[]
): DesignRecommendation[] {
  const recommendations: DesignRecommendation[] = [];
  const totalEmbodied = Array.from(metrics.values()).reduce(
    (sum, m) => sum + m.embodied_proxy,
    0
  );
  const categoryCaps: Record<DesignRecommendation['category'], number> = {
    replace: 2,
    specify: 3,
    reduce: 2,
    keep: 2,
  };

  // Sort materials by embodied impact
  const sortedByEmbodied = [...materials].sort((a, b) => {
    const metricA = metrics.get(a.id);
    const metricB = metrics.get(b.id);
    return (metricB?.embodied_proxy || 0) - (metricA?.embodied_proxy || 0);
  });
  const rankMap = new Map<string, number>();
  sortedByEmbodied.forEach((mat, idx) => {
    rankMap.set(mat.id, idx + 1);
  });

  const buildDriver = (materialIds?: string[]): string => {
    if (!materialIds || materialIds.length === 0) {
      return 'Driver: data limited';
    }
    const candidates = materialIds
      .map((id) => ({ id, metric: metrics.get(id) }))
      .filter((entry) => entry.metric);
    const primary = candidates.sort(
      (a, b) => (b.metric?.embodied_proxy || 0) - (a.metric?.embodied_proxy || 0)
    )[0];
    if (!primary?.metric) return 'Driver: data limited';
    const rank = rankMap.get(primary.id);
    const rankText = rank ? `#${rank} embodied contributor` : 'embodied contributor';
    const replacements = primary.metric.lifecycle_multiplier;
    const replacementText = `${replacements} replacement${replacements === 1 ? '' : 's'}`;
    const circularity = getCircularityIndicator(primary.metric.end_of_life_proxy);
    const circularityText = `${circularity} circularity`;
    return `Driver: ${rankText} + ${replacementText} + ${circularityText}`;
  };

  // Check for carbon dominant components (>15%)
  sortedByEmbodied.forEach((mat) => {
    const metric = metrics.get(mat.id);
    if (!metric || totalEmbodied === 0) return;
    const percent = (metric.embodied_proxy / totalEmbodied) * 100;

    if (percent >= 20) {
      // Major contributor - suggest reduction or replacement
      if (mat.category === 'floor') {
        recommendations.push({
          priority: 'high',
          category: 'reduce',
          recommendationId: `reduce-floor-${mat.id}`,
          action: `Limit ${mat.name.toLowerCase()} to high-traffic zones only`,
          rationale: `Currently ${percent.toFixed(0)}% of palette embodied carbon`,
          driver: buildDriver([mat.id]),
          materialIds: [mat.id],
        });
      } else if (mat.category === 'external' || mat.category === 'wall-internal') {
        recommendations.push({
          priority: 'high',
          category: 'replace',
          recommendationId: `replace-${mat.id}`,
          action: `Consider bio-based alternatives to ${mat.name.toLowerCase()}`,
          rationale: `High embodied carbon (${percent.toFixed(0)}% of total)`,
          driver: buildDriver([mat.id]),
          materialIds: [mat.id],
        });
      } else if (mat.category === 'external-ground') {
        recommendations.push({
          priority: 'high',
          category: 'reduce',
          recommendationId: `reduce-hardscape-${mat.id}`,
          action: 'Reduce hard landscape area by 20-30%',
          rationale: `Hard landscape contributing ${percent.toFixed(0)}% of palette carbon`,
          driver: buildDriver([mat.id]),
          materialIds: [mat.id],
        });
      }
    }
  });

  // Check for glazing without disassembly - consolidate into single recommendation
  const glazingMaterials = materials.filter(
    (m) => m.category === 'window' || m.name.toLowerCase().includes('glass')
  );
  const glazingWithoutDisassembly = glazingMaterials.filter((mat) => {
    const insight = insights.find((i) => i.id === mat.id);
    const hasDisassembly = insight?.ukChecks?.some(
      (c) => c.label.toLowerCase().includes('mechanical') || c.label.toLowerCase().includes('demount')
    );
    return !hasDisassembly;
  });
  if (glazingWithoutDisassembly.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'specify',
      recommendationId: 'specify-demountable-glazing',
      action: 'Replace frameless glazing with modular demountable system',
      rationale: `Enables future reuse and reduces lifetime impact (${glazingWithoutDisassembly.length} glazing element${glazingWithoutDisassembly.length > 1 ? 's' : ''})`,
      driver: buildDriver(glazingWithoutDisassembly.map((m) => m.id)),
      materialIds: glazingWithoutDisassembly.map((m) => m.id),
    });
  }

  // Check for multiple high-maintenance materials
  const highMaintenance = materials.filter((m) => {
    const metric = metrics.get(m.id);
    return metric && metric.in_use_proxy >= 3;
  });
  if (highMaintenance.length >= 3) {
    recommendations.push({
      priority: 'medium',
      category: 'reduce',
      recommendationId: 'reduce-maintenance-complexity',
      action: 'Consolidate finishes to reduce maintenance complexity',
      rationale: `${highMaintenance.length} materials require significant maintenance`,
      driver: buildDriver(highMaintenance.map((m) => m.id)),
      materialIds: highMaintenance.map((m) => m.id),
    });
  }

  // Check for low-circularity materials
  const lowCircularity = materials.filter((m) => {
    const metric = metrics.get(m.id);
    return metric && metric.end_of_life_proxy >= 4;
  });
  lowCircularity.forEach((mat) => {
    recommendations.push({
      priority: 'medium',
      category: 'specify',
      recommendationId: `specify-fixings-${mat.id}`,
      action: `Specify mechanical fixings for ${mat.name}`,
      rationale: 'Enables disassembly and material recovery',
      driver: buildDriver([mat.id]),
      materialIds: [mat.id],
    });
  });

  // Bio-based alternatives for high-embodied structure
  const structuralMaterials = materials.filter(
    (m) => m.category === 'wall-internal' || m.category === 'roof' || m.category === 'structure' || m.category === 'external'
  );
  const highEmbodiedStructure = structuralMaterials.filter((m) => {
    const metric = metrics.get(m.id);
    return metric && metric.embodied_proxy >= 3;
  });
  if (highEmbodiedStructure.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'replace',
      recommendationId: 'replace-bio-based-structure',
      action: 'Prioritise hempcrete, rammed earth, or mass timber in envelope',
      rationale: 'Bio-based materials store carbon rather than emit it',
      driver: buildDriver(highEmbodiedStructure.map((m) => m.id)),
      materialIds: highEmbodiedStructure.map((m) => m.id),
    });
  }

  // Deduplicate by recommendationId
  const seen = new Set<string>();
  const deduped = recommendations.filter((rec) => {
    if (seen.has(rec.recommendationId)) return false;
    seen.add(rec.recommendationId);
    return true;
  });

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  deduped.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Cap per type
  const counts: Record<DesignRecommendation['category'], number> = {
    replace: 0,
    specify: 0,
    reduce: 0,
    keep: 0,
  };
  const capped: DesignRecommendation[] = [];
  deduped.forEach((rec) => {
    const cap = categoryCaps[rec.category];
    if (counts[rec.category] < cap) {
      counts[rec.category] += 1;
      capped.push(rec);
    }
  });

  return capped; // Apply caps instead of total count
}

/**
 * Render Design Direction Page
 */
export function renderDesignDirectionPage(
  ctx: PDFContext,
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>,
  insights: EnhancedSustainabilityInsight[]
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'Design Direction', 16);
  ctx.cursorY += 5;

  // Introductory text
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(80);
  ctx.doc.text(
    'Recommended adjustments based on palette analysis. Address high-priority items first.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 18;
  ctx.doc.setTextColor(0);

  // Generate recommendations
  const recommendations = generateDesignRecommendations(materials, metrics, insights);

  if (recommendations.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No specific design adjustments recommended for this palette.', ctx.margin, ctx.cursorY);
    ctx.cursorY += 15;
    ctx.doc.text('Continue with evidence collection and specification refinement.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    return;
  }

  // Category icons
  const categoryLabels: Record<string, string> = {
    reduce: 'REDUCE',
    replace: 'REPLACE',
    specify: 'SPECIFY',
    keep: 'KEEP',
  };

  // Render recommendations
  recommendations.forEach((rec) => {
    ensureSpace(ctx, 50);

    // Priority indicator
    const priorityColors: Record<string, [number, number, number]> = {
      high: [220, 53, 69],
      medium: [255, 191, 0],
      low: [34, 139, 34],
    };
    const [r, g, b] = priorityColors[rec.priority];

    // Draw priority badge
    ctx.doc.setFillColor(r, g, b);
    ctx.doc.circle(ctx.margin + 8, ctx.cursorY, 4, 'F');

    // Category tag
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(100);
    ctx.doc.text(categoryLabels[rec.category], ctx.margin + 18, ctx.cursorY + 2);

    ctx.cursorY += 12;

    // Action text
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(0);
    const actionLines = ctx.doc.splitTextToSize(rec.action, ctx.pageWidth - ctx.margin * 2 - 20);
    actionLines.forEach((line: string) => {
      ctx.doc.text(line, ctx.margin + 5, ctx.cursorY);
      ctx.cursorY += 12;
    });

    // Rationale
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(80);
    ctx.doc.text(rec.rationale, ctx.margin + 5, ctx.cursorY);
    ctx.cursorY += 12;

    // Driver
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(100);
    ctx.doc.text(rec.driver, ctx.margin + 5, ctx.cursorY);
    ctx.cursorY += 14;

    ctx.doc.setTextColor(0);
  });

  // Legend
  ctx.cursorY += 10;
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(80);

  const legendY = ctx.cursorY;
  ctx.doc.setFillColor(220, 53, 69);
  ctx.doc.circle(ctx.margin + 5, legendY - 2, 3, 'F');
  ctx.doc.text('High priority', ctx.margin + 12, legendY);

  ctx.doc.setFillColor(255, 191, 0);
  ctx.doc.circle(ctx.margin + 80, legendY - 2, 3, 'F');
  ctx.doc.text('Medium priority', ctx.margin + 87, legendY);

  ctx.doc.setFillColor(34, 139, 34);
  ctx.doc.circle(ctx.margin + 175, legendY - 2, 3, 'F');
  ctx.doc.text('Low priority', ctx.margin + 182, legendY);

  ctx.doc.setTextColor(0);
}

/**
 * Compliance helpers (concept-stage readiness)
 */
/**
 * Determine compliance status for a category
 * Returns: green (evidence available), amber (evidence required), red (risk/non-compliant)
 */
function getComplianceStatus(
  insight: EnhancedSustainabilityInsight,
  material: MaterialOption,
  category: ComplianceKey
): TrafficLight {
  const ukChecks = insight.ukChecks || [];
  const benefits = insight.benefits || [];
  const risks = insight.risks || [];

  // Check for explicit status in ukChecks
  const relevantCheck = ukChecks.find((c) => {
    const label = c.label.toLowerCase();
    switch (category) {
      case 'epd':
        return (
          c.standard_code?.includes('EN 15804') ||
          c.standard_code?.includes('ISO 14025') ||
          label.includes('epd') ||
          label.includes('environmental product declaration')
        );
      case 'recycled':
        return (
          label.includes('recycled') ||
          label.includes('reclaimed') ||
          label.includes('secondary')
        );
      case 'fixings':
        return (
          label.includes('mechanical') ||
          label.includes('demountable') ||
          label.includes('disassembly') ||
          label.includes('reversible')
        );
      case 'biodiversity':
        return (
          label.includes('biodiversity') ||
          label.includes('habitat') ||
          label.includes('native')
        );
      case 'certification':
        return (
          c.standard_code?.includes('FSC') ||
          c.standard_code?.includes('PEFC') ||
          label.includes('certified') ||
          label.includes('chain of custody')
        );
      default:
        return false;
    }
  });

  // If ukCheck has explicit status, use it
  if (relevantCheck?.status) {
    return relevantCheck.status;
  }

  // Check for risks that would flag red
  const hasRisk = risks.some((r) => {
    const note = r.note?.toLowerCase() || '';
    switch (category) {
      case 'epd':
        return note.includes('no epd') || note.includes('unverified');
      case 'recycled':
        return note.includes('virgin') || note.includes('non-recycled');
      case 'fixings':
        return (
          note.includes('adhesive') ||
          note.includes('bonded') ||
          note.includes('composite')
        );
      case 'certification':
        return note.includes('uncertified') || note.includes('illegal');
      default:
        return false;
    }
  });

  if (hasRisk) return 'red';

  // Biodiversity special handling
  if (category === 'biodiversity') {
    if (material.category !== 'landscape' && material.category !== 'external-ground') {
      return 'amber'; // Not applicable shown as amber for non-landscape
    }
    const hasBioBenefit = benefits.some((b) => b.type === 'biodiversity' && b.score_1to5 >= 3);
    if (hasBioBenefit) return 'green';
    const hasAnyBio = benefits.some((b) => b.type === 'biodiversity');
    if (hasAnyBio) return 'amber';
    return 'red'; // Landscape without biodiversity consideration is a gap
  }

  // If we found a relevant check (without explicit status), it's at least being tracked
  if (relevantCheck) {
    // Check if the label suggests it's verified/available
    const label = relevantCheck.label.toLowerCase();
    if (
      label.includes('verified') ||
      label.includes('confirmed') ||
      label.includes('available') ||
      label.includes('compliant')
    ) {
      return 'green';
    }
    // Check being tracked but not yet verified
    return 'amber';
  }

  // Nothing found - evidence required
  return 'amber';
}

export function renderComplianceReadinessSummary(
  ctx: PDFContext,
  insights: EnhancedSustainabilityInsight[],
  materials: MaterialOption[]
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'Compliance Readiness Summary (UK)', 16);
  ctx.cursorY += 4;

  // Intro (concept-stage framing)
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(80);
  const introLines = ctx.doc.splitTextToSize(
    'Concept-stage view: highlights real risk items, evidence priorities, and what can safely wait. Detailed checks appear as badges on material pages.',
    ctx.pageWidth - ctx.margin * 2
  );
  introLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;
  });
  ctx.doc.setTextColor(0);
  ctx.cursorY += 6;

  const stats = new Map<ComplianceKey, { red: number; amber: number; green: number; na: number }>();
  COMPLIANCE_BADGE_KEY.forEach(({ key }) => {
    stats.set(key, { red: 0, amber: 0, green: 0, na: 0 });
  });

  const redMaterials: Array<{ name: string; codes: string[] }> = [];

  insights.forEach((insight) => {
    const material = materials.find((m) => m.id === insight.id);
    if (!material) return;

    const codes: string[] = [];
    const isLandscape = material.category === 'landscape' || material.category === 'external-ground';

    COMPLIANCE_BADGE_KEY.forEach(({ key, code }) => {
      const bucket = stats.get(key);
      if (!bucket) return;

      if (key === 'biodiversity' && !isLandscape) {
        bucket.na += 1;
        return;
      }

      const status = getComplianceStatus(insight, material, key);
      bucket[status] += 1;
      if (status === 'red') codes.push(code);
    });

    if (codes.length > 0) {
      redMaterials.push({ name: material.name, codes });
    }
  });

  // 1) Real risks
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.text('1) Real risks', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);

  if (redMaterials.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('No red-flag compliance risks identified at concept stage.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  } else {
    redMaterials.slice(0, 4).forEach((item) => {
      ensureSpace(ctx, 12);
      ctx.doc.text(`- ${item.name} (codes ${item.codes.join(', ')})`, ctx.margin, ctx.cursorY);
      ctx.cursorY += 12;
    });
  }

  ctx.cursorY += 6;

  // 2) Evidence to prioritise next
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.text('2) Evidence to prioritise next', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;

  const priority = COMPLIANCE_BADGE_KEY.map(({ key, code }) => {
    const bucket = stats.get(key);
    const total = bucket ? bucket.red + bucket.amber : 0;
    return { code, total };
  })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  if (priority.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('No evidence gaps flagged across the palette.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  } else {
    priority.slice(0, 3).forEach((item) => {
      ctx.doc.text(`- Code ${item.code}: ${item.total} material${item.total > 1 ? 's' : ''} flagged`, ctx.margin, ctx.cursorY);
      ctx.cursorY += 12;
    });
  }

  ctx.cursorY += 6;

  // 3) What can safely wait
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.text('3) Can safely wait (concept stage)', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;

  const deferCodes = COMPLIANCE_BADGE_KEY.filter(({ key }) => {
    const bucket = stats.get(key);
    if (!bucket) return false;
    return bucket.red + bucket.amber === 0 && bucket.green > 0;
  }).map(({ code }) => code);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  if (deferCodes.length > 0) {
    ctx.doc.text(`- Codes ${deferCodes.join(', ')} show no current gaps across the palette`, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  } else {
    ctx.doc.setTextColor(100);
    ctx.doc.text('Defer supplier-specific certificates and test reports to detailed specification.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  ctx.cursorY += 6;

  // Out of scope note
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(100);
  const outScopeLines = ctx.doc.splitTextToSize(
    'Out of scope at concept stage: supplier test reports, product-level verification of claims, construction-phase method statements, commissioning evidence.',
    ctx.pageWidth - ctx.margin * 2
  );
  outScopeLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 10;
  });
  ctx.doc.setTextColor(0);
  ctx.cursorY += 6;

  // Badge key (listed once)
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.text('Badge key (used on material pages):', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  COMPLIANCE_BADGE_KEY.forEach(({ code, label }) => {
    ctx.doc.text(`${code}. ${label}`, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });
}

/**
 * Render lifecycle fingerprint visualization
 */
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
    ctx.doc.text('PROFILE MISSING - PROXY USED', ctx.margin + 10, y);
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

  // Material name
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.text(materialName, ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

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
    ctx.doc.setTextColor(80);
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
          ctx.doc.setFillColor(180, 180, 180);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        } else if (stageData.confidence === 'low') {
          ctx.doc.setDrawColor(100);
          ctx.doc.setFillColor(255, 255, 255);
          ctx.doc.setLineWidth(0.5);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
        } else if (stageData.confidence === 'medium') {
          ctx.doc.setFillColor(150, 150, 150);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        } else {
          ctx.doc.setFillColor(0, 0, 0);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        }
      } else {
        ctx.doc.setDrawColor(200, 200, 200);
        ctx.doc.setFillColor(255, 255, 255);
        ctx.doc.setLineWidth(0.5);
        ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
      }
    }

    // Confidence indicator
    if (stageData.confidence === 'low' || stageData.confidence === 'medium') {
      ctx.doc.setFontSize(6);
      ctx.doc.text('?', xPos + 5 * (dotSize + dotGap) + 2, ctx.cursorY + 7);
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

  // Draw "INDICATIVE ONLY" watermark
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(180, 130, 0);
  ctx.doc.text('NOTE: INDICATIVE ONLY - low data confidence', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;
  ctx.doc.setTextColor(0);
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
  ensureSpace(ctx, 140);

  // Material thumbnail (if available) or color swatch fallback
  const thumbnailSize = 50;
  let contentStartX = ctx.margin;
  let thumbnailRendered = false;

  if (paletteContext?.thumbnailDataUri) {
    try {
      ctx.doc.addImage(
        paletteContext.thumbnailDataUri,
        'PNG',
        ctx.margin,
        ctx.cursorY,
        thumbnailSize,
        thumbnailSize
      );
      contentStartX = ctx.margin + thumbnailSize + 10;
      thumbnailRendered = true;
    } catch (e) {
      console.warn('Failed to add material thumbnail to PDF:', e);
    }
  }

  // Fallback: Draw colored swatch using material.tone
  if (!thumbnailRendered && material.tone) {
    try {
      // Parse hex color to RGB
      const hex = material.tone.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Draw color swatch with border
      ctx.doc.setFillColor(r, g, b);
      ctx.doc.setDrawColor(200, 200, 200);
      ctx.doc.setLineWidth(0.5);
      ctx.doc.roundedRect(ctx.margin, ctx.cursorY, thumbnailSize, thumbnailSize, 2, 2, 'FD');
      contentStartX = ctx.margin + thumbnailSize + 10;
      thumbnailRendered = true;
    } catch (e) {
      console.warn('Failed to draw color swatch:', e);
    }
  }

  // Material name header (next to thumbnail if present)
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(12);
  ctx.doc.text(material.name, contentStartX, ctx.cursorY + 8);

  // Category tag
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(100);
  ctx.doc.text(`[${material.category}]`, contentStartX, ctx.cursorY + 18);
  ctx.doc.setTextColor(0);

  // Move cursor past thumbnail area
  if (thumbnailRendered) {
    ctx.cursorY += thumbnailSize + 10;
  } else {
    ctx.cursorY += 25;
  }

  // Low confidence indicator (if applicable)
  if (metrics?.low_confidence_flag) {
    renderLowConfidenceIndicator(ctx, metrics);
  }

  // Lifecycle fingerprint (moved below header)
  renderLifecycleFingerprint(ctx, material.id, '', profile, metrics?.low_confidence_flag); // Empty name since we already rendered it

  // Palette context box (NEW) - shows ranking and contribution
  if (paletteContext && metrics) {
    // CARBON DOMINANT badge if applicable
    // CRITICAL: Landscape materials NEVER show as "carbon dominant" - conceptually wrong
    const showCarbonDominant = paletteContext.isCarbonDominant && !isLandscapeMaterial(material);
    if (showCarbonDominant) {
      ctx.doc.setFillColor(255, 245, 238);
      ctx.doc.setDrawColor(220, 53, 69);
      ctx.doc.setLineWidth(1);
      ctx.doc.roundedRect(ctx.margin, ctx.cursorY - 4, 180, 14, 2, 2, 'FD');
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(220, 53, 69);
      ctx.doc.text('CARBON DOMINANT COMPONENT - act here first', ctx.margin + 4, ctx.cursorY + 5);
      ctx.cursorY += 18;
    }

    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);

    // Color code based on ranking
    if (paletteContext.rank <= 2) {
      ctx.doc.setTextColor(220, 53, 69); // Red for top 2
    } else if (paletteContext.rank <= Math.ceil(paletteContext.totalMaterials / 2)) {
      ctx.doc.setTextColor(180, 130, 0); // Amber for upper half
    } else {
      ctx.doc.setTextColor(34, 139, 34); // Green for lower half
    }

    // Ranking text
    const rankText = `#${paletteContext.rank} of ${paletteContext.totalMaterials} by embodied carbon`;
    ctx.doc.text(rankText, ctx.margin, ctx.cursorY);

    // Contribution percentage
    const contribText = `(${paletteContext.contributionPercent.toFixed(0)}% of palette total)`;
    ctx.doc.text(contribText, ctx.margin + 150, ctx.cursorY);

    ctx.doc.setTextColor(0);
    ctx.cursorY += 14;

    // Traffic light indicator with dynamic reason
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    drawTrafficLight(ctx, ctx.margin, ctx.cursorY - 3, metrics.traffic_light, 4);
    // Use the specific reason from scoring, or fall back to generic
    const ratingLabel = metrics.traffic_light_reason || (
      metrics.traffic_light === 'green'
        ? 'Low impact'
        : metrics.traffic_light === 'amber'
        ? 'Moderate impact - review design levers'
        : 'High impact - consider alternatives'
    );
    ctx.doc.text(ratingLabel, ctx.margin + 15, ctx.cursorY);
    ctx.cursorY += 12;
  }

  if (insight) {
    renderComplianceBadges(ctx, insight, material);
  }

  if (!insight) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No sustainability insights available', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 20;
    return;
  }

  // Headline
  if (insight.headline) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    addParagraph(ctx, insight.headline, 10, 6);
  }

  // Lifecycle metrics box (NEW)
  if (metrics) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(80);

    // Service life and replacements/maintenance
    const lifeText = metrics.service_life >= 100 ? '100+' : String(metrics.service_life);
    const matIsLandscape = isLandscapeMaterial(material);
    const isPartialSystem = !Number.isInteger(metrics.lifecycle_multiplier);
    const replValue = metrics.lifecycle_multiplier.toString();
    let replText: string;
    if (matIsLandscape) {
      replText = `${replValue}x establishment + maintenance factor`;
    } else if (metrics.lifecycle_multiplier === 1) {
      replText = 'full building life';
    } else {
      replText = `${replValue}x over 60 years${isPartialSystem ? ' (partial system)' : ''}`;
    }
    ctx.doc.text(`Service life: ${lifeText} years (${replText})`, ctx.margin, ctx.cursorY);

    // Carbon payback / claim
    const paybackNote = metrics.carbon_payback_note;
    let paybackText: string;
    if (metrics.carbon_payback) {
      const payback = metrics.carbon_payback;
      const categoryLabel = PAYBACK_CATEGORY_LABELS[payback.category];
      const isEcosystem = payback.category === 'ecosystem_sequestration';
      if (payback.years === 0) {
        paybackText = isEcosystem
          ? `Potential sequestration over time (${categoryLabel})`
          : `Carbon payback: Immediate (${categoryLabel})`;
      } else if (payback.rangeYears) {
        const prefix = isEcosystem ? 'Potential sequestration over time' : 'Typical carbon payback';
        paybackText = `${prefix}: ~${payback.rangeYears[0]}-${payback.rangeYears[1]} years (${payback.assumption})`;
      } else {
        const prefix = isEcosystem ? 'Potential sequestration over time' : 'Carbon payback';
        paybackText = `${prefix}: ~${payback.years} years (${payback.assumption})`;
      }
      ctx.doc.setTextColor(34, 100, 34);
    } else {
      paybackText = `Carbon payback: No payback claim${paybackNote ? ` (${paybackNote})` : ''}`;
      ctx.doc.setTextColor(120);
    }
    ctx.cursorY += 10;
    ctx.doc.text(paybackText, ctx.margin, ctx.cursorY);

    ctx.doc.setTextColor(0);
    ctx.cursorY += 14;
  }

  // Practicality bands (cost, complexity, procurement risk)
  const bands = estimatePracticalityBands(material);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(100);

  // Cost band
  const costLabel = bands.costBand === '£' ? 'Low cost' : bands.costBand === '££' ? 'Medium cost' : 'High cost';
  ctx.doc.text(costLabel, ctx.margin, ctx.cursorY);

  // Build complexity
  const complexityLabel = `Build: ${bands.buildComplexity}`;
  ctx.doc.text(complexityLabel, ctx.margin + 80, ctx.cursorY);

  // Procurement risk
  const riskColor: [number, number, number] =
    bands.procurementRisk === 'Low' ? [34, 139, 34] :
    bands.procurementRisk === 'Medium' ? [180, 130, 0] : [220, 53, 69];
  ctx.doc.setTextColor(...riskColor);
  ctx.doc.text(`Procurement: ${bands.procurementRisk}`, ctx.margin + 160, ctx.cursorY);
  ctx.doc.setTextColor(0);
  ctx.cursorY += 14;

  // Hotspots with reasons
  if (insight.hotspots && insight.hotspots.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text('Hotspots:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;

    ctx.doc.setFont('helvetica', 'normal');
    insight.hotspots.forEach((hotspot: Hotspot) => {
      const label = STAGE_LABELS[hotspot.stage];
      ctx.doc.setTextColor(220, 53, 69);
      ctx.doc.text(`${label} (${hotspot.score}):`, ctx.margin + 10, ctx.cursorY);
      ctx.doc.setTextColor(0);
      ctx.doc.text(` ${hotspot.reason}`, ctx.margin + 50, ctx.cursorY);
      ctx.cursorY += 11;
    });
    ctx.cursorY += 4;
  }

  // Design Risk / Response (NEW)
  if (insight.design_risk || insight.design_response) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(100);

    if (insight.design_risk) {
      ctx.doc.text(insight.design_risk, ctx.margin, ctx.cursorY);
      ctx.cursorY += 11;
    }
    if (insight.design_response) {
      ctx.doc.setTextColor(34, 139, 34);
      ctx.doc.text(insight.design_response, ctx.margin, ctx.cursorY);
      ctx.cursorY += 11;
    }
    ctx.doc.setTextColor(0);
    ctx.cursorY += 4;
  }

  // Design Levers (filter out compliance-evidence phrasing; handled via badges)
  const compliancePhrase = /(epd|en 15804|iso 14025|fsc|pefc|chain of custody|certification|certificate)/i;
  const filteredLevers = insight.designLevers
    ? insight.designLevers.filter((lever) => !compliancePhrase.test(lever))
    : [];

  if (filteredLevers.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text('Design Levers:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;

    ctx.doc.setFont('helvetica', 'normal');
    filteredLevers.slice(0, 4).forEach((lever) => {
      addBullet(ctx, lever, 9);
    });
    ctx.cursorY += 4;
  }

  ctx.cursorY += 10;
}

/**
 * Add disclaimer footer
 */
export function addDisclaimer(ctx: PDFContext): void {
  ensureSpace(ctx, 80);
  ctx.cursorY = ctx.pageHeight - ctx.margin - 50;

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(100);

  const disclaimerText =
    'Important: AI-generated content requires professional verification. All sustainability insights, lifecycle assessments, and recommendations should be validated by qualified professionals before use in design decisions or client communications.';
  const disclaimerLines = ctx.doc.splitTextToSize(
    disclaimerText,
    ctx.pageWidth - ctx.margin * 2
  );
  disclaimerLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;
  });

  ctx.cursorY += 5;
  ctx.doc.setFont('helvetica', 'medium');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(0);
  ctx.doc.text('Generated with Moodboard-Lab', ctx.margin, ctx.cursorY);
}
