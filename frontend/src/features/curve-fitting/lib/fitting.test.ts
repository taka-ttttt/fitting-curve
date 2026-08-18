import { describe, expect, it } from "vitest";

import { fitHardeningModel } from "./fitting";
import { evaluateModel } from "./models";
import type { HardeningModel, ModelParameters } from "../types/curve-fitting";

const yieldStress = 300;

function synthetic(model: HardeningModel, parameters: ModelParameters) {
  return Array.from({ length: 81 }, (_, index) => {
    const strain = index / 400;
    return { strain, stress: evaluateModel(model, strain, yieldStress, parameters) };
  });
}

describe("hardening-law fitting", () => {
  it.each([
    ["ludwik", { K: 650, n: 0.24 }],
    ["swift", { epsilon0: 0.012, n: 0.22 }],
    ["voce", { Q: 420, b: 11 }],
  ] as const)("recovers %s parameters from synthetic data", (model, parameters) => {
    const result = fitHardeningModel(synthetic(model, parameters), model, yieldStress, [0, 0.2]);
    expect(result.metrics.rmse).toBeLessThan(0.05);
    for (const [key, value] of Object.entries(parameters)) {
      expect(result.parameters[key as keyof ModelParameters]).toBeCloseTo(value, 2);
    }
  });
});
