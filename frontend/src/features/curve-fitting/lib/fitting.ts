import { levenbergMarquardt, type JacobianFunction, type ParameterizedFunction } from "ml-levenberg-marquardt";

import { calculateMetrics } from "./metrics";
import type { CurvePoint, FitResult, HardeningModel, ModelParameters } from "../types/curve-fitting";

interface ModelDefinition {
  fn: ParameterizedFunction;
  jacobian: JacobianFunction;
  starts: number[][];
  min: number[];
  max: number[];
  toParameters: (values: number[]) => ModelParameters;
}

function intervalUncertainties(points: CurvePoint[]): number[] {
  if (points.length < 2) return points.map(() => 1);
  const widths = points.map((point, index) => {
    if (index === 0) return Math.max(points[1].strain - point.strain, Number.EPSILON) / 2;
    if (index === points.length - 1) {
      return Math.max(point.strain - points[index - 1].strain, Number.EPSILON) / 2;
    }
    return Math.max(points[index + 1].strain - points[index - 1].strain, Number.EPSILON) / 2;
  });
  const mean = widths.reduce((sum, value) => sum + value, 0) / widths.length;
  return widths.map((width) => 1 / Math.sqrt(width / mean));
}

function createDefinition(model: HardeningModel, yieldStress: number): ModelDefinition {
  switch (model) {
    case "ludwik":
      return {
        fn: ([K, n]) => (x) => yieldStress + K * Math.max(0, x) ** n,
        jacobian: ([K, n]) => (x) => {
          const strain = Math.max(0, x);
          const power = strain ** n;
          return [power, strain === 0 ? 0 : K * power * Math.log(strain)];
        },
        starts: [
          [yieldStress, 0.2],
          [yieldStress * 2, 0.35],
          [yieldStress * 0.5, 0.1],
        ],
        min: [0, 0.001],
        max: [yieldStress * 100, 2],
        toParameters: ([K, n]) => ({ K, n }),
      };
    case "swift":
      return {
        fn: ([epsilon0, n]) => (x) =>
          yieldStress * (1 + Math.max(0, x) / epsilon0) ** n,
        jacobian: ([epsilon0, n]) => (x) => {
          const strain = Math.max(0, x);
          const ratio = 1 + strain / epsilon0;
          const value = yieldStress * ratio ** n;
          return [
            -value * n * strain / (epsilon0 * (epsilon0 + strain)),
            value * Math.log(ratio),
          ];
        },
        starts: [
          [0.01, 0.2],
          [0.002, 0.12],
          [0.05, 0.4],
        ],
        min: [1e-7, 0.001],
        max: [2, 2],
        toParameters: ([epsilon0, n]) => ({ epsilon0, n }),
      };
    case "voce":
      return {
        fn: ([Q, b]) => (x) =>
          yieldStress + Q * (1 - Math.exp(-b * Math.max(0, x))),
        jacobian: ([Q, b]) => (x) => {
          const strain = Math.max(0, x);
          const exponential = Math.exp(-b * strain);
          return [1 - exponential, Q * strain * exponential];
        },
        starts: [
          [yieldStress, 10],
          [yieldStress * 2, 4],
          [yieldStress * 0.5, 30],
        ],
        min: [0, 0.001],
        max: [yieldStress * 100, 10_000],
        toParameters: ([Q, b]) => ({ Q, b }),
      };
  }
}

/** Fits one hardening law with bounds, equal-strain weighting, and multiple starts. */
export function fitHardeningModel(
  allPoints: CurvePoint[],
  model: HardeningModel,
  yieldStress: number,
  range: [number, number],
): FitResult {
  const points = allPoints.filter(
    (point) => point.strain >= range[0] && point.strain <= range[1] && point.strain >= 0,
  );
  if (points.length < 3) throw new Error("フィッティング範囲内に3点以上必要です。");
  const definition = createDefinition(model, yieldStress);
  const data = { x: points.map((point) => point.strain), y: points.map((point) => point.stress) };
  const weights = intervalUncertainties(points);
  let best: ReturnType<typeof levenbergMarquardt> | null = null;
  const failures: string[] = [];

  for (const initialValues of definition.starts) {
    try {
      const result = levenbergMarquardt(data, definition.fn, {
        initialValues,
        minValues: definition.min,
        maxValues: definition.max,
        weights,
        jacobianFunction: definition.jacobian,
        damping: 0.01,
        maxIterations: 250,
        errorTolerance: 1e-8,
        timeout: 2,
      });
      if (!best || result.parameterError < best.parameterError) best = result;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (!best) throw new Error(`フィッティングに収束しませんでした。${failures[0] ?? ""}`);
  const parameters = definition.toParameters(best.parameterValues);
  return {
    model,
    parameters,
    metrics: calculateMetrics(points, model, yieldStress, parameters),
    iterations: best.iterations,
    range,
  };
}
