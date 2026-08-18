import { beforeEach, describe, expect, it } from "vitest";

import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import type { ExportResult, FitResult, PreparedData } from "@/features/curve-fitting/types/curve-fitting";

const prepared: PreparedData = {
  dataKind: "true-plastic",
  uploaded: [
    { strain: 0, stress: 300 },
    { strain: 0.1, stress: 400 },
  ],
  engineering: null,
  trueTotal: null,
  directPlastic: [
    { strain: 0, stress: 300 },
    { strain: 0.1, stress: 400 },
  ],
  plastic: [
    { strain: 0, stress: 300 },
    { strain: 0.1, stress: 400 },
  ],
  proportionalLimit: {
    trueStrain: null,
    rawPlasticStrain: 0,
    stress: 300,
    method: "direct-input",
  },
  proofStress: null,
  tensileStrength: {
    uploaded: { strain: 0.1, stress: 400 },
    engineering: null,
    trueTotal: null,
    plastic: { strain: 0.1, stress: 400 },
  },
  warnings: [],
};
const fit: FitResult = {
  model: "voce",
  parameters: { Q: 100, b: 10 },
  metrics: { rmse: 0, normalizedRmse: 0, rSquared: 1, maxAbsoluteError: 0 },
  iterations: 1,
  range: [0.01, 0.1],
  connection: { strain: 0.1, stress: 400 },
  diagnostics: {
    leftTangent: 1_000,
    rightTangent: 367.879,
    hasSignReversal: false,
    exportBlocked: false,
  },
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
      proportionalLimitConfirmed: false,
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
      error: null,
      material: { youngsModulus: 210_000 },
      selectedModels: ["swift"],
      fitRange: [0, 0.2],
      recommendedFitEnd: 0.2,
      busy: false,
    });
  });

  it("invalidates all downstream results when input mapping changes", () => {
    useCurveWorkflowStore.setState({
      prepared,
      proportionalLimitConfirmed: true,
      fits: { voce: fit },
      automaticParameters: { voce: fit.parameters },
      exportModel: "voce",
      exportResult,
    });

    useCurveWorkflowStore.getState().updateMapping({ stressUnit: "GPa" });

    const state = useCurveWorkflowStore.getState();
    expect(state.prepared).toBeNull();
    expect(state.proportionalLimitConfirmed).toBe(false);
    expect(state.fits).toEqual({});
    expect(state.exportResult).toBeNull();
  });

  it("accepts direct true-plastic input and confirms its first point automatically", () => {
    useCurveWorkflowStore.getState().setTable("curve.csv", {
      columns: ["strain", "stress"],
      rows: [
        { strain: "0", stress: "300" },
        { strain: "0.01", stress: "350" },
        { strain: "0.02", stress: "400" },
      ],
      warnings: [],
    });
    useCurveWorkflowStore.getState().updateMapping({ dataKind: "true-plastic" });
    useCurveWorkflowStore.getState().convert();

    const state = useCurveWorkflowStore.getState();
    expect(state.prepared?.plastic).toHaveLength(3);
    expect(state.prepared?.proportionalLimit.method).toBe("direct-input");
    expect(state.proportionalLimitConfirmed).toBe(true);
  });

  it("invalidates total-strain conversion when Young's modulus changes", () => {
    useCurveWorkflowStore.setState({
      prepared: { ...prepared, dataKind: "engineering" },
      proportionalLimitConfirmed: true,
      fits: { voce: fit },
      automaticParameters: { voce: fit.parameters },
      exportModel: "voce",
      exportResult,
      mapping: { ...useCurveWorkflowStore.getState().mapping, dataKind: "engineering" },
    });

    useCurveWorkflowStore.getState().updateMaterial({ youngsModulus: 100_000 });

    const state = useCurveWorkflowStore.getState();
    expect(state.prepared).toBeNull();
    expect(state.fits).toEqual({});
    expect(state.exportResult).toBeNull();
  });

  it("keeps direct plastic conversion when unused Young's modulus changes", () => {
    useCurveWorkflowStore.setState({
      prepared,
      proportionalLimitConfirmed: true,
      mapping: { ...useCurveWorkflowStore.getState().mapping, dataKind: "true-plastic" },
    });

    useCurveWorkflowStore.getState().updateMaterial({ youngsModulus: 100_000 });

    expect(useCurveWorkflowStore.getState().prepared).toBe(prepared);
  });

  it("restores the recommended connection and invalidates fitting results", () => {
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
