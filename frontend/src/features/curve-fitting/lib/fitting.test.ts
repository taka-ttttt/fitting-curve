import { describe, expect, it } from "vitest";

import { fitHardeningModel, yieldTransitionWeight } from "./fitting";
import { evaluateModel, evaluateModelTangent } from "./models";
import type { HardeningModel, ModelParameters } from "../types/curve-fitting";

const initialStress = 300;
const connectionStrain = 0.05;

function synthetic(model: HardeningModel, parameters: ModelParameters) {
  return Array.from({ length: 101 }, (_, index) => {
    const strain = (connectionStrain * index) / 100;
    return { strain, stress: evaluateModel(model, strain, initialStress, parameters) };
  });
}

function matchingYoungsModulus(model: HardeningModel, parameters: ModelParameters): number {
  const stress = evaluateModel(model, connectionStrain, initialStress, parameters);
  const tangent = evaluateModelTangent(model, connectionStrain, initialStress, parameters);
  return (tangent * stress) / (tangent - stress);
}

describe("hardening-law fitting", () => {
  it.each([
    ["ludwik", { K: 1_000, n: 0.4 }],
    ["swift", { epsilon0: 0.01, n: 0.3 }],
    ["voce", { Q: 400, b: 20 }],
  ] as const)("recovers connection-constrained %s parameters from synthetic data", (model, parameters) => {
    const result = fitHardeningModel(
      synthetic(model, parameters),
      model,
      initialStress,
      [0, connectionStrain],
      connectionStrain,
      matchingYoungsModulus(model, parameters),
    );

    expect(result.metrics.rmse).toBeLessThan(0.05);
    expect(evaluateModel(model, connectionStrain, initialStress, result.parameters)).toBeCloseTo(
      result.connection.stress,
      8,
    );
    for (const [key, value] of Object.entries(parameters)) {
      expect(result.parameters[key as keyof ModelParameters]).toBeCloseTo(value, 2);
    }
  });

  it("changes the transition contribution continuously instead of dropping a point", () => {
    expect(yieldTransitionWeight(0, 0.01)).toBeCloseTo(0.1, 12);
    expect(yieldTransitionWeight(0.005, 0.01)).toBeCloseTo(0.55, 12);
    expect(yieldTransitionWeight(0.01, 0.01)).toBe(1);
    expect(yieldTransitionWeight(0.02, 0.01)).toBe(1);
    expect(yieldTransitionWeight(0.005, 0)).toBe(1);
  });

  it("reports start sensitivity from extrapolated stress rather than parameter changes", () => {
    const parameters = { epsilon0: 0.01, n: 0.3 };
    const result = fitHardeningModel(
      synthetic("swift", parameters),
      "swift",
      initialStress,
      [0.01, connectionStrain],
      connectionStrain,
      matchingYoungsModulus("swift", parameters),
    );

    expect(result.sensitivity).not.toBeNull();
    expect(result.sensitivity!.evaluatedTransitionEnds.length).toBeGreaterThan(1);
    expect(result.sensitivity!.relativeSpread).toBeLessThan(0.02);
    expect(result.sensitivity!.rating).toBe("stable");
  });

  it("omits the Considère target when the connection is moved away from UTS", () => {
    const parameters = { Q: 400, b: 20 };
    const points = synthetic("voce", parameters);
    const result = fitHardeningModel(
      points,
      "voce",
      initialStress,
      [0, connectionStrain],
      connectionStrain,
      210_000,
      false,
    );

    expect(result.usesConsidereTarget).toBe(false);
    expect(result.diagnostics.targetTangent).toBeNaN();
    expect(result.parameters.b).toBeCloseTo(parameters.b, 3);
  });
});
