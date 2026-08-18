"use client";

import { FileUp } from "lucide-react";

import { CurveChart } from "@/features/curve-fitting/components/curve-chart";
import { DISPLAY_POINT_LIMIT } from "@/features/curve-fitting/constants/curve-fitting";
import { useImportStep } from "@/features/curve-fitting/hooks/use-import-step";
import { Alert } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

export function ImportSection() {
  const { fileInputRef, uploadError, state, originalSeries, largeData, handleFile } = useImportStep();

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. CSVの読み込みと列指定</CardTitle>
        <CardDescription>ひずみ列・応力列と、CSVに記録されたデータ形式・単位を指定します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {uploadError && <Alert>{uploadError}</Alert>}
        {largeData && (
          <Alert>
            {state.inputData!.uploaded.length.toLocaleString()}点のデータを読み込みました。計算には全点を使い、グラフ表示だけを最大
            {DISPLAY_POINT_LIMIT.toLocaleString()}点に間引いています。
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".csv,text/csv"
            aria-label="CSVファイル"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button type="button" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="size-4" /> CSVを選択
          </Button>
          <span className="text-sm text-slate-600">{state.fileName ?? "ファイル未選択"}</span>
          {state.table && <span className="text-xs text-slate-500">{state.table.rows.length.toLocaleString()}行</span>}
        </div>

        {state.table && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="strain-column">ひずみ列</Label>
                <Select
                  id="strain-column"
                  value={state.mapping.strainColumn}
                  onChange={(event) => state.updateMapping({ strainColumn: event.target.value })}
                >
                  {state.table.columns.map((column) => (
                    <option key={column}>{column}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stress-column">応力列</Label>
                <Select
                  id="stress-column"
                  value={state.mapping.stressColumn}
                  onChange={(event) => state.updateMapping({ stressColumn: event.target.value })}
                >
                  {state.table.columns.map((column) => (
                    <option key={column}>{column}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data-kind">入力形式</Label>
                <Select
                  id="data-kind"
                  value={state.mapping.dataKind}
                  onChange={(event) =>
                    state.updateMapping({ dataKind: event.target.value as typeof state.mapping.dataKind })
                  }
                >
                  <option value="engineering">公称応力・公称ひずみ</option>
                  <option value="true-total">真応力・真全ひずみ</option>
                  <option value="true-plastic">真応力・真塑性ひずみ</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="strain-unit">ひずみ単位</Label>
                <Select
                  id="strain-unit"
                  value={state.mapping.strainUnit}
                  onChange={(event) =>
                    state.updateMapping({ strainUnit: event.target.value as typeof state.mapping.strainUnit })
                  }
                >
                  <option value="decimal">小数 [-]</option>
                  <option value="percent">パーセント [%]</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stress-unit">応力単位</Label>
                <Select
                  id="stress-unit"
                  value={state.mapping.stressUnit}
                  onChange={(event) =>
                    state.updateMapping({ stressUnit: event.target.value as typeof state.mapping.stressUnit })
                  }
                >
                  <option value="Pa">Pa</option>
                  <option value="MPa">MPa</option>
                  <option value="GPa">GPa</option>
                </Select>
              </div>
            </div>
          </>
        )}

        {state.inputData && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">入力曲線</h3>
            <CurveChart
              series={originalSeries}
              xLabel="ひずみ [-]"
              yLabel="応力 [MPa]"
            />
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {state.mapping.dataKind === "engineering"
                ? "引張強度点は公称応力が最大となる試験点です。真応力側の対応点は、同じ試験点を公称値から真値へ変換した位置を示します。"
                : state.mapping.dataKind === "true-total"
                  ? "一様変形を仮定して工学値へ逆変換し、工学応力最大点をネッキング開始候補として扱います。"
                  : "先頭点の真塑性ひずみは0である必要があります。比例限度と0.2%耐力の自動算出は行いません。"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
