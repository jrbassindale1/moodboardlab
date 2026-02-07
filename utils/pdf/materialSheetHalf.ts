import type { jsPDF } from 'jspdf';
import {
  drawLifecycleRadarChart,
  LIFECYCLE_ORDER,
  LIFECYCLE_STAGE_LABELS,
  type LifecycleKey,
} from './charts/radarLifecycle';

// Re-export for external use
export type { LifecycleKey } from './charts/radarLifecycle';

const A4_W = 595.28;
const A4_H = 841.89;
const SHEET_H = A4_H / 2;

const M = 20;
const G = 10;
const R = 8;

const CARD_PAD = 10;

export type MaterialPdfModel = {
  name: string;
  category: string;
  carbonLabel: 'Low Carbon' | 'Medium Carbon' | 'High Carbon';

  imageDataUri?: string;
  imageCaption?: string;

  whatItIs?: string;
  typicalUses?: string[];

  lifecycle: Record<LifecycleKey, number>;
  lifecycleConfidence?: 'High' | 'Medium' | 'Low';
  lifecycleInsight?: string;
  epdAvailable?: boolean;

  strategicValue?: string;
  specActions?: string[];

  risks?: { risk: string; mitigation: string }[];
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
  const sheetTop = opts.sheetIndex === 0 ? 0 : SHEET_H;
  const x0 = M;
  const y0 = sheetTop + M;
  const w = A4_W - 2 * M;
  const h = SHEET_H - 2 * M;

  // Main card border
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.roundedRect(x0, y0, w, h, R, R, 'S');

  let y = y0;

  // Header row (with thumbnail)
  const headerH = 38;
  renderHeader(doc, material, x0, y, w, headerH);
  y += headerH + 6;

  // Two-column body
  const bodyH = 200;
  renderBody(doc, material, x0, y, w, bodyH);
  y += bodyH + 6;

  // Specification actions (compact full-width band)
  const actions = (material.specActions ?? []).slice(0, 3).filter(Boolean);
  if (actions.length) {
    const actionsH = 44;
    renderActions(doc, material, x0, y, w, actionsH);
  }

  // Footer
  const footerH = 14;
  renderFooter(doc, material, opts, x0, y0 + h - footerH, w, footerH);
}

function renderHeader(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // Thumbnail in top-right corner (small, no border)
  const thumbSize = 32;
  const thumbX = x + w - CARD_PAD - thumbSize;
  const thumbY = y + 4;

  if (m.imageDataUri) {
    safeAddImage(doc, m.imageDataUri, thumbX, thumbY, thumbSize, thumbSize);
  } else {
    // Light placeholder if no image
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(thumbX, thumbY, thumbSize, thumbSize, 3, 3, 'F');
  }

  // Material name (to the left of thumbnail)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(clampText(doc, m.name, w - thumbSize - 100), x + CARD_PAD, y + 16);

  // Pills below the name
  const chipY = y + 22;
  const chipH = 12;

  const chips = [
    { text: m.category, kind: 'neutral' as const },
    { text: m.carbonLabel, kind: labelKind(m.carbonLabel) },
  ];

  let cx = x + CARD_PAD;
  for (const chip of chips) {
    const tw = measureText(doc, chip.text, 6.5, 'helvetica', 'bold');
    const chipW = tw + 10;
    drawChip(doc, cx, chipY, chipW, chipH, chip.text, chip.kind);
    cx += chipW + 5;
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

  // Left column: material description, typical uses, strategic value
  renderLeftColumn(doc, m, xL, y, colL - CARD_PAD, h);

  // Right column: radar chart + lifecycle insight
  renderRightColumn(doc, m, xR, y, colR - CARD_PAD, h);
}

function renderLeftColumn(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // Light grey card background
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x - 4, y, w + 8, h - 8, 6, 6, 'FD');

  let cursorY = y + 12;

  // What it is
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.text('WHAT IT IS', x, cursorY);
  cursorY += 10;

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

  // Strategic value
  const sv = (m.strategicValue ?? '').trim();
  if (sv) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(75, 85, 99);
    doc.text('STRATEGIC VALUE', x, cursorY);
    cursorY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const svLines = wrapLines(doc, sv, w, 8).slice(0, 4);
    doc.text(svLines, x, cursorY);
  }
}

function renderRightColumn(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // White card background with border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x - 4, y, w + 8, h - 8, 6, 6, 'FD');

  // Radar chart
  const chartX = x;
  const chartY = y + 6;
  const chartW = w;
  const chartH = 120;

  drawLifecycleRadarChart(doc, { x: chartX, y: chartY, width: chartW, height: chartH }, m.lifecycle);

  // Helper text centered below chart
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(107, 114, 128);
  doc.text(
    'Lower scores = lower impact (1 minimal, 5 significant)',
    x + w / 2,
    chartY + chartH + 6,
    { align: 'center' }
  );

  // Lifecycle insight box
  const insightY = chartY + chartH + 14;
  const insightH = h - (insightY - y) - 14;
  const insightText = m.lifecycleInsight || generateDefaultInsight(m);

  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x, insightY, w, insightH, 4, 4, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);
  const insightLines = wrapLines(doc, insightText, w - 12, 7.5).slice(0, 4);
  doc.text(insightLines, x + 6, insightY + 12);
}

function renderActions(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // Light green background like briefing's checklist style
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(x + CARD_PAD, y, w - 2 * CARD_PAD, h, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(21, 128, 61);
  doc.text('SPECIFICATION ACTIONS', x + CARD_PAD + 8, y + 11);

  const actions = (m.specActions ?? []).slice(0, 3).filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(55, 65, 81);

  let ay = y + 22;
  actions.forEach((action) => {
    const lines = wrapLines(doc, `• ${action}`, w - 2 * CARD_PAD - 16, 7).slice(0, 1);
    doc.text(lines, x + CARD_PAD + 8, ay);
    ay += 9;
  });
}

function renderFooter(
  doc: jsPDF,
  m: MaterialPdfModel,
  opts: RenderOpts,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Divider line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(x + CARD_PAD, y - 4, x + w - CARD_PAD, y - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(107, 114, 128);

  const conf = m.lifecycleConfidence ?? 'Medium';
  const epd = m.epdAvailable ? 'EPD: Yes' : 'EPD: No';
  const gen = opts.generatedOnText ? `Generated: ${opts.generatedOnText}` : '';

  const parts = [`Data confidence: ${conf}`, epd];
  if (gen) parts.push(gen);

  doc.text(parts.join('  ·  '), x + CARD_PAD, y + 6);
}

function generateDefaultInsight(m: MaterialPdfModel): string {
  const entries = Object.entries(m.lifecycle) as [LifecycleKey, number][];
  const sortedDesc = [...entries].sort((a, b) => b[1] - a[1]);
  const sortedAsc = [...entries].sort((a, b) => a[1] - b[1]);

  const highest = sortedDesc[0];
  const lowest = sortedAsc[0];

  if (highest[1] >= 3) {
    return `Biggest hotspot is ${LIFECYCLE_STAGE_LABELS[highest[0]].toLowerCase()} (${highest[1].toFixed(1)}/5). ${LIFECYCLE_STAGE_LABELS[lowest[0]]} performs well at ${lowest[1].toFixed(1)}/5.`;
  }

  return `Balanced lifecycle profile with no major hotspots. ${LIFECYCLE_STAGE_LABELS[lowest[0]]} stage is strongest at ${lowest[1].toFixed(1)}/5.`;
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
