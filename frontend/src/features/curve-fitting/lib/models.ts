import type { HardeningModel, ModelParameters } from "../types/curve-fitting";

export function evaluateModel(
  model: HardeningModel,
  plasticStrain: number,
  yieldStress: number,
  parameters: ModelParameters,
): number {
  const strain = Math.max(0, plasticStrain);
  switch (model) {
    case "ludwik":
      return yieldStress + (parameters.K ?? 0) * strain ** (parameters.n ?? 1);
    case "swift": {
      const epsilon0 = Math.max(parameters.epsilon0 ?? 1e-6, 1e-12);
      return yieldStress * (1 + strain / epsilon0) ** (parameters.n ?? 1);
    }
    case "voce":
      return yieldStress + (parameters.Q ?? 0) * (1 - Math.exp(-(parameters.b ?? 1) * strain));
  }
}

export function deriveSwiftK(yieldStress: number, parameters: ModelParameters): number {
  return yieldStress / Math.max(parameters.epsilon0 ?? 1e-6, 1e-12) ** (parameters.n ?? 1);
}
