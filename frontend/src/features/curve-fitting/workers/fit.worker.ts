/// <reference lib="webworker" />

import { fitHardeningModel } from "@/features/curve-fitting/lib/fitting";
import type { CurvePoint, HardeningModel } from "@/features/curve-fitting/types/curve-fitting";

export interface FitWorkerRequest {
  id: string;
  points: CurvePoint[];
  model: HardeningModel;
  initialStress: number;
  range: [number, number];
  connectionStrain: number;
  youngsModulus: number;
  usesConsidereTarget: boolean;
}

self.onmessage = (event: MessageEvent<FitWorkerRequest>) => {
  const {
    id,
    points,
    model,
    initialStress,
    range,
    connectionStrain,
    youngsModulus,
    usesConsidereTarget,
  } = event.data;
  try {
    self.postMessage({
      id,
      result: fitHardeningModel(
        points,
        model,
        initialStress,
        range,
        connectionStrain,
        youngsModulus,
        usesConsidereTarget,
      ),
    });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
