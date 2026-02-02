import type { jsPDF } from 'jspdf';
import type { PDFContext, TrafficLight } from '../../types/sustainability';

const MARGIN = 48;

export const PDF_TYPE_SCALE = {
  // Keep the report to a strict 4-step type scale: 16 / 12 / 10 / 8.
  pageTitle: 16,
  sectionTitle: 12,
  subheading: 12,
  body: 10,
  small: 8,
  caption: 8,
  micro: 8,
} as const;

export const TRAFFIC_LIGHT_COLORS: Record<TrafficLight, [number, number, number]> = {
  green: [34, 139, 34],
  amber: [255, 191, 0],
  red: [220, 53, 69],
};

export function lineHeightFor(
  fontSize: number,
  density: 'tight' | 'normal' | 'loose' = 'normal'
): number {
  const factor = density === 'tight' ? 1.2 : density === 'loose' ? 1.45 : 1.32;
  return Math.max(fontSize + 1, Math.round(fontSize * factor));
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
export function addHeading(ctx: PDFContext, text: string, size = 16): void {
  ensureSpace(ctx, size * 1.6);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  ctx.doc.text(text, ctx.margin, ctx.cursorY);
  ctx.cursorY += lineHeightFor(size, 'loose');
}

/**
 * Add a paragraph to the PDF
 */
export function addParagraph(ctx: PDFContext, text: string, size = 11, gap = 8): void {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  const maxWidth = ctx.pageWidth - ctx.margin * 2;
  const lineHeight = lineHeightFor(size);
  const lines = ctx.doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string) => {
    ensureSpace(ctx, lineHeight);
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += lineHeight;
  });
  ctx.cursorY += gap;
}

/**
 * Add a bullet point
 */
export function addBullet(ctx: PDFContext, text: string, size = 10): void {
  ensureSpace(ctx, size * 1.4);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  const maxWidth = ctx.pageWidth - ctx.margin * 2 - 15;
  const lineHeight = lineHeightFor(size);
  const lines = ctx.doc.splitTextToSize(text, maxWidth);
  ctx.doc.text('-', ctx.margin, ctx.cursorY);
  lines.forEach((line: string, i: number) => {
    ctx.doc.text(line, ctx.margin + 12, ctx.cursorY + i * lineHeight);
  });
  ctx.cursorY += lines.length * lineHeight + 4;
}

/**
 * Draw a traffic light indicator
 */
export function drawTrafficLight(
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
