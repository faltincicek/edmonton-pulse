import { useMemo, useState } from "react";
import type { SummaryData, SeasonalRow, TrendRow, ResolutionData } from "@/pages/Dashboard";
import { X, TrendingUp, TrendingDown, Minus, ChevronRight, Brain, AlertCircle } from "lucide-react";

const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_ABBR = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length);
}

function linearRegression(ys: number[]) {
  const n = ys.length;
  if (n < 3) return { slope: 0 };
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  return { slope: (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) };
}

// Classify status_detail rows into 4 plain buckets
function classifyDetails(detailData: Array<{ status_detail?: string; cnt: string }>) {
  let fixed = 0, duplicate = 0, noAction = 0, other = 0;
  for (const row of detailData) {
    const d = (row.status_detail || "").toLowerCase();
    const n = Number(row.cnt);
    if (d.includes("duplicate")) duplicate += n;
    else if (d.includes("remedied") || d.includes("clean") || d.includes("towed") || d.includes("enforcement action") || d.includes("violation remedied") || d.includes("sent for clean") || d.includes("vehicle towed")) fixed += n;
    else if (d.includes("no action") || d.includes("non-city") || d.includes("does not meet") || d.includes("not found") || d.includes("not provided")) noAction += n;
    else other += n;
  }
  return { fixed, duplicate, noAction, other };
}

// ── Guided story modal ─────────────────────────────────────────────────────
function GuidedModal({
  onClose, categoryLabel, summaryData, seasonalData, trendData,
  proRatedAvg, thisMonthActual, monthName, diffPct, z,
  slopePercent, years, peakMonth, quietMonth, resolutionData,
}: {
  onClose: () => void;
  categoryLabel: string;
  summaryData: SummaryData;
  seasonalData: SeasonalRow[];
  trendData: TrendRow[];
  proRatedAvg: number;
  thisMonthActual: number;
  monthName: string;
  diffPct: number;
  z: number;
  slopePercent: number;
  years: string[];
  peakMonth: SeasonalRow;
  quietMonth: SeasonalRow;
  resolutionData?: ResolutionData;
}) {
  const ytdCnt = Number(summaryData.ytd?.[0]?.cnt ?? 0);
  const ytdPrev = Number(summaryData.ytdPrev?.[0]?.cnt ?? 0);
  const ytdDelta = ytdPrev > 0 ? Math.round(((ytdCnt - ytdPrev) / ytdPrev) * 100) : 0;

  const yearTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of trendData) m[r.year] = (m[r.year] || 0) + Number(r.cnt);
    return Object.entries(m).sort(([a], [b]) => Number(a) - Number(b)).slice(-4);
  }, [trendData]);
  const maxYearTotal = Math.max(...yearTotals.map(([, v]) => v), 1);

  const seasonalBars = [...seasonalData].sort((a, b) => Number(a.month_number) - Number(b.month_number));
  const maxSeasonalAvg = Math.max(...seasonalBars.map(s => Number(s.avg_cnt)), 1);

  // Resolution breakdown for modal
  const resDetails = resolutionData ? classifyDetails(resolutionData.detailData) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Deep dive · {categoryLabel}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-7">
          {/* Chapter 1 — Is this month normal? */}
          <section>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Chapter 1 · Is {monthName} normal?
            </p>
            <div className="bg-secondary rounded-xl p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Reports filed so far</span>
                <span className="text-xl font-bold tabular-nums">{thisMonthActual.toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Expected at this point in {monthName}</span>
                <span className="text-xl font-bold tabular-nums text-muted-foreground">{Math.round(proRatedAvg).toLocaleString()}</span>
              </div>
              <div className="h-px bg-border" />
              <p className="text-sm leading-relaxed">
                {Math.abs(diffPct) < 5
                  ? `Right on track — reports are within 5% of the typical pace for this point in ${monthName}.`
                  : diffPct > 0
                  ? `${Math.abs(diffPct)}% more reports than the typical ${monthName} pace. ${z > 1.5 ? "That's statistically unusual." : "Still within the normal range."}`
                  : `${Math.abs(diffPct)}% fewer reports than the typical ${monthName} pace. ${z < -1.5 ? "That's statistically quiet." : "Within the normal range."}`
                }
              </p>
              <p className="text-xs text-muted-foreground">
                The historical monthly average for {monthName} is{" "}
                <strong>{Math.round(Number(seasonalData.find(s => Number(s.month_number) === summaryData.currentMonth)?.avg_cnt ?? 0)).toLocaleString()}</strong> reports.
                We scale it to {summaryData.dayOfMonth}/{summaryData.daysInMonth} days to make a fair mid-month comparison.
              </p>
            </div>
          </section>

          {/* Chapter 2 — Year to date */}
          <section>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Chapter 2 · Year to date
            </p>
            <div className="bg-secondary rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">{summaryData.currentYear} YTD</p>
                  <p className="text-2xl font-bold tabular-nums">{ytdCnt.toLocaleString()}</p>
                </div>
                <div className={`flex items-center gap-1 text-lg font-bold ${ytdDelta > 0 ? "text-orange-500" : ytdDelta < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {ytdDelta > 0 ? <TrendingUp className="w-5 h-5" /> : ytdDelta < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                  {ytdDelta > 0 ? "+" : ""}{ytdDelta}%
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                vs {ytdPrev.toLocaleString()} reports through the same point in {summaryData.prevYear}.
              </p>
            </div>
          </section>

          {/* Chapter 3 — How did the city respond? */}
          {resDetails && resolutionData && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Chapter 3 · How did the city respond?
              </p>
              <div className="bg-secondary rounded-xl p-4 space-y-4">
                {(() => {
                  const closed = Number(resolutionData.statusData.find(s => s.request_status === "Closed")?.cnt ?? 0);
                  const open = Number(resolutionData.statusData.find(s => s.request_status === "Open")?.cnt ?? 0);
                  const total = closed + open;
                  const closureRate = total > 0 ? Math.round((closed / total) * 100) : 0;
                  const avgDays = parseFloat(resolutionData.avgDaysData[0]?.avg_days ?? "0");
                  const dupePct = total > 0 ? Math.round((resDetails.duplicate / total) * 100) : 0;
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-background rounded-lg px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">Closed by city</p>
                          <p className="text-xl font-bold text-green-600 dark:text-green-400">{closureRate}%</p>
                          <p className="text-xs text-muted-foreground">{closed.toLocaleString()} of {total.toLocaleString()}</p>
                        </div>
                        <div className="bg-background rounded-lg px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">Avg. days to close</p>
                          <p className="text-xl font-bold">{avgDays.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">for closed reports</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: "Actually fixed / resolved", val: resDetails.fixed, color: "bg-green-500" },
                          { label: "Duplicate reports (same issue)", val: resDetails.duplicate, color: "bg-yellow-500" },
                          { label: "No action needed / not city's issue", val: resDetails.noAction, color: "bg-slate-400" },
                          { label: "Other / redirected", val: resDetails.other, color: "bg-primary/40" },
                        ].map(({ label, val, color }) => {
                          const pct = closed > 0 ? Math.round((val / closed) * 100) : 0;
                          return (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-medium">{pct}%</span>
                              </div>
                              <div className="h-2 bg-background rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {dupePct > 10 && (
                        <p className="text-xs text-muted-foreground">
                          Note: {dupePct}% of closed reports were duplicates — multiple people reporting the same issue. The raw report count is higher than the number of unique problems.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </section>
          )}

          {/* Chapter 4 — Seasonal patterns */}
          <section>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Chapter 4 · When does this peak?
            </p>
            <div className="bg-secondary rounded-xl p-4 space-y-4">
              <div className="flex items-end gap-1 h-16">
                {seasonalBars.map(s => {
                  const h = Math.max(4, Math.round((Number(s.avg_cnt) / maxSeasonalAvg) * 100));
                  const isCurrent = Number(s.month_number) === summaryData.currentMonth;
                  return (
                    <div key={s.month_number} className="flex-1 flex flex-col items-center">
                      <div className="w-full rounded-t transition-all"
                        style={{ height: `${h}%`, background: isCurrent ? "hsl(var(--accent))" : "hsl(var(--primary) / 0.35)" }}
                        title={`${s.month}: avg ${Math.round(Number(s.avg_cnt)).toLocaleString()}`} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                {MONTH_ABBR.slice(1).map(m => <span key={m}>{m[0]}</span>)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Busiest month</p>
                  <p className="text-sm font-bold text-orange-500">{peakMonth.month}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(Number(peakMonth.avg_cnt)).toLocaleString()} avg reports/yr</p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Quietest month</p>
                  <p className="text-sm font-bold text-blue-500">{quietMonth.month}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(Number(quietMonth.avg_cnt)).toLocaleString()} avg reports/yr</p>
                </div>
              </div>
            </div>
          </section>

          {/* Chapter 5 — Multi-year trend */}
          <section>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Chapter 5 · Is Edmonton getting better or worse?
            </p>
            <div className="bg-secondary rounded-xl p-4 space-y-4">
              <div className="space-y-2">
                {yearTotals.map(([yr, total]) => {
                  const pct = Math.round((total / maxYearTotal) * 100);
                  const isCurrent = yr === String(summaryData.currentYear);
                  return (
                    <div key={yr} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-8 shrink-0">{yr}</span>
                      <div className="flex-1 h-5 bg-background rounded overflow-hidden">
                        <div className="h-full rounded transition-all duration-700"
                          style={{ width: `${pct}%`, background: isCurrent ? "hsl(var(--accent))" : "hsl(var(--primary) / 0.5)" }} />
                      </div>
                      <span className="text-xs font-medium tabular-nums w-16 text-right">
                        {total.toLocaleString()}{isCurrent ? "*" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">* {summaryData.currentYear} is partial (Jan–{MONTH_ABBR[summaryData.currentMonth]}).</p>
              <p className="text-sm leading-relaxed">
                {slopePercent > 10
                  ? `Trending upward — annual report volume has been growing ~${slopePercent}% per year (linear regression across ${years.length} years). More reports may reflect higher awareness, population growth, or worsening conditions.`
                  : slopePercent < -10
                  ? `Trending downward — annual report volume has been declining ~${Math.abs(slopePercent)}% per year. Could mean fewer issues, faster resolution, or less reporting.`
                  : `Relatively stable — no strong multi-year trend in report volume.`}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
export default function WowInsight({
  summaryData, seasonalData, trendData, categoryLabel, resolutionData,
}: {
  summaryData: SummaryData;
  seasonalData: SeasonalRow[];
  trendData: TrendRow[];
  categoryLabel: string;
  resolutionData?: ResolutionData;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const insight = useMemo(() => {
    if (!seasonalData.length || !summaryData) return null;
    const currentMonth = summaryData.currentMonth;
    const dayOfMonth = summaryData.dayOfMonth || new Date().getDate();
    const daysInMonth = summaryData.daysInMonth || 30;
    const seasonal = seasonalData.find(s => Number(s.month_number) === currentMonth);
    const historicalAvgFull = seasonal ? Number(seasonal.avg_cnt) : 0;
    const proRatedAvg = historicalAvgFull * (dayOfMonth / daysInMonth);
    const thisMonthActual = Number(summaryData.thisMonth?.[0]?.cnt ?? 0);
    const diffPct = proRatedAvg > 0 ? Math.round(((thisMonthActual - proRatedAvg) / proRatedAvg) * 100) : 0;
    const allAvgs = seasonalData.map(s => Number(s.avg_cnt) * (dayOfMonth / daysInMonth));
    const sd = stdDev(allAvgs);
    const z = sd > 0 ? (thisMonthActual - proRatedAvg) / sd : 0;
    const peakMonth = seasonalData.reduce((best, s) => Number(s.avg_cnt) > Number(best.avg_cnt) ? s : best, seasonalData[0]);
    const quietMonth = seasonalData.reduce((best, s) => Number(s.avg_cnt) < Number(best.avg_cnt) ? s : best, seasonalData[0]);
    const years = [...new Set(trendData.map(r => r.year))].sort();
    const yearlyTotals = years.map(yr => trendData.filter(r => r.year === yr).reduce((a, r) => a + Number(r.cnt), 0)).filter(t => t > 0);
    const { slope } = linearRegression(yearlyTotals);
    const avgAnnual = yearlyTotals.length ? yearlyTotals.reduce((a, b) => a + b, 0) / yearlyTotals.length : 0;
    const slopePercent = avgAnnual > 0 ? Math.round((slope / avgAnnual) * 100) : 0;
    return { z, diffPct, thisMonthActual, proRatedAvg, peakMonth, quietMonth, slopePercent, years, dayOfMonth, daysInMonth };
  }, [seasonalData, summaryData, trendData]);

  // Resolution numbers
  const resolution = useMemo(() => {
    if (!resolutionData) return null;
    const closed = Number(resolutionData.statusData.find(s => s.request_status === "Closed")?.cnt ?? 0);
    const open = Number(resolutionData.statusData.find(s => s.request_status === "Open")?.cnt ?? 0);
    const total = closed + open;
    const closureRate = total > 0 ? Math.round((closed / total) * 100) : null;
    const avgDays = resolutionData.avgDaysData[0]?.avg_days ? parseFloat(resolutionData.avgDaysData[0].avg_days) : null;
    const dupe = resolutionData.detailData.filter(r => (r.status_detail || "").toLowerCase().includes("duplicate")).reduce((a, r) => a + Number(r.cnt), 0);
    const dupePct = total > 0 ? Math.round((dupe / total) * 100) : 0;
    return { closed, open, total, closureRate, avgDays, dupePct };
  }, [resolutionData]);

  if (!insight) return null;

  const monthName = MONTH_NAMES[summaryData.currentMonth];
  const { z, diffPct, thisMonthActual, proRatedAvg, peakMonth, quietMonth, slopePercent, years, dayOfMonth, daysInMonth } = insight;

  // Reported side verdict
  let reportColor: string, reportLabel: string, reportHeadline: string, ReportIcon = Minus;
  if (z > 1.5) {
    reportColor = "text-orange-500"; reportLabel = "Above normal"; ReportIcon = TrendingUp;
    reportHeadline = `${Math.abs(diffPct)}% more than expected`;
  } else if (z < -1.5) {
    reportColor = "text-green-600 dark:text-green-400"; reportLabel = "Below normal"; ReportIcon = TrendingDown;
    reportHeadline = `${Math.abs(diffPct)}% fewer than expected`;
  } else if (z > 0.4) {
    reportColor = "text-yellow-600 dark:text-yellow-400"; reportLabel = "Slightly elevated"; ReportIcon = TrendingUp;
    reportHeadline = `${Math.abs(diffPct)}% above typical pace`;
  } else if (z < -0.4) {
    reportColor = "text-blue-500"; reportLabel = "Slightly below pace"; ReportIcon = TrendingDown;
    reportHeadline = `${Math.abs(diffPct)}% below typical pace`;
  } else {
    reportColor = "text-green-600 dark:text-green-400"; reportLabel = "On track";
    reportHeadline = "Tracking normally";
  }

  return (
    <>
      <div className="rounded-2xl border border-border overflow-hidden">
        {/* Two-column hero */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">

          {/* Left: Reports filed */}
          <div className="bg-card px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Reports filed · {MONTH_NAMES[summaryData.currentMonth]} {summaryData.currentYear}
            </p>
            <div className="flex items-baseline gap-3 mb-1">
              <span className={`text-4xl font-bold tabular-nums`} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {thisMonthActual.toLocaleString()}
              </span>
              <span className={`flex items-center gap-1 text-sm font-semibold ${reportColor}`}>
                <ReportIcon className="w-4 h-4" />
                {reportLabel}
              </span>
            </div>
            <p className={`text-base font-medium mb-2 ${reportColor}`}>{reportHeadline}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Expected ~{Math.round(proRatedAvg).toLocaleString()} at day {dayOfMonth} of {daysInMonth}.
              Pro-rated from the historical average for {monthName}.
            </p>
            <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              Based on resident-filed 311 reports — not all are unique or city-verified.
            </p>
          </div>

          {/* Right: City response */}
          <div className="bg-card px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              City response · all time
            </p>
            {resolution ? (
              <>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-4xl font-bold tabular-nums text-green-600 dark:text-green-400"
                    style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                    {resolution.closureRate}%
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">closed</span>
                </div>
                <p className="text-base font-medium text-green-600 dark:text-green-400 mb-2">
                  {resolution.closed.toLocaleString()} of {resolution.total.toLocaleString()} reports resolved
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Average time to close: <strong>{resolution.avgDays?.toFixed(1)} days</strong>.
                  {resolution.dupePct > 10 ? ` ${resolution.dupePct}% were duplicates (same issue reported by multiple people).` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {resolution.open.toLocaleString()} reports are currently open (unresolved).
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
        </div>

        {/* Footer strip with Explore button */}
        <div className="bg-secondary/40 border-t border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Peak month:</span>
            <span className="text-orange-500 font-semibold">{peakMonth.month}</span>
            <span className="mx-1 opacity-40">·</span>
            <span className="font-medium">Quietest:</span>
            <span className="text-blue-500 font-semibold">{quietMonth.month}</span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors bg-primary/8 hover:bg-primary/15 rounded-lg px-4 py-2"
          >
            Explore deeper
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {modalOpen && (
        <GuidedModal
          onClose={() => setModalOpen(false)}
          categoryLabel={categoryLabel}
          summaryData={summaryData}
          seasonalData={seasonalData}
          trendData={trendData}
          proRatedAvg={proRatedAvg}
          thisMonthActual={thisMonthActual}
          monthName={monthName}
          diffPct={diffPct}
          z={z}
          slopePercent={slopePercent}
          years={years}
          peakMonth={peakMonth}
          quietMonth={quietMonth}
          resolutionData={resolutionData}
        />
      )}
    </>
  );
}
