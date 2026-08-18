import type {
  CurvePoint,
  ConversionMethod,
  CsvTable,
  DataMapping,
  MaterialProperties,
  PreparedData,
  PreparedInputData,
} from "../types/curve-fitting";

const STRESS_TO_MPA = { Pa: 1e-6, MPa: 1, GPa: 1e3 } as const;
const YIELD_POINT_TOLERANCE = 1e-10;

function toFiniteNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

interface NormalizedPointPair {
  uploaded: CurvePoint;
  trueTotal: CurvePoint;
}

function normalizeRows(table: CsvTable, mapping: DataMapping): {
  pairs: NormalizedPointPair[];
  warnings: string[];
} {
  const warnings = [...table.warnings];
  const pairs: NormalizedPointPair[] = [];
  let invalidCount = 0;

  table.rows.forEach((row) => {
    const rawStrain = toFiniteNumber(row[mapping.strainColumn] ?? "");
    const rawStress = toFiniteNumber(row[mapping.stressColumn] ?? "");
    if (rawStrain === null || rawStress === null) {
      invalidCount += 1;
      return;
    }
    const strain = rawStrain * (mapping.strainUnit === "percent" ? 0.01 : 1);
    const stress = rawStress * STRESS_TO_MPA[mapping.stressUnit];
    if (mapping.dataKind === "engineering" && strain <= -1) {
      invalidCount += 1;
      return;
    }
    const uploaded = { strain, stress };
    const trueTotal =
      mapping.dataKind === "engineering"
        ? { strain: Math.log1p(strain), stress: stress * (1 + strain) }
        : { strain, stress };
    pairs.push({ uploaded, trueTotal });
  });

  if (invalidCount) warnings.push(`${invalidCount}行の非数値または無効なデータを除外しました。`);
  if (pairs.length < 3) throw new Error("有効なデータ点が3点以上必要です。");
  return { pairs, warnings };
}

/** Maps CSV columns and normalizes the input to MPa/decimal and true total values. */
export function prepareInputData(table: CsvTable, mapping: DataMapping): PreparedInputData {
  const { pairs, warnings } = normalizeRows(table, mapping);
  const tensileStrengthPair = pairs.reduce((maximum, pair) =>
    pair.uploaded.stress > maximum.uploaded.stress ? pair : maximum,
  );
  const uploaded = pairs.map((pair) => pair.uploaded).sort((a, b) => a.strain - b.strain);
  const trueTotal = pairs.map((pair) => pair.trueTotal).sort((a, b) => a.strain - b.strain);

  return {
    uploaded,
    trueTotal,
    tensileStrength: {
      uploaded: tensileStrengthPair.uploaded,
      trueTotal: tensileStrengthPair.trueTotal,
    },
    warnings,
  };
}

interface YieldPoint {
  sourceStrain: number;
  sourceStress: number;
  trueStrain: number;
  stress: number;
}

function interpolateSpecifiedYieldPoint(points: CurvePoint[], yieldStress: number): YieldPoint {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous.stress <= yieldStress && current.stress >= yieldStress) {
      const stressDifference = current.stress - previous.stress;
      if (stressDifference === 0) {
        return {
          sourceStrain: previous.strain,
          sourceStress: yieldStress,
          trueStrain: previous.strain,
          stress: yieldStress,
        };
      }
      const ratio = (yieldStress - previous.stress) / stressDifference;
      const trueStrain = previous.strain + ratio * (current.strain - previous.strain);
      return {
        sourceStrain: trueStrain,
        sourceStress: yieldStress,
        trueStrain,
        stress: yieldStress,
      };
    }
  }
  throw new Error("降伏応力は、入力曲線が上昇中に通過する応力範囲内で指定してください。");
}

function interpolateProofStressPoint(
  input: PreparedInputData,
  youngsModulus: number,
): YieldPoint {
  if (!(youngsModulus > 0)) throw new Error("0.2%耐力方式ではヤング率を0より大きくしてください。");
  const offsetStrain = 0.002;
  const residual = (point: CurvePoint) =>
    point.stress - youngsModulus * (point.strain - offsetStrain);
  for (let index = 1; index < input.uploaded.length; index += 1) {
    const previous = input.uploaded[index - 1];
    const current = input.uploaded[index];
    const previousResidual = residual(previous);
    const currentResidual = residual(current);
    if (previousResidual >= 0 && currentResidual <= 0) {
      const denominator = previousResidual - currentResidual;
      const ratio = denominator === 0 ? 0 : previousResidual / denominator;
      const previousTrue = input.trueTotal[index - 1];
      const currentTrue = input.trueTotal[index];
      return {
        sourceStrain: previous.strain + ratio * (current.strain - previous.strain),
        sourceStress: previous.stress + ratio * (current.stress - previous.stress),
        trueStrain: previousTrue.strain + ratio * (currentTrue.strain - previousTrue.strain),
        stress: previousTrue.stress + ratio * (currentTrue.stress - previousTrue.stress),
      };
    }
  }
  throw new Error("入力曲線と0.2%オフセット直線の交点を求められませんでした。");
}

/** Keeps points after yield and shifts the interpolated yield strain to zero. */
export function prepareData(
  table: CsvTable,
  mapping: DataMapping,
  material: MaterialProperties,
  method: ConversionMethod,
): PreparedData {
  const input = prepareInputData(table, mapping);
  if (method === "specified-yield" && !(material.yieldStress > 0)) {
    throw new Error("降伏応力は0より大きい値が必要です。");
  }
  const yieldPoint =
    method === "specified-yield"
      ? interpolateSpecifiedYieldPoint(input.trueTotal, material.yieldStress)
      : interpolateProofStressPoint(input, material.youngsModulus);
  const toPlastic = (point: CurvePoint): CurvePoint => ({
    strain: point.strain - yieldPoint.trueStrain,
    stress: point.stress,
  });
  const plastic = input.trueTotal
    .filter((point) => point.strain >= yieldPoint.trueStrain)
    .map(toPlastic);
  const hasYieldPoint = plastic.some(
    (point) =>
      Math.abs(point.strain) <= YIELD_POINT_TOLERANCE &&
      Math.abs(point.stress - yieldPoint.stress) <=
        Math.max(1, yieldPoint.stress) * YIELD_POINT_TOLERANCE,
  );
  if (!hasYieldPoint) plastic.push({ strain: 0, stress: yieldPoint.stress });
  plastic.sort((a, b) => a.strain - b.strain);
  const duplicateCount = plastic.reduce(
    (count, point, index) =>
      index > 0 && point.strain === plastic[index - 1].strain ? count + 1 : count,
    0,
  );
  const warnings = [...input.warnings];
  if (duplicateCount) warnings.push(`${duplicateCount}点で塑性ひずみが重複しています。`);
  return {
    ...input,
    plastic,
    yieldPoint: { ...yieldPoint, method },
    tensileStrength: {
      ...input.tensileStrength,
      plastic: toPlastic(input.tensileStrength.trueTotal),
    },
    warnings,
  };
}
