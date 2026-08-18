import type { HardeningModel, ModelParameters } from "../types/curve-fitting";

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
