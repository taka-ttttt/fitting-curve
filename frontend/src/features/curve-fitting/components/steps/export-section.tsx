"use client";

import { Check, Clipboard, Download } from "lucide-react";

import { CurveChart } from "@/features/curve-fitting/components/curve-chart";
import { HARDENING_MODEL_LABELS, HARDENING_MODELS } from "@/features/curve-fitting/constants/curve-fitting";
import { useExportStep, type ExportFormValues } from "@/features/curve-fitting/hooks/use-export-step";
import type { HardeningModel } from "@/features/curve-fitting/types/curve-fitting";
import { Alert } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toPrecision(5) : "—";
}

export function ExportSection() {
  const { copied, exportForm, state, exportSeries, handleExport, downloadCsv, copyLsdyna } = useExportStep();

  const fittedModels = HARDENING_MODELS.filter((model) => Boolean(state.fits[model]));
  if (fittedModels.length === 0 || !state.exportModel) return null;
  const selectedFit = state.fits[state.exportModel];

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. エクスポート</CardTitle>
        <CardDescription>
          比例限度付近を密にし、接続点を必ず含む非等間隔点を生成します。接続点までは実測補間、それ以降は接続補正後の硬化則です。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="export-model">エクスポート対象硬化則</Label>
          <Select
            id="export-model"
            value={state.exportModel}
            onChange={(event) => state.setExportModel(event.target.value as HardeningModel)}
          >
            {fittedModels.map((model) => (
              <option key={model} value={model}>
                {HARDENING_MODEL_LABELS[model]}
              </option>
            ))}
          </Select>
        </div>
        {selectedFit && (
          <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
            接続点: 塑性ひずみ {formatMetric(selectedFit.connection.strain)}、真応力 {formatMetric(selectedFit.connection.stress)} MPa
          </div>
        )}
        {selectedFit?.diagnostics.exportBlocked && (
          <Alert>接続点前後の接線係数が非物理的なため、このフィット結果はエクスポートできません。</Alert>
        )}
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
            {selectedFit && state.exportResult.points.at(-1)!.strain > selectedFit.connection.strain && (
              <Alert>接続点より後は、実測値ではなく接続補正した硬化則による外挿値です。</Alert>
            )}
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
