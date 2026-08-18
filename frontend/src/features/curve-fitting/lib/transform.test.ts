import { describe, expect, it } from "vitest";

import { parseCsvText } from "./csv";
import { prepareData, prepareInputData } from "./transform";

const engineeringMapping = {
  strainColumn: "strain",
  stressColumn: "stress",
  dataKind: "engineering" as const,
  strainUnit: "decimal" as const,
  stressUnit: "MPa" as const,
};

describe("CSV parsing and stress-strain conversion", () => {
  it("maps engineering values to true total values", () => {
    const table = parseCsvText("\uFEFFstrain,stress\r\n0,0\r\n0.01,200\r\n0.02,300\r\n");
    const result = prepareInputData(table, engineeringMapping);

    expect(result.uploaded).toHaveLength(3);
    expect(result.trueTotal?.[1].stress).toBeCloseTo(202, 10);
    expect(result.trueTotal?.[1].strain).toBeCloseTo(Math.log1p(0.01), 10);
  });

  it("detects the proportional limit from sustained plastic-strain residuals", () => {
    const table = parseCsvText(
      "strain,stress\n0,0\n0.001,100\n0.002,190\n0.003,200\n0.004,210\n0.005,220\n",
    );
    const result = prepareData(
      table,
      { ...engineeringMapping, dataKind: "true-total" },
      { youngsModulus: 100_000 },
    );

    expect(result.proportionalLimit.method).toBe("automatic");
    expect(result.proportionalLimit.trueStrain).toBeCloseTo(0.002, 12);
    expect(result.proportionalLimit.stress).toBeCloseTo(190, 12);
    expect(result.plastic[0]).toEqual({ strain: 0, stress: 190 });
    expect(result.plastic.find((point) => point.stress === 200)?.strain).toBeCloseTo(0.0009, 12);
  });

  it("ignores a temporary threshold exceedance shorter than three points", () => {
    const table = parseCsvText(
      "strain,stress\n0,0\n0.001,100\n0.002,190\n0.003,300\n0.004,390\n0.005,490\n0.006,590\n",
    );
    const result = prepareData(
      table,
      { ...engineeringMapping, dataKind: "true-total" },
      { youngsModulus: 100_000 },
    );

    expect(result.proportionalLimit.trueStrain).toBeCloseTo(0.004, 12);
    expect(result.proportionalLimit.stress).toBeCloseTo(390, 12);
  });

  it("keeps 0.2% proof stress as a reference instead of the plastic origin", () => {
    const table = parseCsvText("strain,stress\n0,0\n0.001,100\n0.003,250\n0.005,300\n0.006,320\n");
    const result = prepareData(table, engineeringMapping, { youngsModulus: 100_000 });

    expect(result.proofStress?.engineering).toEqual({ strain: 0.005, stress: 300 });
    expect(result.proportionalLimit.stress).toBeLessThan(result.proofStress!.trueTotal.stress);
    expect(result.plastic[0].stress).toBe(result.proportionalLimit.stress);
    expect(result.proofStress!.relativePlasticStrain).toBeGreaterThan(0);
  });

  it("rebuilds relative plastic strain from a manually selected proportional limit", () => {
    const table = parseCsvText(
      "strain,stress\n0,0\n0.001,100\n0.002,190\n0.003,200\n0.004,210\n0.005,220\n",
    );
    const result = prepareData(
      table,
      { ...engineeringMapping, dataKind: "true-total" },
      { youngsModulus: 100_000 },
      0.0015,
    );

    expect(result.proportionalLimit.method).toBe("manual");
    expect(result.proportionalLimit.trueStrain).toBe(0.0015);
    expect(result.plastic).toContainEqual({ strain: 0, stress: 145 });
  });

  it("accepts direct true-plastic input only when the first strain is zero", () => {
    const table = parseCsvText("strain,stress\n0,300\n0.01,350\n0.02,380\n");
    const result = prepareData(
      table,
      { ...engineeringMapping, dataKind: "true-plastic" },
      { youngsModulus: 0 },
    );

    expect(result.proportionalLimit.method).toBe("direct-input");
    expect(result.proofStress).toBeNull();
    expect(result.plastic).toEqual([
      { strain: 0, stress: 300 },
      { strain: 0.01, stress: 350 },
      { strain: 0.02, stress: 380 },
    ]);
  });
});
