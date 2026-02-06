import type { jsPDF } from 'jspdf';

const A4_W = 595.28;
const A4_H = 841.89;
const SHEET_H = A4_H / 2;

const M = 34;
const G = 12;
const R = 12;

const HEADER_H = 44;
const MAIN_H = 210;
const ACTIONS_H = 72;
const RISKS_H = 54;
const FOOTER_H = 18;

const CARD_PAD = 12;

export type LifecycleKey =
  | 'raw'
  | 'manufacturing'
  | 'transport'
  | 'installation'
  | 'inUse'
  | 'maintenance'
  | 'endOfLife';

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
  epdAvailable?: boolean;

  strategicValue?: string;
  specActions?: string[];

  risks?: { risk: string; mitigation: string }[];
};

type RenderOpts = {
  sheetIndex: 0 | 1;
  generatedOnText?: string;
};

const LIFECYCLE_STAGE_LABELS: Record<LifecycleKey, string> = {
  raw: 'Raw Materials',
  manufacturing: 'Manufacturing',
  transport: 'Transport',
  installation: 'Installation',
  inUse: 'In Use',
  maintenance: 'Maintenance',
  endOfLife: 'End of Life',
};

const LIFECYCLE_STAGE_CHART_LABELS: Record<LifecycleKey, string[]> = {
  raw: ['Raw', 'Materials'],
  manufacturing: ['Manufacturing'],
  transport: ['Transport'],
  installation: ['Installation'],
  inUse: ['In Use'],
  maintenance: ['Maintenance'],
  endOfLife: ['End of', 'Life'],
};

const LIFECYCLE_ORDER: LifecycleKey[] = [
  'raw',
  'manufacturing',
  'transport',
  'installation',
  'inUse',
  'maintenance',
  'endOfLife',
];

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

  drawRoundRect(doc, x0, y0, w, h, R, { stroke: true, fill: false });

  let y = y0;

  renderHeader(doc, material, x0, y, w, HEADER_H);
  y += HEADER_H + 10;

  renderMain(doc, material, x0, y, w, MAIN_H);
  y += MAIN_H + 10;

  renderActions(doc, material, x0, y, w, ACTIONS_H);
  y += ACTIONS_H + 8;

  const risks = (material.risks ?? []).slice(0, 2).filter((r) => r.risk && r.mitigation);
  if (risks.length) {
    renderRisks(doc, risks, x0, y, w, RISKS_H);
    y += RISKS_H + 8;
  }

  renderFooter(doc, material, opts, x0, y0 + h - FOOTER_H, w, FOOTER_H);
}

function renderHeader(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(25, 25, 25);
  doc.text(clampText(doc, m.name, w - 160), x, y + 24);

  const chipY = y + 10;
  const chipH = 16;
  const rightX = x + w;

  const chips = [
    { text: m.category, kind: 'neutral' as const },
    { text: m.carbonLabel, kind: labelKind(m.carbonLabel) },
  ];

  let cx = rightX;
  for (let i = chips.length - 1; i >= 0; i -= 1) {
    const t = chips[i].text;
    const tw = measureText(doc, t, 8, 'helvetica', 'normal');
    const chipW = tw + 14;
    cx -= chipW;
    drawChip(doc, cx, chipY, chipW, chipH, t, chips[i].kind);
    cx -= 8;
  }

  doc.setDrawColor(230);
  doc.setLineWidth(1);
  doc.line(x, y + h, x + w, y + h);
}

function renderMain(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  const colL = Math.round(w * 0.52);
  const colR = w - colL - G;

  const xL = x;
  const xR = x + colL + G;

  renderImageAndIdentity(doc, m, xL, y, colL, h);
  renderLifecycle(doc, m, xR, y, colR, h);
}

function renderImageAndIdentity(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  const imageBoxSize = 92;
  const cardGap = 6;
  const imageInset = 6;

  drawCard(doc, x, y, imageBoxSize, imageBoxSize, { tint: 'light' });
  if (m.imageDataUri) {
    const ix = x + imageInset;
    const iy = y + imageInset;
    const iw = imageBoxSize - imageInset * 2;
    const ih = imageBoxSize - imageInset * 2;
    safeAddImage(doc, m.imageDataUri, ix, iy, iw, ih);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    m.imageCaption ? clampText(doc, m.imageCaption, imageBoxSize) : 'Typical finish shown',
    x,
    y + imageBoxSize + 8
  );

  let ty = y + imageBoxSize + 18;

  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('What it is', x, ty);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const what = (m.whatItIs ?? '').trim();
  let textCursorY = ty + 12;
  if (what) {
    const lines = wrapLines(doc, what, w, 8).slice(0, 2);
    doc.text(lines, x, textCursorY);
    textCursorY += lines.length * 9;
  }
  textCursorY += 8;

  const uses = (m.typicalUses ?? []).slice(0, 3).filter(Boolean);
  if (uses.length) {
    const uy = textCursorY;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text('Typical uses:', x, uy);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60);
    let by = uy + 12;
    for (const u of uses) {
      doc.text(`- ${clampText(doc, u, w - 10)}`, x + 2, by);
      by += 11;
    }
  }
}

function renderLifecycle(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  drawCard(doc, x, y, w, h, { tint: 'light' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text('LIFECYCLE IMPACT PROFILE', x + CARD_PAD, y + 18);

  const chartX = x + CARD_PAD;
  const chartY = y + 24;
  const chartW = w - 2 * CARD_PAD;
  const chartH = 118;

  doc.setDrawColor(230);
  doc.setLineWidth(1);
  doc.rect(chartX, chartY, chartW, chartH);

  const stages = LIFECYCLE_ORDER.map((key) => ({
    key,
    label: LIFECYCLE_STAGE_LABELS[key],
    chartLabel: LIFECYCLE_STAGE_CHART_LABELS[key],
    score: Math.max(1, Math.min(5, m.lifecycle[key] ?? 1)),
  }));
  drawLifecycleRadarChart(doc, chartX, chartY, chartW, chartH, stages);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(
    'Lower scores = lower impact (1 minimal, 5 significant)',
    x + CARD_PAD,
    chartY + chartH + 10
  );

  const { highest, secondHighest, strongest } = summariseLifecycle(m.lifecycle);

  const infoY = chartY + chartH + 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30);
  doc.text('Highest stage:', x + CARD_PAD, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${labelStage(highest.key)} (${highest.val.toFixed(1)}/5)`, x + CARD_PAD + 72, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('Second:', x + CARD_PAD, infoY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${labelStage(secondHighest.key)} (${secondHighest.val.toFixed(1)}/5)`,
    x + CARD_PAD + 42,
    infoY + 14
  );

  const stripY = infoY + 26;
  drawRoundRect(doc, x + CARD_PAD, stripY, w - 2 * CARD_PAD, 22, 10, {
    fill: true,
    stroke: false,
    fillGrey: 245,
  });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70);
  doc.text('Strongest', x + CARD_PAD + 8, stripY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30);
  const strongText =
    `${labelStage(strongest[0].key)} (${strongest[0].val.toFixed(1)}/5)` +
    (strongest[1] ? `   ${labelStage(strongest[1].key)} (${strongest[1].val.toFixed(1)}/5)` : '');
  doc.text(
    clampText(doc, strongText, w - 2 * CARD_PAD - 80),
    x + CARD_PAD + 78,
    stripY + 14
  );
}

function renderActions(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  drawCard(doc, x, y, w, h, { tint: 'greenTint' });

  const colL = Math.round((w - G) * 0.48);
  const colR = w - colL - G;

  const xL = x + CARD_PAD;
  const xR = x + CARD_PAD + colL + G;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30);
  doc.text('Strategic value', xL, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60);
  const sv = (m.strategicValue ?? '').trim();
  const svLines = sv ? wrapLines(doc, sv, colL - CARD_PAD, 8).slice(0, 3) : [];
  if (svLines.length) doc.text(svLines, xL, y + 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30);
  doc.text('Specification actions', xR, y + 16);

  const actions = (m.specActions ?? []).slice(0, 3).filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60);
  let ay = y + 30;
  for (const a of actions) {
    doc.text(`- ${clampText(doc, a, colR - 8)}`, xR, ay);
    ay += 12;
  }
}

function renderRisks(
  doc: jsPDF,
  risks: { risk: string; mitigation: string }[],
  x: number,
  y: number,
  w: number,
  h: number
) {
  drawCard(doc, x, y, w, h, { tint: 'amberTint' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30);
  doc.text('Risks and mitigation', x + CARD_PAD, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60);

  let ry = y + 30;
  for (const r of risks.slice(0, 2)) {
    const text = `- Risk: ${r.risk}  Mitigation: ${r.mitigation}`;
    const lines = wrapLines(doc, text, w - 2 * CARD_PAD, 8).slice(0, 2);
    doc.text(lines, x + CARD_PAD, ry);
    ry += 12;
  }
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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110);

  const conf = m.lifecycleConfidence ?? 'Medium';
  const epd = m.epdAvailable ? 'EPD: Yes' : 'EPD: No';
  const gen = opts.generatedOnText ? `Generated: ${opts.generatedOnText}` : '';

  const line = `Data confidence: ${conf}  -  ${epd}${gen ? `  -  ${gen}` : ''}`;
  doc.text(clampText(doc, line, w), x, y + 12);
}

function summariseLifecycle(lc: Record<LifecycleKey, number>) {
  const entries = Object.entries(lc) as [LifecycleKey, number][];
  const sortedDesc = [...entries].sort((a, b) => b[1] - a[1]);
  const sortedAsc = [...entries].sort((a, b) => a[1] - b[1]);

  return {
    highest: { key: sortedDesc[0][0], val: sortedDesc[0][1] },
    secondHighest: { key: sortedDesc[1][0], val: sortedDesc[1][1] },
    strongest: [
      { key: sortedAsc[0][0], val: sortedAsc[0][1] },
      { key: sortedAsc[1]?.[0] ?? sortedAsc[0][0], val: sortedAsc[1]?.[1] ?? sortedAsc[0][1] },
    ],
  };
}

function labelStage(k: LifecycleKey) {
  return LIFECYCLE_STAGE_LABELS[k] ?? k;
}

function labelKind(lbl: MaterialPdfModel['carbonLabel']) {
  if (lbl === 'Low Carbon') return 'green';
  if (lbl === 'Medium Carbon') return 'amber';
  return 'red';
}

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { tint: 'light' | 'greenTint' | 'amberTint' }
) {
  const fill = opts.tint === 'light' ? 250 : opts.tint === 'greenTint' ? 245 : 250;
  drawRoundRect(doc, x, y, w, h, R, { fill: true, stroke: true, fillGrey: fill });
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
  const fillGrey = kind === 'neutral' ? 245 : kind === 'green' ? 232 : kind === 'amber' ? 245 : 245;
  drawRoundRect(doc, x, y, w, h, 10, { fill: true, stroke: false, fillGrey });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(kind === 'green' ? 40 : 60);
  doc.text(text, x + 7, y + 11);
}

function drawRoundRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  opts: { fill: boolean; stroke: boolean; fillGrey?: number }
) {
  if (opts.fill) {
    const g = opts.fillGrey ?? 255;
    doc.setFillColor(g, g, g);
  }
  if (opts.stroke) {
    doc.setDrawColor(230);
    doc.setLineWidth(1);
  }
  doc.roundedRect(
    x,
    y,
    w,
    h,
    r,
    r,
    opts.fill && opts.stroke ? 'FD' : opts.fill ? 'F' : 'S'
  );
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

function drawPolygon(
  doc: jsPDF,
  points: Array<{ x: number; y: number }>,
  style: 'S' | 'F' | 'FD'
) {
  if (points.length < 2) return;
  const segments = points.slice(1).map((point, index) => [
    point.x - points[index].x,
    point.y - points[index].y,
  ]);
  doc.lines(segments, points[0].x, points[0].y, [1, 1], style, true);
}

function drawLifecycleRadarChart(
  doc: jsPDF,
  x: number,
  top: number,
  width: number,
  height: number,
  stages: Array<{ key: LifecycleKey; label: string; chartLabel: string[]; score: number }>
) {
  const centerX = x + width / 2;
  const centerY = top + height / 2;
  const radius = Math.min(width, height) * 0.34;
  const stageCount = stages.length;

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
    const ring = stages.map((_, index) => pointFor(index, level));
    drawPolygon(doc, ring, 'S');
  }

  stages.forEach((_, index) => {
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

  const radarPoints = stages.map((stage, index) => pointFor(index, stage.score));
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1.2);
  drawPolygon(doc, radarPoints, 'S');
  doc.setLineWidth(0.5);

  doc.setFillColor(5, 150, 105);
  radarPoints.forEach((point) => {
    doc.circle(point.x, point.y, 1.8, 'F');
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  stages.forEach((stage, index) => {
    const labelPoint = pointFor(index, 6.15);
    const cosVal = Math.cos(labelPoint.angle);
    const align: 'left' | 'center' | 'right' =
      cosVal > 0.35 ? 'left' : cosVal < -0.35 ? 'right' : 'center';
    const topOffset = index === 0 ? -5 : 0;
    stage.chartLabel.forEach((line, lineIndex) => {
      doc.text(line, labelPoint.x, labelPoint.y + topOffset + lineIndex * 7, { align });
    });
  });
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
