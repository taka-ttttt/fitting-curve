export type InputDataKind = "engineering" | "true-total" | "true-plastic";
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

export interface PreparedData {
  uploaded: CurvePoint[];
  plastic: CurvePoint[];
  warnings: string[];
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
