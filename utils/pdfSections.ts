// PDF section renderers
// Modular functions for rendering each section of the sustainability report

import type { jsPDF } from 'jspdf';
import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  SystemLevelSummary,
  ClientSummary,
  TrafficLight,
  PDFContext,
  Hotspot,
  LifecycleProfile,
} from '../types/sustainability';
import type { MaterialOption } from '../types';
import { STAGE_LABELS } from './designConsequences';
import { getCircularityIndicator, formatScore } from './sustainabilityScoring';

// PDF constants
const MARGIN = 48;
const TRAFFIC_LIGHT_COLORS: Record<TrafficLight, [number, number, number]> = {
  green: [34, 139, 34],
  amber: [255, 191, 0],
  red: [220, 53, 69],
};

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
function addHeading(ctx: PDFContext, text: string, size = 16): void {
  ensureSpace(ctx, size * 1.6);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  ctx.doc.text(text, ctx.margin, ctx.cursorY);
  ctx.cursorY += size + 10;
}

/**
 * Add a paragraph to the PDF
 */
function addParagraph(ctx: PDFContext, text: string, size = 11, gap = 8): void {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  const maxWidth = ctx.pageWidth - ctx.margin * 2;
  const lines = ctx.doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string) => {
    ensureSpace(ctx, size * 1.2);
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += size + 4;
  });
  ctx.cursorY += gap;
}

/**
 * Add a bullet point
 */
function addBullet(ctx: PDFContext, text: string, size = 10): void {
  ensureSpace(ctx, size * 1.4);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(0);
  const maxWidth = ctx.pageWidth - ctx.margin * 2 - 15;
  const lines = ctx.doc.splitTextToSize(text, maxWidth);
  ctx.doc.text('•', ctx.margin, ctx.cursorY);
  lines.forEach((line: string, i: number) => {
    ctx.doc.text(line, ctx.margin + 12, ctx.cursorY + i * (size + 3));
  });
  ctx.cursorY += lines.length * (size + 3) + 4;
}

/**
 * Draw a traffic light indicator
 */
function drawTrafficLight(
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

// ============== PAGE RENDERERS ==============

/**
 * Render Page 1: Client Summary
 */
export function renderClientSummaryPage(
  ctx: PDFContext,
  summary: ClientSummary
): void {
  // Brand header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(100);
  ctx.doc.text('MOODBOARD-LAB.COM', ctx.pageWidth - ctx.margin, ctx.cursorY, {
    align: 'right',
  });
  ctx.cursorY += 15;

  // Title
  ctx.doc.setTextColor(0);
  addHeading(ctx, 'Sustainability Summary', 20);
  ctx.cursorY += 5;

  // What this palette achieves
  addHeading(ctx, 'What this palette achieves', 13);
  summary.achievements.forEach((achievement) => {
    addBullet(ctx, achievement, 11);
  });
  ctx.cursorY += 10;

  // Key risks and mitigations
  addHeading(ctx, 'Key risks and how we mitigate', 13);
  summary.risks_and_mitigations.forEach((risk) => {
    addBullet(ctx, risk, 11);
  });
  ctx.cursorY += 10;

  // Evidence checklist
  addHeading(ctx, 'Next evidence to collect', 13);
  summary.evidence_checklist.forEach((item) => {
    ensureSpace(ctx, 14);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.text(`☐ ${item}`, ctx.margin + 5, ctx.cursorY);
    ctx.cursorY += 14;
  });
  ctx.cursorY += 15;

  // Confidence statement
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(80);
  const confLines = ctx.doc.splitTextToSize(
    summary.confidence_statement,
    ctx.pageWidth - ctx.margin * 2
  );
  confLines.forEach((line: string) => {
    ensureSpace(ctx, 12);
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });
  ctx.doc.setTextColor(0);
}

/**
 * Render Page 2: Comparative Dashboard
 */
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

  // ===== TABLE 1: Impact & Rating =====
  addHeading(ctx, 'Impact Assessment', 12);

  const impactColWidths = [120, 55, 50, 45, 45, 45, 45];
  const impactHeaders = ['Material', 'Embodied', 'In-use', 'EOL', 'Benefit', 'Conf.', 'Rating'];
  const tableStartX = ctx.margin;

  // Table header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(60);
  let xPos = tableStartX;
  impactHeaders.forEach((header, i) => {
    ctx.doc.text(header, xPos, ctx.cursorY);
    xPos += impactColWidths[i];
  });
  ctx.cursorY += 12;

  // Header line
  ctx.doc.setDrawColor(180);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.cursorY - 5, ctx.pageWidth - ctx.margin, ctx.cursorY - 5);

  // Table rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(0);

  materials.forEach((material) => {
    ensureSpace(ctx, 14);
    const metric = metrics.get(material.id);
    if (!metric) return;

    xPos = tableStartX;

    // Material name (truncated)
    const truncatedName = material.name.length > 18 ? material.name.substring(0, 16) + '...' : material.name;
    ctx.doc.text(truncatedName, xPos, ctx.cursorY);
    xPos += impactColWidths[0];

    // Scores
    ctx.doc.text(formatScore(metric.embodied_proxy), xPos, ctx.cursorY);
    xPos += impactColWidths[1];

    ctx.doc.text(formatScore(metric.in_use_proxy), xPos, ctx.cursorY);
    xPos += impactColWidths[2];

    ctx.doc.text(formatScore(metric.end_of_life_proxy), xPos, ctx.cursorY);
    xPos += impactColWidths[3];

    ctx.doc.text(formatScore(metric.benefit_score), xPos, ctx.cursorY);
    xPos += impactColWidths[4];

    // Confidence
    const confPercent = Math.round(metric.confidence_score * 100);
    ctx.doc.text(`${confPercent}%`, xPos, ctx.cursorY);
    xPos += impactColWidths[5];

    // Traffic light
    drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, metric.traffic_light, 4);

    ctx.cursorY += 13;
  });

  // ===== TABLE 2: Lifecycle & Durability =====
  ctx.cursorY += 15;
  addHeading(ctx, 'Lifecycle & Durability', 12);

  const lifecycleColWidths = [120, 65, 70, 65, 100];
  const lifecycleHeaders = ['Material', 'Service Life', 'Replacements*', 'Circularity', 'Carbon Payback'];

  // Table header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(60);
  xPos = tableStartX;
  lifecycleHeaders.forEach((header, i) => {
    ctx.doc.text(header, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[i];
  });
  ctx.cursorY += 12;

  // Header line
  ctx.doc.line(ctx.margin, ctx.cursorY - 5, ctx.pageWidth - ctx.margin, ctx.cursorY - 5);

  // Table rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(0);

  materials.forEach((material) => {
    ensureSpace(ctx, 14);
    const metric = metrics.get(material.id);
    if (!metric) return;

    xPos = tableStartX;

    // Material name
    const truncatedName = material.name.length > 18 ? material.name.substring(0, 16) + '...' : material.name;
    ctx.doc.text(truncatedName, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[0];

    // Service life
    const lifeText = metric.service_life >= 100 ? '100+ years' : `${metric.service_life} years`;
    ctx.doc.text(lifeText, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[1];

    // Replacement cycles (over 60-year building life)
    const replText = metric.lifecycle_multiplier === 1 ? '1× (full life)' : `${metric.lifecycle_multiplier}×`;
    ctx.doc.text(replText, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[2];

    // Circularity indicator
    const circ = getCircularityIndicator(metric.end_of_life_proxy);
    const circText = circ === 'high' ? '● High' : circ === 'medium' ? '◐ Medium' : '○ Low';
    ctx.doc.text(circText, xPos, ctx.cursorY);
    xPos += lifecycleColWidths[3];

    // Carbon payback
    if (metric.carbon_payback) {
      const payback = metric.carbon_payback;
      let paybackText: string;
      if (payback.years === 0) {
        paybackText = payback.mechanism === 'sequestration' ? 'Carbon -ve' : 'Immediate';
      } else {
        paybackText = `~${payback.years} years`;
      }
      // Color code based on payback
      if (payback.years === 0) {
        ctx.doc.setTextColor(34, 139, 34); // Green
      } else if (payback.years <= 5) {
        ctx.doc.setTextColor(0, 128, 0);
      }
      ctx.doc.text(paybackText, xPos, ctx.cursorY);
      ctx.doc.setTextColor(0);
    } else {
      ctx.doc.setTextColor(150);
      ctx.doc.text('—', xPos, ctx.cursorY);
      ctx.doc.setTextColor(0);
    }

    ctx.cursorY += 13;
  });

  // Legend
  ctx.cursorY += 12;
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(80);
  ctx.doc.text(
    '* Replacements = how many times installed over 60-year building life. Higher = more lifetime embodied carbon.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 10;
  ctx.doc.text(
    'Carbon Payback: years until embodied carbon is offset by sequestration, energy generation, or avoided emissions. Carbon -ve = net negative.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.cursorY += 10;
  ctx.doc.text(
    'Rating: Green = low impact | Amber = moderate | Red = high impact. Circularity: ● High | ◐ Medium | ○ Low',
    ctx.margin,
    ctx.cursorY
  );
  ctx.doc.setTextColor(0);
}

/**
 * Render Page 3: System-Level Summary
 */
export function renderSystemSummaryPage(
  ctx: PDFContext,
  summary: SystemLevelSummary,
  materials: MaterialOption[]
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'System-Level Analysis', 16);
  ctx.cursorY += 5;

  // Palette Strategy section
  addHeading(ctx, 'Palette Strategy', 13);

  // Top embodied materials
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.text('Highest embodied carbon:', ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

  ctx.doc.setFont('helvetica', 'normal');
  summary.top_embodied_items.slice(0, 3).forEach((id) => {
    const mat = materials.find((m) => m.id === id);
    if (mat) {
      ctx.doc.text(`  • ${mat.name}`, ctx.margin + 10, ctx.cursorY);
      ctx.cursorY += 12;
    }
  });

  if (summary.top_embodied_items.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('  No high-embodied materials identified', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  ctx.cursorY += 8;

  // Top benefit materials
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text('Highest benefit contribution:', ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

  ctx.doc.setFont('helvetica', 'normal');
  summary.top_benefit_items.slice(0, 3).forEach((id) => {
    const mat = materials.find((m) => m.id === id);
    if (mat) {
      ctx.doc.text(`  • ${mat.name}`, ctx.margin + 10, ctx.cursorY);
      ctx.cursorY += 12;
    }
  });

  if (summary.top_benefit_items.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('  No high-benefit materials identified', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  // Net statement
  ctx.cursorY += 10;
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(10);
  const netLines = ctx.doc.splitTextToSize(
    summary.net_statement,
    ctx.pageWidth - ctx.margin * 2
  );
  netLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });

  // Synergies section
  ctx.cursorY += 15;
  addHeading(ctx, 'Synergies', 13);

  if (summary.synergies.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No synergies detected in current palette', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 15;
  } else {
    summary.synergies.forEach((synergy) => {
      ensureSpace(ctx, 30);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(10);
      ctx.doc.setTextColor(34, 139, 34); // Green
      ctx.doc.text(`✓ ${synergy.type.toUpperCase()}:`, ctx.margin, ctx.cursorY);
      ctx.doc.setTextColor(0);
      ctx.cursorY += 12;

      ctx.doc.setFont('helvetica', 'normal');
      const descLines = ctx.doc.splitTextToSize(
        synergy.description,
        ctx.pageWidth - ctx.margin * 2 - 15
      );
      descLines.forEach((line: string) => {
        ctx.doc.text(line, ctx.margin + 15, ctx.cursorY);
        ctx.cursorY += 11;
      });
      ctx.cursorY += 5;
    });
  }

  // Watch-outs section
  ctx.cursorY += 10;
  addHeading(ctx, 'Watch-outs', 13);

  if (summary.conflicts.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No conflicts detected in current palette', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 15;
  } else {
    summary.conflicts.forEach((conflict) => {
      ensureSpace(ctx, 45);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(10);
      ctx.doc.setTextColor(220, 53, 69); // Red
      ctx.doc.text(`⚠ ${conflict.type.toUpperCase()}:`, ctx.margin, ctx.cursorY);
      ctx.doc.setTextColor(0);
      ctx.cursorY += 12;

      ctx.doc.setFont('helvetica', 'normal');
      const descLines = ctx.doc.splitTextToSize(
        conflict.description,
        ctx.pageWidth - ctx.margin * 2 - 15
      );
      descLines.forEach((line: string) => {
        ctx.doc.text(line, ctx.margin + 15, ctx.cursorY);
        ctx.cursorY += 11;
      });

      if (conflict.mitigation) {
        ctx.doc.setTextColor(80);
        ctx.doc.setFont('helvetica', 'italic');
        ctx.doc.text(`Mitigation: ${conflict.mitigation}`, ctx.margin + 15, ctx.cursorY);
        ctx.doc.setTextColor(0);
        ctx.cursorY += 11;
      }
      ctx.cursorY += 5;
    });
  }
}

/**
 * Render Page 4: UK Compliance Dashboard
 */
/**
 * Determine compliance status for a category
 * Returns: green (evidence available), amber (evidence required), red (risk/non-compliant)
 */
function getComplianceStatus(
  insight: EnhancedSustainabilityInsight,
  material: MaterialOption,
  category: 'epd' | 'recycled' | 'fixings' | 'biodiversity' | 'certification'
): TrafficLight {
  const ukChecks = insight.ukChecks || [];
  const benefits = insight.benefits || [];
  const risks = insight.risks || [];

  // Check for explicit status in ukChecks
  const relevantCheck = ukChecks.find((c) => {
    const label = c.label.toLowerCase();
    switch (category) {
      case 'epd':
        return (
          c.standard_code?.includes('EN 15804') ||
          c.standard_code?.includes('ISO 14025') ||
          label.includes('epd') ||
          label.includes('environmental product declaration')
        );
      case 'recycled':
        return (
          label.includes('recycled') ||
          label.includes('reclaimed') ||
          label.includes('secondary')
        );
      case 'fixings':
        return (
          label.includes('mechanical') ||
          label.includes('demountable') ||
          label.includes('disassembly') ||
          label.includes('reversible')
        );
      case 'biodiversity':
        return (
          label.includes('biodiversity') ||
          label.includes('habitat') ||
          label.includes('native')
        );
      case 'certification':
        return (
          c.standard_code?.includes('FSC') ||
          c.standard_code?.includes('PEFC') ||
          label.includes('certified') ||
          label.includes('chain of custody')
        );
      default:
        return false;
    }
  });

  // If ukCheck has explicit status, use it
  if (relevantCheck?.status) {
    return relevantCheck.status;
  }

  // Check for risks that would flag red
  const hasRisk = risks.some((r) => {
    const note = r.note?.toLowerCase() || '';
    switch (category) {
      case 'epd':
        return note.includes('no epd') || note.includes('unverified');
      case 'recycled':
        return note.includes('virgin') || note.includes('non-recycled');
      case 'fixings':
        return (
          note.includes('adhesive') ||
          note.includes('bonded') ||
          note.includes('composite')
        );
      case 'certification':
        return note.includes('uncertified') || note.includes('illegal');
      default:
        return false;
    }
  });

  if (hasRisk) return 'red';

  // Biodiversity special handling
  if (category === 'biodiversity') {
    if (material.category !== 'landscape' && material.category !== 'external-ground') {
      return 'amber'; // Not applicable shown as amber for non-landscape
    }
    const hasBioBenefit = benefits.some((b) => b.type === 'biodiversity' && b.score_1to5 >= 3);
    if (hasBioBenefit) return 'green';
    const hasAnyBio = benefits.some((b) => b.type === 'biodiversity');
    if (hasAnyBio) return 'amber';
    return 'red'; // Landscape without biodiversity consideration is a gap
  }

  // If we found a relevant check (without explicit status), it's at least being tracked
  if (relevantCheck) {
    // Check if the label suggests it's verified/available
    const label = relevantCheck.label.toLowerCase();
    if (
      label.includes('verified') ||
      label.includes('confirmed') ||
      label.includes('available') ||
      label.includes('compliant')
    ) {
      return 'green';
    }
    // Check being tracked but not yet verified
    return 'amber';
  }

  // Nothing found - evidence required
  return 'amber';
}

export function renderUKComplianceDashboard(
  ctx: PDFContext,
  insights: EnhancedSustainabilityInsight[],
  materials: MaterialOption[]
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'UK Compliance & Evidence', 16);
  ctx.cursorY += 5;

  // Build evidence lists by priority (red first, then amber)
  const redFlags: string[] = [];
  const amberRequired: string[] = [];

  insights.forEach((insight) => {
    const material = materials.find((m) => m.id === insight.id);
    if (!material) return;

    // Check each category and collect issues
    const categories: Array<{ key: 'epd' | 'recycled' | 'fixings' | 'biodiversity' | 'certification'; label: string }> = [
      { key: 'epd', label: 'EPD (EN 15804)' },
      { key: 'recycled', label: 'recycled content verification' },
      { key: 'fixings', label: 'mechanical fixings / disassembly' },
      { key: 'certification', label: 'chain of custody certification' },
    ];

    // Add biodiversity for landscape materials
    if (material.category === 'landscape' || material.category === 'external-ground') {
      categories.push({ key: 'biodiversity', label: 'biodiversity assessment' });
    }

    categories.forEach(({ key, label }) => {
      const status = getComplianceStatus(insight, material, key);
      if (status === 'red') {
        redFlags.push(`${material.name}: ${label} — risk or non-compliant`);
      } else if (status === 'amber') {
        amberRequired.push(`${material.name}: ${label}`);
      }
    });
  });

  // SECTION 1: Evidence Required (at TOP)
  const hasIssues = redFlags.length > 0 || amberRequired.length > 0;

  if (hasIssues) {
    addHeading(ctx, 'Evidence Required', 13);

    // Red flags first (risks)
    if (redFlags.length > 0) {
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(220, 53, 69);
      ctx.doc.text('Non-compliant / Risk:', ctx.margin, ctx.cursorY);
      ctx.cursorY += 12;

      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setTextColor(0);
      const maxRed = Math.min(redFlags.length, 5);
      for (let i = 0; i < maxRed; i++) {
        ensureSpace(ctx, 12);
        drawTrafficLight(ctx, ctx.margin + 5, ctx.cursorY - 3, 'red', 3);
        ctx.doc.text(redFlags[i], ctx.margin + 15, ctx.cursorY);
        ctx.cursorY += 12;
      }
      ctx.cursorY += 5;
    }

    // Amber items (evidence required)
    if (amberRequired.length > 0) {
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(180, 130, 0);
      ctx.doc.text('Evidence to obtain:', ctx.margin, ctx.cursorY);
      ctx.cursorY += 12;

      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setTextColor(0);
      const maxAmber = Math.min(amberRequired.length, 8);
      for (let i = 0; i < maxAmber; i++) {
        ensureSpace(ctx, 12);
        drawTrafficLight(ctx, ctx.margin + 5, ctx.cursorY - 3, 'amber', 3);
        ctx.doc.text(amberRequired[i], ctx.margin + 15, ctx.cursorY);
        ctx.cursorY += 12;
      }

      if (amberRequired.length > 8) {
        ctx.doc.setTextColor(100);
        ctx.doc.text(
          `... and ${amberRequired.length - 8} more items`,
          ctx.margin + 15,
          ctx.cursorY
        );
        ctx.doc.setTextColor(0);
        ctx.cursorY += 12;
      }
    }

    ctx.cursorY += 15;
  }

  // SECTION 2: Compliance Matrix
  addHeading(ctx, 'Compliance Matrix', 13);

  // Table layout
  const colWidths = [130, 50, 50, 50, 50, 50];
  const headers = ['Material', 'EPD', 'Recycled', 'Fixings', 'Cert.', 'Bio.'];
  const tableStartX = ctx.margin;

  // Table header
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(60);
  let xPos = tableStartX;
  headers.forEach((header, i) => {
    ctx.doc.text(header, xPos, ctx.cursorY);
    xPos += colWidths[i];
  });
  ctx.cursorY += 12;

  // Header line
  ctx.doc.setDrawColor(180);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(
    ctx.margin,
    ctx.cursorY - 5,
    ctx.pageWidth - ctx.margin,
    ctx.cursorY - 5
  );

  // Table rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(0);

  insights.forEach((insight) => {
    ensureSpace(ctx, 16);
    const material = materials.find((m) => m.id === insight.id);
    if (!material) return;

    xPos = tableStartX;

    // Material name
    const truncatedName =
      material.name.length > 20
        ? material.name.substring(0, 18) + '...'
        : material.name;
    ctx.doc.text(truncatedName, xPos, ctx.cursorY);
    xPos += colWidths[0];

    // EPD
    const epdStatus = getComplianceStatus(insight, material, 'epd');
    drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, epdStatus, 3);
    xPos += colWidths[1];

    // Recycled
    const recycledStatus = getComplianceStatus(insight, material, 'recycled');
    drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, recycledStatus, 3);
    xPos += colWidths[2];

    // Fixings
    const fixingsStatus = getComplianceStatus(insight, material, 'fixings');
    drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, fixingsStatus, 3);
    xPos += colWidths[3];

    // Certification
    const certStatus = getComplianceStatus(insight, material, 'certification');
    drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, certStatus, 3);
    xPos += colWidths[4];

    // Biodiversity (landscape only, otherwise show n/a)
    if (material.category === 'landscape' || material.category === 'external-ground') {
      const bioStatus = getComplianceStatus(insight, material, 'biodiversity');
      drawTrafficLight(ctx, xPos + 12, ctx.cursorY - 3, bioStatus, 3);
    } else {
      ctx.doc.setTextColor(150);
      ctx.doc.setFontSize(7);
      ctx.doc.text('n/a', xPos + 8, ctx.cursorY);
      ctx.doc.setFontSize(8);
      ctx.doc.setTextColor(0);
    }

    ctx.cursorY += 14;
  });

  // Legend
  ctx.cursorY += 12;
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(80);

  // Draw legend with actual traffic lights
  const legendY = ctx.cursorY;
  drawTrafficLight(ctx, ctx.margin + 5, legendY - 3, 'green', 3);
  ctx.doc.text('Evidence available', ctx.margin + 15, legendY);

  drawTrafficLight(ctx, ctx.margin + 100, legendY - 3, 'amber', 3);
  ctx.doc.text('Evidence required', ctx.margin + 110, legendY);

  drawTrafficLight(ctx, ctx.margin + 205, legendY - 3, 'red', 3);
  ctx.doc.text('Risk / Non-compliant', ctx.margin + 215, legendY);

  ctx.doc.setTextColor(0);
}

/**
 * Render lifecycle fingerprint visualization
 */
export function renderLifecycleFingerprint(
  ctx: PDFContext,
  materialId: string,
  materialName: string,
  profile: LifecycleProfile | null
): void {
  if (!profile) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text(`${materialName}: Fingerprint not available`, ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 15;
    return;
  }

  ensureSpace(ctx, 50);

  // Material name
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.text(materialName, ctx.margin, ctx.cursorY);
  ctx.cursorY += 14;

  // Draw fingerprint dots
  const stageKeys: Array<keyof LifecycleProfile> = [
    'raw',
    'manufacturing',
    'transport',
    'installation',
    'inUse',
    'maintenance',
    'endOfLife',
  ];
  const dotSize = 4;
  const dotGap = 2;
  const stageWidth = 50;
  const startX = ctx.margin;

  stageKeys.forEach((key, stageIndex) => {
    const stageData = profile[key];
    const xPos = startX + stageIndex * stageWidth;
    const label = STAGE_LABELS[key];

    // Stage label
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(7);
    ctx.doc.setTextColor(80);
    ctx.doc.text(label, xPos, ctx.cursorY);
    ctx.doc.setTextColor(0);

    // Draw dots
    for (let i = 1; i <= 5; i++) {
      const dotX = xPos + (i - 1) * (dotSize + dotGap);
      const dotY = ctx.cursorY + 6 - dotSize / 2;
      const isFilled = i <= stageData.impact;

      if (isFilled) {
        if (stageData.confidence === 'low') {
          ctx.doc.setDrawColor(100);
          ctx.doc.setFillColor(255, 255, 255);
          ctx.doc.setLineWidth(0.5);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
        } else if (stageData.confidence === 'medium') {
          ctx.doc.setFillColor(150, 150, 150);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        } else {
          ctx.doc.setFillColor(0, 0, 0);
          ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'F');
        }
      } else {
        ctx.doc.setDrawColor(200, 200, 200);
        ctx.doc.setFillColor(255, 255, 255);
        ctx.doc.setLineWidth(0.5);
        ctx.doc.rect(dotX, dotY, dotSize, dotSize, 'FD');
      }
    }

    // Confidence indicator
    if (stageData.confidence === 'low' || stageData.confidence === 'medium') {
      ctx.doc.setFontSize(6);
      ctx.doc.text('?', xPos + 5 * (dotSize + dotGap) + 2, ctx.cursorY + 7);
    }
  });

  ctx.cursorY += 18;
}

/**
 * Palette context for material ranking
 */
export interface MaterialPaletteContext {
  rank: number; // 1 = highest embodied impact
  totalMaterials: number;
  contributionPercent: number; // Percentage of total embodied impact
  thumbnailDataUri?: string; // Optional material thumbnail
}

/**
 * Render enhanced material section with design consequences
 */
export function renderEnhancedMaterialSection(
  ctx: PDFContext,
  material: MaterialOption,
  insight: EnhancedSustainabilityInsight | undefined,
  metrics: MaterialMetrics | undefined,
  profile: LifecycleProfile | null,
  paletteContext?: MaterialPaletteContext
): void {
  ensureSpace(ctx, 140);

  // Material thumbnail (if available)
  const thumbnailSize = 50;
  let contentStartX = ctx.margin;

  if (paletteContext?.thumbnailDataUri) {
    try {
      ctx.doc.addImage(
        paletteContext.thumbnailDataUri,
        'PNG',
        ctx.margin,
        ctx.cursorY,
        thumbnailSize,
        thumbnailSize
      );
      contentStartX = ctx.margin + thumbnailSize + 10; // Offset content to right of thumbnail
    } catch (e) {
      // Thumbnail failed to load, continue without it
      console.warn('Failed to add material thumbnail to PDF:', e);
    }
  }

  // Material name header (next to thumbnail if present)
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(12);
  ctx.doc.text(material.name, contentStartX, ctx.cursorY + 8);

  // Category tag
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(100);
  ctx.doc.text(`[${material.category}]`, contentStartX, ctx.cursorY + 18);
  ctx.doc.setTextColor(0);

  // Move cursor past thumbnail area
  if (paletteContext?.thumbnailDataUri) {
    ctx.cursorY += thumbnailSize + 10;
  } else {
    ctx.cursorY += 25;
  }

  // Lifecycle fingerprint (moved below header)
  renderLifecycleFingerprint(ctx, material.id, '', profile); // Empty name since we already rendered it

  // Palette context box (NEW) - shows ranking and contribution
  if (paletteContext && metrics) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);

    // Color code based on ranking
    if (paletteContext.rank <= 2) {
      ctx.doc.setTextColor(220, 53, 69); // Red for top 2
    } else if (paletteContext.rank <= Math.ceil(paletteContext.totalMaterials / 2)) {
      ctx.doc.setTextColor(180, 130, 0); // Amber for upper half
    } else {
      ctx.doc.setTextColor(34, 139, 34); // Green for lower half
    }

    // Ranking text
    const rankText = `#${paletteContext.rank} of ${paletteContext.totalMaterials} by embodied carbon`;
    ctx.doc.text(rankText, ctx.margin, ctx.cursorY);

    // Contribution percentage
    const contribText = `(${paletteContext.contributionPercent.toFixed(0)}% of palette total)`;
    ctx.doc.text(contribText, ctx.margin + 150, ctx.cursorY);

    ctx.doc.setTextColor(0);
    ctx.cursorY += 14;

    // Traffic light indicator with label
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    const ratingLabel =
      metrics.traffic_light === 'green'
        ? 'Low impact'
        : metrics.traffic_light === 'amber'
        ? 'Moderate impact — review design levers'
        : 'High impact — consider alternatives';
    drawTrafficLight(ctx, ctx.margin, ctx.cursorY - 3, metrics.traffic_light, 4);
    ctx.doc.text(ratingLabel, ctx.margin + 15, ctx.cursorY);
    ctx.cursorY += 12;
  }

  if (!insight) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No sustainability insights available', ctx.margin + 10, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 20;
    return;
  }

  // Headline
  if (insight.headline) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    addParagraph(ctx, insight.headline, 10, 6);
  }

  // Lifecycle metrics box (NEW)
  if (metrics) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(80);

    // Service life and replacements
    const lifeText = metrics.service_life >= 100 ? '100+' : String(metrics.service_life);
    const replText = metrics.lifecycle_multiplier === 1 ? 'full building life' : `${metrics.lifecycle_multiplier}× over 60 years`;
    ctx.doc.text(`Service life: ${lifeText} years (${replText})`, ctx.margin, ctx.cursorY);

    // Carbon payback if applicable
    if (metrics.carbon_payback) {
      const payback = metrics.carbon_payback;
      let paybackText: string;
      if (payback.years === 0) {
        paybackText = payback.mechanism === 'sequestration'
          ? 'Carbon payback: Negative from day 1 (carbon stored)'
          : 'Carbon payback: Immediate benefit';
      } else {
        const mechText = payback.mechanism === 'generation' ? 'energy generated'
          : payback.mechanism === 'sequestration' ? 'carbon stored'
          : 'emissions avoided';
        paybackText = `Carbon payback: ~${payback.years} years (${mechText})`;
      }
      ctx.cursorY += 10;
      ctx.doc.setTextColor(34, 100, 34);
      ctx.doc.text(paybackText, ctx.margin, ctx.cursorY);
    }

    ctx.doc.setTextColor(0);
    ctx.cursorY += 14;
  }

  // Hotspots with reasons
  if (insight.hotspots && insight.hotspots.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text('Hotspots:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;

    ctx.doc.setFont('helvetica', 'normal');
    insight.hotspots.forEach((hotspot: Hotspot) => {
      const label = STAGE_LABELS[hotspot.stage];
      ctx.doc.setTextColor(220, 53, 69);
      ctx.doc.text(`${label} (${hotspot.score}):`, ctx.margin + 10, ctx.cursorY);
      ctx.doc.setTextColor(0);
      ctx.doc.text(` ${hotspot.reason}`, ctx.margin + 50, ctx.cursorY);
      ctx.cursorY += 11;
    });
    ctx.cursorY += 4;
  }

  // Design Risk / Response (NEW)
  if (insight.design_risk || insight.design_response) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(100);

    if (insight.design_risk) {
      ctx.doc.text(insight.design_risk, ctx.margin, ctx.cursorY);
      ctx.cursorY += 11;
    }
    if (insight.design_response) {
      ctx.doc.setTextColor(34, 139, 34);
      ctx.doc.text(insight.design_response, ctx.margin, ctx.cursorY);
      ctx.cursorY += 11;
    }
    ctx.doc.setTextColor(0);
    ctx.cursorY += 4;
  }

  // Design Levers
  if (insight.designLevers && insight.designLevers.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text('Design Levers:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;

    ctx.doc.setFont('helvetica', 'normal');
    insight.designLevers.slice(0, 4).forEach((lever) => {
      addBullet(ctx, lever, 9);
    });
    ctx.cursorY += 4;
  }

  // UK Checks
  if (insight.ukChecks && insight.ukChecks.length > 0) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text('UK Checks:', ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;

    ctx.doc.setFont('helvetica', 'normal');
    insight.ukChecks.slice(0, 4).forEach((check) => {
      const text = check.standard_code
        ? `${check.label} (${check.standard_code})`
        : check.label;
      addBullet(ctx, text, 9);
    });
    ctx.cursorY += 4;
  }

  ctx.cursorY += 10;
}

/**
 * Add disclaimer footer
 */
export function addDisclaimer(ctx: PDFContext): void {
  ensureSpace(ctx, 80);
  ctx.cursorY = ctx.pageHeight - ctx.margin - 50;

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
  ctx.doc.setFont('helvetica', 'medium');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(0);
  ctx.doc.text('Generated with Moodboard-Lab', ctx.margin, ctx.cursorY);
}
