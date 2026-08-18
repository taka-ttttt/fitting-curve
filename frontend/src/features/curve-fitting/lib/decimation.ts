import type { CurvePoint } from "../types/curve-fitting";

/** Largest-Triangle-Three-Buckets decimation for display only. */
export function decimateLttb(points: CurvePoint[], threshold: number): CurvePoint[] {
  if (threshold >= points.length || threshold <= 2) return points;
  const result: CurvePoint[] = [points[0]];
  const bucketSize = (points.length - 2) / (threshold - 2);
  let anchorIndex = 0;

  for (let bucket = 0; bucket < threshold - 2; bucket += 1) {
    const averageStart = Math.floor((bucket + 1) * bucketSize) + 1;
    const averageEnd = Math.min(Math.floor((bucket + 2) * bucketSize) + 1, points.length);
    const averageSlice = points.slice(averageStart, averageEnd);
    const average = averageSlice.length
      ? averageSlice.reduce(
          (sum, point) => ({ strain: sum.strain + point.strain, stress: sum.stress + point.stress }),
          { strain: 0, stress: 0 },
        )
      : points[points.length - 1];
    const averageX = averageSlice.length ? average.strain / averageSlice.length : average.strain;
    const averageY = averageSlice.length ? average.stress / averageSlice.length : average.stress;
    const rangeStart = Math.floor(bucket * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((bucket + 1) * bucketSize) + 1, points.length - 1);
    const anchor = points[anchorIndex];
    let maxArea = -1;
    let selectedIndex = rangeStart;
    for (let index = rangeStart; index < rangeEnd; index += 1) {
      const candidate = points[index];
      const area = Math.abs(
        (anchor.strain - averageX) * (candidate.stress - anchor.stress) -
          (anchor.strain - candidate.strain) * (averageY - anchor.stress),
      );
      if (area > maxArea) {
        maxArea = area;
        selectedIndex = index;
      }
    }
    result.push(points[selectedIndex]);
    anchorIndex = selectedIndex;
  }
  result.push(points[points.length - 1]);
  return result;
}
