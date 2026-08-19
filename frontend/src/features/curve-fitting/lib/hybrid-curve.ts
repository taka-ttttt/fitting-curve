import { CURVE_POINT_TOLERANCE } from "../constants/curve-fitting";
import { evaluateModel, evaluateModelTangent } from "./models";
import type {
  ConnectionDiagnostics,
  CurveConnection,
  CurvePoint,
  HardeningModel,
  ModelParameters,
} from "../types/curve-fitting";

export function interpolateStress(points: CurvePoint[], strain: number): number {
  if (points.length === 0) throw new Error("補間する実測点がありません。");
  if (strain < points[0].strain - CURVE_POINT_TOLERANCE || strain > points.at(-1)!.strain + CURVE_POINT_TOLERANCE) {
    throw new Error("フィッティング終点は実測塑性ひずみ範囲内にしてください。");
  }
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

export function createConnection(points: CurvePoint[], strain: number): CurveConnection {
  return { strain, stress: interpolateStress(points, strain) };
}

export function evaluateConnectedModel(
  model: HardeningModel,
  plasticStrain: number,
  initialStress: number,
  parameters: ModelParameters,
  connection: CurveConnection,
): number {
  void connection;
  return evaluateModel(model, plasticStrain, initialStress, parameters);
}

export function evaluateHybridCurve(
  measuredPoints: CurvePoint[],
  model: HardeningModel,
  plasticStrain: number,
  initialStress: number,
  parameters: ModelParameters,
  connection: CurveConnection,
): number {
  return plasticStrain <= connection.strain
    ? interpolateStress(measuredPoints, plasticStrain)
    : evaluateConnectedModel(model, plasticStrain, initialStress, parameters, connection);
}

function medianPositiveSpacing(points: CurvePoint[]): number {
  const spacings = points
    .slice(1)
    .map((point, index) => point.strain - points[index].strain)
    .filter((spacing) => spacing > CURVE_POINT_TOLERANCE)
    .sort((left, right) => left - right);
  return spacings.length === 0 ? 0 : spacings[Math.floor(spacings.length / 2)];
}

/** Estimates the measured tangent using a local least-squares line instead of one noisy interval. */
export function measuredLeftTangent(points: CurvePoint[], connectionStrain: number): number {
  const leftPoints = points.filter(
    (point) => point.strain <= connectionStrain + CURVE_POINT_TOLERANCE,
  );
  if (leftPoints.length < 2) return Number.NaN;
  const spacing = medianPositiveSpacing(leftPoints);
  const windowWidth = Math.max(
    connectionStrain * 0.05,
    Math.min(spacing * 8, connectionStrain * 0.2),
  );
  let window = leftPoints.filter(
    (point) => point.strain >= connectionStrain - windowWidth,
  );
  if (window.length < 2) window = leftPoints.slice(-2);
  const meanStrain = window.reduce((sum, point) => sum + point.strain, 0) / window.length;
  const meanStress = window.reduce((sum, point) => sum + point.stress, 0) / window.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of window) {
    numerator += (point.strain - meanStrain) * (point.stress - meanStress);
    denominator += (point.strain - meanStrain) ** 2;
  }
  return denominator > 0 ? numerator / denominator : Number.NaN;
}

export function calculateConsidereTangent(connectionStress: number, youngsModulus: number): number {
  return youngsModulus > connectionStress && connectionStress > 0
    ? (connectionStress * youngsModulus) / (youngsModulus - connectionStress)
    : Number.NaN;
}

export function calculateConnectionDiagnostics(
  measuredPoints: CurvePoint[],
  model: HardeningModel,
  initialStress: number,
  parameters: ModelParameters,
  connection: CurveConnection,
  youngsModulus: number,
  usesConsidereTarget = true,
): ConnectionDiagnostics {
  const leftTangent = measuredLeftTangent(measuredPoints, connection.strain);
  const rightTangent = evaluateModelTangent(
    model,
    connection.strain,
    initialStress,
    parameters,
  );
  const targetTangent = usesConsidereTarget
    ? calculateConsidereTangent(connection.stress, youngsModulus)
    : Number.NaN;
  const tangentRelativeError = Number.isFinite(targetTangent) && targetTangent !== 0
    ? Math.abs(rightTangent - targetTangent) / Math.abs(targetTangent)
    : Number.NaN;
  const hasSignReversal = Number.isFinite(leftTangent) && Number.isFinite(rightTangent)
    ? leftTangent * rightTangent < 0
    : false;
  return {
    leftTangent,
    rightTangent,
    targetTangent,
    tangentRelativeError,
    hasSignReversal,
    exportBlocked:
      !Number.isFinite(leftTangent) ||
      !Number.isFinite(rightTangent) ||
      leftTangent < 0 ||
      rightTangent < 0 ||
      hasSignReversal,
  };
}
