"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { CURVE_COLORS, HARDENING_MODEL_LABELS } from "@/features/curve-fitting/constants/curve-fitting";
import { evaluateConnectedModel } from "@/features/curve-fitting/lib/hybrid-curve";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";

/** Collects fitting workflow state and prepares the display-only fitted curve. */
export function useFittingStep() {
  const state = useCurveWorkflowStore(
    useShallow((store) => ({
      prepared: store.prepared,
      proportionalLimitConfirmed: store.proportionalLimitConfirmed,
      selectedModels: store.selectedModels,
      fitRange: store.fitRange,
      recommendedFitEnd: store.recommendedFitEnd,
      connectionStrain: store.connectionStrain,
      recommendedConnectionStrain: store.recommendedConnectionStrain,
      fits: store.fits,
      busy: store.busy,
      toggleModel: store.toggleModel,
      setFitRange: store.setFitRange,
      setConnectionStrain: store.setConnectionStrain,
      resetFitEnd: store.resetFitEnd,
      resetConnection: store.resetConnection,
      runFits: store.runFits,
      updateParameter: store.updateParameter,
      resetParameters: store.resetParameters,
    })),
  );
  const fittedSeries = useMemo<CurveSeries[]>(() => {
    if (!state.prepared) return [];
    const series: CurveSeries[] = [
      {
        name: "実測 真応力–真塑性ひずみ",
        points: state.prepared.plastic,
        color: CURVE_COLORS.plastic,
        pointsOnly: true,
      },
      {
        name: "引張強度点",
        points: [state.prepared.tensileStrength.plastic],
        color: CURVE_COLORS.plastic,
        pointsOnly: true,
        symbol: "rect",
        symbolSize: 11,
      },
    ];
    state.selectedModels.forEach((model) => {
      const fit = state.fits[model];
      if (!fit) return;
      const [transitionEnd] = state.fitRange;
      const measuredEnd = state.prepared!.plastic.at(-1)!.strain;
      const displayEnd = Math.max(
        measuredEnd,
        fit.connection.strain + Math.max(fit.connection.strain - transitionEnd, 0.05),
      );
      const points = Array.from({ length: 301 }, (_, index) => {
        const strain = (displayEnd * index) / 300;
        return {
          strain,
          stress: evaluateConnectedModel(
            model,
            strain,
            state.prepared!.proportionalLimit.stress,
            fit.parameters,
            fit.connection,
          ),
        };
      });
      series.push({
        name: `${HARDENING_MODEL_LABELS[model]} 接続制約後`,
        points,
        color: CURVE_COLORS[model],
        dashed: true,
      });
    });
    const connectionFit = state.selectedModels
      .map((model) => state.fits[model])
      .find((fit) => fit !== undefined);
    if (connectionFit) {
      series.push({
        name: "実測・硬化則接続点",
        points: [connectionFit.connection],
        color: CURVE_COLORS.connection,
        pointsOnly: true,
        symbol: "diamond",
        symbolSize: 12,
      });
    }
    return series;
  }, [state.fitRange, state.fits, state.prepared, state.selectedModels]);
  const fitRangeError = useMemo(() => {
    if (!state.prepared) return "変換データがありません。";
    if (!state.proportionalLimitConfirmed) return "比例限度候補を確認してください。";
    if (state.selectedModels.length === 0) return "硬化則を1つ以上選択してください。";
    const [start, end] = state.fitRange;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "降伏遷移終了点とフィッティング終点を入力してください。";
    }
    if (!Number.isFinite(state.connectionStrain)) return "接続点塑性ひずみを入力してください。";
    if (start < 0 || end < 0) return "各ひずみは0以上で指定してください。";
    if (start >= end) return "フィッティング終点は降伏遷移終了点より大きくしてください。";
    if (end > state.prepared.plastic.at(-1)!.strain) return "フィッティング終点は実測範囲内にしてください。";
    if (end > state.connectionStrain) return "フィッティング終点は接続点以前にしてください。";
    if (state.connectionStrain > state.prepared.plastic.at(-1)!.strain) {
      return "接続点は実測範囲内にしてください。";
    }
    const pointCount = state.prepared.plastic.filter(
      (point) => point.strain >= 0 && point.strain <= end,
    ).length;
    return pointCount < 3 ? "フィッティング範囲内に3点以上必要です。" : null;
  }, [
    state.fitRange,
    state.connectionStrain,
    state.prepared,
    state.proportionalLimitConfirmed,
    state.selectedModels.length,
  ]);

  return { state, fittedSeries, fitRangeError };
}
