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
  LifecycleStageKey,
  LifecycleProfile,
} from '../types/sustainability';
import type { MaterialOption } from '../types';
import { STAGE_LABELS } from './designConsequences';
import { getCircularityIndicator, formatScore, LANDSCAPE_CARBON_CAP_HARD } from './sustainabilityScoring';
import { isLandscapeMaterial, isHardLandscapeMaterial } from './lifecycleDurations';

// PDF constants
const MARGIN = 48;
const TRAFFIC_LIGHT_COLORS: Record<TrafficLight, [number, number, number]> = {
  green: [34, 139, 34],
  amber: [255, 191, 0],
  red: [220, 53, 69],
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

function renderEpdLifecycleMapping(ctx: PDFContext): void {
  const title = 'Relationship to EPD lifecycle modules (EN 15804)';
  const intro =
    'This report uses a simplified lifecycle structure suitable for concept-stage design. ' +
    'The impact categories shown correspond to EN 15804 lifecycle modules as follows:';
  const rows = [
    { left: 'Raw + Manufacturing', right: 'A1-A3 (product stage)' },
    { left: 'Transport', right: 'A4 (transport to site)' },
    { left: 'Installation', right: 'A5 (construction / installation)' },
    { left: 'In use', right: 'B1, B6-B7 (use and operational effects, where relevant)' },
    { left: 'Maintenance', right: 'B2-B5 (maintenance, repair, replacement, refurbishment)' },
    { left: 'End of life', right: 'C1-C4 (end-of-life stages)' },
    { left: 'Module D (contextual)', right: 'Module D (reuse, recovery, recycling potential)' },
  ];
  const closing =
    'This mapping is indicative and intended for alignment and clarity, not substitution for full EPD-based assessment. ' +
    'Detailed A-D module separation becomes relevant once quantities and product-specific EPDs are available.';

  ensureSpace(ctx, 18);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(0);
  ctx.doc.text(title, ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;

  addParagraph(ctx, intro, 9, 4);

  const tableWidth = ctx.pageWidth - ctx.margin * 2;
  const gutter = 12;
  const col1Width = Math.round(tableWidth * 0.38);
  const col2Width = tableWidth - col1Width - gutter;
  const col1X = ctx.margin;
  const col2X = ctx.margin + col1Width + gutter;
  const headerSize = 8;

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(headerSize);
  ctx.doc.setTextColor(60);
  ctx.doc.text('Report category', col1X, ctx.cursorY);
  ctx.doc.text('EN 15804 reference', col2X, ctx.cursorY);
  ctx.cursorY += 10;

  ctx.doc.setDrawColor(200);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.cursorY - 4, ctx.pageWidth - ctx.margin, ctx.cursorY - 4);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(headerSize);
  ctx.doc.setTextColor(0);
  const lineHeight = headerSize + 3;

  rows.forEach((row) => {
    const leftLines = ctx.doc.splitTextToSize(row.left, col1Width);
    const rightLines = ctx.doc.splitTextToSize(row.right, col2Width);
    const rowLines = Math.max(leftLines.length, rightLines.length);
    ensureSpace(ctx, rowLines * lineHeight + 2);

    for (let i = 0; i < rowLines; i += 1) {
      const y = ctx.cursorY + i * lineHeight;
      ctx.doc.text(leftLines[i] || '', col1X, y);
      ctx.doc.text(rightLines[i] || '', col2X, y);
    }
    ctx.cursorY += rowLines * lineHeight + 2;
  });

  ctx.cursorY += 4;
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(90);
  const closingLines = ctx.doc.splitTextToSize(closing, tableWidth);
  closingLines.forEach((line: string) => {
    ensureSpace(ctx, lineHeight);
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += lineHeight;
  });
  ctx.doc.setTextColor(0);
  ctx.cursorY += 6;
}

type ComplianceKey =
  | 'epd'
  | 'recycled'
  | 'fixings'
  | 'biodiversity'
  | 'certification';

const COMPLIANCE_BADGE_KEY: Array<{ key: ComplianceKey; code: string; label: string; explanation: string }> = [
  { key: 'epd', code: '1', label: 'EPD (EN 15804 / ISO 14025)', explanation: 'Required for all primary structure and envelope systems' },
  { key: 'recycled', code: '2', label: 'Recycled content declaration', explanation: 'Critical for steel, concrete, polymers' },
  { key: 'fixings', code: '3', label: 'Design for disassembly / reversible fixings', explanation: 'Relevant to finishes and secondary systems' },
  { key: 'certification', code: '4', label: 'Chain of custody certification (FSC/PEFC)', explanation: 'Required for all timber products' },
  { key: 'biodiversity', code: '5', label: 'Biodiversity assessment (landscape only)', explanation: 'Required for all landscape elements' },
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

  const addSectionTitle = (text: string) => {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(11);
    ctx.doc.setTextColor(0);
    ctx.doc.text(text, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  };

  const addBodyText = (text: string) => {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(60);
    const lines = ctx.doc.splitTextToSize(text, ctx.pageWidth - ctx.margin * 2);
    lines.forEach((line: string) => {
      ctx.doc.text(line, ctx.margin, ctx.cursorY);
      ctx.cursorY += 11;
    });
    ctx.doc.setTextColor(0);
    ctx.cursorY += 4;
  };

  const addSmallBullet = (text: string) => {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(60);
    const maxWidth = ctx.pageWidth - ctx.margin * 2 - 12;
    const lines = ctx.doc.splitTextToSize(text, maxWidth);
    ctx.doc.text('•', ctx.margin, ctx.cursorY);
    lines.forEach((line: string, idx: number) => {
      ctx.doc.text(line, ctx.margin + 10, ctx.cursorY + idx * 10);
    });
    ctx.cursorY += lines.length * 10 + 2;
    ctx.doc.setTextColor(0);
  };

  // Section 1: What this report is
  addSectionTitle('What this report is');
  addBodyText(
    'This is a concept-stage sustainability insight report generated from the selected material palette. ' +
      'It is designed to support early design decisions, highlight carbon drivers, and identify where specification choices matter most.'
  );

  // Section 2: What this report is not
  addSectionTitle('What this report is not');
  addBodyText(
    'This is not a formal Life Cycle Assessment (LCA), carbon calculation, or EPD-based compliance report. ' +
      'It does not replace quantity-based modelling or consultant-led assessments at later stages.'
  );

  // Section 3: How the scoring works
  addSectionTitle('How to read the scores');
  addSmallBullet('Impact scores run from 1 (very low) to 5 (very high).');
  addSmallBullet('Scores are relative within this palette, not absolute carbon values.');
  addSmallBullet('Confidence reflects data availability at concept stage.');
  addSmallBullet('Landscape systems are treated differently to industrial materials.');
  addBodyText('Scores highlight where to focus effort, not exact emissions.');

  // Section 4: How to use this report
  addSectionTitle('How to use this report');
  addSmallBullet('Use the dashboard to identify dominant carbon contributors.');
  addSmallBullet('Use material pages to understand why a material scores highly.');
  addSmallBullet('Use design actions to adjust the palette before fixing quantities.');
  addSmallBullet('Revisit findings once specifications and quantities are defined.');

  // Divider before summary content
  ctx.doc.setDrawColor(220);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.cursorY, ctx.pageWidth - ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;

  // What this palette achieves
  addHeading(ctx, 'What this palette achieves', 13);
  summary.achievements.slice(0, 2).forEach((achievement) => {
    addBullet(ctx, achievement, 11);
  });
  ctx.cursorY += 10;

  // Key risks and mitigations
  addHeading(ctx, 'Key risks and how we mitigate', 13);
  summary.risks_and_mitigations.slice(0, 2).forEach((risk) => {
    addBullet(ctx, risk, 11);
  });
  ctx.cursorY += 10;

  // Evidence priorities
  addHeading(ctx, 'Evidence priorities', 13);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(80);
  ctx.doc.text(
    'See Compliance Readiness Summary for prioritised evidence items and the badge key.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.doc.setTextColor(0);
  ctx.cursorY += 14;

  // Confidence statement
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(80);
  const confidenceText = summary.confidence_statement.split('. ')[0] || summary.confidence_statement;
  const confLines = ctx.doc.splitTextToSize(
    confidenceText,
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
    ctx.doc.text('CARBON DOMINANT COMPONENTS (within this palette, early-stage estimate):', ctx.margin + 8, ctx.cursorY);
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
    ctx.cursorY += 8;
    ctx.doc.text(
      'High ranking may be driven by frequent replacement over 60 years, not single-application intensity.',
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

  renderEpdLifecycleMapping(ctx);

  // ===== TABLE 1: Impact & Rating =====
  addHeading(ctx, 'Impact Assessment', 12);

  const impactColWidths = [120, 55, 50, 45, 45, 45, 45];
  const impactHeaders = ['Material', 'Embodied', 'In-use', 'EOL', 'Module D*', 'Conf.', 'Rating'];
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
    'Rating: Green = low impact + env. benefit | Amber = moderate | Red = high embodied impact or repeated replacement burden. Landscape rated on ecosystem benefits.',
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
  ctx.cursorY += 10;
  ctx.doc.text(
    '*Module D (contextual) shown for context only; does not offset embodied impact in rating calculation for high-carbon materials.',
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

  // Biogenic and ecosystem contributions (biodiversity, sequestration)
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text('Biogenic and ecosystem contributions:', ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

  ctx.doc.setFont('helvetica', 'normal');
  const envBenefitItems: MaterialOption[] = [];
  const functionalBenefitItems: MaterialOption[] = [];
  summary.top_benefit_items.slice(0, 3).forEach((id) => {
    const mat = materials.find((m) => m.id === id);
    const metric = metrics.get(id);
    if (!mat || !metric) return;

    // Hard landscape (gravel, paving, etc.) can NEVER appear in ecosystem benefits
    // They should only appear under functional benefits (permeability, SuDS)
    if (isHardLandscapeMaterial(mat)) {
      functionalBenefitItems.push(mat);
      return;
    }

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
    ctx.doc.text('  No materials with significant ecosystem benefits', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  if (functionalBenefitItems.length > 0) {
    ctx.cursorY += 6;
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text('Functional necessity (durability, load capacity, SuDS infrastructure):', ctx.margin, ctx.cursorY);
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
  const directionDisclaimer = 'Recommendations are proportional to early-stage impact drivers and should be revisited once quantities and specifications are known.';
  const disclaimerLines = ctx.doc.splitTextToSize(directionDisclaimer, ctx.pageWidth - ctx.margin * 2);
  disclaimerLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });
  ctx.cursorY += 6;
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
    'Compliance readiness = whether standard supplier evidence (environmental product declarations, certificates, recycled-content declarations) is likely to be available at this stage. Concept-stage view: highlights real risk items, evidence priorities, and what can safely wait.',
    ctx.pageWidth - ctx.margin * 2
  );
  introLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;
  });
  ctx.cursorY += 2;
  ctx.doc.text(
    'At concept stage, most materials require standard evidence rather than presenting unique compliance risks.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.doc.setTextColor(0);
  ctx.cursorY += 12;

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
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(100);
  ctx.doc.text('This is typical at concept stage and does not indicate non-compliance.', ctx.margin, ctx.cursorY);
  ctx.doc.setTextColor(0);
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

  ctx.doc.setFontSize(9);
  COMPLIANCE_BADGE_KEY.forEach(({ code, label, explanation }) => {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.text(`${code}. ${label}`, ctx.margin, ctx.cursorY);
    ctx.cursorY += 10;
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setTextColor(80);
    ctx.doc.text(`   ${explanation}`, ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
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
  ensureSpace(ctx, 190);

  const addSubtleBullet = (text: string, size = 8): void => {
    ensureSpace(ctx, size * 1.4);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(size);
    ctx.doc.setTextColor(90);
    const maxWidth = ctx.pageWidth - ctx.margin * 2 - 15;
    const lines = ctx.doc.splitTextToSize(text, maxWidth);
    ctx.doc.text('-', ctx.margin, ctx.cursorY);
    lines.forEach((line: string, i: number) => {
      ctx.doc.text(line, ctx.margin + 12, ctx.cursorY + i * (size + 3));
    });
    ctx.cursorY += lines.length * (size + 3) + 3;
    ctx.doc.setTextColor(0);
  };

  const renderDesignActionsBox = (actions: string[]): void => {
    const header = 'DESIGN ACTIONS (CONCEPT STAGE)';
    const headerSize = 10;
    const bodySize = 10;
    const boxPaddingX = 10;
    const boxPaddingY = 8;
    const bulletIndent = 12;
    const boxWidth = ctx.pageWidth - ctx.margin * 2;
    const contentWidth = boxWidth - boxPaddingX * 2 - bulletIndent;
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(bodySize);
    const linesPerAction = actions.map((action) => ctx.doc.splitTextToSize(action, contentWidth));
    const bodyLineCount = linesPerAction.reduce((sum, lines) => sum + lines.length, 0);
    const bodyHeight =
      actions.length === 0 ? bodySize + 3 : bodyLineCount * (bodySize + 3) + (actions.length - 1) * 2;
    const boxHeight = boxPaddingY + headerSize + 6 + bodyHeight + boxPaddingY;

    ensureSpace(ctx, boxHeight + 6);
    const boxY = ctx.cursorY;
    ctx.doc.setFillColor(248, 244, 236);
    ctx.doc.setDrawColor(230, 220, 205);
    ctx.doc.roundedRect(ctx.margin, boxY, boxWidth, boxHeight, 2, 2, 'FD');

    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(headerSize);
    ctx.doc.setTextColor(0);
    ctx.doc.text(header, ctx.margin + boxPaddingX, boxY + boxPaddingY + headerSize);

    let y = boxY + boxPaddingY + headerSize + 6;
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(bodySize);

    if (actions.length === 0) {
      ctx.doc.setTextColor(90);
    ctx.doc.text('No design actions available yet', ctx.margin + boxPaddingX, y);
      ctx.doc.setTextColor(0);
      y += bodySize + 3;
    } else {
      actions.forEach((action, index) => {
        const lines = linesPerAction[index];
        ctx.doc.text('-', ctx.margin + boxPaddingX, y);
        lines.forEach((line: string, lineIndex: number) => {
          ctx.doc.text(
            line,
            ctx.margin + boxPaddingX + bulletIndent,
            y + lineIndex * (bodySize + 3)
          );
        });
        y += lines.length * (bodySize + 3) + 2;
      });
    }

    ctx.cursorY = boxY + boxHeight + 10;
  };

  // ZONE 1: Material summary
  const thumbnailSize = 50;
  let contentStartX = ctx.margin;
  let thumbnailRendered = false;
  const summaryStartY = ctx.cursorY;

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
      const hex = material.tone.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
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
  ctx.doc.setTextColor(0);
  ctx.doc.text(material.name, contentStartX, summaryStartY + 8);

  // Category tag
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(100);
  ctx.doc.text(`[${material.category}]`, contentStartX, summaryStartY + 18);
  ctx.doc.setTextColor(0);

  // Summary line (single blunt statement)
  const summaryLine = buildMaterialSummaryLine(material, insight, metrics);
  const summaryFontSize = 9;
  const summaryMaxWidth = ctx.pageWidth - ctx.margin - contentStartX;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(summaryFontSize);
  ctx.doc.setTextColor(40);
  const fittedSummary = fitSingleLineText(ctx.doc, summaryLine, summaryMaxWidth);
  const summaryLineY = summaryStartY + 28;
  ctx.doc.text(fittedSummary, contentStartX, summaryLineY);
  ctx.doc.setTextColor(0);

  let summaryTextY = summaryLineY + summaryFontSize + 6;
  const contextLine = buildContextLine(material, metrics);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(80);
  const contextLines = ctx.doc.splitTextToSize(contextLine, summaryMaxWidth);
  contextLines.forEach((line: string) => {
    ctx.doc.text(line, contentStartX, summaryTextY);
    summaryTextY += 10;
  });

  const comparativeCue = getComparativeCueLine(paletteContext);
  if (comparativeCue) {
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(100);
    const cueLines = ctx.doc.splitTextToSize(comparativeCue, summaryMaxWidth);
    cueLines.forEach((line: string) => {
      ctx.doc.text(line, contentStartX, summaryTextY);
      summaryTextY += 10;
    });
  }

  ctx.doc.setTextColor(0);
  ctx.doc.setFont('helvetica', 'normal');

  const summaryBottom = Math.max(
    thumbnailRendered ? summaryStartY + thumbnailSize : summaryStartY + 24,
    summaryTextY
  );
  ctx.cursorY = summaryBottom + 8;

  // Subtle divider between summary and drivers
  ctx.doc.setDrawColor(230);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.cursorY, ctx.pageWidth - ctx.margin, ctx.cursorY);
  ctx.cursorY += 8;

  // ZONE 2: Lifecycle drivers
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(90);
  ctx.doc.text('Lifecycle drivers (context)', ctx.margin, ctx.cursorY);
  ctx.cursorY += 10;
  ctx.doc.setTextColor(0);

  if (metrics?.low_confidence_flag) {
    renderLowConfidenceIndicator(ctx, metrics);
  }

  ctx.cursorY += 2;
  renderLifecycleFingerprint(ctx, material.id, '', profile, metrics?.low_confidence_flag);
  ctx.cursorY += 2;

  const mainDrivers = buildLifecycleDrivers(material, insight, metrics);
  if (mainDrivers.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(80);
    ctx.doc.text('Main drivers:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 9;
    mainDrivers.forEach((driver) => addSubtleBullet(driver, 8));
    ctx.cursorY += 4;
  }

  const opportunityLine = buildDesignOpportunity(insight, material);
  if (opportunityLine) {
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(70);
    const oppLines = ctx.doc.splitTextToSize(opportunityLine, ctx.pageWidth - ctx.margin * 2);
    oppLines.forEach((line: string) => {
      ctx.doc.text(line, ctx.margin, ctx.cursorY);
      ctx.cursorY += 10;
    });
    ctx.doc.setTextColor(0);
    ctx.cursorY += 2;
  }

  if (material.id === 'clay-plaster') {
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(90);
    const note =
      'High ranking driven by frequent replacement over 60 years rather than extraction or processing intensity.';
    const noteLines = ctx.doc.splitTextToSize(note, ctx.pageWidth - ctx.margin * 2);
    noteLines.forEach((line: string) => {
      ctx.doc.text(line, ctx.margin, ctx.cursorY);
      ctx.cursorY += 10;
    });
    ctx.doc.setTextColor(0);
    ctx.cursorY += 4;
  }

  // ZONE 3: Design actions
  const compliancePhrase = /(epd|en 15804|iso 14025|fsc|pefc|chain of custody|certification|certificate)/i;
  const filteredLevers = insight?.designLevers
    ? insight.designLevers.filter((lever) => !compliancePhrase.test(lever))
    : [];
  const actions = filteredLevers.map((lever) => normalizeDesignAction(lever)).slice(0, 3);
  renderDesignActionsBox(actions);

  // Secondary info (de-emphasised)
  const secondaryLines: Array<{ text: string; tone?: 'amber' }> = [];
  if (paletteContext && metrics) {
    secondaryLines.push({
      text: `#${paletteContext.rank} of ${paletteContext.totalMaterials} by embodied carbon (${paletteContext.contributionPercent.toFixed(0)}% of palette total)`,
    });
  }

  secondaryLines.push({
    text: 'Compliance readiness: supplier evidence (environmental product declarations, timber chain-of-custody certificates, recycled-content statements) is typically gathered by RIBA Stage 3.',
  });

  const bands = estimatePracticalityBands(material);
  const deliveryComplexity = getDeliveryComplexityLabel(bands);
  secondaryLines.push({
    text: `Delivery complexity: ${deliveryComplexity}`,
  });

  if (secondaryLines.length > 0) {
    const footerFontSize = 7;
    const footerLineHeight = footerFontSize + 3;
    const footerHeight = secondaryLines.length * footerLineHeight;
    if (ctx.cursorY + footerHeight < ctx.pageHeight - ctx.margin) {
      ctx.cursorY = ctx.pageHeight - ctx.margin - footerHeight;
    } else {
      ctx.cursorY += 4;
    }

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(footerFontSize);
    secondaryLines.forEach((line) => {
      if (line.tone === 'amber') {
        ctx.doc.setTextColor(180, 130, 0);
      } else {
        ctx.doc.setTextColor(110);
      }
      ctx.doc.text(line.text, ctx.margin, ctx.cursorY);
      ctx.cursorY += footerLineHeight;
    });
    ctx.doc.setTextColor(0);
  }

  ctx.cursorY += 6;
}

/**
 * Add disclaimer footer
 */
export function addDisclaimer(ctx: PDFContext): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  // Glossary
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(14);
  ctx.doc.setTextColor(0);
  ctx.doc.text('Glossary', ctx.margin, ctx.cursorY);
  ctx.cursorY += 16;

  const glossaryItems: Array<{ term: string; description: string }> = [
    {
      term: 'RIBA Stage 3',
      description: 'Developed design stage in the UK work stages.',
    },
    {
      term: 'Environmental product declaration',
      description: 'Standardised product life-cycle data sheet (often called an EPD).',
    },
    {
      term: 'FSC / PEFC',
      description: 'Timber chain-of-custody certification schemes.',
    },
    {
      term: 'EN 15804 / ISO 14025',
      description: 'Standards that define how environmental product declarations are produced.',
    },
    {
      term: 'EOL',
      description: 'End of life (what happens when a material is removed or disposed).',
    },
    {
      term: 'Conf.',
      description: 'Confidence in data quality.',
    },
    {
      term: 'SuDS',
      description: 'Sustainable drainage systems.',
    },
    {
      term: 'AI',
      description: 'Artificial intelligence used to draft early-stage insights.',
    },
    {
      term: 'RAW / MFG / TRN / INS / USE / MNT / EOL',
      description:
        'Lifecycle stages: RAW = raw material acquisition (cradle), MFG = production processes, TRN = distribution impacts, INS = construction/assembly effects, USE = operational impacts during service life, MNT = upkeep over life, EOL = disposal or recycling stages.',
    },
    {
      term: 'Impact scores',
      description:
        'Scores are relative (1–5) and intended for comparative early-stage design decision-making, not as a substitute for EPD-based carbon calculations.',
    },
  ];

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(80);
  glossaryItems.forEach((item) => {
    const line = `${item.term}: ${item.description}`;
    const lines = ctx.doc.splitTextToSize(line, ctx.pageWidth - ctx.margin * 2);
    lines.forEach((textLine: string) => {
      ctx.doc.text(textLine, ctx.margin, ctx.cursorY);
      ctx.cursorY += 11;
    });
    ctx.cursorY += 2;
  });

  // Disclaimer footer
  ctx.cursorY = ctx.pageHeight - ctx.margin - 55;

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
