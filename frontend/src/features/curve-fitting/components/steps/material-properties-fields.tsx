"use client";

import { useShallow } from "zustand/react/shallow";

import { useCurveWorkflowStore } from "@/features/curve-fitting/store/curve-workflow-store";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { NumberField } from "@/shared/components/ui/number-field";
import { Select } from "@/shared/components/ui/select";
import type { ConversionMethod } from "@/features/curve-fitting/types/curve-fitting";

export function MaterialPropertiesFields() {
  const state = useCurveWorkflowStore(
    useShallow((store) => ({
      material: store.material,
      conversionMethod: store.conversionMethod,
      updateMaterial: store.updateMaterial,
      setConversionMethod: store.setConversionMethod,
      convert: store.convert,
    })),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="conversion-method">変換基準</Label>
        <Select
          id="conversion-method"
          value={state.conversionMethod}
          onChange={(event) => state.setConversionMethod(event.target.value as ConversionMethod)}
        >
          <option value="specified-yield">指定した降伏応力</option>
          <option value="proof-0.2">ヤング率から0.2%耐力を算出</option>
        </Select>
      </div>
      <NumberField
        id="youngs"
        label="ヤング率 [MPa]"
        value={state.material.youngsModulus}
        min={0}
        description={
          state.conversionMethod === "proof-0.2"
            ? "0.2%オフセット直線 σ=E(ε−0.002) と入力曲線の交点を求めるために使用します。"
            : "グラフ上のヤング率参考線を描くためだけに使用し、変換計算やフィッティングには使用しません。"
        }
        onChange={(youngsModulus) => state.updateMaterial({ youngsModulus })}
      />
      {state.conversionMethod === "specified-yield" && (
        <NumberField
          id="yield"
          label="降伏応力 [MPa]"
          value={state.material.yieldStress}
          min={0}
          description="入力曲線との交点を補間し、真塑性ひずみ0の基準とする応力です。"
          onChange={(yieldStress) => state.updateMaterial({ yieldStress })}
        />
      )}
      <div className="flex items-end">
        <Button className="w-full" onClick={state.convert}>
          変換データを作成
        </Button>
      </div>
    </div>
  );
}
