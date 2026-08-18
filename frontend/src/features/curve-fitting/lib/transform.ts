import type {
  CurvePoint,
  CsvTable,
  DataMapping,
  MaterialProperties,
  PreparedData,
} from "../types/curve-fitting";

const STRESS_TO_MPA = { Pa: 1e-6, MPa: 1, GPa: 1e3 } as const;

function toFiniteNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Maps CSV columns, normalizes units to MPa/decimal, and derives plastic strain. */
export function prepareData(
  table: CsvTable,
  mapping: DataMapping,
  material: MaterialProperties,
): PreparedData {
  if (!(material.yieldStress > 0)) throw new Error("降伏応力は0より大きい値が必要です。");
  if (mapping.dataKind !== "true-plastic" && !(material.youngsModulus > 0)) {
    throw new Error("この入力形式ではヤング率が必要です。");
  }

  const warnings = [...table.warnings];
  const uploaded: CurvePoint[] = [];
  const plastic: CurvePoint[] = [];
  let invalidCount = 0;
  let negativePlasticCount = 0;

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
    uploaded.push({ strain, stress });

    let trueStress = stress;
    let truePlasticStrain = strain;
    if (mapping.dataKind === "engineering") {
      trueStress = stress * (1 + strain);
      const trueTotalStrain = Math.log1p(strain);
      truePlasticStrain = trueTotalStrain - trueStress / material.youngsModulus;
    } else if (mapping.dataKind === "true-total") {
      truePlasticStrain = strain - stress / material.youngsModulus;
    }
    if (truePlasticStrain < 0) negativePlasticCount += 1;
    plastic.push({ strain: truePlasticStrain, stress: trueStress });
  });

  uploaded.sort((a, b) => a.strain - b.strain);
  plastic.sort((a, b) => a.strain - b.strain);
  const duplicateCount = plastic.reduce(
    (count, point, index) =>
      index > 0 && point.strain === plastic[index - 1].strain ? count + 1 : count,
    0,
  );
  if (invalidCount) warnings.push(`${invalidCount}行の非数値または無効なデータを除外しました。`);
  if (negativePlasticCount) {
    warnings.push(`${negativePlasticCount}点の塑性ひずみが負です。フィッティング範囲を確認してください。`);
  }
  if (duplicateCount) warnings.push(`${duplicateCount}点で塑性ひずみが重複しています。`);
  if (plastic.length < 3) throw new Error("有効なデータ点が3点以上必要です。");
  return { uploaded, plastic, warnings };
}
