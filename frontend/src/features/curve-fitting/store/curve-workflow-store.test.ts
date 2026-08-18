import { beforeEach, describe, expect, it } from "vitest";

import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import type { ExportResult, FitResult, PreparedData } from "@/features/curve-fitting/types/curve-fitting";

const prepared: PreparedData = {
  uploaded: [{ strain: 0, stress: 300 }],
  trueTotal: [{ strain: 0, stress: 300 }],
  plastic: [{ strain: 0, stress: 300 }],
  yieldPoint: {
    sourceStrain: 0.003,
    sourceStress: 300,
    trueStrain: 0.003,
    stress: 300,
    method: "specified-yield",
  },
  tensileStrength: {
    uploaded: { strain: 0, stress: 300 },
    trueTotal: { strain: 0, stress: 300 },
    plastic: { strain: 0, stress: 300 },
  },
  warnings: [],
};
const fit: FitResult = {
  model: "voce",
  parameters: { Q: 100, b: 10 },
  metrics: { rmse: 0, normalizedRmse: 0, rSquared: 1, maxAbsoluteError: 0 },
  iterations: 1,
  range: [0, 0.1],
};
const exportResult: ExportResult = {
  points: [],
  csv: "",
  lsdyna: "",
  lcintPoints: [],
  lcintMaxAbsoluteDifference: 0,
  lcintMaxRelativeDifference: 0,
};

describe("curve workflow store", () => {
  beforeEach(() => {
    useCurveWorkflowStore.setState({
      fileName: null,
      table: null,
      inputData: null,
      prepared: null,
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
      error: null,
      material: { youngsModulus: 210_000, yieldStress: 300 },
      conversionMethod: "specified-yield",
      selectedModels: ["swift"],
      fitRange: [0, 0.2],
      recommendedFitEnd: 0.2,
      busy: false,
    });
  });

  it("invalidates all downstream results when input mapping changes", () => {
    useCurveWorkflowStore.setState({
      prepared,
      fits: { voce: fit },
      automaticParameters: { voce: fit.parameters },
      exportModel: "voce",
      exportResult,
    });

    useCurveWorkflowStore.getState().updateMapping({ stressUnit: "GPa" });

    const state = useCurveWorkflowStore.getState();
    expect(state.prepared).toBeNull();
    expect(state.fits).toEqual({});
    expect(state.automaticParameters).toEqual({});
    expect(state.exportResult).toBeNull();
  });

  it("keeps import and conversion state in their respective slices", () => {
    useCurveWorkflowStore.getState().setTable("curve.csv", {
      columns: ["strain", "stress"],
      rows: [
        { strain: "0", stress: "300" },
        { strain: "0.01", stress: "350" },
        { strain: "0.02", stress: "400" },
      ],
      warnings: [],
    });
    useCurveWorkflowStore.getState().updateMapping({ dataKind: "true" });
    useCurveWorkflowStore.getState().convert();

    const state = useCurveWorkflowStore.getState();
    expect(state.fileName).toBe("curve.csv");
    expect(state.inputData?.trueTotal).toHaveLength(3);
    expect(state.prepared?.plastic).toHaveLength(3);
    expect(state.fits).toEqual({});
  });

  it("keeps converted and fitted results when only Young's modulus changes", () => {
    useCurveWorkflowStore.setState({
      prepared,
      fits: { voce: fit },
      automaticParameters: { voce: fit.parameters },
      exportModel: "voce",
      exportResult,
    });

    useCurveWorkflowStore.getState().updateMaterial({ youngsModulus: 100_000 });

    const state = useCurveWorkflowStore.getState();
    expect(state.material.youngsModulus).toBe(100_000);
    expect(state.prepared).toBe(prepared);
    expect(state.fits.voce).toBe(fit);
    expect(state.exportResult).toBe(exportResult);

    useCurveWorkflowStore.getState().updateMaterial({ yieldStress: 320 });
    const afterYieldStressChange = useCurveWorkflowStore.getState();
    expect(afterYieldStressChange.prepared).toBeNull();
    expect(afterYieldStressChange.fits).toEqual({});
    expect(afterYieldStressChange.exportResult).toBeNull();
  });

  it("invalidates conversion when Young's modulus changes in 0.2% proof-stress mode", () => {
    useCurveWorkflowStore.setState({
      conversionMethod: "proof-0.2",
      prepared,
      fits: { voce: fit },
      automaticParameters: { voce: fit.parameters },
      exportModel: "voce",
      exportResult,
    });

    useCurveWorkflowStore.getState().updateMaterial({ youngsModulus: 100_000 });

    const state = useCurveWorkflowStore.getState();
    expect(state.prepared).toBeNull();
    expect(state.fits).toEqual({});
    expect(state.exportResult).toBeNull();
  });

  it("restores the recommended fitting end and invalidates fitting results", () => {
    useCurveWorkflowStore.setState({
      fitRange: [0.01, 0.1],
      recommendedFitEnd: 0.15,
      fits: { voce: fit },
      automaticParameters: { voce: fit.parameters },
      exportModel: "voce",
      exportResult,
    });

    useCurveWorkflowStore.getState().resetFitEnd();

    const state = useCurveWorkflowStore.getState();
    expect(state.fitRange).toEqual([0.01, 0.15]);
    expect(state.fits).toEqual({});
    expect(state.exportModel).toBeNull();
  });
});
