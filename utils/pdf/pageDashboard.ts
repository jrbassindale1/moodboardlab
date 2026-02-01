import type { MaterialOption } from '../../types';
import type { MaterialMetrics, PDFContext } from '../../types/sustainability';
import { formatScore } from '../sustainabilityScoring';
import { isLandscapeMaterial } from '../lifecycleDurations';
import { addHeading, drawTrafficLight, ensureSpace } from './layout';
import { drawGroupHeader, groupMaterialsByElement } from './groups';

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

  // --- RENDER CARBON DISTRIBUTION CHART ---
  const chartY = ctx.margin + 20;
  const chartWidth = ctx.pageWidth - ctx.margin * 2;

  const totalEmbodied = Array.from(metrics.values()).reduce((sum, m) => sum + m.embodied_proxy, 0);
  const sortedMat = [...materials]
    .filter((m) => !isLandscapeMaterial(m))
    .sort((a, b) => {
      const mA = metrics.get(a.id)?.embodied_proxy || 0;
      const mB = metrics.get(b.id)?.embodied_proxy || 0;
      return mB - mA;
    })
    .slice(0, 5);

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(0);
  ctx.doc.text('Estimated Embodied Carbon Distribution (Top 5 Contributors)', ctx.margin, chartY - 5);

  let currentY = chartY;
  const maxBarWidth = chartWidth - 60;

  sortedMat.forEach((mat) => {
    const met = metrics.get(mat.id);
    if (!met) return;

    const percentage = totalEmbodied > 0 ? met.embodied_proxy / totalEmbodied : 0;
    const barW = maxBarWidth * percentage;

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(0);
    ctx.doc.text(mat.name, ctx.margin, currentY + 3);

    ctx.doc.setFillColor(55, 65, 81);
    ctx.doc.roundedRect(ctx.margin + 50, currentY - 2, barW, 6, 1, 1, 'F');

    ctx.doc.setTextColor(100);
    ctx.doc.text(`${(percentage * 100).toFixed(0)}%`, ctx.margin + 50 + barW + 5, currentY + 3);
    ctx.doc.setTextColor(0);

    currentY += 10;
  });

  ctx.cursorY = currentY + 20;

  // ===== MASTER TABLE: Impact Summary =====
  addHeading(ctx, 'Element Summary (Grouped by Element)', 12);

  const tableWidth = ctx.pageWidth - ctx.margin * 2;
  const colMaterialW = tableWidth * 0.28;
  const colEmbodiedW = tableWidth * 0.32;
  const colLifeW = tableWidth * 0.16;
  const colReplW = tableWidth * 0.14;
  const colRatingW = tableWidth * 0.1;

  const colMaterialX = ctx.margin;
  const colEmbodiedX = colMaterialX + colMaterialW;
  const colLifeX = colEmbodiedX + colEmbodiedW;
  const colReplX = colLifeX + colLifeW;
  const colRatingX = colReplX + colReplW;

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(60);
  ctx.doc.text('Material', colMaterialX + 2, ctx.cursorY);
  ctx.doc.text('Embodied (A1-A3)', colEmbodiedX + 2, ctx.cursorY);
  ctx.doc.text('Lifespan', colLifeX + 2, ctx.cursorY);
  ctx.doc.text('Replacements', colReplX + 2, ctx.cursorY);
  ctx.doc.text('Rating', colRatingX + 2, ctx.cursorY);
  ctx.cursorY += 10;

  ctx.doc.setDrawColor(180);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.cursorY - 5, ctx.pageWidth - ctx.margin, ctx.cursorY - 5);

  let rowIndex = 0;

  groupMaterialsByElement(materials).forEach(({ group, items }) => {
    if (items.length === 0) return;
    drawGroupHeader(ctx, group.label, ctx.margin, tableWidth);
    items.forEach((material) => {
      const metric = metrics.get(material.id);
      if (!metric) return;

      const nameLines = ctx.doc.splitTextToSize(material.name, colMaterialW - 4);
      const maxLines = nameLines.length;
      const rowPadding = 3;
      const lineHeight = 9;
      const rowHeight = maxLines * lineHeight + rowPadding * 2;

      ensureSpace(ctx, rowHeight + 2);

      if (rowIndex % 2 === 1) {
        ctx.doc.setFillColor(249, 250, 251);
        ctx.doc.rect(ctx.margin, ctx.cursorY, tableWidth, rowHeight, 'F');
      }

      const textY = ctx.cursorY + rowPadding + 5;

      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(8);
      ctx.doc.setTextColor(0);
      ctx.doc.text(nameLines, colMaterialX + 2, textY);

      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(8);

      const embodiedValue = formatScore(metric.embodied_proxy);
      ctx.doc.text(embodiedValue, colEmbodiedX + 2, textY);

      const numberWidth = ctx.doc.getTextWidth(embodiedValue);
      const barX = colEmbodiedX + 2 + numberWidth + 6;
      const barMaxW = Math.max(12, colEmbodiedW - (barX - colEmbodiedX) - 6);
      const barY = textY - 4;
      ctx.doc.setFillColor(229, 231, 235);
      ctx.doc.rect(barX, barY, barMaxW, 4, 'F');
      ctx.doc.setFillColor(156, 163, 175);
      ctx.doc.rect(barX, barY, barMaxW * Math.min(metric.embodied_proxy / 5, 1), 4, 'F');

      const lifeText = metric.service_life >= 100 ? '100+ yrs' : `${metric.service_life} yrs`;
      ctx.doc.text(lifeText, colLifeX + 2, textY);

      const replText = `${metric.lifecycle_multiplier}x`;
      ctx.doc.text(replText, colReplX + 2, textY);

      drawTrafficLight(ctx, colRatingX + colRatingW / 2, textY - 2, metric.traffic_light, 4);

      ctx.doc.setDrawColor(229, 231, 235);
      ctx.doc.setLineWidth(0.5);
      ctx.doc.line(ctx.margin, ctx.cursorY + rowHeight, ctx.pageWidth - ctx.margin, ctx.cursorY + rowHeight);

      ctx.cursorY += rowHeight;
      rowIndex += 1;
    });
  });
}
