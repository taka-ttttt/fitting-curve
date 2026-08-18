"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useShallow } from "zustand/react/shallow";
import { z } from "zod";

import type { CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { CURVE_COLORS } from "@/features/curve-fitting/constants/curve-fitting";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";

const exportSchema = z.object({
  maximumPlasticStrain: z.number().positive("0より大きい値を指定してください。"),
  pointCount: z.number().int("整数を指定してください。").min(20, "20点以上を指定してください。"),
  lcid: z.number().int("整数を指定してください。").positive("1以上を指定してください。"),
});

export type ExportFormValues = z.infer<typeof exportSchema>;

/** Collects export form state, generated series, download, and clipboard behavior. */
export function useExportStep() {
  const [copied, setCopied] = useState(false);
  const exportForm = useForm<ExportFormValues>({
    resolver: zodResolver(exportSchema),
    defaultValues: { maximumPlasticStrain: 0.5, pointCount: 100, lcid: 1 },
  });
  const state = useCurveWorkflowStore(
    useShallow((store) => ({
      fits: store.fits,
      prepared: store.prepared,
      exportModel: store.exportModel,
      exportResult: store.exportResult,
      setExportModel: store.setExportModel,
      updateExportSettings: store.updateExportSettings,
      createExport: store.createExport,
    })),
  );
  const exportSeries = useMemo<CurveSeries[]>(
    () => {
      if (!state.exportResult || !state.exportModel || !state.prepared) return [];
      const fit = state.fits[state.exportModel];
      if (!fit) return [];
      const measuredEnd = state.prepared.plastic.at(-1)!.strain;
      const measuredPoints = state.exportResult.points.filter(
        (point) => point.strain <= fit.connection.strain,
      );
      const modelPoints = state.exportResult.points.filter(
        (point) => point.strain >= fit.connection.strain && point.strain <= measuredEnd,
      );
      const extrapolatedTail = state.exportResult.points.filter((point) => point.strain > measuredEnd);
      const extrapolatedPoints = modelPoints.at(-1)
        ? [modelPoints.at(-1)!, ...extrapolatedTail]
        : extrapolatedTail;
      return [
        { name: "実測保持区間", points: measuredPoints, color: CURVE_COLORS.plastic },
        {
          name: "硬化則区間",
          points: modelPoints,
          color: CURVE_COLORS[state.exportModel],
          dashed: true,
        },
        ...(extrapolatedPoints.length > 1
          ? [
            {
              name: "硬化則外挿区間",
              points: extrapolatedPoints,
              color: CURVE_COLORS.connection,
              dashed: true,
            },
          ]
          : []),
        {
          name: "LCINT=1001 内部曲線",
          points: state.exportResult.lcintPoints,
          color: CURVE_COLORS.reference,
          dashed: true,
        },
        {
          name: "接続点",
          points: [fit.connection],
          color: CURVE_COLORS.connection,
          pointsOnly: true,
          symbol: "diamond",
          symbolSize: 12,
        },
      ];
    },
    [state.exportModel, state.exportResult, state.fits, state.prepared],
  );

  function handleExport(values: ExportFormValues): void {
    state.updateExportSettings(values);
    state.createExport();
  }

  function downloadCsv(): void {
    if (!state.exportResult) return;
    const blob = new Blob(["\uFEFF", state.exportResult.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fitted_curve.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyLsdyna(): Promise<void> {
    if (!state.exportResult) return;
    await navigator.clipboard.writeText(state.exportResult.lsdyna);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return { copied, exportForm, state, exportSeries, handleExport, downloadCsv, copyLsdyna };
}
