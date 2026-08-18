import { create } from "zustand";

import { createConversionSlice } from "@/features/curve-fitting/store/slices/conversion-slice";
import { createExportSlice } from "@/features/curve-fitting/store/slices/export-slice";
import { createFittingSlice } from "@/features/curve-fitting/store/slices/fitting-slice";
import { createImportSlice } from "@/features/curve-fitting/store/slices/import-slice";
import { createWorkflowSlice } from "@/features/curve-fitting/store/slices/workflow-slice";
import type { CurveWorkflowState } from "@/features/curve-fitting/store/types";

export const useCurveWorkflowStore = create<CurveWorkflowState>()((...args) => ({
  ...createWorkflowSlice(...args),
  ...createImportSlice(...args),
  ...createConversionSlice(...args),
  ...createFittingSlice(...args),
  ...createExportSlice(...args),
}));
