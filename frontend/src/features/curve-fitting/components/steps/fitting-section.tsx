"use client";

import { RotateCcw, WandSparkles } from "lucide-react";

import { CurveChart } from "@/features/curve-fitting/components/curve-chart";
import {
  CURVE_COLORS,
  HARDENING_MODEL_LABELS,
  HARDENING_MODELS,
} from "@/features/curve-fitting/constants/curve-fitting";
import { useFittingStep } from "@/features/curve-fitting/hooks/use-fitting-step";
import { deriveSwiftK } from "@/features/curve-fitting/lib/models";
import type { HardeningModel, ModelParameters } from "@/features/curve-fitting/types/curve-fitting";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { NumberField } from "@/shared/components/ui/number-field";

const PARAMETER_FIELDS: Record<
  HardeningModel,
  { key: keyof ModelParameters; label: string; min: number; step: number; description: string }[]
> = {
  ludwik: [
    { key: "K", label: "K [MPa]", min: 0, step: 1, description: "加工硬化の強さを表す強度係数です。" },
    {
      key: "n",
      label: "n",
      min: 0.001,
      step: 0.001,
      description: "塑性ひずみに対する応力増加の度合いを表す加工硬化指数です。",
    },
  ],
  swift: [
    {
      key: "epsilon0",
      label: "ε₀",
      min: 1e-7,
      step: 0.0001,
      description:
        "加工硬化挙動を表す塑性ひずみオフセット（等価的・仮想的な予ひずみ）です。比例限度ひずみやσ0/Eとは別物です。",
    },
    {
      key: "n",
      label: "n",
      min: 0.001,
      step: 0.001,
      description: "塑性ひずみに対する応力増加の度合いを表す加工硬化指数です。",
    },
  ],
  voce: [
    {
      key: "Q",
      label: "Q [MPa]",
      min: 0,
      step: 1,
      description: "比例限度応力から基底式の飽和応力までの応力増分です。",
    },
    {
      key: "b",
      label: "b",
      min: 0.001,
      step: 0.1,
      description: "飽和応力へ近づく速さを決める無次元の係数です。",
    },
  ],
};

const MODEL_DETAILS: Record<HardeningModel, { formula: string; description: string }> = {
  ludwik: {
    formula: "f(εₚ) = σ₀ + K εₚⁿ",
    description: "σ₀は比例限度応力です。接続後は σ=σⱼ+f(εₚ)−f(εⱼ) を使用します。",
  },
  swift: {
    formula: "f(εₚ) = K(ε₀ + εₚ)ⁿ = σ₀(1 + εₚ / ε₀)ⁿ",
    description:
      "ε₀は等価的な予ひずみです。f(0)=σ₀からKを算出し、接続後は差分で連続化します。",
  },
  voce: {
    formula: "f(εₚ) = σ₀ + Q[1 − exp(−bεₚ)]",
    description: "Qは飽和までの応力増分、bは飽和速度です。接続後は差分で連続化します。",
  },
};

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toPrecision(5) : "—";
}

export function FittingSection() {
  const { state, fittedSeries, fitRangeError } = useFittingStep();

  if (!state.prepared || !state.proportionalLimitConfirmed) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. 硬化則のフィッティング</CardTitle>
        <CardDescription>
          フィッティング始点からフィッティング終点までで硬化則を同定し、フィッティング終点までは実測、以降は接続補正後の硬化則を使用します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-slate-800">硬化則（複数選択可）</legend>
            <div className="flex h-10 items-center gap-4 rounded-md border border-slate-300 bg-white px-3">
              {HARDENING_MODELS.map((model) => (
                <label key={model} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.selectedModels.includes(model)}
                    disabled={state.busy}
                    onChange={() => state.toggleModel(model)}
                    className="size-4 accent-cyan-700"
                  />
                  {HARDENING_MODEL_LABELS[model]}
                </label>
              ))}
            </div>
          </fieldset>
          <NumberField
            id="fit-start"
            label="フィッティング始点"
            value={state.fitRange[0]}
            min={0}
            step={0.001}
            disabled={state.busy}
            onChange={(value) => state.setFitRange([value, state.fitRange[1]])}
          />
          <div>
            <NumberField
              id="fit-end"
              label="フィッティング終点"
              value={state.fitRange[1]}
              min={0}
              step={0.001}
              disabled={state.busy}
              description="既定値は工学応力最大点です。ここまでは実測を保持し、以降を硬化則へ接続します。"
              onChange={(value) => state.setFitRange([state.fitRange[0], value])}
            />
            <Button
              className="mt-2 w-full"
              variant="ghost"
              size="sm"
              disabled={state.busy}
              onClick={state.resetFitEnd}
            >
              <RotateCcw className="size-3.5" /> 推奨フィッティング終点に戻す
            </Button>
          </div>
          <div className="flex items-end pb-10">
            <Button
              className="w-full"
              disabled={state.busy || Boolean(fitRangeError)}
              onClick={() => void state.runFits()}
            >
              <WandSparkles className="size-4" /> {state.busy ? "計算中…" : "選択した硬化則をフィット"}
            </Button>
          </div>
        </div>

        {fitRangeError && <p className="text-sm text-red-700">{fitRangeError}</p>}

        <CurveChart
          series={fittedSeries}
          xLabel="真塑性ひずみ [-]"
          fitRange={state.fitRange}
        />

        <div className="grid gap-4 xl:grid-cols-3">
          {state.selectedModels.map((model) => {
            const fit = state.fits[model];
            return (
              <section key={model} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-sm"
                    style={{ backgroundColor: CURVE_COLORS[model] }}
                  />
                  <h3 className="font-semibold">{HARDENING_MODEL_LABELS[model]}</h3>
                </div>
                <p className="mt-3 font-mono text-sm font-semibold text-slate-950">
                  {MODEL_DETAILS[model].formula}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{MODEL_DETAILS[model].description}</p>

                {fit ? (
                  <>
                    <div className="mt-4 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">パラメータ調整</h4>
                      <Button variant="ghost" size="sm" onClick={() => state.resetParameters(model)}>
                        <RotateCcw className="size-3.5" /> 自動値に戻す
                      </Button>
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {PARAMETER_FIELDS[model].map((field) => (
                        <NumberField
                          key={field.key}
                          id={`parameter-${model}-${field.key}`}
                          label={field.label}
                          value={fit.parameters[field.key] ?? 0}
                          min={field.min}
                          step={field.step}
                          description={field.description}
                          onChange={(value) => state.updateParameter(model, field.key, value)}
                        />
                      ))}
                    </div>
                    {model === "swift" && (
                      <p className="mt-3 text-xs text-slate-600">
                        拘束条件 f(0)=σ₀ より、K ={" "}
                        {formatMetric(deriveSwiftK(state.prepared!.proportionalLimit.stress, fit.parameters))} MPa
                      </p>
                    )}
                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
                      <p>接続応力: {formatMetric(fit.connection.stress)} MPa</p>
                      <p>左接線係数: {formatMetric(fit.diagnostics.leftTangent)} MPa</p>
                      <p>右接線係数: {formatMetric(fit.diagnostics.rightTangent)} MPa</p>
                      {fit.diagnostics.exportBlocked && (
                        <p className="mt-1 font-semibold text-red-700">接続部が非物理的なためエクスポートできません。</p>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {[
                        ["RMSE [MPa]", fit.metrics.rmse],
                        ["正規化RMSE", fit.metrics.normalizedRmse],
                        ["R²", fit.metrics.rSquared],
                        ["最大絶対誤差 [MPa]", fit.metrics.maxAbsoluteError],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-md border border-slate-200 bg-white p-2">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="mt-1 font-mono text-sm font-semibold">{formatMetric(Number(value))}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-xs text-slate-500">フィッティング実行後にパラメータと結果を表示します。</p>
                )}
              </section>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
