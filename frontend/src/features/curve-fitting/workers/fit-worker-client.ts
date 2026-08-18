import type { FitResult } from "@/features/curve-fitting/types/curve-fitting";
import type { FitWorkerRequest } from "@/features/curve-fitting/workers/fit.worker";

export function runFitWorker(request: Omit<FitWorkerRequest, "id">): Promise<FitResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./fit.worker.ts", import.meta.url));
    const id = crypto.randomUUID();
    worker.onmessage = (event: MessageEvent<{ id: string; result?: FitResult; error?: string }>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("フィッティング結果を取得できませんでした。"));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "フィッティングワーカーでエラーが発生しました。"));
    };
    worker.postMessage({ ...request, id } satisfies FitWorkerRequest);
  });
}
