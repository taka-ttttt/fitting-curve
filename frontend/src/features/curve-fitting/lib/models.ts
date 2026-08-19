import {
  HARDENING_EXPONENT_MAX,
  HARDENING_EXPONENT_MIN,
} from "../constants/curve-fitting";
import type { CurveConnection, HardeningModel, ModelParameters } from "../types/curve-fitting";

function assertConnectionInputs(initialStress: number, connection: CurveConnection): void {
  if (!(initialStress > 0)) throw new Error("比例限度応力は0より大きい値が必要です。");
  if (!(connection.strain > 0)) throw new Error("接続点ひずみは0より大きい値が必要です。");
  if (!(connection.stress > initialStress)) {
    throw new Error("接続応力は比例限度応力より大きい値が必要です。");
  }
}

/** Derives a complete parameter set that makes the base law pass through the connection. */
export function deriveConnectionConstrainedParameters(
  model: HardeningModel,
  independentValue: number,
  initialStress: number,
  connection: CurveConnection,
): ModelParameters {
  assertConnectionInputs(initialStress, connection);
  const stressIncrease = connection.stress - initialStress;
  switch (model) {
    case "ludwik": {
      const n = independentValue;
      if (!(n >= HARDENING_EXPONENT_MIN && n <= HARDENING_EXPONENT_MAX)) {
        throw new Error("Ludwikのnは0より大きく1より小さい範囲で指定してください。");
      }
      return { K: stressIncrease / connection.strain ** n, n };
    }
    case "swift": {
      const epsilon0 = independentValue;
      if (!(epsilon0 > 0)) throw new Error("Swiftのε₀は0より大きい値が必要です。");
      const denominator = Math.log1p(connection.strain / epsilon0);
      const n = Math.log(connection.stress / initialStress) / denominator;
      if (!(n >= HARDENING_EXPONENT_MIN && n <= HARDENING_EXPONENT_MAX)) {
        throw new Error("接続応力を満たすSwiftのnが0より大きく1より小さい範囲にありません。");
      }
      return { epsilon0, n };
    }
    case "voce": {
      const b = independentValue;
      if (!(b > 0)) throw new Error("Voceのbは0より大きい値が必要です。");
      const fraction = -Math.expm1(-b * connection.strain);
      if (!(fraction > 0)) throw new Error("Voceの接続応力拘束を計算できません。");
      return { Q: stressIncrease / fraction, b };
    }
  }
}

export function getIndependentParameter(
  model: HardeningModel,
  parameters: ModelParameters,
): number {
  switch (model) {
    case "ludwik":
      return parameters.n ?? Number.NaN;
    case "swift":
      return parameters.epsilon0 ?? Number.NaN;
    case "voce":
      return parameters.b ?? Number.NaN;
  }
}

export function evaluateModel(
  model: HardeningModel,
  plasticStrain: number,
  initialStress: number,
  parameters: ModelParameters,
): number {
  const strain = Math.max(0, plasticStrain);
  switch (model) {
    case "ludwik":
      return initialStress + (parameters.K ?? 0) * strain ** (parameters.n ?? 1);
    case "swift": {
      const epsilon0 = Math.max(parameters.epsilon0 ?? 1e-6, 1e-12);
      return initialStress * (1 + strain / epsilon0) ** (parameters.n ?? 1);
    }
    case "voce":
      return initialStress + (parameters.Q ?? 0) * (1 - Math.exp(-(parameters.b ?? 1) * strain));
  }
}

export function evaluateModelTangent(
  model: HardeningModel,
  plasticStrain: number,
  initialStress: number,
  parameters: ModelParameters,
): number {
  const strain = Math.max(0, plasticStrain);
  switch (model) {
    case "ludwik": {
      const K = parameters.K ?? 0;
      const n = parameters.n ?? 1;
      return strain === 0 && n < 1 ? Number.POSITIVE_INFINITY : K * n * strain ** (n - 1);
    }
    case "swift": {
      const epsilon0 = Math.max(parameters.epsilon0 ?? 1e-6, 1e-12);
      const n = parameters.n ?? 1;
      return (initialStress * n * (1 + strain / epsilon0) ** (n - 1)) / epsilon0;
    }
    case "voce":
      return (parameters.Q ?? 0) * (parameters.b ?? 1) * Math.exp(-(parameters.b ?? 1) * strain);
  }
}

export function deriveSwiftK(initialStress: number, parameters: ModelParameters): number {
  return initialStress / Math.max(parameters.epsilon0 ?? 1e-6, 1e-12) ** (parameters.n ?? 1);
}
