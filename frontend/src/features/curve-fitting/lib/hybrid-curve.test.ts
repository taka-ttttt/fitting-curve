import { describe, expect, it } from "vitest";

import {
  calculateConnectionDiagnostics,
  createConnection,
  evaluateConnectedModel,
  evaluateHybridCurve,
} from "./hybrid-curve";

const measured = [
  { strain: 0, stress: 300 },
  { strain: 0.05, stress: 400 },
  { strain: 0.1, stress: 450 },
];
const parameters = { Q: 200, b: 5 };

describe("hybrid measured/model curve", () => {
  it("preserves measured interpolation and uses the unshifted constrained model after connection", () => {
    const connection = createConnection(measured, 0.075);
    const constrainedParameters = { Q: 125 / (1 - Math.exp(-5 * 0.075)), b: 5 };

    expect(connection.stress).toBe(425);
    expect(evaluateHybridCurve(measured, "voce", 0.025, 300, constrainedParameters, connection)).toBe(350);
    expect(evaluateConnectedModel("voce", 0.075, 300, constrainedParameters, connection)).toBeCloseTo(425, 12);
    expect(evaluateHybridCurve(measured, "voce", 0.075, 300, constrainedParameters, connection)).toBe(425);
    expect(evaluateHybridCurve(measured, "voce", 0.08, 300, constrainedParameters, connection)).toBeGreaterThan(425);
  });

  it("blocks export when the measured tangent immediately before the connection is negative", () => {
    const decreasing = [
      { strain: 0, stress: 300 },
      { strain: 0.05, stress: 400 },
      { strain: 0.1, stress: 390 },
    ];
    const connection = createConnection(decreasing, 0.1);
    const diagnostics = calculateConnectionDiagnostics(
      decreasing,
      "voce",
      300,
      parameters,
      connection,
      210_000,
    );

    expect(diagnostics.leftTangent).toBeLessThan(0);
    expect(diagnostics.rightTangent).toBeGreaterThan(0);
    expect(diagnostics.hasSignReversal).toBe(true);
    expect(diagnostics.exportBlocked).toBe(true);
  });
});
