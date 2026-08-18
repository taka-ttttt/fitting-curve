"use client";

import { useMemo } from "react";

import { CurveChart, type CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { MaterialPropertiesFields } from "@/features/curve-fitting/components/steps/material-properties-fields";
import { CURVE_COLORS } from "@/features/curve-fitting/constants/curve-fitting";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import { Alert } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { NumberField } from "@/shared/components/ui/number-field";

export function ConversionSection() {
  const prepared = useCurveWorkflowStore((store) => store.prepared);
  const inputData = useCurveWorkflowStore((store) => store.inputData);
  const dataKind = useCurveWorkflowStore((store) => store.mapping.dataKind);
  const proportionalLimitConfirmed = useCurveWorkflowStore(
    (store) => store.proportionalLimitConfirmed,
  );
  const setProportionalLimit = useCurveWorkflowStore((store) => store.setProportionalLimit);
  const confirmProportionalLimit = useCurveWorkflowStore((store) => store.confirmProportionalLimit);
  const convertedSeries = useMemo<CurveSeries[]>(() => {
    if (!inputData) return [];
    if (dataKind === "true-plastic") {
      return prepared
        ? [
            {
              name: "実測 真応力–真塑性ひずみ",
              points: prepared.plastic,
              color: CURVE_COLORS.plastic,
              pointsOnly: true,
            },
          ]
        : [];
    }
    if (!inputData.trueTotal) return [];
    const series: CurveSeries[] = [
      {
        name: "真応力–真全ひずみ",
        points: inputData.trueTotal,
        color: CURVE_COLORS.trueTotal,
        pointsOnly: true,
      },
    ];
    if (prepared && prepared.proportionalLimit.trueStrain !== null) {
      series.push({
        name: "比例限度候補",
        points: [
          {
            strain: prepared.proportionalLimit.trueStrain,
            stress: prepared.proportionalLimit.stress,
          },
        ],
        color: CURVE_COLORS.proportionalLimit,
        pointsOnly: true,
        symbol: "diamond",
        symbolSize: 13,
      });
    }
    if (prepared?.proofStress) {
      series.push({
        name: "0.2%耐力（参考）",
        points: [prepared.proofStress.trueTotal],
        color: CURVE_COLORS.reference,
        pointsOnly: true,
        symbol: "rect",
        symbolSize: 11,
      });
    }
    return series;
  }, [dataKind, inputData, prepared]);

  if (!inputData) return null;
  const isDirectPlastic = dataKind === "true-plastic";

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. 真応力–真塑性ひずみへの変換</CardTitle>
        <CardDescription>
          {isDirectPlastic
            ? "入力済みの真塑性ひずみを検証し、先頭点を比例限度として使用します。"
            : "弾性ひずみを除去し、比例限度候補を検出します。0.2%耐力は参考値として表示し、塑性ひずみ原点には使用しません。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MaterialPropertiesFields />
        {!isDirectPlastic && (
          <Alert>
            比例限度候補は単調引張データから得る工学的近似です。除荷試験で確認した弾性限度と同一とは限りません。
          </Alert>
        )}
        {prepared?.warnings.map((warning) => (
          <Alert key={warning}>{warning}</Alert>
        ))}
        {!isDirectPlastic && (
          <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
            <NumberField
              id="proportional-limit-strain"
              label="比例限度候補の真全ひずみ"
              value={prepared?.proportionalLimit.trueStrain ?? 0}
              min={0}
              step={0.0001}
              description="グラフをクリックするか数値を変更して候補を修正できます。"
              onChange={setProportionalLimit}
            />
            <div className="self-center text-sm text-slate-700">
              {prepared ? (
                <>
                  <p>比例限度応力: {prepared.proportionalLimit.stress.toPrecision(6)} MPa</p>
                  <p>検出方法: {prepared.proportionalLimit.method === "automatic" ? "自動" : "手動"}</p>
                </>
              ) : (
                <p>自動検出できない場合は、真全ひずみを直接入力してください。</p>
              )}
              {prepared?.proofStress && (
                <p>0.2%耐力: {prepared.proofStress.engineering.stress.toPrecision(6)} MPa</p>
              )}
            </div>
            <div className="flex items-center">
              <Button
                disabled={!prepared || proportionalLimitConfirmed}
                onClick={confirmProportionalLimit}
              >
                {proportionalLimitConfirmed ? "比例限度を確認済み" : "この比例限度を使用"}
              </Button>
            </div>
          </div>
        )}
        {prepared && isDirectPlastic && (
          <p className="text-sm font-medium text-slate-700">
            比例限度応力: {prepared.proportionalLimit.stress.toPrecision(6)} MPa
          </p>
        )}
        <CurveChart
          series={convertedSeries}
          xLabel={isDirectPlastic ? "真塑性ひずみ [-]" : "真全ひずみ [-]"}
          onPointSelect={
            isDirectPlastic ? undefined : (strain) => setProportionalLimit(strain)
          }
        />
      </CardContent>
    </Card>
  );
}
