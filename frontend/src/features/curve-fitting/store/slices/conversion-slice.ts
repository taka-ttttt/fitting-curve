import { prepareData } from "@/features/curve-fitting/lib/transform";
import type { ConversionSlice, CurveWorkflowSlice } from "@/features/curve-fitting/store/types";

export const createConversionSlice: CurveWorkflowSlice<ConversionSlice> = (set, get) => ({
  prepared: null,
  convert: () => {
    const { table, mapping, material, conversionMethod } = get();
    if (!table) return;
    try {
      const prepared = prepareData(table, mapping, material, conversionMethod);
      const nonNegative = prepared.plastic.filter((point) => point.strain >= 0);
      const beforeTensileStrength = nonNegative.filter(
        (point) => point.strain < prepared.tensileStrength.plastic.strain,
      );
      const maximum =
        beforeTensileStrength.at(-1)?.strain ??
        Math.max(prepared.tensileStrength.plastic.strain, nonNegative.at(-1)?.strain ?? 0.2);
      set({
        prepared,
        fitRange: [nonNegative[0]?.strain ?? 0, maximum],
        recommendedFitEnd: maximum,
        fits: {},
        automaticParameters: {},
        exportModel: null,
        exportResult: null,
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
});
