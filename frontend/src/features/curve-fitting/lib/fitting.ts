import {
  FIT_SENSITIVITY_OFFSET_FRACTION,
  FIT_SENSITIVITY_OFFSET_MULTIPLIERS,
  FIT_SENSITIVITY_STABLE_LIMIT,
  FIT_SENSITIVITY_WARNING_LIMIT,
  HARDENING_EXPONENT_MAX,
  HARDENING_EXPONENT_MIN,
  UTS_TANGENT_PENALTY_WEIGHT,
  YIELD_TRANSITION_MINIMUM_WEIGHT,
} from "../constants/curve-fitting";
import {
  calculateConnectionDiagnostics,
  calculateConsidereTangent,
  createConnection,
} from "./hybrid-curve";
import { calculateMetrics } from "./metrics";
import {
  deriveConnectionConstrainedParameters,
  evaluateModel,
  evaluateModelTangent,
} from "./models";
import type {
  CurveConnection,
  CurvePoint,
  FitResult,
  FitSensitivity,
  HardeningModel,
  ModelParameters,
} from "../types/curve-fitting";

interface FitContext {
  points: CurvePoint[];
  model: HardeningModel;
  initialStress: number;
  transitionEnd: number;
  connection: CurveConnection;
  youngsModulus: number;
  usesConsidereTarget: boolean;
}

interface OptimizedFit {
  parameters: ModelParameters;
  iterations: number;
}

function intervalWidths(points: CurvePoint[]): number[] {
  if (points.length < 2) return points.map(() => 1);
  return points.map((point, index) => {
    if (index === 0) return Math.max(points[1].strain - point.strain, Number.EPSILON) / 2;
    if (index === points.length - 1) {
      return Math.max(point.strain - points[index - 1].strain, Number.EPSILON) / 2;
    }
    return Math.max(
      (points[index + 1].strain - points[index - 1].strain) / 2,
      Number.EPSILON,
    );
  });
}

/** Smoothly raises the contribution of the yield-transition region from a small value to one. */
export function yieldTransitionWeight(strain: number, transitionEnd: number): number {
  if (!(transitionEnd > 0) || strain >= transitionEnd) return 1;
  const ratio = Math.max(0, Math.min(1, strain / transitionEnd));
  const smooth = (1 - Math.cos(Math.PI * ratio)) / 2;
  return YIELD_TRANSITION_MINIMUM_WEIGHT + (1 - YIELD_TRANSITION_MINIMUM_WEIGHT) * smooth;
}

function parameterAtUnitInterval(
  model: HardeningModel,
  unitValue: number,
  initialStress: number,
  connection: CurveConnection,
): number {
  const unit = Math.max(0, Math.min(1, unitValue));
  switch (model) {
    case "ludwik":
      return HARDENING_EXPONENT_MIN + unit * (HARDENING_EXPONENT_MAX - HARDENING_EXPONENT_MIN);
    case "swift": {
      const logStressRatio = Math.log(connection.stress / initialStress);
      const epsilonAtExponent = (exponent: number) => {
        const denominator = Math.expm1(logStressRatio / exponent);
        return denominator > 0 ? connection.strain / denominator : Number.EPSILON;
      };
      const minimum = Math.max(Number.EPSILON, epsilonAtExponent(HARDENING_EXPONENT_MIN));
      const maximum = Math.max(minimum, epsilonAtExponent(HARDENING_EXPONENT_MAX));
      return Math.exp(Math.log(minimum) + unit * (Math.log(maximum) - Math.log(minimum)));
    }
    case "voce": {
      const minimum = Math.max(0.001, 0.001 / connection.strain);
      const maximum = Math.min(10_000, 20 / connection.strain);
      return Math.exp(Math.log(minimum) + unit * (Math.log(maximum) - Math.log(minimum)));
    }
  }
}

function fittingObjective(context: FitContext, independentValue: number): number {
  let parameters: ModelParameters;
  try {
    parameters = deriveConnectionConstrainedParameters(
      context.model,
      independentValue,
      context.initialStress,
      context.connection,
    );
  } catch {
    return Number.POSITIVE_INFINITY;
  }
  const widths = intervalWidths(context.points);
  const stressScale = Math.max(context.connection.stress - context.initialStress, 1);
  let weightedSquaredError = 0;
  let weightSum = 0;
  for (let index = 0; index < context.points.length; index += 1) {
    const point = context.points[index];
    const weight = widths[index] * yieldTransitionWeight(point.strain, context.transitionEnd);
    const residual =
      (evaluateModel(context.model, point.strain, context.initialStress, parameters) - point.stress) /
      stressScale;
    weightedSquaredError += weight * residual * residual;
    weightSum += weight;
  }
  const targetTangent = context.usesConsidereTarget
    ? calculateConsidereTangent(context.connection.stress, context.youngsModulus)
    : Number.NaN;
  const modelTangent = evaluateModelTangent(
    context.model,
    context.connection.strain,
    context.initialStress,
    parameters,
  );
  const tangentPenalty = Number.isFinite(targetTangent) && targetTangent > 0
    ? ((modelTangent - targetTangent) / targetTangent) ** 2
    : 0;
  return weightedSquaredError / Math.max(weightSum, Number.EPSILON) +
    UTS_TANGENT_PENALTY_WEIGHT * tangentPenalty;
}

function optimizeParameters(context: FitContext): OptimizedFit {
  const coarseCount = 241;
  let bestIndex = -1;
  let bestError = Number.POSITIVE_INFINITY;
  for (let index = 0; index < coarseCount; index += 1) {
    const error = fittingObjective(
      context,
      parameterAtUnitInterval(
        context.model,
        index / (coarseCount - 1),
        context.initialStress,
        context.connection,
      ),
    );
    if (error < bestError) {
      bestError = error;
      bestIndex = index;
    }
  }
  if (bestIndex < 0 || !Number.isFinite(bestError)) {
    throw new Error(`${context.model}で接続応力拘束を満たす有効な解がありません。`);
  }

  let left = Math.max(0, (bestIndex - 1) / (coarseCount - 1));
  let right = Math.min(1, (bestIndex + 1) / (coarseCount - 1));
  const ratio = (Math.sqrt(5) - 1) / 2;
  let leftProbe = right - ratio * (right - left);
  let rightProbe = left + ratio * (right - left);
  let leftError = fittingObjective(
    context,
    parameterAtUnitInterval(context.model, leftProbe, context.initialStress, context.connection),
  );
  let rightError = fittingObjective(
    context,
    parameterAtUnitInterval(context.model, rightProbe, context.initialStress, context.connection),
  );
  const refinementIterations = 64;
  for (let iteration = 0; iteration < refinementIterations; iteration += 1) {
    if (leftError <= rightError) {
      right = rightProbe;
      rightProbe = leftProbe;
      rightError = leftError;
      leftProbe = right - ratio * (right - left);
      leftError = fittingObjective(
        context,
        parameterAtUnitInterval(context.model, leftProbe, context.initialStress, context.connection),
      );
    } else {
      left = leftProbe;
      leftProbe = rightProbe;
      leftError = rightError;
      rightProbe = left + ratio * (right - left);
      rightError = fittingObjective(
        context,
        parameterAtUnitInterval(context.model, rightProbe, context.initialStress, context.connection),
      );
    }
  }
  const unitValue = (left + right) / 2;
  const independentValue = parameterAtUnitInterval(
    context.model,
    unitValue,
    context.initialStress,
    context.connection,
  );
  return {
    parameters: deriveConnectionConstrainedParameters(
      context.model,
      independentValue,
      context.initialStress,
      context.connection,
    ),
    iterations: coarseCount + refinementIterations,
  };
}

function medianPositiveSpacing(points: CurvePoint[]): number {
  const spacings = points
    .slice(1)
    .map((point, index) => point.strain - points[index].strain)
    .filter((spacing) => spacing > 0)
    .sort((left, right) => left - right);
  return spacings.length === 0 ? 0 : spacings[Math.floor(spacings.length / 2)];
}

function sensitivityRating(relativeSpread: number): FitSensitivity["rating"] {
  if (relativeSpread <= FIT_SENSITIVITY_STABLE_LIMIT) return "stable";
  if (relativeSpread <= FIT_SENSITIVITY_WARNING_LIMIT) return "warning";
  return "unstable";
}

function calculateSensitivity(
  baseContext: FitContext,
  fitEnd: number,
  nominalParameters: ModelParameters,
): FitSensitivity {
  const spacing = medianPositiveSpacing(baseContext.points);
  const offset = Math.max(spacing * 2, baseContext.connection.strain * FIT_SENSITIVITY_OFFSET_FRACTION);
  const maximumTransitionEnd = Math.max(0, fitEnd - Math.max(spacing, Number.EPSILON));
  const transitionEnds = FIT_SENSITIVITY_OFFSET_MULTIPLIERS.map((multiplier) =>
    Math.max(0, Math.min(maximumTransitionEnd, baseContext.transitionEnd + multiplier * offset)),
  ).filter((value, index, values) =>
    values.findIndex((candidate) => Math.abs(candidate - value) <= Number.EPSILON * 10) === index,
  );
  const evaluationStrain =
    baseContext.connection.strain + Math.max(baseContext.connection.strain, 0.1);
  const stresses: number[] = [];
  const evaluatedTransitionEnds: number[] = [];
  for (const transitionEnd of transitionEnds) {
    try {
      const result = optimizeParameters({ ...baseContext, transitionEnd });
      stresses.push(
        evaluateModel(
          baseContext.model,
          evaluationStrain,
          baseContext.initialStress,
          result.parameters,
        ),
      );
      evaluatedTransitionEnds.push(transitionEnd);
    } catch {
      // Invalid candidates are omitted; the nominal fit remains available.
    }
  }
  const nominalStress = evaluateModel(
    baseContext.model,
    evaluationStrain,
    baseContext.initialStress,
    nominalParameters,
  );
  if (stresses.length === 0) {
    stresses.push(nominalStress);
    evaluatedTransitionEnds.push(baseContext.transitionEnd);
  }
  const minimumStress = Math.min(...stresses);
  const maximumStress = Math.max(...stresses);
  const relativeSpread = (maximumStress - minimumStress) / Math.max(Math.abs(nominalStress), 1);
  return {
    evaluationStrain,
    minimumStress,
    maximumStress,
    relativeSpread,
    rating: sensitivityRating(relativeSpread),
    evaluatedTransitionEnds,
  };
}

/** Fits a connection-constrained hardening law with gradual yield-transition weighting. */
export function fitHardeningModel(
  allPoints: CurvePoint[],
  model: HardeningModel,
  initialStress: number,
  range: [number, number],
  connectionStrain = range[1],
  youngsModulus = 210_000,
  usesConsidereTarget = true,
): FitResult {
  const points = allPoints.filter(
    (point) => point.strain >= 0 && point.strain <= range[1],
  );
  if (points.length < 3) throw new Error("フィッティング終点までに3点以上必要です。");
  if (range[0] < 0 || range[0] >= range[1]) {
    throw new Error("降伏遷移終了点は0以上でフィッティング終点より小さくしてください。");
  }
  if (range[1] > connectionStrain) {
    throw new Error("フィッティング終点は接続点以前にしてください。");
  }
  const connection = createConnection(allPoints, connectionStrain);
  const context: FitContext = {
    points,
    model,
    initialStress,
    transitionEnd: range[0],
    connection,
    youngsModulus,
    usesConsidereTarget,
  };
  const optimized = optimizeParameters(context);
  return {
    model,
    parameters: optimized.parameters,
    metrics: calculateMetrics(points, model, initialStress, optimized.parameters, connection),
    iterations: optimized.iterations,
    range,
    connection,
    usesConsidereTarget,
    diagnostics: calculateConnectionDiagnostics(
      allPoints,
      model,
      initialStress,
      optimized.parameters,
      connection,
      youngsModulus,
      usesConsidereTarget,
    ),
    sensitivity: calculateSensitivity(context, range[1], optimized.parameters),
  };
}
