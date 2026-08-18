import { evaluateModel } from "./models";
import type { CurvePoint, FitMetrics, HardeningModel, ModelParameters } from "../types/curve-fitting";

export function calculateMetrics(
  points: CurvePoint[],
  model: HardeningModel,
  yieldStress: number,
  parameters: ModelParameters,
): FitMetrics {
  if (points.length === 0) {
    return { rmse: 0, normalizedRmse: 0, rSquared: 0, maxAbsoluteError: 0 };
  }
  const mean = points.reduce((sum, point) => sum + point.stress, 0) / points.length;
  let squaredError = 0;
  let totalVariation = 0;
  let maxAbsoluteError = 0;
  for (const point of points) {
    const residual = point.stress - evaluateModel(model, point.strain, yieldStress, parameters);
    squaredError += residual * residual;
    totalVariation += (point.stress - mean) ** 2;
    maxAbsoluteError = Math.max(maxAbsoluteError, Math.abs(residual));
  }
  const rmse = Math.sqrt(squaredError / points.length);
  const stressRange = Math.max(...points.map((point) => point.stress)) - Math.min(...points.map((point) => point.stress));
  return {
    rmse,
    normalizedRmse: stressRange > 0 ? rmse / stressRange : 0,
    rSquared: totalVariation > 0 ? 1 - squaredError / totalVariation : squaredError === 0 ? 1 : 0,
    maxAbsoluteError,
  };
}
