"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { CURVE_COLORS, HARDENING_MODEL_LABELS } from "@/features/curve-fitting/constants/curve-fitting";
import { evaluateModel } from "@/features/curve-fitting/lib/models";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";

/** Collects fitting workflow state and prepares the display-only fitted curve. */
export function useFittingStep() {
  const state = useCurveWorkflowStore(
    useShallow((store) => ({
      prepared: store.prepared,
      selectedModels: store.selectedModels,
      fitRange: store.fitRange,
      recommendedFitEnd: store.recommendedFitEnd,
      fits: store.fits,
      busy: store.busy,
      toggleModel: store.toggleModel,
      setFitRange: store.setFitRange,
      resetFitEnd: store.resetFitEnd,
      runFits: store.runFits,
      updateParameter: store.updateParameter,
      resetParameters: store.resetParameters,
    })),
  );
  const fittedSeries = useMemo<CurveSeries[]>(() => {
    if (!state.prepared) return [];
    const series: CurveSeries[] = [
      {
        name: "真応力–真塑性ひずみ",
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
      const [start, end] = state.fitRange;
      const points = Array.from({ length: 301 }, (_, index) => {
        const strain = start + ((end - start) * index) / 300;
        return {
          strain,
          stress: evaluateModel(model, strain, state.prepared!.yieldPoint.stress, fit.parameters),
        };
      });
      series.push({
        name: `${HARDENING_MODEL_LABELS[model]}フィット`,
        points,
        color: CURVE_COLORS[model],
      });
    });
    return series;
  }, [state.fitRange, state.fits, state.prepared, state.selectedModels]);
  const fitRangeError = useMemo(() => {
    if (!state.prepared) return "変換データがありません。";
    if (state.selectedModels.length === 0) return "硬化則を1つ以上選択してください。";
    const [start, end] = state.fitRange;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "開始・終了塑性ひずみを入力してください。";
    if (start < 0 || end < 0) return "開始・終了塑性ひずみは0以上で指定してください。";
    if (start >= end) return "終了塑性ひずみは開始塑性ひずみより大きくしてください。";
    const pointCount = state.prepared.plastic.filter(
      (point) => point.strain >= start && point.strain <= end,
    ).length;
    return pointCount < 3 ? "フィッティング範囲内に3点以上必要です。" : null;
  }, [state.fitRange, state.prepared, state.selectedModels.length]);

  return { state, fittedSeries, fitRangeError };
}
