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
}

export interface PreparedInputData {
  dataKind: InputDataKind;
  uploaded: CurvePoint[];
  engineering: CurvePoint[] | null;
  trueTotal: CurvePoint[] | null;
  directPlastic: CurvePoint[] | null;
  tensileStrength: {
    uploaded: CurvePoint;
    engineering: CurvePoint | null;
    trueTotal: CurvePoint | null;
  };
  warnings: string[];
}

export interface ProportionalLimitPoint {
  trueStrain: number | null;
  rawPlasticStrain: number;
  stress: number;
  method: "automatic" | "manual" | "direct-input";
}

export interface ProofStressPoint {
  engineering: CurvePoint;
  trueTotal: CurvePoint;
  relativePlasticStrain: number;
}

export interface PreparedData extends PreparedInputData {
  plastic: CurvePoint[];
  proportionalLimit: ProportionalLimitPoint;
  proofStress: ProofStressPoint | null;
  tensileStrength: PreparedInputData["tensileStrength"] & {
    plastic: CurvePoint;
  };
}

export interface CurveConnection {
  strain: number;
  stress: number;
}

export interface ConnectionDiagnostics {
  leftTangent: number;
  rightTangent: number;
  targetTangent: number;
  tangentRelativeError: number;
  hasSignReversal: boolean;
  exportBlocked: boolean;
}

export type FitSensitivityRating = "stable" | "warning" | "unstable";

export interface FitSensitivity {
  evaluationStrain: number;
  minimumStress: number;
  maximumStress: number;
  relativeSpread: number;
  rating: FitSensitivityRating;
  evaluatedTransitionEnds: number[];
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
  connection: CurveConnection;
  usesConsidereTarget: boolean;
  diagnostics: ConnectionDiagnostics;
  sensitivity: FitSensitivity | null;
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
