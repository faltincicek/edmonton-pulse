import { useMemo, useState } from "react";
import type { NbhdRow, SummaryData } from "@/pages/Dashboard";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

// Rough neighbourhood area estimates in km² — covers the most common ones.
// Where area is unknown we'll show a "?" and exclude from density ranking.
const NBHD_AREA_KM2: Record<string, number> = {
  "DOWNTOWN": 2.9,
  "GLENORA": 2.1,
  "RIVER VALLEY": 14.2,
  "STRATHCONA": 1.8,
  "OLIVER": 1.9,
  "QUEEN ALEXANDRA": 1.3,
  "WESTMOUNT": 1.6,
  "BONNIE DOON": 1.7,
  "FOREST HEIGHTS": 2.0,
  "MILL WOODS": 7.8,
  "YELLOWHEAD CORRIDOR": 5.1,
  "NORTH GLENORA": 1.5,
  "CALDER": 1.7,
  "SPRUCE AVENUE": 1.2,
  "PARKDALE": 1.1,
  "CENTRAL MCDOUGALL": 0.9,
  "ALBERTA AVENUE": 1.8,
  "EASTWOOD": 1.4,
  "BEVERLY HEIGHTS": 1.6,
  "CLOVERDALE": 2.3,
  "GROVENOR": 1.2,
  "WOODCROFT": 1.4,
  "ROSSLYN": 1.0,
  "MCKERNAN": 1.3,
  "RITCHIE": 1.2,
  "HOLYROOD": 1.4,
  "KING EDWARD PARK": 1.5,
  "IDYLWYLDE": 1.3,
  "HAZELDEAN": 1.4,
  "ABBOTTSFIELD": 1.3,
  "NEWTON": 1.8,
  "CROMDALE": 0.9,
  "LAUDERDALE": 1.1,
  "ROPER INDUSTRIAL": 3.2,
  "KENILWORTH": 1.5,
};

type SortMode = "change" | "raw" | "open" | "density";

function toTitle(name: string): string {
  if (!name) return "Unknown";
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function TopNeighbourhoods({
  current,
  prev,
  currentYear,
  prevYear,
  openData,
  onSelect,
  selected,
  categoryLabel,
  summaryData,
}: {
  current: NbhdRow[];
  prev: NbhdRow[];
  currentYear: number;
  prevYear: number;
  openData: NbhdRow[];
  onSelect: (n: string) => void;
  selected: string | null;
  categoryLabel: string;
  summaryData?: SummaryData;
}) {
  const [mode, setMode] = useState<SortMode>("change");

  const prevMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of prev) if (r.neighbourhood) m[r.neighbourhood] = Number(r.cnt);
    return m;
  }, [prev]);

  // Open count lookup by neighbourhood
  const openMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of openData) if (r.neighbourhood) m[r.neighbourhood] = Number(r.cnt);
    return m;
  }, [openData]);

  // Deduplicate + enrich
  const enriched = useMemo(() => {
    const deduped = current
      .filter((r) => r.neighbourhood && r.neighbourhood.trim())
      .reduce<NbhdRow[]>((acc, r) => {
        const existing = acc.find((a) => a.neighbourhood === r.neighbourhood);
        if (existing) {
          existing.cnt = String(Number(existing.cnt) + Number(r.cnt));
        } else {
          acc.push({ ...r });
        }
        return acc;
      }, []);

    return deduped.map((r) => {
      const prevCnt = prevMap[r.neighbourhood] || 0;
      const currCnt = Number(r.cnt);
      const openCnt = openMap[r.neighbourhood] || 0;
      const delta = prevCnt > 0 ? Math.round(((currCnt - prevCnt) / prevCnt) * 100) : null;
      const area = NBHD_AREA_KM2[r.neighbourhood.toUpperCase()] ?? null;
      const density = area ? currCnt / area : null;
      return { ...r, currCnt, prevCnt, openCnt, delta, area, density };
    });
  }, [current, prevMap, openMap]);

  // Sort based on mode
  const top = useMemo(() => {
    if (mode === "change") {
      return [...enriched]
        .filter((r) => r.delta !== null)
        .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
        .slice(0, 15);
    } else if (mode === "open") {
      return [...enriched]
        .filter((r) => r.openCnt > 0)
        .sort((a, b) => b.openCnt - a.openCnt)
        .slice(0, 15);
    } else if (mode === "density") {
      return [...enriched]
        .filter((r) => r.density !== null)
        .sort((a, b) => (b.density ?? 0) - (a.density ?? 0))
        .slice(0, 15);
    } else {
      return [...enriched]
        .sort((a, b) => b.currCnt - a.currCnt)
        .slice(0, 15);
    }
  }, [enriched, mode]);

  // Value for bar width
  const maxVal = useMemo(() => {
    if (mode === "change") return Math.max(...top.map((r) => Math.abs(r.delta ?? 0)), 1);
    if (mode === "open") return Math.max(...top.map((r) => r.openCnt), 1);
    if (mode === "density") return Math.max(...top.map((r) => r.density ?? 0), 0.01);
    return Math.max(...top.map((r) => r.currCnt), 1);
  }, [top, mode]);

  const modeLabels: Record<SortMode, string> = {
    change: "% Change",
    open: "Unresolved",
    raw: "All reports",
    density: "Per km²",
  };

  const modeHelp: Record<SortMode, string> = {
    change: "Which neighbourhoods saw the biggest change vs last year",
    open: "Currently open (unresolved) reports by neighbourhood",
    raw: "All reports filed this year — includes duplicates",
    density: "Reports per km² — levels the playing field between large and small areas",
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Neighbourhoods · {currentYear}</span>
          </div>
          <span className="text-xs text-muted-foreground">vs {prevYear}</span>
        </div>
        {/* Toggle */}
        <div className="flex gap-1 flex-wrap">
          {(["change", "open", "raw", "density"] as SortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{modeHelp[mode]}</p>
      </div>

      <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
        {top.map((row, i) => {
          const isSelected = selected === row.neighbourhood;
          const displayName = toTitle(row.neighbourhood);

          // Bar value and label
          let barPct: number;
          let valueLabel: string;
          let deltaEl: JSX.Element | null = null;

          if (mode === "change" && row.delta !== null) {
            barPct = Math.round((Math.abs(row.delta) / maxVal) * 100);
            valueLabel = `${row.delta > 0 ? "+" : ""}${row.delta}%`;
            deltaEl = (
              <span className={`flex items-center gap-0.5 text-xs font-bold ${
                row.delta > 0 ? "text-orange-500" : row.delta < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              }`}>
                {row.delta > 0 ? <TrendingUp className="w-3 h-3" /> : row.delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {valueLabel}
              </span>
            );
          } else if (mode === "open") {
            barPct = Math.round((row.openCnt / maxVal) * 100);
            valueLabel = row.openCnt.toLocaleString();
            deltaEl = <span className="text-sm font-bold tabular-nums text-orange-500">{valueLabel} open</span>;
          } else if (mode === "density" && row.density !== null) {
            barPct = Math.round((row.density / maxVal) * 100);
            valueLabel = `${row.density.toFixed(1)}/km²`;
            deltaEl = <span className="text-xs font-bold text-muted-foreground tabular-nums">{valueLabel}</span>;
          } else {
            barPct = Math.round((row.currCnt / maxVal) * 100);
            valueLabel = row.currCnt.toLocaleString();
            deltaEl = <span className="text-sm font-bold tabular-nums">{valueLabel}</span>;
          }

          return (
            <button
              key={row.neighbourhood || i}
              onClick={() => row.neighbourhood && onSelect(row.neighbourhood)}
              className={`w-full text-left px-4 py-2.5 transition-colors ${
                isSelected ? "bg-primary/8 border-l-2 border-primary" : "hover:bg-secondary"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium truncate">{displayName}</span>
                  {mode !== "raw" && (
                    <span className="text-xs text-muted-foreground shrink-0">({row.currCnt.toLocaleString()})</span>
                  )}
                </div>
                {deltaEl}
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barPct}%`,
                    background: mode === "change"
                      ? row.delta && row.delta > 0
                        ? "hsl(38 95% 48%)"
                        : "hsl(142 72% 38%)"
                      : "hsl(var(--primary))",
                    opacity: isSelected ? 1 : 0.65,
                  }}
                />
              </div>
            </button>
          );
        })}
        {top.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No data available.
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        Click a neighbourhood to see its detailed trend
      </div>
    </div>
  );
}
