import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import type { TrendRow, NbhdRow } from "@/pages/Dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { X, MapPin, TrendingUp, TrendingDown } from "lucide-react";

const MONTH_ABBR = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Linear regression for trend arrow
function linearRegression(ys: number[]) {
  const n = ys.length;
  if (n < 3) return { slope: 0 };
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return { slope };
}

type ChartRow = { label: string; count: number; year: string };

export default function NeighbourhoodDetail({
  neighbourhood,
  trendData,
  loading,
  categoryLabel,
  allNbhdData,
  onClose,
}: {
  neighbourhood: string;
  trendData: TrendRow[];
  loading: boolean;
  categoryLabel: string;
  allNbhdData: NbhdRow[];
  onClose: () => void;
}) {
  const displayName = neighbourhood
    ? neighbourhood.charAt(0) + neighbourhood.slice(1).toLowerCase()
    : "Unknown";

  const allTimeCount = useMemo(() => {
    const row = allNbhdData.find((r) => r.neighbourhood === neighbourhood);
    return row ? Number(row.cnt) : 0;
  }, [allNbhdData, neighbourhood]);

  // Ranked position
  const rank = useMemo(() => {
    const sorted = [...allNbhdData].sort((a, b) => Number(b.cnt) - Number(a.cnt));
    return sorted.findIndex((r) => r.neighbourhood === neighbourhood) + 1;
  }, [allNbhdData, neighbourhood]);

  // Build flat chart data
  const chartData = useMemo<ChartRow[]>(() => {
    return trendData
      .map((r) => ({
        label: `${MONTH_ABBR[Number(r.month_number)]} ${r.year.slice(2)}`,
        count: Number(r.cnt),
        year: r.year,
      }))
      .sort((a, b) => {
        const [, ya] = a.label.split(" ");
        const [, yb] = b.label.split(" ");
        if (ya !== yb) return Number(ya) - Number(yb);
        return MONTH_ABBR.indexOf(a.label.split(" ")[0]) - MONTH_ABBR.indexOf(b.label.split(" ")[0]);
      });
  }, [trendData]);

  const trend = useMemo(() => {
    if (chartData.length < 3) return null;
    const { slope } = linearRegression(chartData.map((r) => r.count));
    const total = chartData.reduce((a, r) => a + r.count, 0);
    const avg = total / chartData.length;
    const pct = avg > 0 ? Math.round((slope / avg) * 100) : 0;
    return { slope, pct };
  }, [chartData]);

  // Current year vs previous year comparison
  const yoyComparison = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const prevYear = String(Number(currentYear) - 1);
    const currTotal = trendData
      .filter((r) => r.year === currentYear)
      .reduce((a, r) => a + Number(r.cnt), 0);
    const prevTotal = trendData
      .filter((r) => r.year === prevYear)
      .reduce((a, r) => a + Number(r.cnt), 0);
    if (prevTotal === 0) return null;
    const delta = Math.round(((currTotal - prevTotal) / prevTotal) * 100);
    return { currTotal, prevTotal, delta, currentYear, prevYear };
  }, [trendData]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold truncate">{displayName}</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          data-testid="button-close-detail"
          aria-label="Close neighbourhood detail"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
            <div className="px-3 py-2.5 text-center">
              <div className="text-xs text-muted-foreground">All-time</div>
              <div className="text-base font-bold">{allTimeCount.toLocaleString()}</div>
            </div>
            <div className="px-3 py-2.5 text-center">
              <div className="text-xs text-muted-foreground">City rank</div>
              <div className="text-base font-bold">#{rank}</div>
            </div>
            <div className="px-3 py-2.5 text-center">
              <div className="text-xs text-muted-foreground">Trend</div>
              {trend ? (
                <div className={`text-base font-bold flex items-center justify-center gap-0.5 ${trend.slope > 0 ? "text-orange-500" : "text-green-600 dark:text-green-400"}`}>
                  {trend.slope > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {Math.abs(trend.pct)}%
                </div>
              ) : <div className="text-base font-bold text-muted-foreground">—</div>}
            </div>
          </div>

          {/* YoY comparison */}
          {yoyComparison && (
            <div className="px-4 py-2.5 bg-secondary/50 border-b border-border">
              <p className="text-xs text-muted-foreground">
                {yoyComparison.currentYear}: <strong>{yoyComparison.currTotal.toLocaleString()}</strong> requests ·{" "}
                <span className={yoyComparison.delta > 0 ? "text-orange-500" : "text-green-600 dark:text-green-400"}>
                  {yoyComparison.delta > 0 ? "+" : ""}{yoyComparison.delta}%
                </span>{" "}
                vs {yoyComparison.prevYear} ({yoyComparison.prevTotal.toLocaleString()})
              </p>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 ? (
            <div className="px-2 pt-3 pb-2">
              <p className="text-xs text-muted-foreground px-2 mb-1">{categoryLabel} requests over time</p>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="nbhdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [v.toLocaleString(), "Requests"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#nbhdGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No data for this neighbourhood and category.
            </div>
          )}
        </>
      )}
    </div>
  );
}
