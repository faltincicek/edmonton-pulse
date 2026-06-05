import { useEffect, useRef, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { NbhdRow } from "@/pages/Dashboard";
import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function getHeatLevel(count: number, max: number): number {
  if (max === 0) return 0;
  const ratio = count / max;
  if (ratio < 0.05) return 0;
  if (ratio < 0.15) return 1;
  if (ratio < 0.30) return 2;
  if (ratio < 0.50) return 3;
  if (ratio < 0.75) return 4;
  return 5;
}

const HEAT_COLORS_LIGHT = ["#e8eaf0", "#93b5d8", "#5b97cc", "#2d78ba", "#f5a623", "#e07020"];
const HEAT_COLORS_DARK = ["#1e2535", "#263d5a", "#2d5a80", "#3080b0", "#c47a1a", "#e07830"];

type GeoFeature = {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: { neighbourhood_number: string; name: string; descriptive_name?: string };
};

type GeoCollection = { type: string; features: GeoFeature[] };

export default function NeighbourhoodMap({
  nbhdData,
  loading,
  onSelect,
  selected,
  categoryLabel,
  mapMode = "open",
  onMapModeChange,
}: {
  nbhdData: NbhdRow[];
  loading: boolean;
  onSelect: (nbhd: string) => void;
  selected: string | null;
  categoryLabel: string;
  mapMode?: "open" | "all";
  onMapModeChange?: (mode: "open" | "all") => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const geoLayerRef = useRef<unknown>(null);
  const [mapReady, setMapReady] = useState(false);
  const isDark = document.documentElement.classList.contains("dark");

  // Fetch GeoJSON
  const { data: geoData, isLoading: geoLoading } = useQuery<GeoCollection>({
    queryKey: ["/api/geo/neighbourhoods"],
    queryFn: () => apiRequest("GET", "/api/geo/neighbourhoods").then(r => r.json()),
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Build count lookup
  const countByNbhd = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of nbhdData) {
      if (row.neighbourhood) {
        map[row.neighbourhood.toUpperCase()] = Number(row.cnt);
      }
    }
    return map;
  }, [nbhdData]);

  const maxCount = useMemo(
    () => Math.max(...Object.values(countByNbhd), 1),
    [countByNbhd]
  );

  // Init map once the div is ready
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Fix default icon paths
      // @ts-ignore
      delete L.default.Icon.Default.prototype._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const LL = L.default;
      const map = LL.map(mapRef.current!, {
        center: [53.545, -113.49],
        zoom: 10,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      const tileUrl = document.documentElement.classList.contains("dark")
        ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";

      LL.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Label layer on top
      const labelUrl = document.documentElement.classList.contains("dark")
        ? "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";
      LL.tileLayer(labelUrl, {
        subdomains: "abcd",
        maxZoom: 19,
        pane: "shadowPane",
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run once

  // Add/update GeoJSON layer when data or selection changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !geoData) return;

    // Capture props as local vars before async import so closure is stable
    const currentMapMode = mapMode;
    const currentCategoryLabel = categoryLabel;

    import("leaflet").then((L) => {
      const LL = L.default;
      const map = mapInstanceRef.current as ReturnType<typeof LL.map>;

      if (geoLayerRef.current) {
        map.removeLayer(geoLayerRef.current as ReturnType<typeof LL.geoJSON>);
        geoLayerRef.current = null;
      }

      const COLORS = document.documentElement.classList.contains("dark")
        ? HEAT_COLORS_DARK
        : HEAT_COLORS_LIGHT;

      const layer = LL.geoJSON(geoData as GeoJSON.GeoJsonObject, {
        style: (feature) => {
          const name = feature?.properties?.name?.toUpperCase() || "";
          const count = countByNbhd[name] || 0;
          const level = getHeatLevel(count, maxCount);
          const isSelectedFeature = selected === feature?.properties?.name;
          return {
            fillColor: COLORS[level],
            fillOpacity: isSelectedFeature ? 0.95 : 0.7,
            weight: isSelectedFeature ? 3 : 0.8,
            color: isSelectedFeature ? "#f59e0b" : (document.documentElement.classList.contains("dark") ? "#2a3040" : "#aab0bb"),
            opacity: 1,
          };
        },
        onEachFeature: (feature, lyr) => {
          const name = feature.properties?.name || "";
          const descriptive = feature.properties?.descriptive_name || name;
          const count = countByNbhd[name.toUpperCase()] || 0;

          lyr.on("click", () => {
            if (name) onSelect(name);
          });

          lyr.bindTooltip(
            `<strong>${descriptive}</strong><br/>${count.toLocaleString()} ${currentCategoryLabel} ${currentMapMode === "open" ? "open (unresolved)" : "total"} reports`,
            { sticky: true, className: "nbhd-tooltip", opacity: 1 }
          );
        },
      }).addTo(map);

      geoLayerRef.current = layer;
    });
  }, [mapReady, geoData, countByNbhd, maxCount, selected, onSelect, categoryLabel, mapMode]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{categoryLabel} — Neighbourhood map</span>
        </div>
        <div className="flex items-center gap-1">
            {onMapModeChange && (
              <>
                <button
                  onClick={() => onMapModeChange("open")}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                    mapMode === "open"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Unresolved
                </button>
                <button
                  onClick={() => onMapModeChange("all")}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                    mapMode === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All reports
                </button>
              </>
            )}
          </div>
      </div>
      {mapMode && (
        <div className="px-4 py-1.5 bg-secondary/40 border-b border-border text-xs text-muted-foreground">
          {mapMode === "open"
            ? "Showing neighbourhoods with currently open (unresolved) reports"
            : "Showing all reports filed since 2023"}
        </div>
      )}
      {/* Map container — must always be in DOM */}
      <div
        ref={mapRef}
        style={{ height: "400px", width: "100%" }}
        data-testid="map-container"
      />
      {/* Legend */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
        <span className="text-xs text-muted-foreground mr-1">Fewer</span>
        {HEAT_COLORS_LIGHT.map((c, i) => (
          <div
            key={i}
            className="w-5 h-3 rounded-sm border border-border/30"
            style={{ background: c }}
            title={["None", "Very Low", "Low", "Medium", "High", "Very High"][i]}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">More</span>
        {geoLoading && (
          <span className="text-xs text-muted-foreground ml-2">Loading neighbourhoods…</span>
        )}
      </div>
    </div>
  );
}
