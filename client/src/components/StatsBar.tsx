import type { SummaryData } from "@/pages/Dashboard";
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart2 } from "lucide-react";

const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

function StatCard({
  label,
  value,
  sub,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: number;
  icon: React.ElementType;
}) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;
  const DeltaIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const deltaColor = isPositive
    ? "text-orange-500"
    : isNegative
    ? "text-green-600 dark:text-green-400"
    : "text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        {value}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{sub}</span>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${deltaColor}`}>
            <DeltaIcon className="w-3 h-3" />
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

function getDelta(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round(((a - b) / b) * 100);
}

export default function StatsBar({ data, categoryLabel }: { data: SummaryData; categoryLabel: string }) {
  const thisMonthCnt = Number(data.thisMonth?.[0]?.cnt ?? 0);
  const lastYearSameMonthCnt = Number(data.lastYearSameMonth?.[0]?.cnt ?? 0);
  const ytdCnt = Number(data.ytd?.[0]?.cnt ?? 0);
  const ytdPrevCnt = Number(data.ytdPrev?.[0]?.cnt ?? 0);
  const monthName = MONTH_NAMES[data.currentMonth] || "";

  const monthDelta = getDelta(thisMonthCnt, lastYearSameMonthCnt);
  const ytdDelta = getDelta(ytdCnt, ytdPrevCnt);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label={`${monthName} ${data.currentYear}`}
        value={thisMonthCnt.toLocaleString()}
        sub={`vs ${lastYearSameMonthCnt.toLocaleString()} last year`}
        delta={monthDelta}
        icon={Calendar}
      />
      <StatCard
        label={`${data.currentYear} YTD`}
        value={ytdCnt.toLocaleString()}
        sub={`vs ${ytdPrevCnt.toLocaleString()} in ${data.prevYear}`}
        delta={ytdDelta}
        icon={BarChart2}
      />
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col gap-1 col-span-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City Status</span>
        <div className="text-sm font-semibold mt-1 leading-snug">
          {categoryLabel} requests in {monthName} {data.currentYear} are{" "}
          <span className={monthDelta > 0 ? "text-orange-500" : monthDelta < 0 ? "text-green-600 dark:text-green-400" : "text-foreground"}>
            {Math.abs(monthDelta)}% {monthDelta > 0 ? "higher" : monthDelta < 0 ? "lower" : "similar"}
          </span>{" "}
          than the same month last year. Year-to-date the city has received{" "}
          <span className="font-bold text-primary">{ytdCnt.toLocaleString()}</span> requests —{" "}
          <span className={ytdDelta > 0 ? "text-orange-500" : ytdDelta < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
            {Math.abs(ytdDelta)}% {ytdDelta > 0 ? "more" : ytdDelta < 0 ? "fewer" : "same"}
          </span>{" "}
          than {data.prevYear}.
        </div>
      </div>
    </div>
  );
}
