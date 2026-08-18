"use client";

import { useMemo } from "react";

import { CurveChart, type CurveSeries } from "@/features/curve-fitting/components/curve-chart";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import { Alert } from "@/shared/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function ConversionSection() {
  const prepared = useCurveWorkflowStore((store) => store.prepared);
  const convertedSeries = useMemo<CurveSeries[]>(
    () =>
      prepared
        ? [
            {
              name: "真応力–真塑性ひずみ",
              points: prepared.plastic,
              color: "#0891b2",
              pointsOnly: true,
            },
          ]
        : [],
    [prepared],
  );

  if (!prepared) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. 真応力–真塑性ひずみへの変換</CardTitle>
        <CardDescription>以降の計算には、並べ替え後の全データ点を使用します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {prepared.warnings.map((warning) => (
          <Alert key={warning}>{warning}</Alert>
        ))}
        <CurveChart series={convertedSeries} xLabel="真塑性ひずみ [-]" />
      </CardContent>
    </Card>
  );
}
