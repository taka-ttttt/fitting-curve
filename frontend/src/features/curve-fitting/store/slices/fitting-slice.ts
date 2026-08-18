import { calculateMetrics } from "@/features/curve-fitting/lib/metrics";
import { calculateConnectionDiagnostics } from "@/features/curve-fitting/lib/hybrid-curve";
import { HARDENING_MODELS } from "@/features/curve-fitting/constants/curve-fitting";
import type { CurveWorkflowSlice, FittingSlice } from "@/features/curve-fitting/store/types";
import type { FitResults, ModelParameterSets } from "@/features/curve-fitting/types/curve-fitting";
import { runFitWorker } from "@/features/curve-fitting/workers/fit-worker-client";

export const createFittingSlice: CurveWorkflowSlice<FittingSlice> = (set, get) => ({
  selectedModels: ["swift"],
  fitRange: [0, 0.2],
  recommendedFitEnd: 0.2,
  fits: {},
  automaticParameters: {},
  busy: false,
  toggleModel: (model) =>
    set((state) => ({
      selectedModels: HARDENING_MODELS.filter((item) =>
        item === model ? !state.selectedModels.includes(model) : state.selectedModels.includes(item),
      ),
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
    })),
  setFitRange: (fitRange) =>
    set({ fits: {}, automaticParameters: {}, exportModel: null, exportResult: null, fitRange }),
  resetFitEnd: () =>
    set((state) => ({
      fitRange: [state.fitRange[0], state.recommendedFitEnd],
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
    })),
  runFits: async () => {
    const { prepared, proportionalLimitConfirmed, selectedModels, fitRange, recommendedFitEnd } = get();
    if (!prepared) return;
    if (!proportionalLimitConfirmed) {
      set({ error: "比例限度候補を確認してからフィッティングしてください。" });
      return;
    }
    if (selectedModels.length === 0) {
      set({ error: "フィッティングする硬化則を1つ以上選択してください。" });
      return;
    }
    if (fitRange[0] < 0 || fitRange[1] <= fitRange[0]) {
      set({ error: "終了塑性ひずみは開始塑性ひずみより大きい0以上の範囲で指定してください。" });
      return;
    }
    if (fitRange[1] > recommendedFitEnd) {
      set({ error: "接続点は引張強度点以前にしてください。" });
      return;
    }
    set({ busy: true, error: null });
    try {
      const results = await Promise.all(
        selectedModels.map((model) =>
          runFitWorker({
            points: prepared.plastic,
            model,
            initialStress: prepared.proportionalLimit.stress,
            range: fitRange,
          }),
        ),
      );
      const fits: FitResults = {};
      const automaticParameters: ModelParameterSets = {};
      results.forEach((fit) => {
        fits[fit.model] = fit;
        automaticParameters[fit.model] = { ...fit.parameters };
      });
      const current = get();
      const selectionChanged =
        current.selectedModels.length !== selectedModels.length ||
        current.selectedModels.some((model, index) => model !== selectedModels[index]);
      const rangeChanged =
        current.fitRange[0] !== fitRange[0] || current.fitRange[1] !== fitRange[1];
      if (current.prepared !== prepared || selectionChanged || rangeChanged) return;
      set({
        fits,
        automaticParameters,
        exportModel: selectedModels[0] ?? null,
        exportResult: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      set({ busy: false });
    }
  },
  updateParameter: (model, name, value) =>
    set((state) => {
      const fit = state.fits[model];
      if (!fit || !state.prepared) return state;
      const parameters = { ...fit.parameters, [name]: value };
      const points = state.prepared.plastic.filter(
        (point) => point.strain >= state.fitRange[0] && point.strain <= state.fitRange[1],
      );
      return {
        fits: {
          ...state.fits,
          [model]: {
            ...fit,
            parameters,
            metrics: calculateMetrics(
              points,
              model,
              state.prepared.proportionalLimit.stress,
              parameters,
              fit.connection,
            ),
            diagnostics: calculateConnectionDiagnostics(
              state.prepared.plastic,
              model,
              state.prepared.proportionalLimit.stress,
              parameters,
              fit.connection,
            ),
          },
        },
        exportResult: null,
      };
    }),
  resetParameters: (model) => {
    const state = get();
    const fit = state.fits[model];
    const automaticParameters = state.automaticParameters[model];
    if (!fit || !automaticParameters || !state.prepared) return;
    const points = state.prepared.plastic.filter(
      (point) => point.strain >= state.fitRange[0] && point.strain <= state.fitRange[1],
    );
    const parameters = { ...automaticParameters };
    set({
      fits: {
        ...state.fits,
        [model]: {
          ...fit,
          parameters,
          metrics: calculateMetrics(
            points,
            model,
            state.prepared.proportionalLimit.stress,
            parameters,
            fit.connection,
          ),
          diagnostics: calculateConnectionDiagnostics(
            state.prepared.plastic,
            model,
            state.prepared.proportionalLimit.stress,
            parameters,
            fit.connection,
          ),
        },
      },
      exportResult: null,
    });
  },
});
