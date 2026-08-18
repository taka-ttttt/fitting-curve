import { describe, expect, it } from "vitest";

import { LCINT_POINT_COUNT } from "../constants/curve-fitting";
import { createExportStrains, formatSignificant, generateExport } from "./export";

describe("curve export", () => {
  it("allocates intervals densely around yielding", () => {
    const strains = createExportStrains(0.5, 101);
    expect(strains).toHaveLength(101);
    expect(strains[0]).toBe(0);
    expect(strains[50]).toBeCloseTo(0.05, 12);
    expect(strains[85]).toBeCloseTo(0.2, 12);
    expect(strains.at(-1)).toBeCloseTo(0.5, 12);
  });

  it("formats six significant digits", () => {
    expect(formatSignificant(123.456789)).toBe("123.457");
    expect(formatSignificant(0.00123456789)).toBe("0.00123457");
  });

  it("generates BOM-ready CRLF CSV, DEFINE_CURVE, and 1001 LCINT samples", () => {
    const result = generateExport(
      "voce",
      300,
      { Q: 400, b: 10 },
      { maximumPlasticStrain: 0.5, pointCount: 100, lcid: 7 },
    );
    expect(result.csv).toContain("\r\n");
    expect(result.csv.startsWith("plastic_strain,true_stress")).toBe(true);
    expect(result.lsdyna).toContain("*DEFINE_CURVE");
    expect(result.lsdyna).toContain(String(7).padStart(10));
    expect(result.lsdyna).toContain(String(1_001).padStart(10));
    expect(result.lcintPoints).toHaveLength(LCINT_POINT_COUNT);
    expect(result.lsdyna).not.toContain("*END");
  });
});
