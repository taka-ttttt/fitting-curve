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
    throw new Error("接続点は実測塑性ひずみ範囲内にしてください。");
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
  return (
    connection.stress +
    evaluateModel(model, plasticStrain, initialStress, parameters) -
    evaluateModel(model, connection.strain, initialStress, parameters)
  );
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

function measuredLeftTangent(points: CurvePoint[], connectionStrain: number): number {
  const leftPoints = points.filter((point) => point.strain < connectionStrain - CURVE_POINT_TOLERANCE);
  const left = leftPoints.at(-1);
  if (!left) return Number.NaN;
  const connectionStress = interpolateStress(points, connectionStrain);
  return (connectionStress - left.stress) / (connectionStrain - left.strain);
}

export function calculateConnectionDiagnostics(
  measuredPoints: CurvePoint[],
  model: HardeningModel,
  initialStress: number,
  parameters: ModelParameters,
  connection: CurveConnection,
): ConnectionDiagnostics {
  const leftTangent = measuredLeftTangent(measuredPoints, connection.strain);
  const rightTangent = evaluateModelTangent(
    model,
    connection.strain,
    initialStress,
    parameters,
  );
  const hasSignReversal = Number.isFinite(leftTangent) && Number.isFinite(rightTangent)
    ? leftTangent * rightTangent < 0
    : false;
  return {
    leftTangent,
    rightTangent,
    hasSignReversal,
    exportBlocked:
      !Number.isFinite(leftTangent) ||
      !Number.isFinite(rightTangent) ||
      leftTangent < 0 ||
      rightTangent < 0 ||
      hasSignReversal,
  };
}
