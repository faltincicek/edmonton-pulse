import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import type { TrendRow, SeasonalRow } from "@/pages/Dashboard";
import { TrendingUp } from "lucide-react";

const MONTH_ABBR = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Year colors — civic palette
const YEAR_COLORS: Record<string, string> = {
  "2023": "#94a3b8",
  "2024": "#60a5fa",
  "2025": "#2563eb",
  "2026": "#f59e0b",
};

type ChartRow = { month: string; [year: string]: string | number };

// Simple linear regression
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function TrendChart({
  data,
  categoryLabel,
  seasonalData,
  summaryData,
}: {
  data: TrendRow[];
  categoryLabel: string;
  seasonalData: SeasonalRow[];
  summaryData?: { currentYear: number; currentMonth: number; dayOfMonth: number; daysInMonth: number } | null;
}) {
  const years = useMemo(
    () => [...new Set(data.map((r) => r.year))].sort(),
    [data]
  );

  // Build month-indexed chart data
  const chartData = useMemo<ChartRow[]>(() => {
    const rows: ChartRow[] = MONTH_ABBR.slice(1).map((m) => ({ month: m }));
    for (const row of data) {
      const mIdx = Number(row.month_number) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        rows[mIdx][row.year] = Number(row.cnt);
      }
    }
    for (const s of seasonalData) {
      const mIdx = Number(s.month_number) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        rows[mIdx]["avg"] = Math.round(Number(s.avg_cnt));
      }
    }
    return rows;
  }, [data, seasonalData]);

  // Trend direction for most recent full year (excl current year if few months)
  const trendInsight = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const prevYear = String(Number(currentYear) - 1);
    const prevData = data.filter((r) => r.year === prevYear);
    if (prevData.length < 6) return null;
    const points = prevData.map((r, i) => ({ x: i, y: Number(r.cnt) }));
    const { slope } = linearRegression(points);
    const total = prevData.reduce((a, r) => a + Number(r.cnt), 0);
    const direction = slope > 10 ? "increasing" : slope < -10 ? "decreasing" : "stable";
    return { direction, total, year: prevYear };
  }, [data]);

  const latestYear = useMemo(
    () => (years.length > 0 ? years[years.length - 1] : ""),
    [years]
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Monthly Trends by Year</span>
        </div>
        {trendInsight && (
          <div className="text-xs text-muted-foreground hidden md:block">
            {trendInsight.year}: {trendInsight.direction} trend ·{" "}
            {trendInsight.total.toLocaleString()} total
          </div>
        )}
      </div>
      <div className="px-2 pt-3 pb-1">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: 12,
                fontFamily: "Satoshi, sans-serif",
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              formatter={(value: number, name: string) => [
                value?.toLocaleString() ?? "—",
                name === "avg" ? "Historical avg" : name,
              ]}
            />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                  {value === "avg" ? "Hist. avg" : value}
                </span>
              )}
            />
            {/* Historical average dashed */}
            {seasonalData.length > 0 && (
              <Line
                type="monotone"
                dataKey="avg"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                name="avg"
              />
            )}
            {/* Year lines */}
            {years.map((year) => (
              <Line
                key={year}
                type="monotone"
                dataKey={year}
                stroke={YEAR_COLORS[year] || "#999"}
                strokeWidth={year === latestYear ? 2.5 : 1.5}
                dot={year === latestYear}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground px-4 pb-2.5">
        Dashed line = historical monthly average across all years.
        {summaryData && ` Note: ${new Date(0, summaryData.currentMonth - 1).toLocaleString('default', { month: 'long' })} ${summaryData.currentYear} only includes the first ${summaryData.dayOfMonth} of ${summaryData.daysInMonth} days — it will naturally look lower.`}
      </p>
    </div>
  );
}
