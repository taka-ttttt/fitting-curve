"use client";

import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { DISPLAY_POINT_LIMIT } from "@/features/curve-fitting/constants/curve-fitting";
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
      mapping: store.mapping,
      prepared: store.prepared,
      setTable: store.setTable,
      updateMapping: store.updateMapping,
      clearError: store.clearError,
    })),
  );
  const originalSeries = useMemo<CurveSeries[]>(
    () =>
      state.prepared
        ? [
            {
              name: "アップロードデータ",
              points: state.prepared.uploaded,
              color: "#64748b",
              pointsOnly: true,
            },
          ]
        : [],
    [state.prepared],
  );
  const largeData = (state.prepared?.uploaded.length ?? 0) > DISPLAY_POINT_LIMIT;
  const inputXLabel =
    state.mapping.dataKind === "engineering"
      ? "公称ひずみ [-]"
      : state.mapping.dataKind === "true-total"
        ? "真全ひずみ [-]"
        : "真塑性ひずみ [-]";

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

  return { fileInputRef, uploadError, state, originalSeries, largeData, inputXLabel, handleFile };
}
