import { generateExport } from "@/features/curve-fitting/lib/export";
import type { CurveWorkflowSlice, ExportSlice } from "@/features/curve-fitting/store/types";

export const createExportSlice: CurveWorkflowSlice<ExportSlice> = (set, get) => ({
  exportModel: null,
  exportSettings: { maximumPlasticStrain: 0.5, pointCount: 100, lcid: 1 },
  exportResult: null,
  setExportModel: (exportModel) => set({ exportModel, exportResult: null }),
  updateExportSettings: (patch) =>
    set((state) => ({ exportSettings: { ...state.exportSettings, ...patch }, exportResult: null })),
  createExport: () => {
    const { fits, exportModel, prepared, exportSettings } = get();
    if (!exportModel || !prepared) return;
    const fit = fits[exportModel];
    if (!fit) return;
    if (fit.diagnostics.exportBlocked) {
      set({ error: "接続点前後の接線係数が非物理的なためエクスポートできません。" });
      return;
    }
    try {
      set({
        exportResult: generateExport(
          exportModel,
          prepared.proportionalLimit.stress,
          fit.parameters,
          prepared.plastic,
          fit.connection,
          exportSettings,
        ),
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
});
