import type { ClientSummary, MaterialMetrics, PDFContext } from '../../types/sustainability';
import type { MaterialOption } from '../../types';
import { addHeading, lineHeightFor, PDF_TYPE_SCALE } from './layout';
import { calculateProjectMetrics } from './paletteMetrics';

export function renderStrategicOverview(
  ctx: PDFContext,
  _summary: ClientSummary,
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'Strategic Overview', 16);
  ctx.cursorY += 5;

  const dialY = ctx.cursorY;
  const dialGap = 12;
  const dialWidth = (ctx.pageWidth - ctx.margin * 2 - dialGap * 2) / 3;
  const calc = calculateProjectMetrics(materials, metrics);
  const bodyLineHeight = lineHeightFor(PDF_TYPE_SCALE.body);

  const drawDial = (label: string, value: string, subtext: string, x: number) => {
    const labelY = dialY;
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
    ctx.doc.setTextColor(102, 102, 102);
    ctx.doc.text(label.toUpperCase(), x, labelY);

    const valueY = labelY + 14;
    let circleColor: [number, number, number] = [16, 185, 129];
    if (value === 'High') circleColor = [239, 68, 68];
    else if (value === 'Medium') circleColor = [245, 158, 11];
    else if (value === 'Low') circleColor = [16, 185, 129];

    ctx.doc.setFillColor(...circleColor);
    ctx.doc.circle(x + 4, valueY - 4, 4, 'F');

    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.sectionTitle);
    ctx.doc.setTextColor(0);
    ctx.doc.text(value, x + 12, valueY);

    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
    ctx.doc.setTextColor(136, 136, 136);
    ctx.doc.text(subtext, x, valueY + 12);
  };

  const avgEmbodied =
    materials.length > 0
      ? Array.from(metrics.values()).reduce((a, b) => a + b.embodied_proxy, 0) / materials.length
      : 0;
  let effLabel = 'Medium';
  if (avgEmbodied < 2.5) effLabel = 'Low';
  if (avgEmbodied > 3.8) effLabel = 'High';
  drawDial('Production Impact', effLabel, 'A1-A3 Manufacturing', ctx.margin);

  let circLabel = 'Medium';
  if (calc.circularRatio > 0.6) circLabel = 'High';
  if (calc.circularRatio < 0.3) circLabel = 'Low';
  drawDial('Circularity', circLabel, 'Reuse Potential', ctx.margin + dialWidth + dialGap);

  const bioLabel = calc.bioRatio > 0.3 ? 'High' : calc.bioRatio > 0.1 ? 'Medium' : 'Low';
  drawDial('Biogenic Carbon', bioLabel, 'Storage Potential', ctx.margin + (dialWidth + dialGap) * 2);

  ctx.cursorY += 52;

  const columnGap = 15;
  const halfWidth = (ctx.pageWidth - ctx.margin * 2 - columnGap) / 2;
  const rightColX = ctx.margin + halfWidth + columnGap;

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.subheading);
  ctx.doc.setTextColor(34, 139, 34);
  ctx.doc.text('Project Strengths', ctx.margin, ctx.cursorY);
  ctx.doc.setTextColor(0);
  ctx.cursorY += lineHeightFor(PDF_TYPE_SCALE.subheading, 'tight');

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.body);

  const strengths: string[] = [];
  if (calc.bioRatio > 0.3)
    strengths.push(
      'Bio-based Core: Significant use of renewable materials (timber/natural fibres) actively stores carbon.'
    );
  if (calc.circularRatio > 0.5)
    strengths.push('Design for Reuse: Mechanical fixings in key layers allow for future disassembly.');
  if (strengths.length === 0)
    strengths.push('Durability: Robust material palette suitable for long-life application.');

  strengths.forEach((strength) => {
    const lines = ctx.doc.splitTextToSize(strength, halfWidth - 12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setTextColor(22, 163, 74);
    ctx.doc.text('+', ctx.margin, ctx.cursorY);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setTextColor(0);
    ctx.doc.text(lines, ctx.margin + 10, ctx.cursorY);
    ctx.cursorY += lines.length * bodyLineHeight + 6;
  });

  const winEndY = ctx.cursorY;
  ctx.cursorY = dialY + 52;

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.subheading);
  ctx.doc.setTextColor(220, 53, 69);
  ctx.doc.text('Project Watch-outs', rightColX, ctx.cursorY);
  ctx.doc.setTextColor(0);
  ctx.cursorY += lineHeightFor(PDF_TYPE_SCALE.subheading, 'tight');

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.body);

  const watchouts: string[] = [];
  const highReplacementItems = materials.filter((material) => {
    const metric = metrics.get(material.id);
    return metric && metric.lifecycle_multiplier >= 3;
  });

  if (highReplacementItems.length > 0) {
    watchouts.push(
      'Recurring Carbon: Short-lifespan finishes (e.g. flooring) will multiply embodied carbon over 60 years.'
    );
  }

  const heavyItems = materials.filter((material) => {
    const metric = metrics.get(material.id);
    return metric && metric.embodied_proxy > 4;
  });
  if (heavyItems.length > 0) {
    watchouts.push(
      'Production Spikes: Key structural or cladding elements rely on energy-intensive manufacturing.'
    );
  }

  watchouts.forEach((watchout) => {
    const lines = ctx.doc.splitTextToSize(watchout, halfWidth - 12);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setTextColor(220, 53, 69);
    ctx.doc.text('!', rightColX, ctx.cursorY);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setTextColor(0);
    ctx.doc.text(lines, rightColX + 10, ctx.cursorY);
    ctx.cursorY += lines.length * bodyLineHeight + 6;
  });

  ctx.cursorY = Math.max(winEndY, ctx.cursorY) + 20;

  addHeading(ctx, 'Priority Specification Notes', 12);
  ctx.cursorY += 2;

  const tableWidth = ctx.pageWidth - ctx.margin * 2;
  const col1W = tableWidth * 0.25;
  const col2W = tableWidth * 0.3;
  const col3W = tableWidth * 0.45;

  const col1X = ctx.margin;
  const col2X = ctx.margin + col1W;
  const col3X = ctx.margin + col1W + col2W;

  const headerH = 12;
  ctx.doc.setFillColor(55, 65, 81);
  ctx.doc.rect(ctx.margin, ctx.cursorY, tableWidth, headerH, 'F');

  ctx.doc.setTextColor(255, 255, 255);
  ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
  ctx.doc.setFont('helvetica', 'bold');
  const textY = ctx.cursorY + 8;
  ctx.doc.text('MATERIAL', col1X + 4, textY);
  ctx.doc.text('RISK / DRIVER', col2X + 4, textY);
  ctx.doc.text('RECOMMENDED ACTION', col3X + 4, textY);

  ctx.cursorY += headerH;
  ctx.doc.setTextColor(0);

  const riskItems = materials
    .map((material) => {
      const metric = metrics.get(material.id);
      if (!metric) return { m: material, score: 0, reason: '', action: '' };

      let riskScore = 0;
      let reason = '';
      let action = '';

      if (metric.lifecycle_multiplier >= 3) {
        riskScore += 10;
        reason = `Frequent replacement (~${Math.round(60 / metric.lifecycle_multiplier)} yr cycle)`;
        action = 'Specify loose-lay / adhesive-free to allow clean removal.';
      } else if (metric.embodied_proxy > 3.5) {
        riskScore += 5;
        reason = 'High production energy intensity';
        action = 'Target high recycled content (>30%) or low-carbon fuel mfg.';
      } else if (metric.end_of_life_proxy > 3.5) {
        riskScore += 3;
        reason = 'Difficult to recycle (Composite)';
        action = 'Ensure mechanical fixings to allow material separation.';
      }

      return { m: material, score: riskScore, reason, action };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  riskItems.forEach((item, index) => {
    if (item.score === 0) return;

    ctx.doc.setFont('helvetica', 'bold');
    const nameLines = ctx.doc.splitTextToSize(item.m.name, col1W - 8);

    ctx.doc.setFont('helvetica', 'normal');
    const riskLines = ctx.doc.splitTextToSize(item.reason, col2W - 8);
    const actionLines = ctx.doc.splitTextToSize(item.action, col3W - 8);

    const maxLines = Math.max(nameLines.length, riskLines.length, actionLines.length);
    const rowLineHeight = lineHeightFor(PDF_TYPE_SCALE.small);
    const padding = 7;
    const rowHeight = maxLines * rowLineHeight + padding * 2;

    if (ctx.cursorY + rowHeight > ctx.pageHeight - ctx.margin) {
      ctx.doc.addPage();
      ctx.cursorY = ctx.margin;
    }

    if (index % 2 === 0) {
      ctx.doc.setFillColor(249, 250, 251);
      ctx.doc.rect(ctx.margin, ctx.cursorY, tableWidth, rowHeight, 'F');
    }

    const rowTextY = ctx.cursorY + padding + 1;

    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
    ctx.doc.setTextColor(17, 24, 39);
    ctx.doc.text(nameLines, col1X + 4, rowTextY);

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setTextColor(55, 65, 81);
    ctx.doc.text(riskLines, col2X + 4, rowTextY);

    ctx.doc.setTextColor(0);
    ctx.doc.text(actionLines, col3X + 4, rowTextY);

    ctx.doc.setDrawColor(229, 231, 235);
    ctx.doc.setLineWidth(0.5);
    ctx.doc.line(ctx.margin, ctx.cursorY + rowHeight, ctx.pageWidth - ctx.margin, ctx.cursorY + rowHeight);

    ctx.cursorY += rowHeight;
  });

  const footerHeight = 18;
  const footerY = ctx.pageHeight - ctx.margin - footerHeight;
  ctx.doc.setDrawColor(229, 231, 235);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, footerY - 4, ctx.pageWidth - ctx.margin, footerY - 4);

  const footerText =
    'Concept stage only: scores (1-5) are relative and may reflect replacement frequency. Landscape items include biodiversity benefits. Abbreviations: A1-A3 Production, B In-Use, C End of Life.';
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
  ctx.doc.setTextColor(90);
  const footerLines = ctx.doc.splitTextToSize(footerText, ctx.pageWidth - ctx.margin * 2);
  ctx.doc.text(footerLines, ctx.margin, footerY, { lineHeightFactor: 1.35 });
}
