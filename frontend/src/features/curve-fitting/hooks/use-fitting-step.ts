"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { evaluateModel } from "@/features/curve-fitting/lib/models";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import type { HardeningModel } from "@/features/curve-fitting/types/curve-fitting";

export const MODEL_LABELS: Record<HardeningModel, string> = {
  ludwik: "Ludwik",
  swift: "Swift",
  voce: "Voce",
};

/** Collects fitting workflow state and prepares the display-only fitted curve. */
export function useFittingStep() {
  const state = useCurveWorkflowStore(
    useShallow((store) => ({
      prepared: store.prepared,
      model: store.model,
      fitRange: store.fitRange,
      fit: store.fit,
      material: store.material,
      busy: store.busy,
      setModel: store.setModel,
      setFitRange: store.setFitRange,
      runFit: store.runFit,
      updateParameter: store.updateParameter,
      resetParameters: store.resetParameters,
    })),
  );
  const fittedSeries = useMemo<CurveSeries[]>(() => {
    if (!state.prepared) return [];
    const series: CurveSeries[] = [
      { name: "変換データ", points: state.prepared.plastic, color: "#94a3b8", pointsOnly: true },
    ];
    if (state.fit) {
      const [start, end] = state.fitRange;
      const points = Array.from({ length: 301 }, (_, index) => {
        const strain = start + ((end - start) * index) / 300;
        return {
          strain,
          stress: evaluateModel(state.model, strain, state.material.yieldStress, state.fit!.parameters),
        };
      });
      series.push({ name: `${MODEL_LABELS[state.model]}フィット`, points, color: "#dc2626" });
    }
    return series;
  }, [state.fit, state.fitRange, state.material.yieldStress, state.model, state.prepared]);

  return { state, fittedSeries };
}
