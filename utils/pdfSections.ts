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
} from '../types/sustainability';
import type { MaterialOption } from '../types';
import { STAGE_LABELS } from './designConsequences';
import { getCircularityIndicator, formatScore } from './sustainabilityScoring';

// PDF constants
const MARGIN = 48;
const TRAFFIC_LIGHT_COLORS: Record<TrafficLight, [number, number, number]> = {
  green: [34, 139, 34],
  amber: [255, 191, 0],
  red: [220, 53, 69],
};

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
  ctx.doc.text('•', ctx.margin, ctx.cursorY);
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

  // Evidence checklist
  addHeading(ctx, 'Next evidence to collect', 13);
  summary.evidence_checklist.forEach((item) => {
    ensureSpace(ctx, 14);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.text(`☐ ${item}`, ctx.margin + 5, ctx.cursorY);
    ctx.cursorY += 14;
  });
  ctx.cursorY += 15;

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

  // Table layout
  const colWidths = [130, 50, 50, 45, 45, 40, 45, 45];
  const headers = [
    'Material',
    'Embodied',
    'In-use',
    'EOL',
    'Benefit',
    'Circ.',
    'Conf.',
    'Rating',
  ];
  const tableStartX = ctx.margin;

  // Table header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(60);
  let xPos = tableStartX;
  headers.forEach((header, i) => {
    ctx.doc.text(header, xPos, ctx.cursorY);
    xPos += colWidths[i];
  });
  ctx.cursorY += 12;

  // Header line
  ctx.doc.setDrawColor(180);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(
    ctx.margin,
    ctx.cursorY - 5,
    ctx.pageWidth - ctx.margin,
    ctx.cursorY - 5
  );

  // Table rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(0);

  materials.forEach((material) => {
    ensureSpace(ctx, 18);
    const metric = metrics.get(material.id);
    if (!metric) return;

    xPos = tableStartX;

    // Material name (truncated)
    const truncatedName =
      material.name.length > 20
        ? material.name.substring(0, 18) + '...'
        : material.name;
    ctx.doc.text(truncatedName, xPos, ctx.cursorY);
    xPos += colWidths[0];

    // Numeric scores
    ctx.doc.text(formatScore(metric.embodied_proxy), xPos, ctx.cursorY);
    xPos += colWidths[1];

    ctx.doc.text(formatScore(metric.in_use_proxy), xPos, ctx.cursorY);
    xPos += colWidths[2];

    ctx.doc.text(formatScore(metric.end_of_life_proxy), xPos, ctx.cursorY);
    xPos += colWidths[3];

    ctx.doc.text(formatScore(metric.benefit_score), xPos, ctx.cursorY);
    xPos += colWidths[4];

    // Circularity indicator
    const circ = getCircularityIndicator(metric.end_of_life_proxy);
    const circSymbol = circ === 'high' ? '●' : circ === 'medium' ? '◐' : '○';
    ctx.doc.text(circSymbol, xPos + 8, ctx.cursorY);
    xPos += colWidths[5];

    // Confidence
    const confPercent = Math.round(metric.confidence_score * 100);
    ctx.doc.text(`${confPercent}%`, xPos, ctx.cursorY);
    if (metric.low_confidence_flag) {
      ctx.doc.setFontSize(7);
      ctx.doc.text('?', xPos + 22, ctx.cursorY);
      ctx.doc.setFontSize(9);
    }
    xPos += colWidths[6];

    // Traffic light
    drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, metric.traffic_light);

    ctx.cursorY += 16;
  });

  // Legend
  ctx.cursorY += 15;
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(80);
  ctx.doc.text(
    'Rating: Green = low impact or high benefit offset | Amber = moderate, review design levers | Red = high impact, consider alternatives',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 11;
  ctx.doc.text(
    'Circularity: ● High | ◐ Medium | ○ Low | ? = Low confidence data',
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
  materials: MaterialOption[]
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
      ctx.doc.text(`  • ${mat.name}`, ctx.margin + 10, ctx.cursorY);
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

  // Top benefit materials
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text('Highest benefit contribution:', ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

  ctx.doc.setFont('helvetica', 'normal');
  summary.top_benefit_items.slice(0, 3).forEach((id) => {
    const mat = materials.find((m) => m.id === id);
    if (mat) {
      ctx.doc.text(`  • ${mat.name}`, ctx.margin + 10, ctx.cursorY);
      ctx.cursorY += 12;
    }
  });

  if (summary.top_benefit_items.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('  No high-benefit materials identified', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
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
      ctx.doc.text(`✓ ${synergy.type.toUpperCase()}:`, ctx.margin, ctx.cursorY);
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
      ctx.doc.text(`⚠ ${conflict.type.toUpperCase()}:`, ctx.margin, ctx.cursorY);
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
 * Render Page 4: UK Compliance Dashboard
 */
export function renderUKComplianceDashboard(
  ctx: PDFContext,
  insights: EnhancedSustainabilityInsight[],
  materials: MaterialOption[]
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'UK Compliance Checks', 16);
  ctx.cursorY += 5;

  // Table layout
  const colWidths = [140, 55, 60, 55, 55];
  const headers = ['Material', 'EPD', 'Recycled', 'Fixings', 'Bio.'];
  const tableStartX = ctx.margin;

  // Table header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(60);
  let xPos = tableStartX;
  headers.forEach((header, i) => {
    ctx.doc.text(header, xPos, ctx.cursorY);
    xPos += colWidths[i];
  });
  ctx.cursorY += 12;

  // Header line
  ctx.doc.setDrawColor(180);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(
    ctx.margin,
    ctx.cursorY - 5,
    ctx.pageWidth - ctx.margin,
    ctx.cursorY - 5
  );

  // Track missing evidence
  const missingEvidence: string[] = [];

  // Table rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(0);

  insights.forEach((insight) => {
    ensureSpace(ctx, 18);
    const material = materials.find((m) => m.id === insight.id);
    if (!material) return;

    xPos = tableStartX;

    // Material name
    const truncatedName =
      material.name.length > 22
        ? material.name.substring(0, 20) + '...'
        : material.name;
    ctx.doc.text(truncatedName, xPos, ctx.cursorY);
    xPos += colWidths[0];

    // EPD check
    const hasEPD = insight.ukChecks?.some(
      (c) =>
        c.standard_code?.includes('EN 15804') ||
        c.label.toLowerCase().includes('epd')
    );
    drawTrafficLight(
      ctx,
      xPos + 15,
      ctx.cursorY - 3,
      hasEPD ? 'green' : 'amber',
      4
    );
    if (!hasEPD) missingEvidence.push(`${material.name}: Request EPD (EN 15804)`);
    xPos += colWidths[1];

    // Recycled content check
    const hasRecycled = insight.ukChecks?.some((c) =>
      c.label.toLowerCase().includes('recycled')
    );
    drawTrafficLight(
      ctx,
      xPos + 15,
      ctx.cursorY - 3,
      hasRecycled ? 'green' : 'amber',
      4
    );
    if (!hasRecycled)
      missingEvidence.push(`${material.name}: Verify recycled content`);
    xPos += colWidths[2];

    // Mechanical fixings check
    const hasMechanical =
      material.description?.toLowerCase().includes('mechanical') ||
      material.description?.toLowerCase().includes('demountable') ||
      insight.ukChecks?.some(
        (c) =>
          c.label.toLowerCase().includes('demountable') ||
          c.label.toLowerCase().includes('mechanical')
      );
    drawTrafficLight(
      ctx,
      xPos + 15,
      ctx.cursorY - 3,
      hasMechanical ? 'green' : 'amber',
      4
    );
    xPos += colWidths[3];

    // Biodiversity (landscape only)
    if (material.category === 'landscape') {
      const hasBio = insight.benefits?.some((b) => b.type === 'biodiversity');
      drawTrafficLight(
        ctx,
        xPos + 15,
        ctx.cursorY - 3,
        hasBio ? 'green' : 'amber',
        4
      );
    } else {
      ctx.doc.setTextColor(150);
      ctx.doc.text('—', xPos + 15, ctx.cursorY);
      ctx.doc.setTextColor(0);
    }

    ctx.cursorY += 16;
  });

  // Missing evidence summary
  if (missingEvidence.length > 0) {
    ctx.cursorY += 20;
    ensureSpace(ctx, 80);
    addHeading(ctx, 'Missing Evidence', 12);

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9);
    const maxItems = Math.min(missingEvidence.length, 10);
    for (let i = 0; i < maxItems; i++) {
      ensureSpace(ctx, 12);
      ctx.doc.text(`• ${missingEvidence[i]}`, ctx.margin + 10, ctx.cursorY);
      ctx.cursorY += 12;
    }

    if (missingEvidence.length > 10) {
      ctx.doc.setTextColor(100);
      ctx.doc.text(
        `... and ${missingEvidence.length - 10} more items`,
        ctx.margin + 10,
        ctx.cursorY
      );
      ctx.doc.setTextColor(0);
    }
  }

  // Legend
  ctx.cursorY += 15;
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(80);
  ctx.doc.text(
    'Green = Evidence available | Amber = Evidence required | — = Not applicable',
    ctx.margin,
    ctx.cursorY
  );
  ctx.doc.setTextColor(0);
}

/**
 * Render lifecycle fingerprint visualization
 */
export function renderLifecycleFingerprint(
  ctx: PDFContext,
  materialId: string,
  materialName: string,
  profile: LifecycleProfile | null
): void {
  if (!profile) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text(`${materialName}: Fingerprint not available`, ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 15;
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

    // Draw dots
    for (let i = 1; i <= 5; i++) {
      const dotX = xPos + (i - 1) * (dotSize + dotGap);
      const dotY = ctx.cursorY + 6 - dotSize / 2;
      const isFilled = i <= stageData.impact;

      if (isFilled) {
        if (stageData.confidence === 'low') {
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
 * Render enhanced material section with design consequences
 */
export function renderEnhancedMaterialSection(
  ctx: PDFContext,
  material: MaterialOption,
  insight: EnhancedSustainabilityInsight | undefined,
  metrics: MaterialMetrics | undefined,
  profile: LifecycleProfile | null
): void {
  ensureSpace(ctx, 120);

  // Lifecycle fingerprint
  renderLifecycleFingerprint(ctx, material.id, material.name, profile);

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

  // Design Levers
  if (insight.designLevers && insight.designLevers.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text('Design Levers:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;

    ctx.doc.setFont('helvetica', 'normal');
    insight.designLevers.slice(0, 4).forEach((lever) => {
      addBullet(ctx, lever, 9);
    });
    ctx.cursorY += 4;
  }

  // UK Checks
  if (insight.ukChecks && insight.ukChecks.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text('UK Checks:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;

    ctx.doc.setFont('helvetica', 'normal');
    insight.ukChecks.slice(0, 4).forEach((check) => {
      const text = check.standard_code
        ? `${check.label} (${check.standard_code})`
        : check.label;
      addBullet(ctx, text, 9);
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
