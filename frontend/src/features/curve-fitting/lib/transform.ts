import {
  CURVE_POINT_TOLERANCE,
  PROPORTIONAL_LIMIT_CONSECUTIVE_POINTS,
  PROPORTIONAL_LIMIT_PLASTIC_STRAIN_THRESHOLD,
} from "../constants/curve-fitting";
import type {
  CurvePoint,
  CsvTable,
  DataMapping,
  MaterialProperties,
  PreparedData,
  PreparedInputData,
  ProofStressPoint,
  ProportionalLimitPoint,
} from "../types/curve-fitting";

const STRESS_TO_MPA = { Pa: 1e-6, MPa: 1, GPa: 1e3 } as const;

function toFiniteNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

interface NormalizedPointSet {
  uploaded: CurvePoint;
  engineering: CurvePoint | null;
  trueTotal: CurvePoint | null;
  directPlastic: CurvePoint | null;
}

function normalizeRows(table: CsvTable, mapping: DataMapping): {
  pointSets: NormalizedPointSet[];
  warnings: string[];
} {
  const warnings = [...table.warnings];
  const pointSets: NormalizedPointSet[] = [];
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
    if (mapping.dataKind === "engineering") {
      pointSets.push({
        uploaded,
        engineering: uploaded,
        trueTotal: { strain: Math.log1p(strain), stress: stress * (1 + strain) },
        directPlastic: null,
      });
      return;
    }
    if (mapping.dataKind === "true-total") {
      const stretch = Math.exp(strain);
      pointSets.push({
        uploaded,
        engineering: { strain: stretch - 1, stress: stress / stretch },
        trueTotal: uploaded,
        directPlastic: null,
      });
      return;
    }
    pointSets.push({ uploaded, engineering: null, trueTotal: null, directPlastic: uploaded });
  });

  if (invalidCount) warnings.push(`${invalidCount}行の非数値または無効なデータを除外しました。`);
  if (pointSets.length < 3) throw new Error("有効なデータ点が3点以上必要です。");
  pointSets.sort((left, right) => left.uploaded.strain - right.uploaded.strain);
  return { pointSets, warnings };
}

/** Maps CSV columns and normalizes the input to MPa and decimal strain. */
export function prepareInputData(table: CsvTable, mapping: DataMapping): PreparedInputData {
  const { pointSets, warnings } = normalizeRows(table, mapping);
  const tensileStrengthSet = pointSets.reduce((maximum, pointSet) => {
    const pointStress = pointSet.engineering?.stress ?? pointSet.uploaded.stress;
    const maximumStress = maximum.engineering?.stress ?? maximum.uploaded.stress;
    return pointStress > maximumStress ? pointSet : maximum;
  });
  return {
    dataKind: mapping.dataKind,
    uploaded: pointSets.map((pointSet) => pointSet.uploaded),
    engineering:
      mapping.dataKind === "true-plastic"
        ? null
        : pointSets.map((pointSet) => pointSet.engineering as CurvePoint),
    trueTotal:
      mapping.dataKind === "true-plastic"
        ? null
        : pointSets.map((pointSet) => pointSet.trueTotal as CurvePoint),
    directPlastic:
      mapping.dataKind === "true-plastic"
        ? pointSets.map((pointSet) => pointSet.directPlastic as CurvePoint)
        : null,
    tensileStrength: {
      uploaded: tensileStrengthSet.uploaded,
      engineering: tensileStrengthSet.engineering,
      trueTotal: tensileStrengthSet.trueTotal,
    },
    warnings,
  };
}

function interpolatePoint(points: CurvePoint[], strain: number): CurvePoint {
  if (strain < points[0].strain || strain > points.at(-1)!.strain) {
    throw new Error("指定した比例限度ひずみは入力曲線の範囲内にしてください。");
  }
  const exact = points.find((point) => Math.abs(point.strain - strain) <= CURVE_POINT_TOLERANCE);
  if (exact) return { ...exact };
  const rightIndex = points.findIndex((point) => point.strain > strain);
  const left = points[rightIndex - 1];
  const right = points[rightIndex];
  const ratio = (strain - left.strain) / (right.strain - left.strain);
  return { strain, stress: left.stress + ratio * (right.stress - left.stress) };
}

function interpolateRawPlastic(
  trueTotal: CurvePoint[],
  rawPlastic: CurvePoint[],
  trueStrain: number,
): ProportionalLimitPoint {
  const stressPoint = interpolatePoint(trueTotal, trueStrain);
  const rawPoint = interpolatePoint(rawPlastic, trueStrain);
  return {
    trueStrain,
    rawPlasticStrain: rawPoint.stress,
    stress: stressPoint.stress,
    method: "manual",
  };
}

function detectProportionalLimit(
  trueTotal: CurvePoint[],
  rawPlastic: CurvePoint[],
): ProportionalLimitPoint {
  const threshold = PROPORTIONAL_LIMIT_PLASTIC_STRAIN_THRESHOLD;
  const runLength = PROPORTIONAL_LIMIT_CONSECUTIVE_POINTS;
  for (let index = 0; index <= rawPlastic.length - runLength; index += 1) {
    const sustained = rawPlastic
      .slice(index, index + runLength)
      .every((point) => point.stress >= threshold);
    if (!sustained) continue;
    let leftIndex = index - 1;
    while (leftIndex >= 0 && rawPlastic[leftIndex].stress >= threshold) leftIndex -= 1;
    if (leftIndex < 0) {
      throw new Error("比例限度候補の前に判定しきい値未満の点がありません。");
    }
    const left = rawPlastic[leftIndex];
    const right = rawPlastic[index];
    const denominator = right.stress - left.stress;
    const ratio = denominator === 0 ? 1 : (threshold - left.stress) / denominator;
    const trueStrain = left.strain + ratio * (right.strain - left.strain);
    return {
      trueStrain,
      rawPlasticStrain: threshold,
      stress: interpolatePoint(trueTotal, trueStrain).stress,
      method: "automatic",
    };
  }
  throw new Error(
    `真塑性ひずみ残差が${threshold}以上となる状態を${runLength}点連続で検出できませんでした。`,
  );
}

function calculateProofStress(
  input: PreparedInputData,
  youngsModulus: number,
  proportionalLimit: ProportionalLimitPoint,
): ProofStressPoint | null {
  if (!input.engineering || !input.trueTotal) return null;
  const offsetStrain = 0.002;
  const residual = (point: CurvePoint) => point.stress - youngsModulus * (point.strain - offsetStrain);
  for (let index = 1; index < input.engineering.length; index += 1) {
    const previous = input.engineering[index - 1];
    const current = input.engineering[index];
    const previousResidual = residual(previous);
    const currentResidual = residual(current);
    if (previousResidual < 0 || currentResidual > 0) continue;
    const denominator = previousResidual - currentResidual;
    const ratio = denominator === 0 ? 0 : previousResidual / denominator;
    const engineering = {
      strain: previous.strain + ratio * (current.strain - previous.strain),
      stress: previous.stress + ratio * (current.stress - previous.stress),
    };
    const previousTrue = input.trueTotal[index - 1];
    const currentTrue = input.trueTotal[index];
    const trueTotal = {
      strain: previousTrue.strain + ratio * (currentTrue.strain - previousTrue.strain),
      stress: previousTrue.stress + ratio * (currentTrue.stress - previousTrue.stress),
    };
    const rawPlasticStrain = trueTotal.strain - trueTotal.stress / youngsModulus;
    return {
      engineering,
      trueTotal,
      relativePlasticStrain: rawPlasticStrain - proportionalLimit.rawPlasticStrain,
    };
  }
  return null;
}

function prepareDirectPlastic(input: PreparedInputData): PreparedData {
  const directPlastic = input.directPlastic;
  if (!directPlastic) throw new Error("真応力–真塑性ひずみデータがありません。");
  if (Math.abs(directPlastic[0].strain) > CURVE_POINT_TOLERANCE) {
    throw new Error("真応力–真塑性ひずみ直接入力の先頭点は塑性ひずみ0にしてください。");
  }
  if (directPlastic.some((point) => point.strain < -CURVE_POINT_TOLERANCE)) {
    throw new Error("真塑性ひずみには0以上の値を指定してください。");
  }
  const plastic = directPlastic.map((point, index) => ({
    strain: index === 0 ? 0 : point.strain,
    stress: point.stress,
  }));
  return {
    ...input,
    plastic,
    proportionalLimit: {
      trueStrain: null,
      rawPlasticStrain: 0,
      stress: plastic[0].stress,
      method: "direct-input",
    },
    proofStress: null,
    tensileStrength: { ...input.tensileStrength, plastic: input.tensileStrength.uploaded },
  };
}

/** Converts total strain input, detects a proportional-limit candidate, and retains measured plastic data. */
export function prepareData(
  table: CsvTable,
  mapping: DataMapping,
  material: MaterialProperties,
  proportionalLimitTrueStrain?: number,
): PreparedData {
  const input = prepareInputData(table, mapping);
  if (mapping.dataKind === "true-plastic") return prepareDirectPlastic(input);
  if (!(material.youngsModulus > 0)) throw new Error("ヤング率は0より大きい値が必要です。");
  const trueTotal = input.trueTotal;
  if (!trueTotal || !input.tensileStrength.trueTotal) throw new Error("真全ひずみデータがありません。");
  const rawPlastic = trueTotal.map((point) => ({
    strain: point.strain,
    stress: point.strain - point.stress / material.youngsModulus,
  }));
  const proportionalLimit =
    proportionalLimitTrueStrain === undefined
      ? detectProportionalLimit(trueTotal, rawPlastic)
      : interpolateRawPlastic(trueTotal, rawPlastic, proportionalLimitTrueStrain);
  const plastic = trueTotal
    .filter((point) => point.strain >= proportionalLimit.trueStrain!)
    .map((point) => ({
      strain:
        point.strain - point.stress / material.youngsModulus - proportionalLimit.rawPlasticStrain,
      stress: point.stress,
    }));
  plastic.push({ strain: 0, stress: proportionalLimit.stress });
  plastic.sort((left, right) => left.strain - right.strain);
  const warnings = [...input.warnings];
  if (plastic.some((point) => point.strain < -CURVE_POINT_TOLERANCE)) {
    warnings.push("比例限度候補より後に負の相対真塑性ひずみがあります。候補を確認してください。");
  }
  const duplicateCount = plastic.reduce(
    (count, point, index) =>
      index > 0 && Math.abs(point.strain - plastic[index - 1].strain) <= CURVE_POINT_TOLERANCE
        ? count + 1
        : count,
    0,
  );
  if (duplicateCount) warnings.push(`${duplicateCount}点で塑性ひずみが重複しています。`);
  const tensileTrue = input.tensileStrength.trueTotal;
  const tensilePlastic = {
    strain:
      tensileTrue.strain -
      tensileTrue.stress / material.youngsModulus -
      proportionalLimit.rawPlasticStrain,
    stress: tensileTrue.stress,
  };
  return {
    ...input,
    plastic,
    proportionalLimit,
    proofStress: calculateProofStress(input, material.youngsModulus, proportionalLimit),
    tensileStrength: { ...input.tensileStrength, plastic: tensilePlastic },
    warnings,
  };
}
