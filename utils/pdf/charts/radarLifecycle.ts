import type { jsPDF } from 'jspdf';

export type LifecycleKey =
  | 'raw'
  | 'manufacturing'
  | 'transport'
  | 'installation'
  | 'inUse'
  | 'maintenance'
  | 'endOfLife';

export const LIFECYCLE_ORDER: LifecycleKey[] = [
  'raw',
  'manufacturing',
  'transport',
  'installation',
  'inUse',
  'maintenance',
  'endOfLife',
];

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleKey, string> = {
  raw: 'Raw Materials',
  manufacturing: 'Manufacturing',
  transport: 'Transport',
  installation: 'Installation',
  inUse: 'In Use',
  maintenance: 'Maintenance',
  endOfLife: 'End of Life',
};

export const LIFECYCLE_STAGE_CHART_LABELS: Record<LifecycleKey, string[]> = {
  raw: ['Raw', 'Materials'],
  manufacturing: ['Manufacturing'],
  transport: ['Transport'],
  installation: ['Installation'],
  inUse: ['In Use'],
  maintenance: ['Maintenance'],
  endOfLife: ['End of', 'Life'],
};

export type LifecycleStageScore = {
  key: LifecycleKey;
  label: string;
  chartLabel: string[];
  score: number;
};

export type RadarChartOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function drawPolygon(
  doc: jsPDF,
  points: Array<{ x: number; y: number }>,
  style: 'S' | 'F' | 'FD'
) {
  if (points.length < 2) return;
  const segments = points.slice(1).map((point, index) => [
    point.x - points[index].x,
    point.y - points[index].y,
  ]);
  doc.lines(segments, points[0].x, points[0].y, [1, 1], style, true);
}

/**
 * Draws a lifecycle radar chart.
 * Shared between the sustainability briefing and material sheet half.
 */
export function drawLifecycleRadarChart(
  doc: jsPDF,
  options: RadarChartOptions,
  scores: Record<LifecycleKey, number>
): void {
  const { x, y, width, height } = options;

  const stages: LifecycleStageScore[] = LIFECYCLE_ORDER.map((key) => ({
    key,
    label: LIFECYCLE_STAGE_LABELS[key],
    chartLabel: LIFECYCLE_STAGE_CHART_LABELS[key],
    score: Math.max(1, Math.min(5, scores[key] ?? 1)),
  }));

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radius = Math.min(width, height) * 0.34;
  const stageCount = stages.length;

  const pointFor = (stageIndex: number, valueOutOfFive: number) => {
    const angle = -Math.PI / 2 + (stageIndex * Math.PI * 2) / stageCount;
    const distance = radius * (valueOutOfFive / 5);
    return {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      angle,
    };
  };

  // Draw grid rings
  doc.setLineWidth(0.5);
  doc.setDrawColor(229, 231, 235);
  for (let level = 1; level <= 5; level += 1) {
    const ring = stages.map((_, index) => pointFor(index, level));
    drawPolygon(doc, ring, 'S');
  }

  // Draw spokes
  stages.forEach((_, index) => {
    const end = pointFor(index, 5);
    doc.line(centerX, centerY, end.x, end.y);
  });

  // Draw level numbers
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  for (let level = 1; level <= 5; level += 1) {
    const levelPoint = pointFor(0, level);
    doc.text(String(level), centerX + 4, levelPoint.y + 2);
  }

  // Draw radar shape
  const radarPoints = stages.map((stage, index) => pointFor(index, stage.score));
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1.2);
  drawPolygon(doc, radarPoints, 'S');
  doc.setLineWidth(0.5);

  // Draw data points
  doc.setFillColor(5, 150, 105);
  radarPoints.forEach((point) => {
    doc.circle(point.x, point.y, 1.8, 'F');
  });

  // Draw stage labels
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  stages.forEach((stage, index) => {
    const labelPoint = pointFor(index, 6.15);
    const cosVal = Math.cos(labelPoint.angle);
    const align: 'left' | 'center' | 'right' =
      cosVal > 0.35 ? 'left' : cosVal < -0.35 ? 'right' : 'center';
    const topOffset = index === 0 ? -5 : 0;
    stage.chartLabel.forEach((line, lineIndex) => {
      doc.text(line, labelPoint.x, labelPoint.y + topOffset + lineIndex * 7, { align });
    });
  });
}

/**
 * Creates stage scores from a lifecycle record.
 */
export function createStageScores(
  lifecycle: Record<LifecycleKey, number>
): LifecycleStageScore[] {
  return LIFECYCLE_ORDER.map((key) => ({
    key,
    label: LIFECYCLE_STAGE_LABELS[key],
    chartLabel: LIFECYCLE_STAGE_CHART_LABELS[key],
    score: Math.max(1, Math.min(5, lifecycle[key] ?? 1)),
  }));
}
