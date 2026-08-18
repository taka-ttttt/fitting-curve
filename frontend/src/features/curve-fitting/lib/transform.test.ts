import { describe, expect, it } from "vitest";

import { parseCsvText } from "./csv";
import { prepareData, prepareInputData } from "./transform";

describe("CSV parsing and stress-strain conversion", () => {
  it("parses a BOM header and maps engineering values to true plastic strain", () => {
    const table = parseCsvText("\uFEFFstrain,stress\r\n0,0\r\n0.01,200\r\n0.02,300\r\n0.03,350\r\n");
    const result = prepareData(
      table,
      {
        strainColumn: "strain",
        stressColumn: "stress",
        dataKind: "engineering",
        strainUnit: "decimal",
        stressUnit: "MPa",
      },
      { youngsModulus: 200_000, yieldStress: 250 },
      "specified-yield",
    );

    expect(result.uploaded).toHaveLength(4);
    expect(result.trueTotal[1].stress).toBeCloseTo(202, 10);
    expect(result.trueTotal[1].strain).toBeCloseTo(Math.log1p(0.01), 10);
    expect(result.plastic).toContainEqual({ strain: 0, stress: 250 });
    const yieldTotalStrain =
      result.trueTotal[1].strain +
      ((250 - result.trueTotal[1].stress) /
        (result.trueTotal[2].stress - result.trueTotal[1].stress)) *
        (result.trueTotal[2].strain - result.trueTotal[1].strain);
    const transformedPoint = result.plastic.find((point) => point.stress === result.trueTotal[2].stress);
    expect(transformedPoint?.strain).toBeCloseTo(result.trueTotal[2].strain - yieldTotalStrain, 10);
    expect(result.plastic.every((point) => point.strain >= 0)).toBe(true);
    expect(result.plastic.some((point) => point.stress === result.trueTotal[1].stress)).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("負"))).toBe(false);

    const resultWithDifferentYoungsModulus = prepareData(
      table,
      {
        strainColumn: "strain",
        stressColumn: "stress",
        dataKind: "engineering",
        strainUnit: "decimal",
        stressUnit: "MPa",
      },
      { youngsModulus: 1, yieldStress: 250 },
      "specified-yield",
    );
    expect(resultWithDifferentYoungsModulus.plastic).toEqual(result.plastic);
    expect(resultWithDifferentYoungsModulus.tensileStrength.plastic).toEqual(
      result.tensileStrength.plastic,
    );
  });

  it("normalizes true strain percentages and GPa stress", () => {
    const table = parseCsvText("eps,sig\n0,0.1\n1,0.4\n2,0.5\n3,0.6\n");
    const result = prepareData(
      table,
      {
        strainColumn: "eps",
        stressColumn: "sig",
        dataKind: "true",
        strainUnit: "percent",
        stressUnit: "GPa",
      },
      { youngsModulus: 0, yieldStress: 300 },
      "specified-yield",
    );
    expect(result.trueTotal[1]).toEqual({ strain: 0.01, stress: 400 });
    expect(result.plastic).toContainEqual({ strain: 0, stress: 300 });
  });

  it("calculates 0.2% proof stress from Young's modulus and the offset-line intersection", () => {
    const table = parseCsvText("strain,stress\n0,0\n0.001,100\n0.003,250\n0.005,300\n0.006,320\n");
    const result = prepareData(
      table,
      {
        strainColumn: "strain",
        stressColumn: "stress",
        dataKind: "engineering",
        strainUnit: "decimal",
        stressUnit: "MPa",
      },
      { youngsModulus: 100_000, yieldStress: 999 },
      "proof-0.2",
    );

    expect(result.yieldPoint).toEqual({
      sourceStrain: 0.005,
      sourceStress: 300,
      trueStrain: Math.log1p(0.005),
      stress: 301.49999999999994,
      method: "proof-0.2",
    });
    expect(result.plastic[0]).toEqual({ strain: 0, stress: 301.49999999999994 });
    expect(result.plastic[1].strain).toBeCloseTo(Math.log1p(0.006) - Math.log1p(0.005), 12);
    expect(result.plastic[1].stress).toBeCloseTo(321.92, 12);
  });

  it("prepares the engineering-to-true comparison without material properties", () => {
    const table = parseCsvText("strain,stress\n0,0\n0.1,100\n0.2,90\n");
    const result = prepareInputData(table, {
      strainColumn: "strain",
      stressColumn: "stress",
      dataKind: "engineering",
      strainUnit: "decimal",
      stressUnit: "MPa",
    });

    expect(result.trueTotal[1]).toEqual({ strain: Math.log1p(0.1), stress: 110.00000000000001 });
    expect(result.tensileStrength.uploaded).toEqual({ strain: 0.1, stress: 100 });
    expect(result.tensileStrength.trueTotal).toEqual(result.trueTotal[1]);
  });
});
