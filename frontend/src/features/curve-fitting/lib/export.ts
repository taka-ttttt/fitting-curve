import {
  CURVE_POINT_TOLERANCE,
  EXPORT_BANDS,
  EXPORT_SIGNIFICANT_DIGITS,
  LCINT_POINT_COUNT,
  MIN_EXPORT_POINT_COUNT,
} from "../constants/curve-fitting";
import { evaluateHybridCurve } from "./hybrid-curve";
import type {
  CurveConnection,
  CurvePoint,
  ExportResult,
  ExportSettings,
  HardeningModel,
  ModelParameters,
} from "../types/curve-fitting";

function largestRemainder(total: number, shares: number[]): number[] {
  const normalizedTotal = shares.reduce((sum, share) => sum + share, 0);
  const raw = shares.map((share) => (total * share) / normalizedTotal);
  const result = raw.map(Math.floor);
  const remainder = total - result.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) result[order[index].index] += 1;
  return result;
}

function uniqueSorted(values: number[]): number[] {
  return values
    .sort((left, right) => left - right)
    .filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]) > CURVE_POINT_TOLERANCE);
}

function satisfyMinimums(allocations: number[], minimums: number[]): number[] {
  const result = [...allocations];
  for (let index = 0; index < result.length; index += 1) {
    while (result[index] < minimums[index]) {
      const donor = result
        .map((value, donorIndex) => ({ donorIndex, surplus: value - minimums[donorIndex] }))
        .filter((item) => item.surplus > 0)
        .sort((left, right) => right.surplus - left.surplus || left.donorIndex - right.donorIndex)[0];
      if (!donor) throw new Error("必須点を含めるための出力点数が不足しています。");
      result[donor.donorIndex] -= 1;
      result[index] += 1;
    }
  }
  return result;
}

/** Allocates N-1 intervals densely near yielding while preserving mandatory strains. */
export function createExportStrains(
  maximum: number,
  pointCount: number,
  mandatoryStrains: number[] = [],
): number[] {
  if (!(maximum > 0)) throw new Error("出力最大塑性ひずみは0より大きい値が必要です。");
  if (!Number.isInteger(pointCount) || pointCount < MIN_EXPORT_POINT_COUNT) {
    throw new Error(`出力点数は${MIN_EXPORT_POINT_COUNT}以上の整数が必要です。`);
  }
  const active = EXPORT_BANDS.map((band) => ({
    start: band.start,
    end: Math.min(band.end, maximum),
    share: band.share,
  })).filter((band) => band.end > band.start);
  const mandatory = uniqueSorted([
    0,
    maximum,
    ...mandatoryStrains.filter((strain) => strain > 0 && strain < maximum),
  ]);
  const bandBoundaries = active.map((band) =>
    uniqueSorted([
      band.start,
      band.end,
      ...mandatory.filter((strain) => strain > band.start && strain < band.end),
    ]),
  );
  const minimums = bandBoundaries.map((boundaries) => boundaries.length - 1);
  const allocations = satisfyMinimums(
    largestRemainder(pointCount - 1, active.map((band) => band.share)),
    minimums,
  );
  const strains = [0];
  active.forEach((band, bandIndex) => {
    const boundaries = bandBoundaries[bandIndex];
    const segmentLengths = boundaries.slice(1).map((end, index) => end - boundaries[index]);
    const remainingIntervals = allocations[bandIndex] - segmentLengths.length;
    const extras = largestRemainder(remainingIntervals, segmentLengths);
    segmentLengths.forEach((_, segmentIndex) => {
      const start = boundaries[segmentIndex];
      const end = boundaries[segmentIndex + 1];
      const intervalCount = 1 + extras[segmentIndex];
      for (let index = 1; index <= intervalCount; index += 1) {
        strains.push(start + ((end - start) * index) / intervalCount);
      }
    });
  });
  if (strains.length !== pointCount) throw new Error("出力点数の配分に失敗しました。");
  return strains;
}

export function formatSignificant(value: number): string {
  if (Object.is(value, -0) || value === 0) return "0.00000";
  return value.toPrecision(EXPORT_SIGNIFICANT_DIGITS);
}

function interpolate(points: CurvePoint[], strain: number): number {
  if (strain <= points[0].strain) return points[0].stress;
  if (strain >= points.at(-1)!.strain) return points.at(-1)!.stress;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].strain <= strain) low = middle;
    else high = middle;
  }
  const left = points[low];
  const right = points[high];
  const ratio = (strain - left.strain) / (right.strain - left.strain);
  return left.stress + ratio * (right.stress - left.stress);
}

function toFixedWidth(value: number, width: number): string {
  const formatted = formatSignificant(value);
  if (formatted.length > width) throw new Error(`LS-DYNA固定幅${width}桁に収まらない値です: ${formatted}`);
  return formatted.padStart(width);
}

function createLsdyna(points: CurvePoint[], lcid: number): string {
  const header = [lcid, 0, 1, 1, 0, 0, 0, 1_001].map((value) => String(value).padStart(10)).join("");
  const rows = points.map(
    (point) => `${toFixedWidth(point.strain, 20)}${toFixedWidth(point.stress, 20)}`,
  );
  return ["*DEFINE_CURVE", "$#    lcid      sidr       sfa       sfo      offa      offo    dattyp     lcint", header, "$#                a1                  o1", ...rows].join("\n");
}

function simulateLcint(points: CurvePoint[]): CurvePoint[] {
  const maximum = points.at(-1)!.strain;
  return Array.from({ length: LCINT_POINT_COUNT }, (_, index) => {
    const strain = (maximum * index) / (LCINT_POINT_COUNT - 1);
    return { strain, stress: interpolate(points, strain) };
  });
}

function compareCurves(source: CurvePoint[], lcint: CurvePoint[]): [number, number] {
  const maximum = source.at(-1)!.strain;
  let maxAbsolute = 0;
  let maxRelative = 0;
  for (let index = 0; index <= 2_000; index += 1) {
    const strain = (maximum * index) / 2_000;
    const sourceStress = interpolate(source, strain);
    const lcintStress = interpolate(lcint, strain);
    const absolute = Math.abs(sourceStress - lcintStress);
    maxAbsolute = Math.max(maxAbsolute, absolute);
    maxRelative = Math.max(maxRelative, sourceStress === 0 ? 0 : absolute / Math.abs(sourceStress));
  }
  return [maxAbsolute, maxRelative];
}

/** Generates CSV, DEFINE_CURVE, and LCINT preview from the hybrid curve. */
export function generateExport(
  model: HardeningModel,
  initialStress: number,
  parameters: ModelParameters,
  measuredPoints: CurvePoint[],
  connection: CurveConnection,
  settings: ExportSettings,
): ExportResult {
  const rounded = createExportStrains(
    settings.maximumPlasticStrain,
    settings.pointCount,
    [connection.strain],
  ).map((strain) => ({
    strain: Number(formatSignificant(strain)),
    stress: Number(
      formatSignificant(
        evaluateHybridCurve(measuredPoints, model, strain, initialStress, parameters, connection),
      ),
    ),
  }));
  const points = rounded.filter(
    (point, index) => index === 0 || point.strain !== rounded[index - 1].strain,
  );
  if (points.length !== settings.pointCount) {
    throw new Error("有効数字6桁への丸め後にひずみが重複しました。出力点数を減らしてください。");
  }
  const csv = [
    "plastic_strain,true_stress",
    ...points.map((point) => `${formatSignificant(point.strain)},${formatSignificant(point.stress)}`),
  ].join("\r\n");
  const lcintPoints = simulateLcint(points);
  const [lcintMaxAbsoluteDifference, lcintMaxRelativeDifference] = compareCurves(points, lcintPoints);
  return {
    points,
    csv,
    lsdyna: createLsdyna(points, settings.lcid),
    lcintPoints,
    lcintMaxAbsoluteDifference,
    lcintMaxRelativeDifference,
  };
}
