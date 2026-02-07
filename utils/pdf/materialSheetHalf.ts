import type { jsPDF } from 'jspdf';
import {
  drawLifecycleRadarChart,
  LIFECYCLE_STAGE_LABELS,
  type LifecycleKey,
} from './charts/radarLifecycle';

// Re-export for external use
export type { LifecycleKey } from './charts/radarLifecycle';

// Export page height for footer positioning
export const MATERIAL_SHEET_PAGE_HEIGHT = 841.89;

const A4_W = 595.28;
const A4_H = 841.89;
const SHEET_H = A4_H / 2;

const M = 20;
const G = 10;

const CARD_PAD = 10;

export type MaterialPdfModel = {
  name: string;
  category: string;
  carbonLabel: 'Low Carbon' | 'Medium Carbon' | 'High Carbon';
  formVariant?: string;

  imageDataUri?: string;
  imageCaption?: string;

  whatItIs?: string;
  typicalUses?: string[];
  performanceNote?: string;
  hotspots?: LifecycleKey[];
  strengths?: LifecycleKey[];

  lifecycle: Record<LifecycleKey, number>;
  lifecycleConfidence?: 'High' | 'Medium' | 'Low';
  lifecycleInsight?: string;
  epdAvailable?: boolean;
  epdStatus?: 'Yes' | 'No' | 'Unknown';

  strategicValue?: string;
  specActions?: string[];

  risks?: { risk: string; mitigation: string }[];

  healthRiskLevel?: 'low' | 'medium' | 'high';
  healthConcerns?: string[];
  healthNote?: string;

  serviceLife?: number;
};

type RenderOpts = {
  sheetIndex: 0 | 1;
  generatedOnText?: string;
};

export function renderMaterialSheetHalf(
  doc: jsPDF,
  material: MaterialPdfModel,
  opts: RenderOpts
) {
  // Move 2nd material up by 15px to account for page footer
  const sheetTop = opts.sheetIndex === 0 ? 0 : SHEET_H - 15;
  const x0 = M;
  const y0 = sheetTop + M;
  const w = A4_W - 2 * M;

  let y = y0;

  // Header row (with thumbnail)
  const headerH = 38;
  renderHeader(doc, material, x0, y, w, headerH);
  y += headerH + 6;

  // Two-column body (health box + spec actions in left column, lifecycle in right column)
  const bodyH = 270;
  renderBody(doc, material, x0, y, w, bodyH);

  // Page footer (only render on bottom material of each page)
  if (opts.sheetIndex === 1) {
    renderPageFooter(doc, opts, A4_H - 28);
  }
}

/** Render the page footer - exported for use when odd number of materials */
export function renderMaterialSheetFooter(doc: jsPDF, generatedOnText?: string) {
  renderPageFooter(doc, { sheetIndex: 0, generatedOnText }, A4_H - 28);
}

function renderHeader(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // Grey background box for header
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x + CARD_PAD - 4, y, w - 2 * CARD_PAD + 8, h, 6, 6, 'FD');

  // Thumbnail on left side
  const thumbSize = 32;
  const thumbX = x + CARD_PAD;
  const thumbY = y + 4;

  if (m.imageDataUri) {
    safeAddImage(doc, m.imageDataUri, thumbX, thumbY, thumbSize, thumbSize);
  } else {
    // Light placeholder if no image
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(thumbX, thumbY, thumbSize, thumbSize, 3, 3, 'F');
  }

  // Material name (to the right of thumbnail)
  const textStartX = thumbX + thumbSize + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(clampText(doc, m.name, w - thumbSize - 40), textStartX, y + 16);

  // Pills below the name (to the right of thumbnail)
  const chipY = y + 22;
  const chipH = 12;

  const chips = [
    { text: m.category, kind: 'neutral' as const },
    { text: m.carbonLabel, kind: labelKind(m.carbonLabel) },
  ];

  let cx = textStartX;
  for (const chip of chips) {
    const tw = measureText(doc, chip.text, 6.5, 'helvetica', 'bold');
    const chipW = tw + 10;
    drawChip(doc, cx, chipY, chipW, chipH, chip.text, chip.kind);
    cx += chipW + 5;
  }

  // Variant text on far right, vertically centered
  const variant = (m.formVariant || m.imageCaption || '').trim();
  if (variant) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    const rightEdge = x + w - CARD_PAD;
    const verticalCenter = y + h / 2;
    doc.text(clampText(doc, variant, 120), rightEdge, verticalCenter, { align: 'right' });
  }

  // Divider line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(x + CARD_PAD, y + h, x + w - CARD_PAD, y + h);
}

function renderBody(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  const colGap = G;
  const colL = Math.round((w - colGap) * 0.48);
  const colR = w - colL - colGap;

  const xL = x + CARD_PAD;
  const xR = x + CARD_PAD + colL + colGap;

  // Left column: material description, typical uses, key performance, health box, spec actions
  renderLeftColumn(doc, m, xL, y, colL - CARD_PAD, h);

  // Right column: radar chart + lifecycle analysis + insight box
  renderRightColumn(doc, m, xR, y, colR - CARD_PAD, h);
}

function renderLeftColumn(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // Reserve space for health box and spec actions at the bottom
  const actions = (m.specActions ?? []).slice(0, 3).filter(Boolean);
  const actionsH = actions.length ? 50 : 0;
  const healthBoxH = 50;
  const boxGap = 4;

  // Calculate main content height (leaving room for health + actions at bottom)
  const bottomSectionH = healthBoxH + boxGap + actionsH + (actions.length ? boxGap : 0);
  const mainContentH = h - bottomSectionH;

  // Light grey card background for main content
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x - 4, y, w + 8, mainContentH, 6, 6, 'FD');

  let cursorY = y + 12;

  // Material description (no heading)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  const whatText = (m.whatItIs ?? '').trim();
  if (whatText) {
    const whatLines = wrapLines(doc, whatText, w, 8).slice(0, 3);
    doc.text(whatLines, x, cursorY);
    cursorY += whatLines.length * 10 + 8;
  } else {
    cursorY += 12;
  }

  // Typical uses
  const uses = (m.typicalUses ?? []).slice(0, 4).filter(Boolean);
  if (uses.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(75, 85, 99);
    doc.text('TYPICAL USES', x, cursorY);
    cursorY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    uses.forEach((use) => {
      doc.text(`• ${clampText(doc, use, w - 8)}`, x, cursorY);
      cursorY += 10;
    });
    cursorY += 6;
  }

  // Key performance
  const perf = (m.performanceNote ?? m.strategicValue ?? '').trim();
  if (perf) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(75, 85, 99);
    doc.text('KEY PERFORMANCE', x, cursorY);
    cursorY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const perfLines = wrapLines(doc, perf, w, 8).slice(0, 2);
    doc.text(perfLines, x, cursorY);
    cursorY += perfLines.length * 10 + 6;
  }

  // Service life (durability)
  if (m.serviceLife) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(75, 85, 99);
    doc.text('EXPECTED SERVICE LIFE', x, cursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text(`${m.serviceLife} years`, x + 82, cursorY);
    cursorY += 12;
  }

  // Risks / Watch for
  const risks = (m.risks ?? []).slice(0, 2);
  if (risks.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(234, 88, 12); // Orange color for warnings
    doc.text('WATCH FOR', x, cursorY);
    cursorY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(55, 65, 81);
    risks.forEach((riskItem) => {
      doc.text(`• ${clampText(doc, riskItem.risk, w - 8)}`, x, cursorY);
      cursorY += 9;
    });
  }

  // Health box - above spec actions
  const healthBoxY = y + mainContentH + boxGap;
  renderHealthBox(doc, m, x, healthBoxY, w, healthBoxH);

  // Specification actions at the bottom of left column
  if (actions.length) {
    const actionsY = healthBoxY + healthBoxH + boxGap;

    // Light green background
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(x - 4, actionsY, w + 8, actionsH, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(21, 128, 61);
    doc.text('SPECIFICATION ACTIONS', x, actionsY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(55, 65, 81);

    let ay = actionsY + 22;
    actions.forEach((action) => {
      const lines = wrapLines(doc, `• ${action}`, w, 7).slice(0, 1);
      doc.text(lines, x, ay);
      ay += 9;
    });
  }
}

function renderHealthBox(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  if (!m.healthRiskLevel && !m.healthNote) {
    // Draw empty placeholder box if no health data
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(153, 246, 228);
    doc.roundedRect(x - 4, y, w + 8, h, 6, 6, 'FD');
    return;
  }

  // Hospital green card background
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(x - 4, y, w + 8, h, 6, 6, 'FD');

  let cursorY = y + 10;

  // Draw green cross icon
  const crossX = x;
  const crossY = cursorY - 5;
  const crossSize = 8;
  doc.setFillColor(20, 184, 166);
  // Vertical bar of cross
  doc.rect(crossX + crossSize * 0.35, crossY, crossSize * 0.3, crossSize, 'F');
  // Horizontal bar of cross
  doc.rect(crossX, crossY + crossSize * 0.35, crossSize, crossSize * 0.3, 'F');

  // Health & Indoor Air heading (offset for cross)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(17, 94, 89);
  doc.text('HEALTH & INDOOR AIR', x + 12, cursorY);

  // Risk level badge
  if (m.healthRiskLevel) {
    const badge = healthBadge(m.healthRiskLevel);
    const badgeText = badge.label;
    const badgeW = measureText(doc, badgeText, 6, 'helvetica', 'bold') + 8;
    const badgeX = x + w - badgeW;
    doc.setFillColor(badge.bg[0], badge.bg[1], badge.bg[2]);
    doc.roundedRect(badgeX, cursorY - 7, badgeW, 10, 5, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(badge.text[0], badge.text[1], badge.text[2]);
    doc.text(badgeText, badgeX + 4, cursorY - 0.5);
  }
  cursorY += 10;

  // Health note
  if (m.healthNote) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(17, 94, 89);
    const healthLines = wrapLines(doc, m.healthNote, w - 4, 7).slice(0, 2);
    doc.text(healthLines, x, cursorY);
  }
}

function healthBadge(level: 'low' | 'medium' | 'high'): {
  label: string;
  bg: [number, number, number];
  text: [number, number, number];
} {
  if (level === 'low') {
    return {
      label: 'Low Risk',
      bg: [220, 252, 231],
      text: [22, 101, 52],
    };
  }
  if (level === 'high') {
    return {
      label: 'High Risk',
      bg: [254, 226, 226],
      text: [153, 27, 27],
    };
  }
  return {
    label: 'Medium Risk',
    bg: [254, 249, 195],
    text: [133, 77, 14],
  };
}

function renderRightColumn(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // White card background with border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x - 4, y, w + 8, h - 8, 6, 6, 'FD');

  // Section heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.text('LIFECYCLE IMPACT', x, y + 12);

  // Radar chart - increased by 10px
  const chartX = x;
  const chartY = y + 16;
  const chartW = w;
  const chartH = 110;

  drawLifecycleRadarChart(doc, { x: chartX, y: chartY, width: chartW, height: chartH }, m.lifecycle);

  // Helper text centered below chart
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(107, 114, 128);
  doc.text(
    'Lower scores = lower impact (1 minimal, 5 significant)',
    x + w / 2,
    chartY + chartH + 5,
    { align: 'center' }
  );

  // Get hotspots and strengths
  const { hotspots, strengths } = analyseLifecycle(m.lifecycle);

  // Major Contributors section - moved down 10px (via larger chart)
  let analysisY = chartY + chartH + 18;

  // Major Contributors (orange) - matching sustainability briefing style
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(234, 88, 12);
  doc.text('MAJOR CONTRIBUTORS', x, analysisY);
  analysisY += 10;

  hotspots.forEach((item) => {
    const scoreColor: [number, number, number] = item.score >= 3 ? [249, 115, 22] : item.score >= 2 ? [234, 179, 8] : [34, 197, 94];
    drawScoreRow(doc, x, analysisY, item.label, item.score, scoreColor, w);
    analysisY += 11;
  });

  analysisY += 4;

  // Strongest Stages (green) - matching sustainability briefing style
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(22, 163, 74);
  doc.text('STRONGEST STAGES', x, analysisY);
  analysisY += 10;

  strengths.forEach((item) => {
    drawScoreRow(doc, x, analysisY, item.label, item.score, [34, 197, 94], w);
    analysisY += 11;
  });

  // Lifecycle insight box (fixed height)
  const insightY = analysisY + 4;
  const insightH = 40;
  const insightText = m.lifecycleInsight || generateDefaultInsight(m);

  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x, insightY, w, insightH, 4, 4, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(55, 65, 81);
  const insightLines = wrapLines(doc, insightText, w - 12, 7).slice(0, 3);
  doc.text(insightLines, x + 6, insightY + 10);
}

/** Draw a score row with label, bar chart, and score value */
function drawScoreRow(
  doc: jsPDF,
  x: number,
  rowY: number,
  label: string,
  score: number,
  color: [number, number, number],
  columnWidth: number
) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(55, 65, 81);
  doc.text(label, x, rowY);

  const barX = x + 70;
  const barW = columnWidth - 100;
  const barH = 4;

  // Background bar
  doc.setFillColor(229, 231, 235);
  doc.roundedRect(barX, rowY - 3, barW, barH, 2, 2, 'F');

  // Filled bar
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(barX, rowY - 3, Math.max(2, (score / 5) * barW), barH, 2, 2, 'F');

  // Score value
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(score.toFixed(1), barX + barW + 4, rowY);
}

function renderPageFooter(doc: jsPDF, opts: RenderOpts, y: number) {
  const pageW = A4_W;

  // Divider line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(M, y - 8, pageW - M, y - 8);

  // Generated by MoodboardLab line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  const dateLabel = opts.generatedOnText || new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Generated by MoodboardLab | ${dateLabel}`, pageW / 2, y, { align: 'center' });

  // Disclaimer line
  doc.setFontSize(6.75);
  doc.setTextColor(156, 163, 175);
  const disclaimer = 'This briefing provides indicative guidance only. Verify all data with material-specific EPDs and certifications.';
  doc.text(disclaimer, pageW / 2, y + 10, { align: 'center' });
}

function analyseLifecycle(lifecycle: Record<LifecycleKey, number>): {
  hotspots: Array<{ key: LifecycleKey; label: string; score: number }>;
  strengths: Array<{ key: LifecycleKey; label: string; score: number }>;
} {
  const entries = Object.entries(lifecycle) as [LifecycleKey, number][];
  const sortedDesc = [...entries].sort((a, b) => b[1] - a[1]);
  const sortedAsc = [...entries].sort((a, b) => a[1] - b[1]);

  const hotspots = sortedDesc.slice(0, 2).map(([key, score]) => ({
    key,
    label: LIFECYCLE_STAGE_LABELS[key],
    score,
  }));

  const strengths = sortedAsc.slice(0, 2).map(([key, score]) => ({
    key,
    label: LIFECYCLE_STAGE_LABELS[key],
    score,
  }));

  return { hotspots, strengths };
}

function generateDefaultInsight(m: MaterialPdfModel): string {
  const { hotspots: autoHotspots, strengths: autoStrengths } = analyseLifecycle(m.lifecycle);

  const hotspots =
    m.hotspots && m.hotspots.length > 0
      ? m.hotspots.map((key) => ({
          key,
          label: LIFECYCLE_STAGE_LABELS[key],
          score: m.lifecycle[key] ?? 1,
        }))
      : autoHotspots;

  const strengths =
    m.strengths && m.strengths.length > 0
      ? m.strengths.map((key) => ({
          key,
          label: LIFECYCLE_STAGE_LABELS[key],
          score: m.lifecycle[key] ?? 1,
        }))
      : autoStrengths;

  const highest = hotspots[0];
  const hotspotLabels = hotspots.map((item) => item.label).join(', ');
  const strengthLabels = strengths.map((item) => item.label).join(', ');
  const summary = `Hotspots: ${hotspotLabels}. Strengths: ${strengthLabels}.`;

  if (highest.score >= 3) {
    return `${summary} Main hotspot is ${highest.label.toLowerCase()}; reduce via targeted specification.`;
  }

  return `${summary} Balanced lifecycle profile with no major hotspots.`;
}

function labelKind(lbl: MaterialPdfModel['carbonLabel']): 'green' | 'amber' | 'red' {
  if (lbl === 'Low Carbon') return 'green';
  if (lbl === 'Medium Carbon') return 'amber';
  return 'red';
}

function drawChip(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  kind: 'neutral' | 'green' | 'amber' | 'red'
) {
  const bgColors: Record<typeof kind, [number, number, number]> = {
    neutral: [243, 244, 246],
    green: [220, 252, 231],
    amber: [254, 249, 195],
    red: [254, 226, 226],
  };
  const textColors: Record<typeof kind, [number, number, number]> = {
    neutral: [75, 85, 99],
    green: [22, 101, 52],
    amber: [133, 77, 14],
    red: [153, 27, 27],
  };

  const bg = bgColors[kind];
  const fg = textColors[kind];

  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(fg[0], fg[1], fg[2]);
  doc.text(text, x + 5, y + 8.5);
}

function safeAddImage(doc: jsPDF, dataUri: string, x: number, y: number, w: number, h: number) {
  try {
    const format = dataUri.includes('image/jpeg')
      ? 'JPEG'
      : dataUri.includes('image/png')
      ? 'PNG'
      : undefined;
    if (format) {
      doc.addImage(dataUri, format, x, y, w, h, undefined, 'FAST');
    } else {
      doc.addImage(dataUri, x, y, w, h);
    }
  } catch {
    // Ignore image failures
  }
}

function measureText(
  doc: jsPDF,
  text: string,
  size: number,
  font: string,
  style: 'normal' | 'bold'
) {
  doc.setFont(font as never, style);
  doc.setFontSize(size);
  return doc.getTextWidth(text);
}

function clampText(doc: jsPDF, text: string, maxW: number) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 3 && doc.getTextWidth(t + '...') > maxW) t = t.slice(0, -1);
  return t.length ? `${t}...` : '';
}

function wrapLines(doc: jsPDF, text: string, maxW: number, fontSize: number) {
  doc.setFontSize(fontSize);
  // @ts-ignore
  return doc.splitTextToSize(text, maxW) as string[];
}
