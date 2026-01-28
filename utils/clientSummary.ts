// Client summary generator
// Creates front-page summary content for the PDF report

import type {
  ClientSummary,
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  Synergy,
  Conflict,
} from '../types/sustainability';
import type { MaterialOption } from '../types';

/**
 * Generate the client-facing summary for the front page
 */
export function generateClientSummary(
  materials: MaterialOption[],
  insights: EnhancedSustainabilityInsight[],
  metrics: Map<string, MaterialMetrics>,
  synergies: Synergy[],
  conflicts: Conflict[]
): ClientSummary {
  const achievements = generateAchievements(materials, metrics, synergies);
  const risksAndMitigations = generateRisksAndMitigations(
    materials,
    insights,
    metrics,
    conflicts
  );
  const evidenceChecklist = generateEvidenceChecklist(materials, insights);
  const confidenceStatement = generateConfidenceStatement(metrics);

  return {
    achievements,
    risks_and_mitigations: risksAndMitigations,
    evidence_checklist: evidenceChecklist,
    confidence_statement: confidenceStatement,
  };
}

/**
 * Generate achievement bullets based on palette characteristics
 */
function generateAchievements(
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>,
  synergies: Synergy[]
): string[] {
  const achievements: string[] = [];
  const totalCount = materials.length;

  // Count by traffic light
  const greenCount = [...metrics.values()].filter(
    (m) => m.traffic_light === 'green'
  ).length;
  const avgBenefit =
    [...metrics.values()].reduce((sum, m) => sum + m.benefit_score, 0) /
    Math.max(totalCount, 1);

  // Count material types
  const landscapeCount = materials.filter(
    (m) => m.category === 'landscape'
  ).length;
  const timberCount = materials.filter(
    (m) =>
      m.id.includes('timber') ||
      m.id.includes('clt') ||
      m.id.includes('glulam') ||
      m.id.includes('wood')
  ).length;

  // Achievement: Green ratings
  if (greenCount > totalCount * 0.5 && totalCount > 0) {
    achievements.push(
      `${greenCount} of ${totalCount} materials achieve green sustainability rating`
    );
  } else if (greenCount >= 1) {
    achievements.push(
      `${greenCount} material${greenCount > 1 ? 's' : ''} achieve${greenCount === 1 ? 's' : ''} green sustainability rating`
    );
  }

  // Achievement: Synergy-based
  if (synergies.some((s) => s.type === 'biodiversity')) {
    achievements.push(
      'Landscape strategy enhances biodiversity and ecological value'
    );
  }

  if (synergies.some((s) => s.type === 'carbon')) {
    achievements.push(
      'Material selection supports carbon reduction through renewable integration or biogenic storage'
    );
  }

  if (synergies.some((s) => s.type === 'circularity')) {
    achievements.push(
      'Circular design principles enable future material reuse'
    );
  }

  // Achievement: Timber
  if (timberCount >= 2) {
    achievements.push(
      'Timber-based materials provide biogenic carbon storage benefits'
    );
  }

  // Achievement: High benefit score
  if (avgBenefit > 2.5 && achievements.length < 3) {
    achievements.push(
      'Material selection balances environmental performance with practical benefits'
    );
  }

  // Achievement: Landscape
  if (landscapeCount > 0 && achievements.length < 3) {
    achievements.push(
      'External landscape specification supports site ecology and wellbeing'
    );
  }

  // Fallback achievements
  if (achievements.length < 3) {
    achievements.push(
      'Early-stage sustainability review enables informed design decisions'
    );
  }

  return achievements.slice(0, 3);
}

/**
 * Generate risk and mitigation bullets
 */
function generateRisksAndMitigations(
  materials: MaterialOption[],
  insights: EnhancedSustainabilityInsight[],
  metrics: Map<string, MaterialMetrics>,
  conflicts: Conflict[]
): string[] {
  const risksAndMitigations: string[] = [];

  // Add conflict-based risks with mitigations
  conflicts.forEach((conflict) => {
    if (conflict.mitigation) {
      risksAndMitigations.push(
        `${conflict.description} — ${conflict.mitigation}`
      );
    } else {
      risksAndMitigations.push(conflict.description);
    }
  });

  // Add high-impact material risks
  const highImpactMaterials = [...metrics.entries()]
    .filter(([, m]) => m.traffic_light === 'red')
    .slice(0, 2);

  highImpactMaterials.forEach(([id]) => {
    const mat = materials.find((m) => m.id === id);
    const insight = insights.find((i) => i.id === id);
    if (mat && insight?.designLevers?.[0]) {
      risksAndMitigations.push(
        `${mat.name} has high embodied impact — ${insight.designLevers[0]}`
      );
    }
  });

  // Add amber material warnings if no reds
  if (highImpactMaterials.length === 0) {
    const amberMaterials = [...metrics.entries()]
      .filter(([, m]) => m.traffic_light === 'amber')
      .slice(0, 1);

    amberMaterials.forEach(([id]) => {
      const mat = materials.find((m) => m.id === id);
      const insight = insights.find((i) => i.id === id);
      if (mat && insight?.designLevers?.[0]) {
        risksAndMitigations.push(
          `${mat.name} requires attention — ${insight.designLevers[0]}`
        );
      }
    });
  }

  // Standard mitigation actions
  if (risksAndMitigations.length < 3) {
    risksAndMitigations.push(
      'Continue to gather EPD data as specifications develop'
    );
  }

  if (risksAndMitigations.length < 3) {
    risksAndMitigations.push(
      'Review transport distances during procurement to minimize impact'
    );
  }

  return risksAndMitigations.slice(0, 3);
}

/**
 * Generate evidence checklist items
 */
function generateEvidenceChecklist(
  materials: MaterialOption[],
  insights: EnhancedSustainabilityInsight[]
): string[] {
  const checklist: string[] = [];
  const addedTypes = new Set<string>();

  // Check for missing EPDs
  insights.forEach((insight) => {
    const mat = materials.find((m) => m.id === insight.id);
    if (!mat) return;

    const hasEPD = insight.ukChecks?.some(
      (c) =>
        c.standard_code?.includes('EN 15804') ||
        c.label.toLowerCase().includes('epd')
    );

    if (!hasEPD && !addedTypes.has('epd')) {
      checklist.push(`Request EPD (EN 15804) for key materials`);
      addedTypes.add('epd');
    }
  });

  // Standard evidence items
  const standardItems = [
    'Confirm recycled content percentages with suppliers',
    'Verify chain-of-custody certificates for timber products',
    'Assess local sourcing options for high-transport-impact items',
    'Request manufacturer sustainability commitments',
    'Document demountability and take-back options',
  ];

  // Check for timber products
  const hasTimber = materials.some(
    (m) =>
      m.id.includes('timber') ||
      m.id.includes('wood') ||
      m.keywords?.some((k) => k.includes('timber'))
  );
  if (hasTimber && !addedTypes.has('timber')) {
    checklist.push('Verify FSC/PEFC certification for all timber products');
    addedTypes.add('timber');
  }

  // Add standard items until we have 5
  for (const item of standardItems) {
    if (checklist.length >= 5) break;
    if (!checklist.includes(item)) {
      checklist.push(item);
    }
  }

  return checklist.slice(0, 5);
}

/**
 * Generate confidence statement based on metrics
 */
function generateConfidenceStatement(
  metrics: Map<string, MaterialMetrics>
): string {
  const metricsArray = [...metrics.values()];
  const lowConfCount = metricsArray.filter((m) => m.low_confidence_flag).length;
  const totalCount = metricsArray.length;

  if (totalCount === 0) {
    return 'No materials have been assessed. Add materials to generate sustainability insights.';
  }

  if (lowConfCount === 0) {
    return 'This assessment is based on high-confidence lifecycle data for all materials. Figures should be validated with product-specific EPDs during detailed design.';
  }

  if (lowConfCount <= 2) {
    return `This assessment includes ${lowConfCount} material${lowConfCount > 1 ? 's' : ''} with limited lifecycle data. Priority should be given to obtaining EPDs for ${lowConfCount > 1 ? 'these items' : 'this item'}.`;
  }

  if (lowConfCount <= totalCount * 0.5) {
    return `Caution: ${lowConfCount} of ${totalCount} materials have low-confidence data. This assessment should be considered indicative until better data is available.`;
  }

  return `Note: The majority of materials (${lowConfCount} of ${totalCount}) have limited lifecycle data. Treat this assessment as preliminary and prioritize EPD collection.`;
}

/**
 * Get a brief one-line summary suitable for headers
 */
export function getOneLinerSummary(
  metrics: Map<string, MaterialMetrics>,
  synergies: Synergy[]
): string {
  const metricsArray = [...metrics.values()];
  const greenCount = metricsArray.filter(
    (m) => m.traffic_light === 'green'
  ).length;
  const totalCount = metricsArray.length;

  if (totalCount === 0) return 'No materials assessed';

  const greenRatio = greenCount / totalCount;
  const hasSynergies = synergies.length > 0;

  if (greenRatio >= 0.7 && hasSynergies) {
    return 'Strong sustainability palette with synergistic benefits';
  } else if (greenRatio >= 0.5) {
    return 'Balanced palette with good sustainability performance';
  } else if (greenRatio >= 0.3) {
    return 'Mixed palette requiring focused improvement areas';
  } else {
    return 'Palette requires review of high-impact materials';
  }
}
