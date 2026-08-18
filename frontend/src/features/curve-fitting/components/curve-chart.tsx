"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  ToolboxComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { DISPLAY_POINT_LIMIT } from "@/features/curve-fitting/constants/curve-fitting";
import { decimateLttb } from "@/features/curve-fitting/lib/decimation";
import type { CurvePoint } from "@/features/curve-fitting/types/curve-fitting";

echarts.use([
  LineChart,
  ScatterChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  ToolboxComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export interface CurveSeries {
  name: string;
  points: CurvePoint[];
  color: string;
  dashed?: boolean;
  pointsOnly?: boolean;
}

interface CurveChartProps {
  series: CurveSeries[];
  xLabel: string;
  yLabel?: string;
  fitRange?: [number, number];
  onFitRangeChange?: (range: [number, number]) => void;
}

export function CurveChart({
  series,
  xLabel,
  yLabel = "真応力 [MPa]",
  fitRange,
  onFitRangeChange,
}: CurveChartProps) {
  const displaySeries = useMemo(
    () => series.map((item) => ({ ...item, points: decimateLttb(item.points, DISPLAY_POINT_LIMIT) })),
    [series],
  );
  const option = useMemo<EChartsOption>(
    () => ({
      animation: false,
      aria: { enabled: true },
      color: displaySeries.map((item) => item.color),
      tooltip: { trigger: "axis", valueFormatter: (value) => Number(value).toPrecision(6) },
      legend: { top: 2, type: "scroll" },
      toolbox: { right: 8, feature: { dataZoom: {}, restore: {}, saveAsImage: {} } },
      grid: { left: 70, right: 28, top: 52, bottom: fitRange ? 72 : 48 },
      xAxis: { type: "value", name: xLabel, nameLocation: "middle", nameGap: 30, scale: true },
      yAxis: { type: "value", name: yLabel, nameLocation: "middle", nameGap: 52, scale: true },
      dataZoom: fitRange
        ? [
            { type: "inside", xAxisIndex: 0, filterMode: "none" },
            {
              type: "slider",
              xAxisIndex: 0,
              filterMode: "none",
              startValue: fitRange[0],
              endValue: fitRange[1],
              bottom: 8,
            },
          ]
        : [{ type: "inside", xAxisIndex: 0, filterMode: "none" }],
      series: displaySeries.map((item, index) => ({
        name: item.name,
        type: item.pointsOnly ? "scatter" : "line",
        data: item.points.map((point) => [point.strain, point.stress]),
        showSymbol: item.pointsOnly || item.points.length < 500,
        symbolSize: item.pointsOnly ? 5 : 3,
        lineStyle: item.pointsOnly ? undefined : { width: 2, type: item.dashed ? "dashed" : "solid" },
        itemStyle: { color: item.color },
        sampling: "lttb",
        progressive: 2_000,
        markArea:
          index === 0 && fitRange
            ? {
                silent: true,
                itemStyle: { color: "rgba(8, 145, 178, 0.08)" },
                data: [[{ xAxis: fitRange[0] }, { xAxis: fitRange[1] }]],
              }
            : undefined,
      })),
    }),
    [displaySeries, fitRange, xLabel, yLabel],
  );

  const onEvents = useMemo(
    () => ({
      datazoom: (event: { startValue?: number; endValue?: number; batch?: { startValue?: number; endValue?: number }[] }) => {
        if (!onFitRangeChange) return;
        const payload = event.batch?.[0] ?? event;
        if (typeof payload.startValue === "number" && typeof payload.endValue === "number") {
          onFitRangeChange([payload.startValue, payload.endValue]);
        }
      },
    }),
    [onFitRangeChange],
  );

  return <ReactEChartsCore echarts={echarts} option={option} onEvents={onEvents} style={{ height: 360 }} notMerge />;
}
