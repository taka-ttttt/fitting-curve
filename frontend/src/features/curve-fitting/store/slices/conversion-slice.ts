import { CURVE_POINT_TOLERANCE } from "@/features/curve-fitting/constants/curve-fitting";
import { prepareData } from "@/features/curve-fitting/lib/transform";
import type { ConversionSlice, CurveWorkflowSlice } from "@/features/curve-fitting/store/types";

function downstreamReset() {
  return {
    fits: {},
    automaticParameters: {},
    exportModel: null,
    exportResult: null,
  } as const;
}

export const createConversionSlice: CurveWorkflowSlice<ConversionSlice> = (set, get) => ({
  prepared: null,
  proportionalLimitConfirmed: false,
  convert: () => {
    const { table, mapping, material } = get();
    if (!table) return;
    try {
      const prepared = prepareData(table, mapping, material);
      const fitStart = Math.max(0, prepared.proofStress?.relativePlasticStrain ?? 0);
      const maximum = prepared.tensileStrength.plastic.strain;
      set({
        prepared,
        proportionalLimitConfirmed: prepared.proportionalLimit.method === "direct-input",
        fitRange: [Math.min(fitStart, maximum / 2), maximum],
        recommendedFitEnd: maximum,
        ...downstreamReset(),
        error: null,
      });
    } catch (error) {
      set({
        prepared: null,
        proportionalLimitConfirmed: false,
        ...downstreamReset(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  setProportionalLimit: (trueStrain) => {
    const { table, mapping, material } = get();
    if (!table || mapping.dataKind === "true-plastic") return;
    try {
      const prepared = prepareData(table, mapping, material, trueStrain);
      const fitStart = Math.max(0, prepared.proofStress?.relativePlasticStrain ?? 0);
      const maximum = prepared.tensileStrength.plastic.strain;
      set({
        prepared,
        proportionalLimitConfirmed: false,
        fitRange: [Math.min(fitStart, maximum / 2), maximum],
        recommendedFitEnd: maximum,
        ...downstreamReset(),
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  confirmProportionalLimit: () => {
    const prepared = get().prepared;
    if (!prepared) return;
    if (prepared.plastic.some((point) => point.strain < -CURVE_POINT_TOLERANCE)) {
      set({ error: "比例限度候補より後に負の相対真塑性ひずみがあります。候補を修正してください。" });
      return;
    }
    set({ proportionalLimitConfirmed: true, error: null });
  },
});
