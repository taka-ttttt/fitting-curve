"use client";

import { useShallow } from "zustand/react/shallow";

import {
  PROPORTIONAL_LIMIT_CONSECUTIVE_POINTS,
  PROPORTIONAL_LIMIT_PLASTIC_STRAIN_THRESHOLD,
} from "@/features/curve-fitting/constants/curve-fitting";
import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import { Button } from "@/shared/components/ui/button";
import { NumberField } from "@/shared/components/ui/number-field";

export function MaterialPropertiesFields() {
  const state = useCurveWorkflowStore(
    useShallow((store) => ({
      dataKind: store.mapping.dataKind,
      material: store.material,
      updateMaterial: store.updateMaterial,
      convert: store.convert,
    })),
  );
  const isDirectPlastic = state.dataKind === "true-plastic";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {!isDirectPlastic && (
        <NumberField
          id="youngs"
          label="ヤング率 [MPa]"
          value={state.material.youngsModulus}
          min={0}
          description="弾性ひずみの除去、比例限度候補、0.2%耐力の算出に使用します。"
          onChange={(youngsModulus) => state.updateMaterial({ youngsModulus })}
        />
      )}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        {isDirectPlastic
          ? "先頭点 εp=0 の応力を比例限度応力 σ0 として使用します。"
          : `真塑性ひずみ残差が${PROPORTIONAL_LIMIT_PLASTIC_STRAIN_THRESHOLD}以上となる状態を${PROPORTIONAL_LIMIT_CONSECUTIVE_POINTS}点連続で検出します。`}
      </div>
      <div className="flex items-end">
        <Button className="w-full" onClick={state.convert}>
          変換データを作成
        </Button>
      </div>
    </div>
  );
}
