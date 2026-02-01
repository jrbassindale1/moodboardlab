import type { MaterialOption } from '../../types';
import type { EnhancedSustainabilityInsight, MaterialMetrics, PDFContext } from '../../types/sustainability';
import { getCircularityIndicator } from '../sustainabilityScoring';
import { addHeading, ensureSpace } from './layout';

/**
 * Design recommendation for the Design Direction page
 */
export interface DesignRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'reduce' | 'replace' | 'specify' | 'keep';
  recommendationId: string;
  action: string;
  rationale: string;
  driver: string;
  materialIds?: string[]; // Related materials
}

/**
 * Generate design recommendations from palette analysis
 */
export function generateDesignRecommendations(
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>,
  insights: EnhancedSustainabilityInsight[]
): DesignRecommendation[] {
  const recommendations: DesignRecommendation[] = [];
  const totalEmbodied = Array.from(metrics.values()).reduce(
    (sum, m) => sum + m.embodied_proxy,
    0
  );
  const categoryCaps: Record<DesignRecommendation['category'], number> = {
    replace: 2,
    specify: 3,
    reduce: 2,
    keep: 2,
  };

  // Sort materials by embodied impact
  const sortedByEmbodied = [...materials].sort((a, b) => {
    const metricA = metrics.get(a.id);
    const metricB = metrics.get(b.id);
    return (metricB?.embodied_proxy || 0) - (metricA?.embodied_proxy || 0);
  });
  const rankMap = new Map<string, number>();
  sortedByEmbodied.forEach((mat, idx) => {
    rankMap.set(mat.id, idx + 1);
  });

  const buildDriver = (materialIds?: string[]): string => {
    if (!materialIds || materialIds.length === 0) {
      return 'Driver: data limited';
    }
    const candidates = materialIds
      .map((id) => ({ id, metric: metrics.get(id) }))
      .filter((entry) => entry.metric);
    const primary = candidates.sort(
      (a, b) => (b.metric?.embodied_proxy || 0) - (a.metric?.embodied_proxy || 0)
    )[0];
    if (!primary?.metric) return 'Driver: data limited';
    const rank = rankMap.get(primary.id);
    const rankText = rank ? `#${rank} embodied contributor` : 'embodied contributor';
    const replacements = primary.metric.lifecycle_multiplier;
    const replacementText = `${replacements} replacement${replacements === 1 ? '' : 's'}`;
    const circularity = getCircularityIndicator(primary.metric.end_of_life_proxy);
    const circularityText = `${circularity} circularity`;
    return `Driver: ${rankText} + ${replacementText} + ${circularityText}`;
  };

  // Check for carbon dominant components (>15%)
  sortedByEmbodied.forEach((mat) => {
    const metric = metrics.get(mat.id);
    if (!metric || totalEmbodied === 0) return;
    const percent = (metric.embodied_proxy / totalEmbodied) * 100;

    if (percent >= 20) {
      // Major contributor - suggest reduction or replacement
      if (mat.category === 'floor') {
        recommendations.push({
          priority: 'high',
          category: 'reduce',
          recommendationId: `reduce-floor-${mat.id}`,
          action: `Limit ${mat.name.toLowerCase()} to high-traffic zones only`,
          rationale: `Currently ${percent.toFixed(0)}% of palette embodied carbon`,
          driver: buildDriver([mat.id]),
          materialIds: [mat.id],
        });
      } else if (mat.category === 'external' || mat.category === 'wall-internal') {
        recommendations.push({
          priority: 'high',
          category: 'replace',
          recommendationId: `replace-${mat.id}`,
          action: `Consider bio-based alternatives to ${mat.name.toLowerCase()}`,
          rationale: `High embodied carbon (${percent.toFixed(0)}% of total)`,
          driver: buildDriver([mat.id]),
          materialIds: [mat.id],
        });
      } else if (mat.category === 'external-ground') {
        recommendations.push({
          priority: 'high',
          category: 'reduce',
          recommendationId: `reduce-hardscape-${mat.id}`,
          action: 'Reduce hard landscape area by 20-30%',
          rationale: `Hard landscape contributing ${percent.toFixed(0)}% of palette carbon`,
          driver: buildDriver([mat.id]),
          materialIds: [mat.id],
        });
      }
    }
  });

  // Check for glazing without disassembly - consolidate into single recommendation
  const glazingMaterials = materials.filter(
    (m) => m.category === 'window' || m.name.toLowerCase().includes('glass')
  );
  const glazingWithoutDisassembly = glazingMaterials.filter((mat) => {
    const insight = insights.find((i) => i.id === mat.id);
    const hasDisassembly = insight?.ukChecks?.some(
      (c) => c.label.toLowerCase().includes('mechanical') || c.label.toLowerCase().includes('demount')
    );
    return !hasDisassembly;
  });
  if (glazingWithoutDisassembly.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'specify',
      recommendationId: 'specify-demountable-glazing',
      action: 'Replace frameless glazing with modular demountable system',
      rationale: `Enables future reuse and reduces lifetime impact (${glazingWithoutDisassembly.length} glazing element${glazingWithoutDisassembly.length > 1 ? 's' : ''})`,
      driver: buildDriver(glazingWithoutDisassembly.map((m) => m.id)),
      materialIds: glazingWithoutDisassembly.map((m) => m.id),
    });
  }

  // Check for multiple high-maintenance materials
  const highMaintenance = materials.filter((m) => {
    const metric = metrics.get(m.id);
    return metric && metric.in_use_proxy >= 3;
  });
  if (highMaintenance.length >= 3) {
    recommendations.push({
      priority: 'medium',
      category: 'reduce',
      recommendationId: 'reduce-maintenance-complexity',
      action: 'Consolidate finishes to reduce maintenance complexity',
      rationale: `${highMaintenance.length} materials require significant maintenance`,
      driver: buildDriver(highMaintenance.map((m) => m.id)),
      materialIds: highMaintenance.map((m) => m.id),
    });
  }

  // Check for low-circularity materials
  const lowCircularity = materials.filter((m) => {
    const metric = metrics.get(m.id);
    return metric && metric.end_of_life_proxy >= 4;
  });
  lowCircularity.forEach((mat) => {
    recommendations.push({
      priority: 'medium',
      category: 'specify',
      recommendationId: `specify-fixings-${mat.id}`,
      action: `Specify mechanical fixings for ${mat.name}`,
      rationale: 'Enables disassembly and material recovery',
      driver: buildDriver([mat.id]),
      materialIds: [mat.id],
    });
  });

  // Bio-based alternatives for high-embodied structure
  const structuralMaterials = materials.filter(
    (m) => m.category === 'wall-internal' || m.category === 'roof' || m.category === 'structure' || m.category === 'external'
  );
  const highEmbodiedStructure = structuralMaterials.filter((m) => {
    const metric = metrics.get(m.id);
    return metric && metric.embodied_proxy >= 3;
  });
  if (highEmbodiedStructure.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'replace',
      recommendationId: 'replace-bio-based-structure',
      action: 'Prioritise hempcrete, rammed earth, or mass timber in envelope',
      rationale: 'Bio-based materials store carbon rather than emit it',
      driver: buildDriver(highEmbodiedStructure.map((m) => m.id)),
      materialIds: highEmbodiedStructure.map((m) => m.id),
    });
  }

  // Deduplicate by recommendationId
  const seen = new Set<string>();
  const deduped = recommendations.filter((rec) => {
    if (seen.has(rec.recommendationId)) return false;
    seen.add(rec.recommendationId);
    return true;
  });

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  deduped.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Cap per type
  const counts: Record<DesignRecommendation['category'], number> = {
    replace: 0,
    specify: 0,
    reduce: 0,
    keep: 0,
  };
  const capped: DesignRecommendation[] = [];
  deduped.forEach((rec) => {
    const cap = categoryCaps[rec.category];
    if (counts[rec.category] < cap) {
      counts[rec.category] += 1;
      capped.push(rec);
    }
  });

  return capped; // Apply caps instead of total count
}

/**
 * Render Design Direction Page
 */
export function renderDesignDirectionPage(
  ctx: PDFContext,
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>,
  insights: EnhancedSustainabilityInsight[]
): void {
  ctx.doc.addPage();
  ctx.cursorY = ctx.margin;

  addHeading(ctx, 'Design Direction', 16);
  ctx.cursorY += 5;

  // Introductory text
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(80);
  const directionDisclaimer = 'Recommendations are proportional to early-stage impact drivers and should be revisited once quantities and specifications are known.';
  const disclaimerLines = ctx.doc.splitTextToSize(directionDisclaimer, ctx.pageWidth - ctx.margin * 2);
  disclaimerLines.forEach((line: string) => {
    ctx.doc.text(line, ctx.margin, ctx.cursorY);
    ctx.cursorY += 12;
  });
  ctx.cursorY += 6;
  ctx.doc.setTextColor(0);

  // Generate recommendations
  const recommendations = generateDesignRecommendations(materials, metrics, insights);

  if (recommendations.length === 0) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(100);
    ctx.doc.text('No specific design adjustments recommended for this palette.', ctx.margin, ctx.cursorY);
    ctx.cursorY += 15;
    ctx.doc.text('Continue with evidence collection and specification refinement.', ctx.margin, ctx.cursorY);
    ctx.doc.setTextColor(0);
    return;
  }

  // Category icons
  const categoryLabels: Record<string, string> = {
    reduce: 'REDUCE',
    replace: 'REPLACE',
    specify: 'SPECIFY',
    keep: 'KEEP',
  };

  // Render recommendations
  recommendations.forEach((rec) => {
    ensureSpace(ctx, 50);

    // Priority indicator
    const priorityColors: Record<string, [number, number, number]> = {
      high: [220, 53, 69],
      medium: [255, 191, 0],
      low: [34, 139, 34],
    };
    const [r, g, b] = priorityColors[rec.priority];

    // Draw priority badge
    ctx.doc.setFillColor(r, g, b);
    ctx.doc.circle(ctx.margin + 8, ctx.cursorY, 4, 'F');

    // Category tag
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(100);
    ctx.doc.text(categoryLabels[rec.category], ctx.margin + 18, ctx.cursorY + 2);

    ctx.cursorY += 12;

    // Action text
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(0);
    const actionLines = ctx.doc.splitTextToSize(rec.action, ctx.pageWidth - ctx.margin * 2 - 20);
    actionLines.forEach((line: string) => {
      ctx.doc.text(line, ctx.margin + 5, ctx.cursorY);
      ctx.cursorY += 12;
    });

    // Rationale
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(80);
    ctx.doc.text(rec.rationale, ctx.margin + 5, ctx.cursorY);
    ctx.cursorY += 12;

    // Driver
    ctx.doc.setFont('helvetica', 'italic');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(100);
    ctx.doc.text(rec.driver, ctx.margin + 5, ctx.cursorY);
    ctx.cursorY += 14;

    ctx.doc.setTextColor(0);
  });

  // Legend
  ctx.cursorY += 10;
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(80);

  const legendY = ctx.cursorY;
  ctx.doc.setFillColor(220, 53, 69);
  ctx.doc.circle(ctx.margin + 5, legendY - 2, 3, 'F');
  ctx.doc.text('High priority', ctx.margin + 12, legendY);

  ctx.doc.setFillColor(255, 191, 0);
  ctx.doc.circle(ctx.margin + 80, legendY - 2, 3, 'F');
  ctx.doc.text('Medium priority', ctx.margin + 87, legendY);

  ctx.doc.setFillColor(34, 139, 34);
  ctx.doc.circle(ctx.margin + 175, legendY - 2, 3, 'F');
  ctx.doc.text('Low priority', ctx.margin + 182, legendY);

  ctx.doc.setTextColor(0);
}
