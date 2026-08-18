"use client";

import { useMemo } from "react";

import { CurveChart, type CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { MaterialPropertiesFields } from "@/features/curve-fitting/components/steps/material-properties-fields";
import { CURVE_COLORS } from "@/features/curve-fitting/constants/curve-fitting";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import { Alert } from "@/shared/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function ConversionSection() {
  const prepared = useCurveWorkflowStore((store) => store.prepared);
  const inputData = useCurveWorkflowStore((store) => store.inputData);
  const material = useCurveWorkflowStore((store) => store.material);
  const conversionMethod = useCurveWorkflowStore((store) => store.conversionMethod);
  const dataKind = useCurveWorkflowStore((store) => store.mapping.dataKind);
  const convertedSeries = useMemo<CurveSeries[]>(() => {
    if (!inputData) return [];
    const series: CurveSeries[] = [
      {
        name: "真応力–真ひずみ",
        points: inputData.trueTotal,
        color: CURVE_COLORS.trueTotal,
        pointsOnly: true,
      },
      {
        name: "引張強度点（真ひずみ）",
        points: [inputData.tensileStrength.trueTotal],
        color: CURVE_COLORS.trueTotal,
        pointsOnly: true,
        symbol: "rect",
        symbolSize: 11,
      },
    ];
    if (conversionMethod === "specified-yield" && material.youngsModulus > 0 && material.yieldStress > 0) {
      series.push({
        name: `ヤング率参考線 E=${material.youngsModulus.toLocaleString()} MPa（σy=${material.yieldStress.toLocaleString()} MPa）`,
        points: [
          { strain: 0, stress: 0 },
          { strain: material.yieldStress / material.youngsModulus, stress: material.yieldStress },
        ],
        color: CURVE_COLORS.reference,
        dashed: true,
      });
    }
    if (conversionMethod === "proof-0.2" && material.youngsModulus > 0) {
      const referencePoint = prepared?.yieldPoint ?? {
        sourceStrain: 0.002 + inputData.tensileStrength.uploaded.stress / material.youngsModulus,
        sourceStress: inputData.tensileStrength.uploaded.stress,
      };
      if (dataKind === "engineering") {
        series.unshift({
          name: "0.2%耐力判定用の公称曲線",
          points: inputData.uploaded,
          color: CURVE_COLORS.engineering,
          pointsOnly: true,
        });
      }
      series.push({
        name: `0.2%オフセット直線（入力座標） E=${material.youngsModulus.toLocaleString()} MPa`,
        points: [
          { strain: 0.002, stress: 0 },
          { strain: referencePoint.sourceStrain, stress: referencePoint.sourceStress },
        ],
        color: CURVE_COLORS.reference,
        dashed: true,
      });
    }
    if (prepared) {
      series.push(
        {
          name: "真応力–真塑性ひずみ",
          points: prepared.plastic,
          color: CURVE_COLORS.plastic,
          pointsOnly: true,
        },
        {
          name: "引張強度点（真塑性ひずみ）",
          points: [prepared.tensileStrength.plastic],
          color: CURVE_COLORS.plastic,
          pointsOnly: true,
          symbol: "rect",
          symbolSize: 11,
        },
      );
    }
    return series;
  }, [conversionMethod, dataKind, inputData, material.youngsModulus, material.yieldStress, prepared]);

  if (!inputData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. 真応力–真塑性ひずみへの変換</CardTitle>
        <CardDescription>
          {conversionMethod === "specified-yield"
            ? "入力曲線と指定した降伏応力の交点を真塑性ひずみ0に合わせ、その時点以降の点群だけを残します。ヤング率は参考線の表示だけに使用します。"
            : "入力曲線と0.2%オフセット直線の交点から耐力を算出し、その点を真塑性ひずみ0として以降の点群だけを残します。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MaterialPropertiesFields />
        {prepared?.warnings.map((warning) => (
          <Alert key={warning}>{warning}</Alert>
        ))}
        {prepared?.yieldPoint.method === "proof-0.2" && (
          <p className="text-sm font-medium text-slate-700">
            算出した0.2%耐力: {prepared.yieldPoint.sourceStress.toPrecision(6)} MPa
            {dataKind === "engineering" &&
              `（対応する基準真応力: ${prepared.yieldPoint.stress.toPrecision(6)} MPa）`}
          </p>
        )}
        <CurveChart series={convertedSeries} xLabel="ひずみ [-]" />
      </CardContent>
    </Card>
  );
}
