import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import CategoryPicker from "@/components/CategoryPicker";
import WowInsight from "@/components/WowInsight";
import NeighbourhoodMap from "@/components/NeighbourhoodMap";
import TrendChart from "@/components/TrendChart";
import TopNeighbourhoods from "@/components/TopNeighbourhoods";
import NeighbourhoodDetail from "@/components/NeighbourhoodDetail";
import ResolutionPanel from "@/components/ResolutionPanel";
import { Skeleton } from "@/components/ui/skeleton";

export type TrendRow = {
  year: string;
  month_number: string;
  month: string;
  cnt: string;
};

export type NbhdRow = {
  neighbourhood: string;
  neighbourhood_id: string;
  cnt: string;
  nbhd_latitude?: string;
  nbhd_longitude?: string;
};

export type SummaryData = {
  thisMonth: [{ cnt: string }];
  lastYearSameMonth: [{ cnt: string }];
  ytd: [{ cnt: string }];
  ytdPrev: [{ cnt: string }];
  currentYear: number;
  currentMonth: number;
  prevYear: number;
  dayOfMonth: number;
  daysInMonth: number;
};

export type SeasonalRow = {
  month_number: string;
  month: string;
  avg_cnt: string;
};

export type CacheInfo = {
  latestFetch: number | null;
  dayOfMonth: number;
  daysInMonth: number;
  monthFraction: number;
};

export type ResolutionData = {
  statusData: Array<{ request_status: string; cnt: string }>;
  detailData: Array<{ status_detail?: string; cnt: string }>;
  avgDaysData: Array<{ avg_days: string }>;
};

// Curated civic categories
const CIVIC_CATEGORIES = [
  "Potholes",
  "Maintenance - Snow  and  Ice",
  "Maintenance - Road Services  and  Repairs",
  "Litter",
  "Graffiti",
  "Traffic Signals  and  Street Lights",
  "Maintenance - Sidewalk/Concrete",
  "Animal Complaints",
  "Encampments",
  "Street Signs",
  "Animal Pick Up Request",
  "Bylaw Complaints",
  "Public Parking Complaints",
  "Collection  and  Disposal Services",
  "Detours  and  Road Closures",
  "Maintenance - ETS",
  "Fire Safety  and  Prevention",
];

export default function Dashboard() {
  const [category, setCategory] = useState("Potholes");
  const [selectedNbhd, setSelectedNbhd] = useState<string | null>(null);
  // Map toggle: "open" = unresolved only, "all" = all reports
  const [mapMode, setMapMode] = useState<"open" | "all">("open");

  // Cache info
  const { data: cacheInfo } = useQuery<CacheInfo>({
    queryKey: ["/api/cache-info"],
    queryFn: () => apiRequest("GET", "/api/cache-info").then(r => r.json()),
    staleTime: 60_000,
  });

  // Trend data
  const { data: trendData, isLoading: trendLoading } = useQuery<TrendRow[]>({
    queryKey: ["/api/trend", category],
    queryFn: () => apiRequest("GET", `/api/trend?category=${encodeURIComponent(category)}`).then(r => r.json()),
  });

  // Summary stats
  const { data: summaryData, isLoading: summaryLoading } = useQuery<SummaryData>({
    queryKey: ["/api/summary", category],
    queryFn: () => apiRequest("GET", `/api/summary?category=${encodeURIComponent(category)}`).then(r => r.json()),
  });

  // Resolution stats
  const { data: resolutionData, isLoading: resolutionLoading } = useQuery<ResolutionData>({
    queryKey: ["/api/resolution", category],
    queryFn: () => apiRequest("GET", `/api/resolution?category=${encodeURIComponent(category)}`).then(r => r.json()),
  });

  // Neighbourhood YoY (for top list comparisons)
  const { data: yoyData, isLoading: yoyLoading } = useQuery<{
    current: NbhdRow[];
    prev: NbhdRow[];
    currentYear: number;
    prevYear: number;
  }>({
    queryKey: ["/api/neighbourhood-yoy", category],
    queryFn: () => apiRequest("GET", `/api/neighbourhood-yoy?category=${encodeURIComponent(category)}`).then(r => r.json()),
  });

  // Open (unresolved) reports by neighbourhood
  const { data: nbhdOpen, isLoading: nbhdOpenLoading } = useQuery<NbhdRow[]>({
    queryKey: ["/api/neighbourhood-open", category],
    queryFn: () => apiRequest("GET", `/api/neighbourhood-open?category=${encodeURIComponent(category)}`).then(r => r.json()),
  });

  // Seasonal baseline
  const { data: seasonalData } = useQuery<SeasonalRow[]>({
    queryKey: ["/api/seasonal", category],
    queryFn: () => apiRequest("GET", `/api/seasonal?category=${encodeURIComponent(category)}`).then(r => r.json()),
  });

  // Neighbourhood all-time counts (for map + detail)
  const { data: nbhdAllTime } = useQuery<NbhdRow[]>({
    queryKey: ["/api/neighbourhood", category],
    queryFn: () => apiRequest("GET", `/api/neighbourhood?category=${encodeURIComponent(category)}`).then(r => r.json()),
  });

  // Neighbourhood detail trend
  const { data: nbhdTrend, isLoading: nbhdTrendLoading } = useQuery<TrendRow[]>({
    queryKey: ["/api/neighbourhood-trend", category, selectedNbhd],
    queryFn: () => apiRequest("GET", `/api/neighbourhood-trend?category=${encodeURIComponent(category)}&neighbourhood=${encodeURIComponent(selectedNbhd || "")}`).then(r => r.json()),
    enabled: !!selectedNbhd,
  });

  const categoryLabel = useMemo(() => {
    return category
      .replace(/Maintenance - /g, "")
      .replace(/  and  /g, " & ")
      .replace(/Collection  and  Disposal Services/g, "Waste Collection")
      .replace(/Public Parking Complaints/g, "Parking Complaints");
  }, [category]);

  // Which data to pass to map depends on mode
  const mapNbhdData = mapMode === "open" ? (nbhdOpen || []) : (nbhdAllTime || []);
  const mapLoading = mapMode === "open" ? nbhdOpenLoading : yoyLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header category={categoryLabel} cacheInfo={cacheInfo} />

      <main className="flex-1 max-w-[1200px] mx-auto w-full px-4 pb-16 pt-6 space-y-8">
        {/* Category Picker */}
        <CategoryPicker
          categories={CIVIC_CATEGORIES}
          selected={category}
          onChange={(c) => {
            setCategory(c);
            setSelectedNbhd(null);
          }}
        />

        {/* WOW Hero — reported + resolved side by side */}
        {summaryLoading || resolutionLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : summaryData ? (
          <WowInsight
            summaryData={summaryData}
            seasonalData={seasonalData || []}
            trendData={trendData || []}
            categoryLabel={categoryLabel}
            resolutionData={resolutionData}
          />
        ) : null}

        {/* Map + Neighbourhood panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <NeighbourhoodMap
            nbhdData={mapNbhdData}
            loading={mapLoading}
            onSelect={(nbhd) => setSelectedNbhd(nbhd === selectedNbhd ? null : nbhd)}
            selected={selectedNbhd}
            categoryLabel={categoryLabel}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
          />

          <div className="flex flex-col gap-5">
            {yoyLoading ? (
              <Skeleton className="h-80 rounded-xl" />
            ) : yoyData ? (
              <TopNeighbourhoods
                current={yoyData.current}
                prev={yoyData.prev}
                currentYear={yoyData.currentYear}
                prevYear={yoyData.prevYear}
                openData={nbhdOpen || []}
                onSelect={(n) => setSelectedNbhd(n === selectedNbhd ? null : n)}
                selected={selectedNbhd}
                categoryLabel={categoryLabel}
                summaryData={summaryData}
              />
            ) : null}

            {selectedNbhd && (
              <NeighbourhoodDetail
                neighbourhood={selectedNbhd}
                trendData={nbhdTrend || []}
                loading={nbhdTrendLoading}
                categoryLabel={categoryLabel}
                allNbhdData={nbhdAllTime || []}
                onClose={() => setSelectedNbhd(null)}
              />
            )}
          </div>
        </div>

        {/* Resolution panel — city response accountability */}
        {resolutionLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : resolutionData ? (
          <ResolutionPanel data={resolutionData} categoryLabel={categoryLabel} />
        ) : null}

        {/* Trend chart — full width */}
        {trendLoading ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : trendData ? (
          <TrendChart
            data={trendData}
            categoryLabel={categoryLabel}
            seasonalData={seasonalData || []}
            summaryData={summaryData}
          />
        ) : null}
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground space-y-1">
        <p>
          Data:{" "}
          <a href="https://data.edmonton.ca/City-Administration/311-Requests/q7ua-agfg" target="_blank" rel="noopener" className="underline hover:text-foreground">
            City of Edmonton Open Data
          </a>{" "}
          · Updated daily · Built with Perplexity Computer
        </p>
        <p>
          Prompted by{" "}
          <a href="https://linkedin.com/in/faltincicek" target="_blank" rel="noopener" className="underline hover:text-foreground">
            Furkan Altincicek
          </a>{" "}
          at{" "}
          <a href="https://linkedin.com/in/shawnkanungo" target="_blank" rel="noopener" className="underline hover:text-foreground">
            Shawn Kanungo
          </a>
          's Perplexity Meetup
        </p>
      </footer>
    </div>
  );
}
