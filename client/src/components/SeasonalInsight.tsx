import { useMemo } from "react";
import type { SummaryData, SeasonalRow, TrendRow } from "@/pages/Dashboard";
import { Brain } from "lucide-react";

// Compute z-score: how far is this month from historical average?
function computeZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / values.length);
}

// Simple linear regression
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

const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

export default function SeasonalInsight({
  seasonalData,
  summaryData,
  trendData,
  categoryLabel,
}: {
  seasonalData: SeasonalRow[];
  summaryData: SummaryData;
  trendData: TrendRow[];
  categoryLabel: string;
}) {
  const insight = useMemo(() => {
    if (!seasonalData.length || !summaryData) return null;

    const currentMonth = summaryData.currentMonth;
    const currentYear = summaryData.currentYear;

    // Historical avg for this month
    const seasonal = seasonalData.find((s) => Number(s.month_number) === currentMonth);
    const historicalAvg = seasonal ? Number(seasonal.avg_cnt) : 0;

    // This month actual
    const thisMonthActual = Number(summaryData.thisMonth?.[0]?.cnt ?? 0);

    // Std dev across all months
    const allAvgs = seasonalData.map((s) => Number(s.avg_cnt));
    const sd = stdDev(allAvgs);
    const z = computeZScore(thisMonthActual, historicalAvg, sd);

    // Peak month
    const peakMonth = seasonalData.reduce(
      (best, s) => (Number(s.avg_cnt) > Number(best.avg_cnt) ? s : best),
      seasonalData[0]
    );

    // Quietest month
    const quietMonth = seasonalData.reduce(
      (best, s) => (Number(s.avg_cnt) < Number(best.avg_cnt) ? s : best),
      seasonalData[0]
    );

    // Year-over-year trend (regression)
    const yearlyTotals: number[] = [];
    const years = [...new Set(trendData.map((r) => r.year))].sort();
    for (const yr of years) {
      const total = trendData.filter((r) => r.year === yr).reduce((a, r) => a + Number(r.cnt), 0);
      if (total > 0) yearlyTotals.push(total);
    }
    const { slope } = linearRegression(yearlyTotals);
    const avgAnnual = yearlyTotals.length
      ? yearlyTotals.reduce((a, b) => a + b, 0) / yearlyTotals.length
      : 0;
    const slopePercent = avgAnnual > 0 ? Math.round((slope / avgAnnual) * 100) : 0;

    return {
      z,
      thisMonthActual,
      historicalAvg,
      peakMonth,
      quietMonth,
      slopePercent,
      years,
      currentMonth,
      currentYear,
    };
  }, [seasonalData, summaryData, trendData]);

  if (!insight) return null;

  const monthName = MONTH_NAMES[insight.currentMonth];
  const { z, thisMonthActual, historicalAvg, peakMonth, quietMonth, slopePercent } = insight;

  // Plain-language seasonal verdict
  const diffPct = historicalAvg > 0 ? Math.round(((thisMonthActual - historicalAvg) / historicalAvg) * 100) : 0;
  let verdict: string;
  let verdictColor: string;
  if (z > 1.5) {
    verdict = `${monthName} ${insight.currentYear} is significantly above the multi-year average (${Math.abs(diffPct)}% higher than historical avg of ${Math.round(historicalAvg).toLocaleString()}). Note: year-over-year and long-term averages can differ.`;
    verdictColor = "text-orange-500";
  } else if (z < -1.5) {
    verdict = `${monthName} ${insight.currentYear} is well below the multi-year average (${Math.abs(diffPct)}% fewer than historical avg of ${Math.round(historicalAvg).toLocaleString()}). Note: year-over-year and long-term averages can differ.`;
    verdictColor = "text-green-600 dark:text-green-400";
  } else if (z > 0.5) {
    verdict = `${monthName} ${insight.currentYear} is slightly above the multi-year average (${Math.abs(diffPct)}% vs historical avg of ${Math.round(historicalAvg).toLocaleString()}) — within normal seasonal range.`;
    verdictColor = "text-yellow-600 dark:text-yellow-400";
  } else if (z < -0.5) {
    verdict = `${monthName} ${insight.currentYear} is slightly below the multi-year average (${Math.abs(diffPct)}% vs historical avg of ${Math.round(historicalAvg).toLocaleString()}) — within normal seasonal range.`;
    verdictColor = "text-blue-500";
  } else {
    verdict = `${monthName} ${insight.currentYear} is right on track — within 10% of the historical average of ${Math.round(historicalAvg).toLocaleString()} for this month.`;
    verdictColor = "text-green-600 dark:text-green-400";
  }

  // Year trend interpretation (linear regression across years)
  let trendLine: string;
  if (slopePercent > 10) {
    trendLine = `Based on a linear regression across ${insight.years.length} years of data, annual volume has been trending upward ~${slopePercent}% per year on average.`;
  } else if (slopePercent < -10) {
    trendLine = `Based on a linear regression across ${insight.years.length} years of data, annual volume has been trending downward ~${Math.abs(slopePercent)}% per year — fewer reports or faster resolution.`;
  } else {
    trendLine = `Based on a linear regression across ${insight.years.length} years of data, annual volume has been relatively stable — no strong upward or downward trend.`;
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Seasonal Intelligence</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Current month verdict */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Is this month normal?</p>
          <p className={`text-sm font-medium leading-snug ${verdictColor}`}>{verdict}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Historical avg for {monthName}: <strong>{Math.round(historicalAvg).toLocaleString()}</strong> ·
            This year: <strong>{thisMonthActual.toLocaleString()}</strong>
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Seasonal patterns */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Seasonal patterns</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground">Peak month</p>
              <p className="text-sm font-bold text-orange-500">{peakMonth.month}</p>
              <p className="text-xs text-muted-foreground">{Math.round(Number(peakMonth.avg_cnt)).toLocaleString()} avg</p>
            </div>
            <div className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground">Quietest month</p>
              <p className="text-sm font-bold text-blue-500">{quietMonth.month}</p>
              <p className="text-xs text-muted-foreground">{Math.round(Number(quietMonth.avg_cnt)).toLocaleString()} avg</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Multi-year trend */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Long-term trend</p>
          <p className="text-xs text-foreground leading-relaxed">{trendLine}</p>
        </div>
      </div>
    </div>
  );
}
