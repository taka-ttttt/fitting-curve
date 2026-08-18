import type { StateCreator } from "zustand";

import type {
  CsvTable,
  DataMapping,
  ExportResult,
  ExportSettings,
  FitResult,
  HardeningModel,
  MaterialProperties,
  ModelParameters,
  PreparedData,
} from "@/features/curve-fitting/types/curve-fitting";

export interface WorkflowSlice {
  error: string | null;
  clearError: () => void;
}

export interface ImportSlice {
  fileName: string | null;
  table: CsvTable | null;
  mapping: DataMapping;
  material: MaterialProperties;
  setTable: (fileName: string, table: CsvTable) => void;
  updateMapping: (patch: Partial<DataMapping>) => void;
  updateMaterial: (patch: Partial<MaterialProperties>) => void;
}

export interface ConversionSlice {
  prepared: PreparedData | null;
  convert: () => void;
}

export interface FittingSlice {
  model: HardeningModel;
  fitRange: [number, number];
  fit: FitResult | null;
  automaticParameters: ModelParameters | null;
  busy: boolean;
  setModel: (model: HardeningModel) => void;
  setFitRange: (range: [number, number]) => void;
  runFit: () => Promise<void>;
  updateParameter: (name: keyof ModelParameters, value: number) => void;
  resetParameters: () => void;
}

export interface ExportSlice {
  exportSettings: ExportSettings;
  exportResult: ExportResult | null;
  updateExportSettings: (patch: Partial<ExportSettings>) => void;
  createExport: () => void;
}

export type CurveWorkflowState = WorkflowSlice & ImportSlice & ConversionSlice & FittingSlice & ExportSlice;

export type CurveWorkflowSlice<T> = StateCreator<CurveWorkflowState, [], [], T>;
