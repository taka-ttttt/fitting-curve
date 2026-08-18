import type { StateCreator } from "zustand";

import type {
  CsvTable,
  DataMapping,
  ConversionMethod,
  ExportResult,
  ExportSettings,
  FitResults,
  HardeningModel,
  MaterialProperties,
  ModelParameters,
  ModelParameterSets,
  PreparedData,
  PreparedInputData,
} from "@/features/curve-fitting/types/curve-fitting";

export interface WorkflowSlice {
  error: string | null;
  clearError: () => void;
}

export interface ImportSlice {
  fileName: string | null;
  table: CsvTable | null;
  inputData: PreparedInputData | null;
  mapping: DataMapping;
  material: MaterialProperties;
  conversionMethod: ConversionMethod;
  setTable: (fileName: string, table: CsvTable) => void;
  updateMapping: (patch: Partial<DataMapping>) => void;
  updateMaterial: (patch: Partial<MaterialProperties>) => void;
  setConversionMethod: (method: ConversionMethod) => void;
}

export interface ConversionSlice {
  prepared: PreparedData | null;
  convert: () => void;
}

export interface FittingSlice {
  selectedModels: HardeningModel[];
  fitRange: [number, number];
  recommendedFitEnd: number;
  fits: FitResults;
  automaticParameters: ModelParameterSets;
  busy: boolean;
  toggleModel: (model: HardeningModel) => void;
  setFitRange: (range: [number, number]) => void;
  resetFitEnd: () => void;
  runFits: () => Promise<void>;
  updateParameter: (model: HardeningModel, name: keyof ModelParameters, value: number) => void;
  resetParameters: (model: HardeningModel) => void;
}

export interface ExportSlice {
  exportModel: HardeningModel | null;
  exportSettings: ExportSettings;
  exportResult: ExportResult | null;
  setExportModel: (model: HardeningModel) => void;
  updateExportSettings: (patch: Partial<ExportSettings>) => void;
  createExport: () => void;
}

export type CurveWorkflowState = WorkflowSlice & ImportSlice & ConversionSlice & FittingSlice & ExportSlice;

export type CurveWorkflowSlice<T> = StateCreator<CurveWorkflowState, [], [], T>;
