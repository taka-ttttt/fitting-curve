import { calculateMetrics } from "@/features/curve-fitting/lib/metrics";
import { calculateConnectionDiagnostics } from "@/features/curve-fitting/lib/hybrid-curve";
import {
  deriveConnectionConstrainedParameters,
  getIndependentParameter,
} from "@/features/curve-fitting/lib/models";
import {
  CURVE_POINT_TOLERANCE,
  HARDENING_MODELS,
} from "@/features/curve-fitting/constants/curve-fitting";
import type { CurveWorkflowSlice, FittingSlice } from "@/features/curve-fitting/store/types";
import type {
  FitResults,
  ModelParameters,
  ModelParameterSets,
} from "@/features/curve-fitting/types/curve-fitting";
import { runFitWorker } from "@/features/curve-fitting/workers/fit-worker-client";

export const createFittingSlice: CurveWorkflowSlice<FittingSlice> = (set, get) => ({
  selectedModels: ["swift"],
  fitRange: [0, 0.2],
  recommendedFitEnd: 0.2,
  connectionStrain: 0.2,
  recommendedConnectionStrain: 0.2,
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
  setConnectionStrain: (connectionStrain) =>
    set({
      connectionStrain,
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
    }),
  resetFitEnd: () =>
    set((state) => ({
      fitRange: [state.fitRange[0], state.recommendedFitEnd],
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
    })),
  resetConnection: () =>
    set((state) => ({
      connectionStrain: state.recommendedConnectionStrain,
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
    })),
  runFits: async () => {
    const {
      prepared,
      proportionalLimitConfirmed,
      selectedModels,
      fitRange,
      connectionStrain,
      material,
    } = get();
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
      set({ error: "降伏遷移終了点は0以上、フィッティング終点はそれより大きい値にしてください。" });
      return;
    }
    if (fitRange[1] > connectionStrain) {
      set({ error: "フィッティング終点は接続点以前にしてください。" });
      return;
    }
    if (connectionStrain > prepared.plastic.at(-1)!.strain) {
      set({ error: "接続点は実測塑性ひずみ範囲内にしてください。" });
      return;
    }
    set({ busy: true, error: null });
    try {
      const usesConsidereTarget = Math.abs(
        connectionStrain - prepared.tensileStrength.plastic.strain,
      ) <= CURVE_POINT_TOLERANCE;
      const results = await Promise.all(
        selectedModels.map((model) =>
          runFitWorker({
            points: prepared.plastic,
            model,
            initialStress: prepared.proportionalLimit.stress,
            range: fitRange,
            connectionStrain,
            youngsModulus: material.youngsModulus,
            usesConsidereTarget,
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
      if (
        current.prepared !== prepared ||
        selectionChanged ||
        rangeChanged ||
        current.connectionStrain !== connectionStrain ||
        current.material.youngsModulus !== material.youngsModulus
      ) return;
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
      const independentName = model === "ludwik" ? "n" : model === "swift" ? "epsilon0" : "b";
      if (name !== independentName) return state;
      let parameters: ModelParameters;
      try {
        parameters = deriveConnectionConstrainedParameters(
          model,
          value,
          state.prepared.proportionalLimit.stress,
          fit.connection,
        );
      } catch {
        return state;
      }
      const points = state.prepared.plastic.filter(
        (point) => point.strain >= 0 && point.strain <= state.fitRange[1],
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
              state.material.youngsModulus,
              fit.usesConsidereTarget,
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
      (point) => point.strain >= 0 && point.strain <= state.fitRange[1],
    );
    const independentValue = getIndependentParameter(model, automaticParameters);
    const parameters = deriveConnectionConstrainedParameters(
      model,
      independentValue,
      state.prepared.proportionalLimit.stress,
      fit.connection,
    );
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
            state.material.youngsModulus,
            fit.usesConsidereTarget,
          ),
        },
      },
      exportResult: null,
    });
  },
});
