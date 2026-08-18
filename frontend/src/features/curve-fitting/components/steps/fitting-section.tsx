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
        "降伏直後の加工硬化挙動を表す塑性ひずみオフセット（等価的・仮想的な予ひずみ）です。直接測定する単純な物性値ではなく、弾性降伏ひずみ σy/E とは別物なので、降伏応力時のひずみをそのまま入力するパラメータではありません。",
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
      description: "降伏応力から飽和応力までの応力増分です。飽和応力はσy+Qです。",
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
    formula: "σ = σy + K εₚⁿ",
    description: "σyは基準応力、εₚは真塑性ひずみ、Kは強度係数、nは加工硬化指数です。",
  },
  swift: {
    formula: "σ = K(ε₀ + εₚ)ⁿ = σy(1 + εₚ / ε₀)ⁿ",
    description:
      "ε₀は降伏直後の曲率を表す等価的・仮想的な予ひずみであり、弾性降伏ひずみσy/Eではありません。本実装ではσ(0)=σyの拘束からKを算出します。",
  },
  voce: {
    formula: "σ = σy + Q[1 − exp(−bεₚ)]",
    description: "Qは飽和までの応力増分、bは飽和速度、σyは基準応力、εₚは真塑性ひずみです。",
  },
};

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toPrecision(5) : "—";
}

export function FittingSection() {
  const { state, fittedSeries, fitRangeError } = useFittingStep();

  if (!state.prepared) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. 硬化則のフィッティング</CardTitle>
        <CardDescription>
          選択したすべての硬化則を同じ塑性ひずみ範囲で計算し、同じグラフ上で比較します。
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
            label="開始塑性ひずみ"
            value={state.fitRange[0]}
            min={0}
            step={0.01}
            disabled={state.busy}
            onChange={(value) => state.setFitRange([value, state.fitRange[1]])}
          />
          <div>
            <NumberField
              id="fit-end"
              label="終了塑性ひずみ"
              value={state.fitRange[1]}
              min={0}
              step={0.01}
              disabled={state.busy}
              description="引張強度点は公称応力が最大となり、くびれ（ネッキング）が始まる目安です。一様変形範囲を対象にするため、その直前を初期終了値にしています。"
              onChange={(value) => state.setFitRange([state.fitRange[0], value])}
            />
            <Button
              className="mt-2 w-full"
              variant="ghost"
              size="sm"
              disabled={state.busy}
              onClick={state.resetFitEnd}
            >
              <RotateCcw className="size-3.5" /> 初期終了値に戻す
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

        <CurveChart series={fittedSeries} xLabel="真塑性ひずみ [-]" fitRange={state.fitRange} />

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
                        拘束条件 σ(0)=σy より、K ={" "}
                        {formatMetric(deriveSwiftK(state.prepared!.yieldPoint.stress, fit.parameters))} MPa
                      </p>
                    )}
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
