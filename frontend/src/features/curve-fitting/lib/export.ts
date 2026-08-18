import {
  EXPORT_BANDS,
  EXPORT_SIGNIFICANT_DIGITS,
  LCINT_POINT_COUNT,
  MIN_EXPORT_POINT_COUNT,
} from "../constants/curve-fitting";
import { evaluateModel } from "./models";
import type {
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

/** Allocates N-1 intervals densely near yielding and returns N unique strain values. */
export function createExportStrains(maximum: number, pointCount: number): number[] {
  if (!(maximum > 0)) throw new Error("出力最大塑性ひずみは0より大きい値が必要です。");
  if (!Number.isInteger(pointCount) || pointCount < MIN_EXPORT_POINT_COUNT) {
    throw new Error(`出力点数は${MIN_EXPORT_POINT_COUNT}以上の整数が必要です。`);
  }
  const active = EXPORT_BANDS.map((band) => ({
    start: band.start,
    end: Math.min(band.end, maximum),
    share: band.share,
  })).filter((band) => band.end > band.start);
  const allocations = largestRemainder(pointCount - 1, active.map((band) => band.share));
  const strains = [0];
  active.forEach((band, bandIndex) => {
    const intervalCount = allocations[bandIndex];
    for (let index = 1; index <= intervalCount; index += 1) {
      strains.push(band.start + ((band.end - band.start) * index) / intervalCount);
    }
  });
  return strains;
}

export function formatSignificant(value: number): string {
  if (Object.is(value, -0) || value === 0) return "0.00000";
  return value.toPrecision(EXPORT_SIGNIFICANT_DIGITS);
}

function interpolate(points: CurvePoint[], strain: number): number {
  if (strain <= points[0].strain) return points[0].stress;
  if (strain >= points[points.length - 1].strain) return points[points.length - 1].stress;
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
  const maximum = points[points.length - 1].strain;
  return Array.from({ length: LCINT_POINT_COUNT }, (_, index) => {
    const strain = (maximum * index) / (LCINT_POINT_COUNT - 1);
    return { strain, stress: interpolate(points, strain) };
  });
}

function compareCurves(source: CurvePoint[], lcint: CurvePoint[]): [number, number] {
  const maximum = source[source.length - 1].strain;
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

/** Generates six-significant-digit CSV, DEFINE_CURVE, and the LCINT=1001 preview. */
export function generateExport(
  model: HardeningModel,
  yieldStress: number,
  parameters: ModelParameters,
  settings: ExportSettings,
): ExportResult {
  const rounded = createExportStrains(settings.maximumPlasticStrain, settings.pointCount).map(
    (strain) => ({
      strain: Number(formatSignificant(strain)),
      stress: Number(formatSignificant(evaluateModel(model, strain, yieldStress, parameters))),
    }),
  );
  const points = rounded.filter(
    (point, index) => index === 0 || point.strain !== rounded[index - 1].strain,
  );
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
