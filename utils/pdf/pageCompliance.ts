import type { MaterialOption } from '../../types';
import type { EnhancedSustainabilityInsight, PDFContext, TrafficLight } from '../../types/sustainability';
import { addHeading, ensureSpace } from './layout';

export type ComplianceKey = 'epd' | 'recycled' | 'fixings' | 'biodiversity' | 'certification';

export const COMPLIANCE_BADGE_KEY: Array<{ key: ComplianceKey; code: string; label: string; explanation: string }> = [
  { key: 'epd', code: '1', label: 'EPD (EN 15804 / ISO 14025)', explanation: 'Required for all primary structure and envelope systems' },
  { key: 'recycled', code: '2', label: 'Recycled content declaration', explanation: 'Critical for steel, concrete, polymers' },
  { key: 'fixings', code: '3', label: 'Design for disassembly / reversible fixings', explanation: 'Relevant to finishes and secondary systems' },
  { key: 'certification', code: '4', label: 'Chain of custody certification (FSC/PEFC)', explanation: 'Required for all timber products' },
  { key: 'biodiversity', code: '5', label: 'Biodiversity assessment (landscape only)', explanation: 'Required for all landscape elements' },
];

/**
 * Determine compliance status for a category
 * Returns: green (evidence available), amber (evidence required), red (risk/non-compliant)
 */
export function getComplianceStatus(
  insight: EnhancedSustainabilityInsight,
  material: MaterialOption,
  category: ComplianceKey
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

export function renderComplianceReadinessSummary(
  ctx: PDFContext,
  insights: EnhancedSustainabilityInsight[],
  materials: MaterialOption[]
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'Compliance Readiness Summary (UK)', 16);
  ctx.cursorY += 4;

  // Intro (concept-stage framing)
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(80);
  const introLines = ctx.doc.splitTextToSize(
    'Compliance readiness = whether standard supplier evidence (environmental product declarations, certificates, recycled-content declarations) is likely to be available at this stage. Concept-stage view: highlights real risk items, evidence priorities, and what can safely wait.',
    ctx.pageWidth - ctx.margin * 2
  );
  introLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 11;
  });
  ctx.cursorY += 2;
  ctx.doc.text(
    'At concept stage, most materials require standard evidence rather than presenting unique compliance risks.',
    ctx.margin,
    ctx.cursorY
  );
  ctx.doc.setTextColor(0);
  ctx.cursorY += 12;

  const stats = new Map<ComplianceKey, { red: number; amber: number; green: number; na: number }>();
  COMPLIANCE_BADGE_KEY.forEach(({ key }) => {
    stats.set(key, { red: 0, amber: 0, green: 0, na: 0 });
  });

  const redMaterials: Array<{ name: string; codes: string[] }> = [];

  insights.forEach((insight) => {
    const material = materials.find((m) => m.id === insight.id);
    if (!material) return;

    const codes: string[] = [];
    const isLandscape = material.category === 'landscape' || material.category === 'external-ground';

    COMPLIANCE_BADGE_KEY.forEach(({ key, code }) => {
      const bucket = stats.get(key);
      if (!bucket) return;

      if (key === 'biodiversity' && !isLandscape) {
        bucket.na += 1;
        return;
      }

      const status = getComplianceStatus(insight, material, key);
      bucket[status] += 1;
      if (status === 'red') codes.push(code);
    });

    if (codes.length > 0) {
      redMaterials.push({ name: material.name, codes });
    }
  });

  // 1) Real risks
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.text('1) Real risks', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);

  if (redMaterials.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('No red-flag compliance risks identified at concept stage.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  } else {
    redMaterials.slice(0, 4).forEach((item) => {
      ensureSpace(ctx, 12);
      ctx.doc.text(`- ${item.name} (codes ${item.codes.join(', ')})`, ctx.margin, ctx.cursorY);
      ctx.cursorY += 12;
    });
  }

  ctx.cursorY += 6;

  // 2) Evidence to prioritise next
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.text('2) Evidence to prioritise next', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(100);
  ctx.doc.text('This is typical at concept stage and does not indicate non-compliance.', ctx.margin, ctx.cursorY);
  ctx.doc.setTextColor(0);
  ctx.cursorY += 12;

  const priority = COMPLIANCE_BADGE_KEY.map(({ key, code }) => {
    const bucket = stats.get(key);
    const total = bucket ? bucket.red + bucket.amber : 0;
    return { code, total };
  })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  if (priority.length === 0) {
    ctx.doc.setTextColor(100);
    ctx.doc.text('No evidence gaps flagged across the palette.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  } else {
    priority.slice(0, 3).forEach((item) => {
      ctx.doc.text(`- Code ${item.code}: ${item.total} material${item.total > 1 ? 's' : ''} flagged`, ctx.margin, ctx.cursorY);
      ctx.cursorY += 12;
    });
  }

  ctx.cursorY += 6;

  // 3) What can safely wait
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.text('3) Can safely wait (concept stage)', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;

  const deferCodes = COMPLIANCE_BADGE_KEY.filter(({ key }) => {
    const bucket = stats.get(key);
    if (!bucket) return false;
    return bucket.red + bucket.amber === 0 && bucket.green > 0;
  }).map(({ code }) => code);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  if (deferCodes.length > 0) {
    ctx.doc.text(`- Codes ${deferCodes.join(', ')} show no current gaps across the palette`, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  } else {
    ctx.doc.setTextColor(100);
    ctx.doc.text('Defer supplier-specific certificates and test reports to detailed specification.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  }

  ctx.cursorY += 6;

  // Out of scope note
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(100);
  const outScopeLines = ctx.doc.splitTextToSize(
    'Out of scope at concept stage: supplier test reports, product-level verification of claims, construction-phase method statements, commissioning evidence.',
    ctx.pageWidth - ctx.margin * 2
  );
  outScopeLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 10;
  });
  ctx.doc.setTextColor(0);
  ctx.cursorY += 6;

  // Badge key (listed once)
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.text('Badge key (used on material pages):', ctx.margin, ctx.cursorY);
  ctx.cursorY += 12;

  ctx.doc.setFontSize(9);
  COMPLIANCE_BADGE_KEY.forEach(({ code, label, explanation }) => {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.text(`${code}. ${label}`, ctx.margin, ctx.cursorY);
    ctx.cursorY += 10;
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setTextColor(80);
    ctx.doc.text(`   ${explanation}`, ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    ctx.cursorY += 12;
  });
}
