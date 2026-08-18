import { generateExport } from "@/features/curve-fitting/lib/export";
import type { CurveWorkflowSlice, ExportSlice } from "@/features/curve-fitting/store/types";

export const createExportSlice: CurveWorkflowSlice<ExportSlice> = (set, get) => ({
  exportSettings: { maximumPlasticStrain: 0.5, pointCount: 100, lcid: 1 },
  exportResult: null,
  updateExportSettings: (patch) =>
    set((state) => ({ exportSettings: { ...state.exportSettings, ...patch }, exportResult: null })),
  createExport: () => {
    const { fit, model, material, exportSettings } = get();
    if (!fit) return;
    try {
      set({
        exportResult: generateExport(model, material.yieldStress, fit.parameters, exportSettings),
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
});
