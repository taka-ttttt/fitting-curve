"use client";

import { Check, Clipboard, Download } from "lucide-react";

import { CurveChart } from "@/features/curve-fitting/components/curve-chart";
import { useExportStep, type ExportFormValues } from "@/features/curve-fitting/hooks/use-export-step";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toPrecision(5) : "—";
}

export function ExportSection() {
  const { copied, exportForm, state, exportSeries, handleExport, downloadCsv, copyLsdyna } = useExportStep();

  if (!state.fit) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. エクスポート</CardTitle>
        <CardDescription>
          降伏点付近を密にした非等間隔点を生成し、有効数字6桁に丸めます。LS-DYNAではLCINT=1001の内部再分割をプレビューします。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={exportForm.handleSubmit(handleExport)}>
          {[
            {
              name: "maximumPlasticStrain",
              id: "export-max",
              label: "出力最大塑性ひずみ",
              min: 0,
              step: "any",
            },
            { name: "pointCount", id: "export-count", label: "出力点数（20以上）", min: 20, step: 1 },
            { name: "lcid", id: "lcid", label: "LCID", min: 1, step: 1 },
          ].map((field) => {
            const name = field.name as keyof ExportFormValues;
            return (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  type="number"
                  min={field.min}
                  step={field.step}
                  aria-invalid={Boolean(exportForm.formState.errors[name])}
                  {...exportForm.register(name, { valueAsNumber: true })}
                />
                {exportForm.formState.errors[name] && (
                  <p className="text-xs text-red-700">{exportForm.formState.errors[name]?.message}</p>
                )}
              </div>
            );
          })}
          <div className="flex items-end">
            <Button className="w-full" type="submit">
              出力データを生成
            </Button>
          </div>
        </form>

        {state.exportResult && (
          <>
            <CurveChart series={exportSeries} xLabel="真塑性ひずみ [-]" />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-100 p-3 text-sm">
                <span className="text-slate-500">出力点数</span>
                <strong className="ml-2">{state.exportResult.points.length}</strong>
              </div>
              <div className="rounded-lg bg-slate-100 p-3 text-sm">
                <span className="text-slate-500">LCINT最大絶対差</span>
                <strong className="ml-2">
                  {formatMetric(state.exportResult.lcintMaxAbsoluteDifference)} MPa
                </strong>
              </div>
              <div className="rounded-lg bg-slate-100 p-3 text-sm">
                <span className="text-slate-500">LCINT最大相対差</span>
                <strong className="ml-2">
                  {formatMetric(state.exportResult.lcintMaxRelativeDifference * 100)}%
                </strong>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={downloadCsv}>
                <Download className="size-4" /> CSVをダウンロード
              </Button>
              <Button variant="outline" onClick={() => void copyLsdyna()}>
                {copied ? <Check className="size-4 text-emerald-600" /> : <Clipboard className="size-4" />}{" "}
                {copied ? "コピーしました" : "DEFINE_CURVEをコピー"}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lsdyna-preview">LS-DYNA *DEFINE_CURVE プレビュー</Label>
              <textarea
                id="lsdyna-preview"
                readOnly
                value={state.exportResult.lsdyna}
                className="h-72 w-full rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
