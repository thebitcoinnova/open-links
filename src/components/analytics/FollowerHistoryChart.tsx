import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { createEffect, createMemo, onCleanup, onMount } from "solid-js";
import {
  type FollowerHistoryAudienceKind,
  type FollowerHistoryMode,
  type FollowerHistoryRange,
  type FollowerHistoryRow,
  buildFollowerHistoryPoints,
  filterFollowerHistoryRows,
} from "../../lib/analytics/follower-history";

echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);

export interface FollowerHistoryChartProps {
  audienceKind: FollowerHistoryAudienceKind;
  height?: number;
  mode: FollowerHistoryMode;
  range: FollowerHistoryRange;
  rows: FollowerHistoryRow[];
  themeFingerprint: string;
}

const readCssVariable = (name: string, fallback: string): string => {
  if (typeof document === "undefined") {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
};

const resolveYAxisLabel = (
  audienceKind: FollowerHistoryAudienceKind,
  mode: FollowerHistoryMode,
): string => {
  if (mode === "growth") {
    return audienceKind === "subscribers" ? "Subscriber change" : "Follower change";
  }

  return audienceKind === "subscribers" ? "Subscribers" : "Followers";
};

export const FollowerHistoryChart = (props: FollowerHistoryChartProps) => {
  let chartElement!: HTMLDivElement;
  let chart: ECharts | undefined;
  let resizeObserver: ResizeObserver | undefined;

  const filteredRows = createMemo(() => filterFollowerHistoryRows(props.rows, props.range));
  const points = createMemo(() => buildFollowerHistoryPoints(filteredRows(), props.mode));

  const option = createMemo<EChartsCoreOption>(() => {
    const accent = readCssVariable("--accent", "#2c4f7c");
    const accentStrong = readCssVariable("--accent-strong", accent);
    const border = readCssVariable("--border-subtle", "rgba(120, 132, 156, 0.35)");
    const textMuted = readCssVariable("--text-muted", "#7f8c9d");

    return {
      animation: false,
      grid: {
        left: 40,
        right: 18,
        top: 18,
        bottom: 34,
      },
      tooltip: {
        trigger: "axis",
        confine: true,
        formatter: (seriesItems: unknown) => {
          const item = Array.isArray(seriesItems)
            ? (seriesItems[0] as { dataIndex?: number } | undefined)
            : (seriesItems as { dataIndex?: number } | undefined);
          const point = points()[item?.dataIndex ?? -1];
          if (!point) {
            return "";
          }

          const formattedDate = new Date(point.observedAt).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const valueText =
            props.mode === "growth"
              ? `${point.delta >= 0 ? "+" : ""}${point.delta.toLocaleString("en-US")}`
              : point.audienceCountRaw;

          return `${formattedDate}<br/>${valueText}`;
        },
      },
      xAxis: {
        axisLabel: {
          color: textMuted,
        },
        axisLine: {
          lineStyle: {
            color: border,
          },
        },
        splitLine: {
          show: false,
        },
        type: "time",
      },
      yAxis: {
        axisLabel: {
          color: textMuted,
        },
        name: resolveYAxisLabel(props.audienceKind, props.mode),
        nameGap: 20,
        nameTextStyle: {
          color: textMuted,
        },
        splitLine: {
          lineStyle: {
            color: border,
          },
        },
        type: "value",
      },
      series: [
        {
          areaStyle:
            props.mode === "raw"
              ? {
                  color: accent,
                  opacity: 0.08,
                }
              : undefined,
          connectNulls: true,
          data: points().map((point) => [point.timestamp, point.value]),
          lineStyle: {
            color: accentStrong,
            width: 2.5,
          },
          showSymbol: false,
          smooth: 0.2,
          type: "line",
        },
      ],
    };
  });

  onMount(() => {
    chart = echarts.init(chartElement, undefined, {
      renderer: "svg",
    });

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => chart?.resize());
      resizeObserver.observe(chartElement);
    } else if (typeof window !== "undefined") {
      const handleResize = () => chart?.resize();
      window.addEventListener("resize", handleResize);
      onCleanup(() => window.removeEventListener("resize", handleResize));
    }
  });

  createEffect(() => {
    if (!chart) {
      return;
    }

    if (filteredRows().length === 0) {
      chart.clear();
      return;
    }

    props.themeFingerprint;
    chart.setOption(option(), true);
    chart.resize();
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    chart?.dispose();
  });

  return (
    <div class="follower-history-chart">
      <div
        aria-hidden={filteredRows().length === 0 ? "true" : undefined}
        hidden={filteredRows().length === 0}
        ref={chartElement}
        style={{ height: `${props.height ?? 280}px`, width: "100%" }}
      />
      {filteredRows().length === 0 ? (
        <p class="analytics-empty-state">No history in this range yet.</p>
      ) : null}
    </div>
  );
};

export default FollowerHistoryChart;
