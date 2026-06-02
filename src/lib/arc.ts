/**
 * Compute SVG path string for a left-side quadratic bezier arc
 * connecting two task pills at the given Y positions.
 */
export function computeArc(
  startY: number,
  endY: number,
  listLeftX: number
): string {
  const midY = (startY + endY) / 2;
  const distance = Math.abs(endY - startY);
  const curveDepth = Math.min(40 + distance * 0.15, 80);
  const cpX = listLeftX - curveDepth;

  return `M ${listLeftX} ${startY} Q ${cpX} ${midY} ${listLeftX} ${endY}`;
}

/**
 * Compute stroke-dasharray length for a quadratic bezier arc.
 * Uses approximation: sample N points along the curve.
 */
export function approximateArcLength(
  startY: number,
  endY: number,
  listLeftX: number,
  samples = 50
): number {
  const midY = (startY + endY) / 2;
  const distance = Math.abs(endY - startY);
  const curveDepth = Math.min(40 + distance * 0.15, 80);
  const cpX = listLeftX - curveDepth;

  let length = 0;
  let prevX = listLeftX;
  let prevY = startY;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    // Quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    const x = mt * mt * listLeftX + 2 * mt * t * cpX + t * t * listLeftX;
    const y = mt * mt * startY + 2 * mt * t * midY + t * t * endY;
    const dx = x - prevX;
    const dy = y - prevY;
    length += Math.sqrt(dx * dx + dy * dy);
    prevX = x;
    prevY = y;
  }

  return length;
}
