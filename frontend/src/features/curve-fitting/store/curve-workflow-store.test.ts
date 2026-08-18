import { beforeEach, describe, expect, it } from "vitest";

import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import type { ExportResult, FitResult, PreparedData } from "@/features/curve-fitting/types/curve-fitting";

const prepared: PreparedData = {
  uploaded: [{ strain: 0, stress: 300 }],
  plastic: [{ strain: 0, stress: 300 }],
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
      prepared: null,
      fit: null,
      automaticParameters: null,
      exportResult: null,
      error: null,
    });
  });

  it("invalidates all downstream results when input mapping changes", () => {
    useCurveWorkflowStore.setState({
      prepared,
      fit,
      automaticParameters: fit.parameters,
      exportResult,
    });

    useCurveWorkflowStore.getState().updateMapping({ stressUnit: "GPa" });

    const state = useCurveWorkflowStore.getState();
    expect(state.prepared).toBeNull();
    expect(state.fit).toBeNull();
    expect(state.automaticParameters).toBeNull();
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
    useCurveWorkflowStore.getState().updateMapping({ dataKind: "true-plastic" });
    useCurveWorkflowStore.getState().convert();

    const state = useCurveWorkflowStore.getState();
    expect(state.fileName).toBe("curve.csv");
    expect(state.prepared?.plastic).toHaveLength(3);
    expect(state.fit).toBeNull();
  });
});
