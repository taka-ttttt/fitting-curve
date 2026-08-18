import type { CurveWorkflowSlice, WorkflowSlice } from "@/features/curve-fitting/store/types";

export const createWorkflowSlice: CurveWorkflowSlice<WorkflowSlice> = (set) => ({
  error: null,
  clearError: () => set({ error: null }),
});
