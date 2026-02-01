import type { MaterialOption } from '../../types';
import type { MaterialMetrics, PDFContext } from '../../types/sustainability';
import { calculateProjectMetrics } from './paletteMetrics';

export function renderSpecifiersSnapshot(
  ctx: PDFContext,
  moodboardImage: string | null,
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
): void {
  // 1. Header
  const headerHeight = 35;
  ctx.doc.setFillColor(243, 244, 246);
  ctx.doc.rect(0, 0, ctx.pageWidth, headerHeight, 'F');

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(20);
  ctx.doc.setTextColor(17, 24, 39);
  ctx.doc.text('Sustainability Snapshot', ctx.margin, 23);

  // Metadata
  ctx.doc.setFontSize(9);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(107, 114, 128);
  const dateStr = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const metaX = ctx.pageWidth - ctx.margin;
  ctx.doc.text(`DATE: ${dateStr}`, metaX, 14, { align: 'right' });
  ctx.doc.text('STAGE: Concept / RIBA 2', metaX, 24, { align: 'right' });

  // 2. HERO IMAGE (Much Larger)
  const availableWidth = ctx.pageWidth - ctx.margin * 2;
  const imgSize = 180;
  const imgX = (ctx.pageWidth - imgSize) / 2;
  const imgY = headerHeight + 15;

  if (moodboardImage) {
    try {
      ctx.doc.addImage(moodboardImage, 'PNG', imgX, imgY, imgSize, imgSize);
    } catch (error) {
      ctx.doc.setFillColor(243, 244, 246);
      ctx.doc.rect(imgX, imgY, imgSize, imgSize, 'F');
      ctx.doc.setFontSize(10);
      ctx.doc.setTextColor(156, 163, 175);
      ctx.doc.text('Moodboard Image', ctx.pageWidth / 2, imgY + imgSize / 2, { align: 'center' });
    }
  } else {
    ctx.doc.setFillColor(243, 244, 246);
    ctx.doc.rect(imgX, imgY, imgSize, imgSize, 'F');
  }

  // Border for image
  ctx.doc.setDrawColor(229, 231, 235);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.rect(imgX, imgY, imgSize, imgSize);

  // 3. Material List
  ctx.cursorY = imgY + imgSize + 20;

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(0);
  ctx.doc.text('Material Palette Composition', ctx.margin, ctx.cursorY);

  ctx.doc.setDrawColor(209, 213, 219);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.cursorY + 4, ctx.pageWidth - ctx.margin, ctx.cursorY + 4);

  ctx.cursorY += 12;

  const swatchSize = 10;
  const swatchRadius = swatchSize / 2;
  const swatchX = ctx.margin;
  const textX = swatchX + swatchSize + 10;
  const textWidth = availableWidth - (textX - ctx.margin) - 4;

  materials.forEach((material) => {
    const nameY = ctx.cursorY;
    const centerY = nameY - 3;
    const tone = material.tone || '#e5e7eb';
    const hex = tone.replace('#', '');
    const isValidHex = hex.length === 6;
    const r = isValidHex ? parseInt(hex.substring(0, 2), 16) : 229;
    const g = isValidHex ? parseInt(hex.substring(2, 4), 16) : 231;
    const b = isValidHex ? parseInt(hex.substring(4, 6), 16) : 235;

    ctx.doc.setFillColor(r, g, b);
    ctx.doc.setDrawColor(229, 231, 235);
    ctx.doc.setLineWidth(0.5);
    ctx.doc.circle(swatchX + swatchRadius, centerY, swatchRadius, 'FD');

    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(17, 24, 39);
    ctx.doc.text(material.name, textX, nameY);

    const sublineParts: string[] = [];
    if (material.finish) sublineParts.push(material.finish);
    if (material.category) {
      const categoryLabel =
        material.category === 'external'
          ? 'External Envelope'
          : material.category
              .split('-')
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ');
      sublineParts.push(categoryLabel);
    }
    const subline = sublineParts.join(' • ');

    if (subline) {
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(75, 85, 99);
      const lines = ctx.doc.splitTextToSize(subline, textWidth);
      const sublineY = nameY + 10;
      ctx.doc.text(lines, textX, sublineY);
      ctx.cursorY = sublineY + lines.length * 10 + 6;
    } else {
      ctx.cursorY = nameY + 16;
    }
  });

  ctx.cursorY += 10;

  // 4. Insight Box
  const calc = calculateProjectMetrics(materials, metrics);

  // Box Background
  const boxHeight = 45;
  ctx.doc.setFillColor(240, 253, 244);
  ctx.doc.rect(ctx.margin, ctx.cursorY, availableWidth, boxHeight, 'F');

  // Left Green Accent Bar
  ctx.doc.setFillColor(22, 163, 74);
  ctx.doc.rect(ctx.margin, ctx.cursorY, 4, boxHeight, 'F');

  // Text inside box
  const pad = 10;
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(21, 128, 61);
  ctx.doc.text('PALETTE INSIGHT:', ctx.margin + pad, ctx.cursorY + pad + 5);

  let insightText = `This configuration represents a ${calc.paletteType}. `;
  if (calc.bioRatio > 0.3) {
    insightText += 'It prioritizes bio-based materials for high carbon storage. ';
  } else {
    insightText += 'It relies on industrial finishes requiring careful carbon management. ';
  }
  insightText += 'See Page 2 for critical hotspots.';

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(55, 65, 81);
  const lines = ctx.doc.splitTextToSize(insightText, availableWidth - pad * 2);
  ctx.doc.text(lines, ctx.margin + pad, ctx.cursorY + pad + 15);
}
