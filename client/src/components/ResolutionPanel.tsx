import { useMemo } from "react";
import type { ResolutionData } from "@/pages/Dashboard";
import { CheckCircle2, Clock, Copy, XCircle, HelpCircle } from "lucide-react";

// Map status_detail strings into 4 plain buckets
function classifyDetails(detailData: Array<{ status_detail?: string; cnt: string }>) {
  const buckets = {
    fixed: { label: "Fixed or resolved", desc: "City took action — repaired, cleaned, or enforced", count: 0, color: "bg-green-500", icon: CheckCircle2, textColor: "text-green-600 dark:text-green-400" },
    duplicate: { label: "Duplicate report", desc: "Same issue was already reported by someone else", count: 0, color: "bg-yellow-400", icon: Copy, textColor: "text-yellow-600 dark:text-yellow-400" },
    noAction: { label: "No action taken", desc: "Assessed but not city's responsibility, or didn't meet repair threshold", count: 0, color: "bg-slate-400", icon: XCircle, textColor: "text-slate-500" },
    other: { label: "Other / redirected", desc: "Referred elsewhere, more info needed, or still in progress", count: 0, color: "bg-primary/40", icon: HelpCircle, textColor: "text-muted-foreground" },
  };

  for (const row of detailData) {
    const d = (row.status_detail || "").toLowerCase();
    const n = Number(row.cnt);
    if (d.includes("duplicate")) buckets.duplicate.count += n;
    else if (
      d.includes("remedied") || d.includes("sent for clean") || d.includes("vehicle towed") ||
      d.includes("enforcement action") || d.includes("citizen complied") || d.includes("violation remedied") ||
      d.includes("complete") || d.includes("warning issued")
    ) buckets.fixed.count += n;
    else if (
      d.includes("no action") || d.includes("non-city") || d.includes("does not meet") ||
      d.includes("not found") || d.includes("assessed")
    ) buckets.noAction.count += n;
    else buckets.other.count += n;
  }

  return buckets;
}

export default function ResolutionPanel({
  data,
  categoryLabel,
}: {
  data: ResolutionData;
  categoryLabel: string;
}) {
  const stats = useMemo(() => {
    const closed = Number(data.statusData.find(s => s.request_status === "Closed")?.cnt ?? 0);
    const open = Number(data.statusData.find(s => s.request_status === "Open")?.cnt ?? 0);
    const total = closed + open;
    const closureRate = total > 0 ? (closed / total) * 100 : 0;
    const avgDays = data.avgDaysData[0]?.avg_days ? parseFloat(data.avgDaysData[0].avg_days) : null;
    const buckets = classifyDetails(data.detailData);
    return { closed, open, total, closureRate, avgDays, buckets };
  }, [data]);

  const bucketList = Object.values(stats.buckets);
  const closedTotal = stats.buckets.fixed.count + stats.buckets.duplicate.count + stats.buckets.noAction.count + stats.buckets.other.count;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold">City Response · {categoryLabel}</span>
        </div>
        <span className="text-xs text-muted-foreground">All time · based on closed reports</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Top 3 stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 tabular-nums"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {stats.closureRate.toFixed(0)}%
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Closed by city</p>
            <p className="text-xs text-muted-foreground">{stats.closed.toLocaleString()} of {stats.total.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {stats.avgDays !== null ? stats.avgDays.toFixed(1) : "—"}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Avg. days to close</p>
            <p className="text-xs text-muted-foreground">median response time</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-500 tabular-nums" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {stats.open.toLocaleString()}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Still open</p>
            <p className="text-xs text-muted-foreground">unresolved right now</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* How were reports resolved */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Of the closed reports — what actually happened?
          </p>

          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden mb-3 gap-0.5">
            {bucketList.map(b => {
              const pct = closedTotal > 0 ? (b.count / closedTotal) * 100 : 0;
              return pct > 2 ? (
                <div
                  key={b.label}
                  className={`${b.color} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${b.label}: ${pct.toFixed(1)}%`}
                />
              ) : null;
            })}
          </div>

          {/* Breakdown rows */}
          <div className="space-y-3">
            {bucketList.map(b => {
              const pct = closedTotal > 0 ? (b.count / closedTotal) * 100 : 0;
              const Icon = b.icon;
              return (
                <div key={b.label} className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${b.textColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{b.label}</span>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${b.textColor}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Caveat */}
        <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
          Note: "No status provided" records (where the city closed the ticket without a detail) are distributed into "Other / redirected." Raw report counts include duplicates — the same pothole reported by 5 neighbours counts as 5 reports.
        </p>
      </div>
    </div>
  );
}
