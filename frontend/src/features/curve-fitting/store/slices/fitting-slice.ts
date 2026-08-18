import { calculateMetrics } from "@/features/curve-fitting/lib/metrics";
import type { CurveWorkflowSlice, FittingSlice } from "@/features/curve-fitting/store/types";
import { runFitWorker } from "@/features/curve-fitting/workers/fit-worker-client";

export const createFittingSlice: CurveWorkflowSlice<FittingSlice> = (set, get) => ({
  model: "swift",
  fitRange: [0, 0.2],
  fit: null,
  automaticParameters: null,
  busy: false,
  setModel: (model) => set({ model, fit: null, automaticParameters: null, exportResult: null }),
  setFitRange: (fitRange) => set({ fitRange, fit: null, automaticParameters: null, exportResult: null }),
  runFit: async () => {
    const { prepared, model, material, fitRange } = get();
    if (!prepared) return;
    set({ busy: true, error: null });
    try {
      const fit = await runFitWorker({
        points: prepared.plastic,
        model,
        yieldStress: material.yieldStress,
        range: fitRange,
      });
      set({ fit, automaticParameters: { ...fit.parameters }, exportResult: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      set({ busy: false });
    }
  },
  updateParameter: (name, value) =>
    set((state) => {
      if (!state.fit || !state.prepared) return state;
      const parameters = { ...state.fit.parameters, [name]: value };
      const points = state.prepared.plastic.filter(
        (point) => point.strain >= state.fitRange[0] && point.strain <= state.fitRange[1],
      );
      return {
        fit: {
          ...state.fit,
          parameters,
          metrics: calculateMetrics(points, state.model, state.material.yieldStress, parameters),
        },
        exportResult: null,
      };
    }),
  resetParameters: () => {
    const state = get();
    if (!state.fit || !state.automaticParameters || !state.prepared) return;
    const points = state.prepared.plastic.filter(
      (point) => point.strain >= state.fitRange[0] && point.strain <= state.fitRange[1],
    );
    const parameters = { ...state.automaticParameters };
    set({
      fit: {
        ...state.fit,
        parameters,
        metrics: calculateMetrics(points, state.model, state.material.yieldStress, parameters),
      },
      exportResult: null,
    });
  },
});
