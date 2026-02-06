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
  raw: 'Raw',
  manufacturing: 'Manufacturing',
  transport: 'Transport',
  installation: 'Installation',
  inUse: 'In Use',
  maintenance: 'Maintenance',
  endOfLife: 'End of Life',
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
  doc.setFontSize(20);
  doc.setTextColor(25, 25, 25);
  doc.text(clampText(doc, m.name, w - 200), x, y + 28);

  const chipY = y + 14;
  const chipH = 20;
  const rightX = x + w;

  const chips = [
    { text: m.category, kind: 'neutral' as const },
    { text: m.carbonLabel, kind: labelKind(m.carbonLabel) },
  ];

  let cx = rightX;
  for (let i = chips.length - 1; i >= 0; i -= 1) {
    const t = chips[i].text;
    const tw = measureText(doc, t, 11, 'helvetica', 'normal');
    const chipW = tw + 18;
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
  const imgH = 120;
  const cardGap = 10;

  drawCard(doc, x, y, w, imgH, { tint: 'light' });
  if (m.imageDataUri) {
    const ix = x + 10;
    const iy = y + 10;
    const iw = w - 20;
    const ih = imgH - 24;
    safeAddImage(doc, m.imageDataUri, ix, iy, iw, ih);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    m.imageCaption ? clampText(doc, m.imageCaption, w - 20) : 'Typical finish shown',
    x + 10,
    y + imgH - 6
  );

  let ty = y + imgH + cardGap;

  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('What it is', x, ty + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const what = (m.whatItIs ?? '').trim();
  if (what) {
    const lines = wrapLines(doc, what, w, 11).slice(0, 2);
    doc.text(lines, x, ty + 34);
  }

  const uses = (m.typicalUses ?? []).slice(0, 3).filter(Boolean);
  if (uses.length) {
    const uy = ty + 62;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text('Typical uses:', x, uy);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60);
    let by = uy + 18;
    for (const u of uses) {
      doc.text(`- ${clampText(doc, u, w - 10)}`, x + 2, by);
      by += 16;
    }
  }
}

function renderLifecycle(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  drawCard(doc, x, y, w, h, { tint: 'light' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(60);
  doc.text('LIFECYCLE IMPACT PROFILE', x + CARD_PAD, y + 20);

  const chartX = x + CARD_PAD;
  const chartY = y + 28;
  const chartW = w - 2 * CARD_PAD;
  const chartH = 118;

  renderLifecycleBars(doc, m.lifecycle, chartX, chartY, chartW, chartH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    'Lower scores = lower impact (1 minimal, 5 significant)',
    x + CARD_PAD,
    chartY + chartH + 12
  );

  const { highest, secondHighest, strongest } = summariseLifecycle(m.lifecycle);

  const infoY = chartY + chartH + 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text('Highest stage:', x + CARD_PAD, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${labelStage(highest.key)} (${highest.val.toFixed(1)}/5)`, x + CARD_PAD + 92, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('Second:', x + CARD_PAD, infoY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${labelStage(secondHighest.key)} (${secondHighest.val.toFixed(1)}/5)`,
    x + CARD_PAD + 52,
    infoY + 18
  );

  const stripY = infoY + 34;
  drawRoundRect(doc, x + CARD_PAD, stripY, w - 2 * CARD_PAD, 26, 10, {
    fill: true,
    stroke: false,
    fillGrey: 245,
  });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70);
  doc.text('Strongest', x + CARD_PAD + 8, stripY + 17);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30);
  const strongText =
    `${labelStage(strongest[0].key)} (${strongest[0].val.toFixed(1)}/5)` +
    (strongest[1] ? `   ${labelStage(strongest[1].key)} (${strongest[1].val.toFixed(1)}/5)` : '');
  doc.text(
    clampText(doc, strongText, w - 2 * CARD_PAD - 80),
    x + CARD_PAD + 78,
    stripY + 17
  );
}

function renderActions(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  drawCard(doc, x, y, w, h, { tint: 'greenTint' });

  const colL = Math.round((w - G) * 0.48);
  const colR = w - colL - G;

  const xL = x + CARD_PAD;
  const xR = x + CARD_PAD + colL + G;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Strategic value', xL, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(60);
  const sv = (m.strategicValue ?? '').trim();
  const svLines = sv ? wrapLines(doc, sv, colL - CARD_PAD, 10.5).slice(0, 3) : [];
  if (svLines.length) doc.text(svLines, xL, y + 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Specification actions', xR, y + 20);

  const actions = (m.specActions ?? []).slice(0, 3).filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(60);
  let ay = y + 38;
  for (const a of actions) {
    doc.text(`- ${clampText(doc, a, colR - 8)}`, xR, ay);
    ay += 16;
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
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Risks and mitigation', x + CARD_PAD, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(60);

  let ry = y + 38;
  for (const r of risks.slice(0, 2)) {
    const text = `- Risk: ${r.risk}  Mitigation: ${r.mitigation}`;
    const lines = wrapLines(doc, text, w - 2 * CARD_PAD, 10.5).slice(0, 2);
    doc.text(lines, x + CARD_PAD, ry);
    ry += 18;
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
  doc.setFontSize(9.5);
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
  doc.setFontSize(11);
  doc.setTextColor(kind === 'green' ? 40 : 60);
  doc.text(text, x + 9, y + 14);
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

function renderLifecycleBars(
  doc: jsPDF,
  lc: Record<LifecycleKey, number>,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setDrawColor(230);
  doc.setLineWidth(1);
  doc.rect(x, y, w, h);

  const chartPadding = 10;
  const innerX = x + chartPadding;
  const innerY = y + chartPadding;
  const innerW = w - chartPadding * 2;
  const innerH = h - chartPadding * 2 - 14;

  const slotW = innerW / LIFECYCLE_ORDER.length;
  const barW = Math.min(18, slotW * 0.6);

  doc.setFillColor(16, 185, 129);
  doc.setTextColor(90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  LIFECYCLE_ORDER.forEach((key, idx) => {
    const value = Math.max(1, Math.min(5, lc[key] ?? 1));
    const barH = (value / 5) * innerH;
    const bx = innerX + idx * slotW + (slotW - barW) / 2;
    const by = innerY + innerH - barH;
    doc.rect(bx, by, barW, barH, 'F');

    const label = LIFECYCLE_STAGE_LABELS[key];
    const shortLabel = label.length > 9 ? `${label.slice(0, 8)}.` : label;
    doc.text(shortLabel, bx - 2, innerY + innerH + 10);
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
