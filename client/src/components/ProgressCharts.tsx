import { useEffect, useState } from "react";

import {
  ApiRequestError,
  type ProgressEntriesResponse,
  type WorkoutCompletionsResponse,
} from "../api/client";

type ProgressChartsProps = {
  getProgress: (signal?: AbortSignal) => Promise<ProgressEntriesResponse>;
  getCompletions: (signal?: AbortSignal) => Promise<WorkoutCompletionsResponse>;
  refreshKey?: number;
};

type WeightPoint = { date: Date; weightKg: number };
type CompletionBucket = { week: Date; count: number };

function getDailyWeightPoints(entries: ProgressEntriesResponse["entries"]): WeightPoint[] {
  const byDay = new Map<string, WeightPoint>();

  for (const entry of entries) {
    const point = { date: new Date(entry.recordedAt), weightKg: entry.weightKg };
    const key = point.date.toISOString().slice(0, 10);
    const existing = byDay.get(key);

    if (!existing || point.date.getTime() > existing.date.getTime()) {
      byDay.set(key, point);
    }
  }

  return [...byDay.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  const weekday = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - weekday);
  return date;
}

function getCompletionBuckets(completedAt: string[]): CompletionBucket[] {
  const counts = new Map<string, { week: Date; count: number }>();
  for (const timestamp of completedAt) {
    const week = startOfWeek(new Date(timestamp));
    const key = week.toISOString();
    const bucket = counts.get(key) ?? { week, count: 0 };
    bucket.count += 1;
    counts.set(key, bucket);
  }

  return [...counts.values()]
    .sort((left, right) => left.week.getTime() - right.week.getTime());
}

function ChartFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6" aria-labelledby={`${title}-heading`}>
      <h3 className="text-lg font-semibold" id={`${title}-heading`}>{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      {children}
    </section>
  );
}

function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length === 0) {
    return <ChartFrame title="Weight over time" description="Record a weight measurement to start this chart."><EmptyChart message="No weight measurements yet." /></ChartFrame>;
  }
  if (points.length === 1) {
    return <ChartFrame title="Weight over time" description="Weight in kilograms by recorded date."><EmptyChart message="Record one more weight measurement to see a trend." /></ChartFrame>;
  }

  const weights = points.map((point) => point.weightKg);
  const minimum = Math.floor(Math.min(...weights) - 1);
  const maximum = Math.ceil(Math.max(...weights) + 1);
  const span = Math.max(maximum - minimum, 1);
  const width = 640;
  const height = 280;
  const padding = { top: 20, right: 20, bottom: 45, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const line = points.map((point, index) => {
    const x = padding.left + (index / (points.length - 1)) * plotWidth;
    const y = padding.top + ((maximum - point.weightKg) / span) * plotHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <ChartFrame title="Weight over time" description="Weight in kilograms by recorded date.">
      <svg className="mt-5 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="weight-chart-title weight-chart-description">
        <title id="weight-chart-title">Weight over time</title>
        <desc id="weight-chart-description">A line chart of weight in kilograms from {formatDate(points[0]!.date)} to {formatDate(points[points.length - 1]!.date)}.</desc>
        {[minimum, (minimum + maximum) / 2, maximum].map((value) => {
          const y = padding.top + ((maximum - value) / span) * plotHeight;
          return <g key={value}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#334155" /><text x={padding.left - 8} y={y + 4} fill="#94a3b8" fontSize="11" textAnchor="end">{value} kg</text></g>;
        })}
        <polyline fill="none" points={line} stroke="#34d399" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => {
          const x = padding.left + (index / (points.length - 1)) * plotWidth;
          const y = padding.top + ((maximum - point.weightKg) / span) * plotHeight;
          return <g key={point.date.toISOString()}><circle cx={x} cy={y} fill="#a7f3d0" r="4"><title>{`${formatDate(point.date)}: ${point.weightKg} kg`}</title></circle>{(index === 0 || index === points.length - 1) && <text x={x} y={height - 16} fill="#94a3b8" fontSize="11" textAnchor={index === 0 ? "start" : "end"}>{formatDate(point.date)}</text>}</g>;
        })}
      </svg>
      <ChartTable headings={["Date", "Weight"]} rows={points.map((point) => [formatDate(point.date), `${point.weightKg} kg`])} />
    </ChartFrame>
  );
}

function CompletionChart({ buckets }: { buckets: CompletionBucket[] }) {
  if (buckets.length === 0) {
    return <ChartFrame title="Workout completion over time" description="Completed workout days by calendar week."><EmptyChart message="Complete a workout day to start this chart." /></ChartFrame>;
  }
  const width = 640;
  const height = 280;
  const padding = { top: 20, right: 20, bottom: 52, left: 45 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slotWidth = plotWidth / buckets.length;
  const barWidth = Math.min(42, slotWidth * 0.65);
  const maximumCount = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <ChartFrame title="Workout completion over time" description="Completed workout days by calendar week.">
      <svg className="mt-5 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="completion-chart-title completion-chart-description">
        <title id="completion-chart-title">Workout completion over time</title>
        <desc id="completion-chart-description">A bar chart showing completed workout days for each calendar week.</desc>
        {[0, maximumCount].map((value) => {
          const y = padding.top + ((maximumCount - value) / maximumCount) * plotHeight;
          return <g key={value}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#334155" /><text x={padding.left - 8} y={y + 4} fill="#94a3b8" fontSize="11" textAnchor="end">{value}</text></g>;
        })}
        {buckets.map((bucket, index) => {
          const heightOfBar = (bucket.count / maximumCount) * plotHeight;
          const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
          const y = padding.top + plotHeight - heightOfBar;
          return <g key={bucket.week.toISOString()}><rect x={x} y={y} width={barWidth} height={heightOfBar} rx="4" fill="#34d399"><title>{`Week of ${formatDate(bucket.week)}: ${bucket.count} completed workout days`}</title></rect><text x={x + barWidth / 2} y={height - 18} fill="#94a3b8" fontSize="11" textAnchor="middle">{formatDate(bucket.week)}</text></g>;
        })}
      </svg>
      <ChartTable headings={["Week of", "Completed days"]} rows={buckets.map((bucket) => [formatDate(bucket.week), String(bucket.count)])} />
    </ChartFrame>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <p className="mt-6 rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">{message}</p>;
}

function ChartTable({ headings, rows }: { headings: string[]; rows: string[][] }) {
  return <table className="sr-only"><caption>Chart data</caption><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table>;
}

export function ProgressCharts({ getProgress, getCompletions, refreshKey = 0 }: ProgressChartsProps) {
  const [weightPoints, setWeightPoints] = useState<WeightPoint[] | null>(null);
  const [completionBuckets, setCompletionBuckets] = useState<CompletionBucket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([getProgress(controller.signal), getCompletions(controller.signal)])
      .then(([progress, completions]) => {
        setWeightPoints(getDailyWeightPoints(progress.entries));
        setCompletionBuckets(getCompletionBuckets(completions.completions.map((completion) => completion.completedAt)));
      })
      .catch((requestError: unknown) => {
        // React development mode deliberately aborts an initial effect while
        // checking cleanup behavior. That is not a chart-data failure.
        if (controller.signal.aborted) return;
        setError(requestError instanceof ApiRequestError ? requestError.message : "We could not load chart data.");
      });
    return () => controller.abort();
  }, [getCompletions, getProgress, refreshKey]);

  if (error) return <p className="mt-8 text-sm text-rose-300" role="alert">{error}</p>;
  if (!weightPoints || !completionBuckets) return <p className="mt-8 text-slate-300" aria-live="polite">Loading progress charts…</p>;

  return <div className="mt-8 grid gap-6 lg:grid-cols-2"><WeightChart points={weightPoints} /><CompletionChart buckets={completionBuckets} /></div>;
}
