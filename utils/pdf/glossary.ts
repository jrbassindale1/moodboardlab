import type { PDFContext } from '../../types/sustainability';

/**
 * Add disclaimer footer
 */
export function addDisclaimer(ctx: PDFContext): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  // Glossary
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(14);
  ctx.doc.setTextColor(0);
  ctx.doc.text('Glossary', ctx.margin, ctx.cursorY);
  ctx.cursorY += 16;

  const glossaryItems: Array<{ term: string; description: string }> = [
    {
      term: 'RIBA Stage 3',
      description: 'Developed design stage in the UK work stages.',
    },
    {
      term: 'Environmental product declaration',
      description: 'Standardised product life-cycle data sheet (often called an EPD).',
    },
    {
      term: 'FSC / PEFC',
      description: 'Timber chain-of-custody certification schemes.',
    },
    {
      term: 'EN 15804 / ISO 14025',
      description: 'Standards that define how environmental product declarations are produced.',
    },
    {
      term: 'EOL',
      description: 'End of life (what happens when a material is removed or disposed).',
    },
    {
      term: 'Conf.',
      description: 'Confidence in data quality.',
    },
    {
      term: 'SuDS',
      description: 'Sustainable drainage systems.',
    },
    {
      term: 'AI',
      description: 'Artificial intelligence used to draft early-stage insights.',
    },
    {
      term: 'RAW / MFG / TRN / INS / USE / MNT / EOL',
      description:
        'Lifecycle stages: RAW = raw material acquisition (cradle), MFG = production processes, TRN = distribution impacts, INS = construction/assembly effects, USE = operational impacts during service life, MNT = upkeep over life, EOL = disposal or recycling stages.',
    },
    {
      term: 'Impact scores',
      description:
        'Scores are relative (1–5) and intended for comparative early-stage design decision-making, not as a substitute for EPD-based carbon calculations.',
    },
  ];

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(80);
  glossaryItems.forEach((item) => {
    const line = `${item.term}: ${item.description}`;
    const lines = ctx.doc.splitTextToSize(line, ctx.pageWidth - ctx.margin * 2);
    lines.forEach((textLine: string) => {
      ctx.doc.text(textLine, ctx.margin, ctx.cursorY);
      ctx.cursorY += 11;
    });
    ctx.cursorY += 2;
  });

  // Disclaimer footer
  ctx.cursorY = ctx.pageHeight - ctx.margin - 55;

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
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(0);
  ctx.doc.text('Generated with Moodboard-Lab', ctx.margin, ctx.cursorY);
}
