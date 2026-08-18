"use client";

import { ConversionSection } from "@/features/curve-fitting/components/steps/conversion-section";
import { ExportSection } from "@/features/curve-fitting/components/steps/export-section";
import { FittingSection } from "@/features/curve-fitting/components/steps/fitting-section";
import { ImportSection } from "@/features/curve-fitting/components/steps/import-section";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import { Alert } from "@/shared/components/ui/alert";

export function CurveFittingWorkbench() {
  const error = useCurveWorkflowStore((store) => store.error);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 border-b border-slate-200 pb-6">
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-cyan-700 uppercase">
          CAE material preparation
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Material Curve Fitter
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          比例限度を基準に真応力–真塑性ひずみへ変換し、実測データとLudwik・Swift・Voce硬化則を連続接続します。データはブラウザ内だけで処理されます。
        </p>
      </header>

      {error && <Alert className="mb-5">{error}</Alert>}

      <div className="space-y-6">
        <ImportSection />
        <ConversionSection />
        <FittingSection />
        <ExportSection />
      </div>
    </main>
  );
}
