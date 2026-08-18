import { prepareData } from "@/features/curve-fitting/lib/transform";
import type { ConversionSlice, CurveWorkflowSlice } from "@/features/curve-fitting/store/types";

export const createConversionSlice: CurveWorkflowSlice<ConversionSlice> = (set, get) => ({
  prepared: null,
  convert: () => {
    const { table, mapping, material } = get();
    if (!table) return;
    try {
      const prepared = prepareData(table, mapping, material);
      const nonNegative = prepared.plastic.filter((point) => point.strain >= 0);
      const maximum = nonNegative.at(-1)?.strain ?? 0.2;
      set({
        prepared,
        fitRange: [nonNegative[0]?.strain ?? 0, maximum],
        fit: null,
        automaticParameters: null,
        exportResult: null,
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
});
