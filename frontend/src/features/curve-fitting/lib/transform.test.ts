import { describe, expect, it } from "vitest";

import { parseCsvText } from "./csv";
import { prepareData } from "./transform";

describe("CSV parsing and stress-strain conversion", () => {
  it("parses a BOM header and maps engineering values to true plastic strain", () => {
    const table = parseCsvText("\uFEFFstrain,stress\r\n0.01,200\r\n0.02,300\r\n0.03,350\r\n");
    const result = prepareData(
      table,
      {
        strainColumn: "strain",
        stressColumn: "stress",
        dataKind: "engineering",
        strainUnit: "decimal",
        stressUnit: "MPa",
      },
      { youngsModulus: 200_000, yieldStress: 180 },
    );

    expect(result.uploaded).toHaveLength(3);
    expect(result.plastic[0].stress).toBeCloseTo(202, 10);
    expect(result.plastic[0].strain).toBeCloseTo(Math.log1p(0.01) - 202 / 200_000, 10);
  });

  it("normalizes percent strain and GPa stress", () => {
    const table = parseCsvText("eps,sig\n1,0.4\n2,0.5\n3,0.6\n");
    const result = prepareData(
      table,
      {
        strainColumn: "eps",
        stressColumn: "sig",
        dataKind: "true-plastic",
        strainUnit: "percent",
        stressUnit: "GPa",
      },
      { youngsModulus: 0, yieldStress: 300 },
    );
    expect(result.plastic[0]).toEqual({ strain: 0.01, stress: 400 });
  });
});
