import type { CurveWorkflowSlice, ImportSlice } from "@/features/curve-fitting/store/types";
import type { DataMapping } from "@/features/curve-fitting/types/curve-fitting";

const initialMapping: DataMapping = {
  strainColumn: "",
  stressColumn: "",
  dataKind: "engineering",
  strainUnit: "decimal",
  stressUnit: "MPa",
};

export const createImportSlice: CurveWorkflowSlice<ImportSlice> = (set) => ({
  fileName: null,
  table: null,
  mapping: initialMapping,
  material: { youngsModulus: 210_000, yieldStress: 300 },
  setTable: (fileName, table) =>
    set({
      fileName,
      table,
      mapping: {
        ...initialMapping,
        strainColumn: table.columns[0] ?? "",
        stressColumn: table.columns[1] ?? table.columns[0] ?? "",
      },
      prepared: null,
      fit: null,
      automaticParameters: null,
      exportResult: null,
      error: null,
    }),
  updateMapping: (patch) =>
    set((state) => ({
      mapping: { ...state.mapping, ...patch },
      prepared: null,
      fit: null,
      automaticParameters: null,
      exportResult: null,
    })),
  updateMaterial: (patch) =>
    set((state) => ({
      material: { ...state.material, ...patch },
      prepared: null,
      fit: null,
      automaticParameters: null,
      exportResult: null,
    })),
});
