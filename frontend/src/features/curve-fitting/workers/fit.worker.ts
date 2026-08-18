/// <reference lib="webworker" />

import { fitHardeningModel } from "@/features/curve-fitting/lib/fitting";
import type { CurvePoint, HardeningModel } from "@/features/curve-fitting/types/curve-fitting";

export interface FitWorkerRequest {
  id: string;
  points: CurvePoint[];
  model: HardeningModel;
  yieldStress: number;
  range: [number, number];
}

self.onmessage = (event: MessageEvent<FitWorkerRequest>) => {
  const { id, points, model, yieldStress, range } = event.data;
  try {
    self.postMessage({ id, result: fitHardeningModel(points, model, yieldStress, range) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
