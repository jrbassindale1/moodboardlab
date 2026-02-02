import type { MaterialOption } from '../../types';
import type { MaterialMetrics, PDFContext, SystemLevelSummary } from '../../types/sustainability';
import { addHeading, lineHeightFor, PDF_TYPE_SCALE } from './layout';

type PracticalityLevel = 'low' | 'medium' | 'high';

function estimatePracticality(materials: MaterialOption[]): {
  complexity: { level: PracticalityLevel; label: string };
  supply: { level: PracticalityLevel; label: string };
  cost: { level: PracticalityLevel; label: string };
} {
  const lowerNames = materials.map((m) => m.name.toLowerCase());
  const hasStone = lowerNames.some((name) =>
    name.includes('stone') || name.includes('precast') || name.includes('terracotta')
  );
  const hasGlazing = lowerNames.some((name) => name.includes('glazing') || name.includes('glass'));
  const hasTimber = lowerNames.some((name) =>
    name.includes('timber') || name.includes('wood') || name.includes('clt')
  );
  const hasImported = lowerNames.some((name) => name.includes('imported'));
  const hasZinc = lowerNames.some((name) => name.includes('zinc'));
  const count = materials.length;

  const complexityLevel: PracticalityLevel =
    count > 8 || hasStone || hasGlazing ? 'high' : count > 5 ? 'medium' : 'low';
  const supplyLevel: PracticalityLevel =
    hasTimber || hasImported ? 'high' : count > 8 ? 'medium' : 'low';
  const costLevel: PracticalityLevel =
    hasStone || hasGlazing || hasZinc ? 'high' : count > 8 ? 'medium' : 'low';

  const complexityLabel =
    complexityLevel === 'high'
      ? 'High - Multiple specialist interfaces'
      : complexityLevel === 'medium'
      ? 'Medium - Specialist trades'
      : 'Low - Standard delivery packages';
  const supplyLabel =
    supplyLevel === 'high'
      ? 'High - Long lead times likely'
      : supplyLevel === 'medium'
      ? 'Medium - Limited supplier options'
      : 'Low - Standard availability';
  const costLabel =
    costLevel === 'high'
      ? 'High - Premium material cost bands'
      : costLevel === 'medium'
      ? 'Medium - Above baseline pricing'
      : 'Low - Baseline cost expectations';

  return {
    complexity: { level: complexityLevel, label: complexityLabel },
    supply: { level: supplyLevel, label: supplyLabel },
    cost: { level: costLevel, label: costLabel }
  };
}

function generateConsultantQuestions(materials: MaterialOption[]): string[] {
  const questions: string[] = [];
  const names = materials.map((m) => m.name.toLowerCase());

  if (names.some((name) => name.includes('timber') || name.includes('wood') || name.includes('clt'))) {
    questions.push('FIRE CONSULTANT: Review reaction-to-fire classification for exposed timber elements.');
    questions.push('ACOUSTICS: Verify mass density of floors for airborne sound insulation (if CLT).');
  }

  if (names.some((name) => name.includes('stone') || name.includes('precast') || name.includes('terracotta'))) {
    questions.push('STRUCTURAL ENGINEER: Verify primary frame capacity for heavy cladding loads.');
  }

  if (materials.some((m) => m.category === 'window') || names.some((name) => name.includes('glass'))) {
    questions.push('FACADE ENGINEER: Review g-values to mitigate solar gain/overheating in south-facing zones.');
  }

  if (names.some((name) => name.includes('hemp') || name.includes('wool') || name.includes('straw'))) {
    questions.push('M&E CONSULTANT: Confirm Vapour Control Layer (VCL) position to prevent interstitial condensation.');
  }

  if (materials.some((m) => m.category === 'landscape' || m.category === 'external-ground')) {
    questions.push('CIVIL ENGINEER: Confirm permeability rates for SuDS integration with sub-base.');
  }

  if (questions.length === 0) {
    questions.push('COST CONSULTANT: Confirm material lead times and procurement routes early.');
  }

  return questions.slice(0, 5);
}

export function renderSystemSummaryPage(
  ctx: PDFContext,
  summary: SystemLevelSummary,
  materials: MaterialOption[],
  _metrics: Map<string, MaterialMetrics>
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'Technical Integration & Feasibility', 16);
  ctx.cursorY += 5;
  const bodyLineHeight = lineHeightFor(PDF_TYPE_SCALE.body);
  const smallLineHeight = lineHeightFor(PDF_TYPE_SCALE.small);

  const practicality = estimatePracticality(materials);
  const meterStartY = ctx.cursorY + 5;
  const contentWidth = ctx.pageWidth - ctx.margin * 2;
  const labelWidth = Math.min(160, contentWidth * 0.35);
  const barWidth = Math.min(160, contentWidth * 0.35);
  const barX = ctx.margin + labelWidth + 10;
  const textX = barX + barWidth + 10;

  const levelColor = (level: PracticalityLevel): [number, number, number] => {
    if (level === 'high') return [239, 68, 68];
    if (level === 'medium') return [245, 158, 11];
    return [16, 185, 129];
  };

  const drawMeter = (label: string, level: PracticalityLevel, labelText: string, y: number) => {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
    ctx.doc.setTextColor(100);
    ctx.doc.text(label, ctx.margin, y);

    ctx.doc.setFillColor(...levelColor(level));
    ctx.doc.rect(barX, y - 4, barWidth, 6, 'F');

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
    ctx.doc.setTextColor(60);
    ctx.doc.text(labelText, textX, y);
  };

  drawMeter('DELIVERY COMPLEXITY', practicality.complexity.level, practicality.complexity.label, meterStartY);
  drawMeter('SUPPLY CHAIN RISK', practicality.supply.level, practicality.supply.label, meterStartY + 14);
  drawMeter('RELATIVE COST', practicality.cost.level, practicality.cost.label, meterStartY + 28);

  ctx.cursorY = meterStartY + 42;

  const columnGap = 14;
  const colWidth = (ctx.pageWidth - ctx.margin * 2 - columnGap) / 2;
  const leftX = ctx.margin;
  const rightX = ctx.margin + colWidth + columnGap;

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.body);
  ctx.doc.setTextColor(22, 163, 74);
  ctx.doc.text('INTEGRATION OPPORTUNITIES', leftX, ctx.cursorY);
  ctx.doc.setTextColor(220, 53, 69);
  ctx.doc.text('SYSTEM CONFLICTS', rightX, ctx.cursorY);
  ctx.doc.setTextColor(0);
  ctx.cursorY += bodyLineHeight;

  let leftY = ctx.cursorY;
  let rightY = ctx.cursorY;
  const bulletGap = 6;

  if (summary.synergies.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
    ctx.doc.setTextColor(120);
    ctx.doc.text('No integration opportunities detected.', leftX, leftY);
    ctx.doc.setTextColor(0);
    leftY += smallLineHeight;
  } else {
    summary.synergies.forEach((synergy) => {
      const lines = ctx.doc.splitTextToSize(synergy.description, colWidth - 12);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(PDF_TYPE_SCALE.body);
      ctx.doc.setTextColor(22, 163, 74);
      ctx.doc.text('+', leftX, leftY);
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
      ctx.doc.setTextColor(0);
      ctx.doc.text(lines, leftX + 8, leftY, { lineHeightFactor: 1.35 });
      leftY += lines.length * smallLineHeight + bulletGap;
    });
  }

  if (summary.conflicts.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
    ctx.doc.setTextColor(120);
    ctx.doc.text('No system conflicts detected.', rightX, rightY);
    ctx.doc.setTextColor(0);
    rightY += smallLineHeight;
  } else {
    summary.conflicts.forEach((conflict) => {
      const lines = ctx.doc.splitTextToSize(conflict.description, colWidth - 12);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(PDF_TYPE_SCALE.body);
      ctx.doc.setTextColor(220, 53, 69);
      ctx.doc.text('!', rightX, rightY);
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(PDF_TYPE_SCALE.small);
      ctx.doc.setTextColor(0);
      ctx.doc.text(lines, rightX + 8, rightY, { lineHeightFactor: 1.35 });
      rightY += lines.length * smallLineHeight + bulletGap;
    });
  }

  ctx.cursorY = Math.max(leftY, rightY) + 10;

  const qs = generateConsultantQuestions(materials);
  let qY = ctx.cursorY + 20;
  const questionLineHeight = lineHeightFor(PDF_TYPE_SCALE.body);
  const qHeight = Math.max(58, 28 + qs.length * questionLineHeight + 10);

  if (qY + qHeight > ctx.pageHeight - ctx.margin) {
    ctx.doc.addPage();
    ctx.cursorY = ctx.margin;
    qY = ctx.cursorY + 10;
  }

  ctx.doc.setFillColor(243, 244, 246);
  ctx.doc.roundedRect(ctx.margin, qY, ctx.pageWidth - ctx.margin * 2, qHeight, 2, 2, 'F');

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.subheading);
  ctx.doc.setTextColor(0);
  const questionTitleY = qY + 14;
  ctx.doc.text('Questions for your Design Team (RIBA Stage 3)', ctx.margin + 10, questionTitleY);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(PDF_TYPE_SCALE.body);
  qs.forEach((q, i) => {
    ctx.doc.text(`• ${q}`, ctx.margin + 10, questionTitleY + 12 + i * questionLineHeight);
  });
}
