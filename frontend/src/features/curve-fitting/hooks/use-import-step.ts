"use client";

import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { CURVE_COLORS, DISPLAY_POINT_LIMIT } from "@/features/curve-fitting/constants/curve-fitting";
import { parseCsvFile } from "@/features/curve-fitting/lib/csv";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";

/** Collects CSV import state, derived chart data, and file-selection behavior. */
export function useImportStep() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const state = useCurveWorkflowStore(
    useShallow((store) => ({
      fileName: store.fileName,
      table: store.table,
      inputData: store.inputData,
      mapping: store.mapping,
      setTable: store.setTable,
      updateMapping: store.updateMapping,
      clearError: store.clearError,
    })),
  );
  const originalSeries = useMemo<CurveSeries[]>(() => {
    if (!state.inputData) return [];
    const inputName =
      state.mapping.dataKind === "engineering"
        ? "公称応力–公称ひずみ"
        : state.mapping.dataKind === "true-total"
          ? "真応力–真全ひずみ"
          : "真応力–真塑性ひずみ";
    const inputColor =
      state.mapping.dataKind === "engineering" ? CURVE_COLORS.engineering : CURVE_COLORS.trueTotal;
    const series: CurveSeries[] = [
      {
        name: inputName,
        points: state.inputData.uploaded,
        color: inputColor,
        pointsOnly: true,
      },
      {
        name:
          state.mapping.dataKind === "engineering"
            ? "引張強度点（公称応力最大）"
            : "最大応力点",
        points: [state.inputData.tensileStrength.uploaded],
        color: inputColor,
        pointsOnly: true,
        symbol: "rect",
        symbolSize: 11,
      },
    ];
    if (state.mapping.dataKind === "engineering" && state.inputData.trueTotal) {
      series.push({
        name: "真応力–真全ひずみ（自動変換）",
        points: state.inputData.trueTotal,
        color: CURVE_COLORS.trueTotal,
        pointsOnly: true,
      });
      if (state.inputData.tensileStrength.trueTotal) {
        series.push({
          name: "引張強度対応点（真応力）",
          points: [state.inputData.tensileStrength.trueTotal],
          color: CURVE_COLORS.trueTotal,
          pointsOnly: true,
          symbol: "rect",
          symbolSize: 11,
        });
      }
    }
    return series;
  }, [state.inputData, state.mapping.dataKind]);
  const largeData = (state.inputData?.uploaded.length ?? 0) > DISPLAY_POINT_LIMIT;

  async function handleFile(file: File): Promise<void> {
    setUploadError(null);
    state.clearError();
    try {
      const table = await parseCsvFile(file);
      if (table.columns.length < 2) throw new Error("CSVには2列以上必要です。");
      state.setTable(file.name, table);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error));
    }
  }

  return { fileInputRef, uploadError, state, originalSeries, largeData, handleFile };
}
