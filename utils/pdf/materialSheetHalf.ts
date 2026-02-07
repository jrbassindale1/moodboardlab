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
  // Card layout constants
  const headerH = 38;
  const headerGap = 6;
  const bodyH = 270;
  const footerY = A4_H - 28;
  const minFooterClearance = 34; // Minimum space above footer
  const targetInterCardGap = { min: 18, max: 22 }; // Target gap between cards

  // Calculate card 1 bottom position
  const card1Top = M;
  const card1Bottom = card1Top + headerH + headerGap + bodyH;

  // For card 2, start with desired offset of -28pt
  let secondMaterialOffset = -28;

  if (opts.sheetIndex === 1) {
    const proposedCard2Top = SHEET_H + secondMaterialOffset + M;
    const card2Bottom = proposedCard2Top + headerH + headerGap + bodyH;

    // Safety check 1: Footer collision - ensure 34pt clearance from footer
    const footerClearance = footerY - 8 - card2Bottom; // -8 for divider line above footer
    if (footerClearance < minFooterClearance) {
      secondMaterialOffset += (minFooterClearance - footerClearance);
    }

    // Safety check 2: Inter-card gap - aim for 18-22pt
    const recalculatedCard2Top = SHEET_H + secondMaterialOffset + M;
    const interCardGap = recalculatedCard2Top - card1Bottom;

    if (interCardGap > targetInterCardGap.max) {
      // Move card 2 up (more negative offset), but respect footer clearance
      const adjustment = Math.min(
        interCardGap - targetInterCardGap.max,
        footerClearance - minFooterClearance
      );
      if (adjustment > 0) {
        secondMaterialOffset -= adjustment;
      }
    } else if (interCardGap < targetInterCardGap.min) {
      // Move card 2 down (less negative offset)
      secondMaterialOffset += (targetInterCardGap.min - interCardGap);
    }
  }

  const sheetTop = opts.sheetIndex === 0 ? 0 : SHEET_H + secondMaterialOffset;
  const x0 = M;
  const y0 = sheetTop + M;
  const w = A4_W - 2 * M;

  let y = y0;

  // Header row (with thumbnail)
  renderHeader(doc, material, x0, y, w, headerH);
  y += headerH + headerGap;

  // Two-column body (health box + spec actions in left column, lifecycle in right column)
  renderBody(doc, material, x0, y, w, bodyH);

  // Page footer (only render on bottom material of each page)
  if (opts.sheetIndex === 1) {
    renderPageFooter(doc, opts, footerY);
  }
}

/** Render the page footer - exported for use when odd number of materials */
export function renderMaterialSheetFooter(doc: jsPDF, generatedOnText?: string) {
  renderPageFooter(doc, { sheetIndex: 0, generatedOnText }, A4_H - 28);
}

function renderHeader(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  // Shared outer frame matching body containers exactly
  // Left column box starts at: x + CARD_PAD - 4
  // Right column box ends at: x + w + 4 (verified by: xR - 4 + colR - CARD_PAD + 8)
  const cardOuterX = x + CARD_PAD - 4;
  const cardOuterW = w - CARD_PAD + 8; // Spans from left column left edge to right column right edge

  // Grey background box for header (matches body outer frame)
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(cardOuterX, y, cardOuterW, h, 6, 6, 'FD');

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

  // Layout constants
  const textStartX = thumbX + thumbSize + 10;
  const titleY = y + 14;
  const descriptorY = titleY + 12; // One line-height below title
  const tagsY = titleY + 6; // Midway between title and descriptor for optical centering
  const chipH = 12;
  const chipGap = 6;
  const tagsRightX = cardOuterX + cardOuterW - CARD_PAD;

  // Build tags (right-aligned)
  const chips = [
    { text: m.category, kind: 'neutral' as const },
    { text: m.carbonLabel, kind: labelKind(m.carbonLabel) },
  ];

  // Calculate tags total width for collision detection
  let totalTagsWidth = 0;
  const chipWidths: number[] = [];
  for (const chip of chips) {
    const tw = measureText(doc, chip.text, 6.5, 'helvetica', 'bold');
    const chipW = tw + 10;
    chipWidths.push(chipW);
    totalTagsWidth += chipW;
  }
  totalTagsWidth += (chips.length - 1) * chipGap;

  // Draw tags from right-to-left
  let tagX = tagsRightX;
  for (let i = chips.length - 1; i >= 0; i--) {
    const chipW = chipWidths[i];
    tagX -= chipW;
    drawChip(doc, tagX, tagsY, chipW, chipH, chips[i].text, chips[i].kind);
    if (i > 0) tagX -= chipGap;
  }

  // Calculate available width for title and descriptor (avoid collision with tags)
  const tagsLeftX = tagX;
  const maxTextWidth = tagsLeftX - textStartX - 8;

  // Material name (title)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(clampText(doc, m.name, maxTextWidth), textStartX, titleY);

  // Descriptor text under title (eg "Fabric-wrapped baffles")
  const variant = (m.formVariant || m.imageCaption || '').trim();
  if (variant) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    // Wrap to max 2 lines with ellipsis on line 2 if needed
    const descriptorLines = wrapLines(doc, variant, maxTextWidth, 7).slice(0, 2);
    if (descriptorLines.length === 2) {
      // Ensure ellipsis on second line if truncated
      const fullLines = wrapLines(doc, variant, maxTextWidth, 7);
      if (fullLines.length > 2) {
        descriptorLines[1] = clampText(doc, descriptorLines[1], maxTextWidth);
      }
    }
    doc.text(descriptorLines, textStartX, descriptorY);
  }

  // Divider line spanning full outer frame width
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(cardOuterX, y + h, cardOuterX + cardOuterW, y + h);
}

function renderBody(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number) {
  const colGap = G;
  const colL = Math.round((w - colGap) * 0.48);
  const colR = w - colL - colGap;

  const xL = x + CARD_PAD;
  const xR = x + CARD_PAD + colL + colGap;

  // Calculate content needs and apply flexibility
  const contentNeeds = calculateLeftColumnContentNeeds(doc, m, colL - CARD_PAD);
  const flexibility = calculateFlexibility(contentNeeds, h);

  // Left column: material description, typical uses, key performance, health box, spec actions
  renderLeftColumn(doc, m, xL, y, colL - CARD_PAD, h, flexibility.mainContentShrink);

  // Right column: radar chart + lifecycle analysis + insight box
  renderRightColumn(doc, m, xR, y, colR - CARD_PAD, h, flexibility.chartShrink, flexibility.insightShrink);
}

/** Calculate approximate content height needs for left column */
function calculateLeftColumnContentNeeds(doc: jsPDF, m: MaterialPdfModel, w: number): number {
  let needed = 12; // Initial padding

  // Description
  const whatText = (m.whatItIs ?? '').trim();
  if (whatText) {
    const whatLines = wrapLines(doc, whatText, w, 8).slice(0, 3);
    needed += whatLines.length * 10 + 8;
  } else {
    needed += 12;
  }

  // Typical uses
  const uses = (m.typicalUses ?? []).slice(0, 4).filter(Boolean);
  if (uses.length) {
    needed += 10 + (uses.length * 10) + 6;
  }

  // Key performance
  const perf = (m.performanceNote ?? m.strategicValue ?? '').trim();
  if (perf) {
    const perfLines = wrapLines(doc, perf, w, 8).slice(0, 2);
    needed += 10 + (perfLines.length * 10) + 6;
  }

  // Service life
  if (m.serviceLife) {
    needed += 22;
  }

  // Risks
  const risks = (m.risks ?? []).slice(0, 2);
  if (risks.length) {
    needed += 10 + (risks.length * 9);
  }

  return needed;
}

/** Calculate flexibility adjustments based on content needs */
function calculateFlexibility(contentNeeds: number, totalHeight: number): {
  mainContentShrink: number;
  insightShrink: number;
  chartShrink: number;
} {
  // Base allocations (updated: health 56pt, spec 76pt)
  const healthBoxH = 56;
  const actionsH = 76;
  const boxGap = 4;
  const bottomSectionH = healthBoxH + boxGap + actionsH + boxGap;
  const baseMainContentH = totalHeight - bottomSectionH;

  // Calculate overflow
  const overflow = contentNeeds - baseMainContentH;

  if (overflow <= 0) {
    // No overflow, no shrinking needed
    return { mainContentShrink: 0, insightShrink: 0, chartShrink: 0 };
  }

  // Apply shrinkage in order:
  // 1. Main content can shrink up to 12pt (absorbs overflow by expanding into reserved space)
  // 2. Insight box can shrink up to 8pt
  // 3. Chart can shrink up to 10pt (min 100pt)

  let remaining = overflow;
  let mainContentShrink = 0;
  let insightShrink = 0;
  let chartShrink = 0;

  // First: allow main content to use reserved space (effectively shrink bottom section)
  const mainContentFlex = Math.min(remaining, 12);
  mainContentShrink = -mainContentFlex; // Negative means expand main content
  remaining -= mainContentFlex;

  if (remaining > 0) {
    // Second: shrink insight box
    insightShrink = Math.min(remaining, 8);
    remaining -= insightShrink;
  }

  if (remaining > 0) {
    // Third: shrink chart (min 100pt, so max shrink is 10pt from 110)
    chartShrink = Math.min(remaining, 10);
  }

  return { mainContentShrink, insightShrink, chartShrink };
}

function renderLeftColumn(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number, mainContentShrink = 0) {
  // Reserve space for health box and spec actions at the bottom
  const actions = (m.specActions ?? []).slice(0, 3).filter(Boolean);
  const boxGap = 4;

  // Check if health data exists
  const hasHealthData = !!(m.healthRiskLevel || m.healthNote);

  // Box heights: Health 56pt, Spec 76pt (or 132pt if no health)
  const baseHealthH = 56;
  const baseSpecH = 76;

  // Conditional: if no health data, collapse health box and give space to spec
  const healthBoxH = hasHealthData ? baseHealthH : 0;
  const actionsH = actions.length ? (hasHealthData ? baseSpecH : baseSpecH + baseHealthH) : 0;

  // Calculate main content height (leaving room for health + actions at bottom)
  // mainContentShrink is negative when we want to expand main content into reserved space
  const bottomSectionH = healthBoxH + (hasHealthData ? boxGap : 0) + actionsH + (actions.length ? boxGap : 0);
  const mainContentH = h - bottomSectionH - mainContentShrink;

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
    cursorY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text(`${m.serviceLife} years`, x, cursorY);
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

  // Health box - above spec actions (only if health data exists)
  const healthBoxY = y + mainContentH + boxGap;
  if (hasHealthData) {
    renderHealthBox(doc, m, x, healthBoxY, w, healthBoxH);
  }

  // Specification actions at the bottom of left column
  if (actions.length) {
    // Position spec actions: after health box if present, otherwise directly after main content
    const actionsY = hasHealthData ? healthBoxY + healthBoxH + boxGap : healthBoxY;

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

    // Bullet wrapping with hanging indent
    const bulletIndent = 10;
    const hangingIndent = 10;
    const lineHeight = 10;
    const maxTotalLines = 5; // Allow 5 lines for taller spec box
    const wrapWidth = w - bulletIndent - hangingIndent - 4; // Account for padding

    let ay = actionsY + 22;
    let totalLinesUsed = 0;

    for (let i = 0; i < actions.length && totalLinesUsed < maxTotalLines; i++) {
      const action = actions[i];
      const remainingLines = maxTotalLines - totalLinesUsed;

      // Wrap the action text
      let lines = wrapLines(doc, action, wrapWidth, 7);
      let isTruncated = false;

      // Truncate if needed (prefer truncating last bullet)
      if (lines.length > remainingLines) {
        lines = lines.slice(0, remainingLines);
        isTruncated = true;
        // Add ellipsis to the last line if truncated
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          lines[lines.length - 1] = clampTextWithEllipsis(doc, lastLine, wrapWidth) + '...';
        }
      }

      // Ensure proper punctuation on each bullet's final line (full-stop if not already punctuated)
      if (!isTruncated && lines.length > 0) {
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine && !/[.!?]$/.test(lastLine)) {
          lines[lines.length - 1] = lastLine + '.';
        }
      }

      // Draw bullet on first line
      doc.text('•', x, ay);

      // Draw each line with proper indentation
      lines.forEach((line, lineIdx) => {
        if (totalLinesUsed >= maxTotalLines) return;
        const textX = lineIdx === 0 ? x + bulletIndent : x + bulletIndent + hangingIndent;
        doc.text(line, textX, ay);
        ay += lineHeight;
        totalLinesUsed++;
      });
    }
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

  // Increased top padding: +4pt vertical inset (was 10, now 14)
  let cursorY = y + 14;

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

  // Risk level badge - aligned with title baseline
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

function renderRightColumn(doc: jsPDF, m: MaterialPdfModel, x: number, y: number, w: number, h: number, chartShrink = 0, insightShrink = 0) {
  // Calculate height to align with left column's bottom
  // Left column's spec actions box ends at y + h, so right column should match
  const rightColumnHeight = h;

  // White card background with border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x - 4, y, w + 8, rightColumnHeight, 6, 6, 'FD');

  // Section heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.text('LIFECYCLE IMPACT', x, y + 12);

  // Radar chart - base 110px, can shrink up to 10px (min 100px)
  const chartX = x;
  const chartY = y + 16;
  const chartW = w;
  const chartH = Math.max(100, 110 - chartShrink);

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

  // Lifecycle insight box (can shrink up to 8pt)
  const insightY = analysisY + 4;
  const insightH = Math.max(32, 40 - insightShrink);
  const rawInsight = m.lifecycleInsight || generateDefaultInsight(m);
  const insightText = normalizeNarrativeText(rawInsight);

  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x, insightY, w, insightH, 4, 4, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(55, 65, 81);
  // Reduce max lines if box is shrunk
  const maxInsightLines = insightH >= 38 ? 3 : 2;
  const insightLines = wrapLines(doc, insightText, w - 12, 7).slice(0, maxInsightLines);
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

function clampTextWithEllipsis(doc: jsPDF, text: string, maxW: number) {
  // Clamp text to fit within maxW, leaving room for ellipsis to be added externally
  const ellipsisWidth = doc.getTextWidth('...');
  if (doc.getTextWidth(text) <= maxW - ellipsisWidth) return text;
  let t = text;
  while (t.length > 0 && doc.getTextWidth(t) > maxW - ellipsisWidth) {
    t = t.slice(0, -1);
  }
  return t.trimEnd();
}

/** Normalize narrative text: sentence case and ensure full stop at end */
function normalizeNarrativeText(text: string): string {
  if (!text || !text.trim()) return '';

  // Split into sentences, normalize each
  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return '';

    // Capitalize first letter (sentence case)
    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    // Ensure ends with punctuation
    if (!/[.!?]$/.test(capitalized)) {
      return capitalized + '.';
    }
    return capitalized;
  });

  return sentences.filter(Boolean).join(' ');
}

function wrapLines(doc: jsPDF, text: string, maxW: number, fontSize: number) {
  doc.setFontSize(fontSize);
  // @ts-ignore
  return doc.splitTextToSize(text, maxW) as string[];
}
