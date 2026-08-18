"use client";

import { RotateCcw, WandSparkles } from "lucide-react";

import { CurveChart } from "@/features/curve-fitting/components/curve-chart";
import { MODEL_LABELS, useFittingStep } from "@/features/curve-fitting/hooks/use-fitting-step";
import { deriveSwiftK } from "@/features/curve-fitting/lib/models";
import type { HardeningModel, ModelParameters } from "@/features/curve-fitting/types/curve-fitting";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { NumberField } from "@/shared/components/ui/number-field";
import { Select } from "@/shared/components/ui/select";

const PARAMETER_FIELDS: Record<
  HardeningModel,
  { key: keyof ModelParameters; label: string; min: number; step: number }[]
> = {
  ludwik: [
    { key: "K", label: "K [MPa]", min: 0, step: 1 },
    { key: "n", label: "n", min: 0.001, step: 0.001 },
  ],
  swift: [
    { key: "epsilon0", label: "ε₀", min: 1e-7, step: 0.0001 },
    { key: "n", label: "n", min: 0.001, step: 0.001 },
  ],
  voce: [
    { key: "Q", label: "Q [MPa]", min: 0, step: 1 },
    { key: "b", label: "b", min: 0.001, step: 0.1 },
  ],
};

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toPrecision(5) : "—";
}

export function FittingSection() {
  const { state, fittedSeries } = useFittingStep();

  if (!state.prepared) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. 硬化則のフィッティング</CardTitle>
        <CardDescription>
          数値欄またはグラフ下部のハンドルで対象範囲を調整し、自動計算後にパラメータを微調整できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="model">硬化則</Label>
            <Select
              id="model"
              value={state.model}
              onChange={(event) => state.setModel(event.target.value as HardeningModel)}
            >
              {Object.entries(MODEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <NumberField
            id="fit-start"
            label="開始塑性ひずみ"
            value={state.fitRange[0]}
            min={0}
            onChange={(value) => state.setFitRange([Math.min(value, state.fitRange[1]), state.fitRange[1]])}
          />
          <NumberField
            id="fit-end"
            label="終了塑性ひずみ"
            value={state.fitRange[1]}
            min={0}
            onChange={(value) => state.setFitRange([state.fitRange[0], Math.max(value, state.fitRange[0])])}
          />
          <div className="flex items-end">
            <Button className="w-full" disabled={state.busy} onClick={() => void state.runFit()}>
              <WandSparkles className="size-4" /> {state.busy ? "計算中…" : "自動フィッティング"}
            </Button>
          </div>
        </div>

        <CurveChart
          series={fittedSeries}
          xLabel="真塑性ひずみ [-]"
          fitRange={state.fitRange}
          onFitRangeChange={state.setFitRange}
        />

        {state.fit && (
          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">パラメータ調整</h3>
                <Button variant="ghost" size="sm" onClick={state.resetParameters}>
                  <RotateCcw className="size-3.5" />自動値に戻す
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {PARAMETER_FIELDS[state.model].map((field) => (
                  <NumberField
                    key={field.key}
                    id={`parameter-${field.key}`}
                    label={field.label}
                    value={state.fit!.parameters[field.key] ?? 0}
                    min={field.min}
                    step={field.step}
                    onChange={(value) => state.updateParameter(field.key, value)}
                  />
                ))}
              </div>
              {state.model === "swift" && (
                <p className="mt-3 text-xs text-slate-600">
                  拘束条件 σ(0)=σy より、K ={" "}
                  {formatMetric(deriveSwiftK(state.material.yieldStress, state.fit.parameters))} MPa
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["RMSE [MPa]", state.fit.metrics.rmse],
                ["正規化RMSE", state.fit.metrics.normalizedRmse],
                ["R²", state.fit.metrics.rSquared],
                ["最大絶対誤差 [MPa]", state.fit.metrics.maxAbsoluteError],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{formatMetric(Number(value))}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
