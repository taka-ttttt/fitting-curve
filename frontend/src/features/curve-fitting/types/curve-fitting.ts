export type InputDataKind = "engineering" | "true";
export type ConversionMethod = "specified-yield" | "proof-0.2";
export type StressUnit = "Pa" | "MPa" | "GPa";
export type StrainUnit = "decimal" | "percent";
export type HardeningModel = "ludwik" | "swift" | "voce";

export interface CurvePoint {
  strain: number;
  stress: number;
}

export interface CsvTable {
  columns: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

export interface DataMapping {
  strainColumn: string;
  stressColumn: string;
  dataKind: InputDataKind;
  strainUnit: StrainUnit;
  stressUnit: StressUnit;
}

export interface MaterialProperties {
  youngsModulus: number;
  yieldStress: number;
}

export interface PreparedInputData {
  uploaded: CurvePoint[];
  trueTotal: CurvePoint[];
  tensileStrength: {
    uploaded: CurvePoint;
    trueTotal: CurvePoint;
  };
  warnings: string[];
}

export interface PreparedData extends PreparedInputData {
  plastic: CurvePoint[];
  yieldPoint: {
    sourceStrain: number;
    sourceStress: number;
    trueStrain: number;
    stress: number;
    method: ConversionMethod;
  };
  tensileStrength: PreparedInputData["tensileStrength"] & {
    plastic: CurvePoint;
  };
}

export interface ModelParameters {
  K?: number;
  n?: number;
  epsilon0?: number;
  Q?: number;
  b?: number;
}

export interface FitMetrics {
  rmse: number;
  normalizedRmse: number;
  rSquared: number;
  maxAbsoluteError: number;
}

export interface FitResult {
  model: HardeningModel;
  parameters: ModelParameters;
  metrics: FitMetrics;
  iterations: number;
  range: [number, number];
}

export type FitResults = Partial<Record<HardeningModel, FitResult>>;
export type ModelParameterSets = Partial<Record<HardeningModel, ModelParameters>>;

export interface ExportSettings {
  maximumPlasticStrain: number;
  pointCount: number;
  lcid: number;
}

export interface ExportResult {
  points: CurvePoint[];
  csv: string;
  lsdyna: string;
  lcintPoints: CurvePoint[];
  lcintMaxAbsoluteDifference: number;
  lcintMaxRelativeDifference: number;
}
