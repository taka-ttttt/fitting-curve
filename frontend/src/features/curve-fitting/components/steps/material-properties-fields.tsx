"use client";

import { useShallow } from "zustand/react/shallow";

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

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {state.dataKind !== "true-plastic" && (
        <NumberField
          id="youngs"
          label="ヤング率 [MPa]"
          value={state.material.youngsModulus}
          min={0}
          onChange={(youngsModulus) => state.updateMaterial({ youngsModulus })}
        />
      )}
      <NumberField
        id="yield"
        label="降伏応力 [MPa]"
        value={state.material.yieldStress}
        min={0}
        onChange={(yieldStress) => state.updateMaterial({ yieldStress })}
      />
      <div className="flex items-end">
        <Button className="w-full" onClick={state.convert}>
          変換データを作成
        </Button>
      </div>
    </div>
  );
}
