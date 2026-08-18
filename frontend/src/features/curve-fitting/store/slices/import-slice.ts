import { prepareInputData } from "@/features/curve-fitting/lib/transform";
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
  inputData: null,
  mapping: initialMapping,
  material: { youngsModulus: 210_000, yieldStress: 300 },
  conversionMethod: "specified-yield",
  setTable: (fileName, table) => {
    const mapping = {
      ...initialMapping,
      strainColumn: table.columns[0] ?? "",
      stressColumn: table.columns[1] ?? table.columns[0] ?? "",
    };
    try {
      set({
        fileName,
        table,
        mapping,
        inputData: prepareInputData(table, mapping),
        prepared: null,
        fits: {},
        automaticParameters: {},
        exportModel: null,
        exportResult: null,
        error: null,
      });
    } catch (error) {
      set({
        fileName,
        table,
        mapping,
        inputData: null,
        prepared: null,
        fits: {},
        automaticParameters: {},
        exportModel: null,
        exportResult: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  updateMapping: (patch) =>
    set((state) => {
      const mapping = { ...state.mapping, ...patch };
      try {
        return {
          mapping,
          inputData: state.table ? prepareInputData(state.table, mapping) : null,
          prepared: null,
          fits: {},
          automaticParameters: {},
          exportModel: null,
          exportResult: null,
          error: null,
        };
      } catch (error) {
        return {
          mapping,
          inputData: null,
          prepared: null,
          fits: {},
          automaticParameters: {},
          exportModel: null,
          exportResult: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  updateMaterial: (patch) =>
    set((state) => {
      const material = { ...state.material, ...patch };
      const affectsConversion =
        (state.conversionMethod === "specified-yield" &&
          patch.yieldStress !== undefined &&
          patch.yieldStress !== state.material.yieldStress) ||
        (state.conversionMethod === "proof-0.2" &&
          patch.youngsModulus !== undefined &&
          patch.youngsModulus !== state.material.youngsModulus);
      if (!affectsConversion) return { material };
      return {
        material,
        prepared: null,
        fits: {},
        automaticParameters: {},
        exportModel: null,
        exportResult: null,
      };
    }),
  setConversionMethod: (conversionMethod) =>
    set({
      conversionMethod,
      prepared: null,
      fits: {},
      automaticParameters: {},
      exportModel: null,
      exportResult: null,
      error: null,
    }),
});
