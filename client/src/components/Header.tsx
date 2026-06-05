import { useTheme } from "./ThemeProvider";
import { Sun, Moon, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CacheInfo } from "@/pages/Dashboard";

function formatLastFetched(ts: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Header({ category, cacheInfo }: { category: string; cacheInfo?: CacheInfo }) {
  const { theme, toggle } = useTheme();
  const fetchedLabel = formatLastFetched(cacheInfo?.latestFetch ?? null);

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Logo */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Edmonton 311 Pulse logo" className="shrink-0">
            <rect width="28" height="28" rx="7" fill="hsl(var(--primary))" />
            <circle cx="14" cy="14" r="6" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="14" cy="14" r="2" fill="hsl(var(--accent))" />
            <path d="M14 8V6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 14H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 20V22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 14H6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <span className="font-bold text-sm tracking-tight text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Edmonton 311 Pulse
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground leading-none mt-0.5">
              <MapPin className="w-3 h-3" />
              <span>Civic analytics for Edmontonians</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span>
              Live data · refreshes daily
              {fetchedLabel ? <span className="ml-1 opacity-70">· fetched {fetchedLabel}</span> : null}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            data-testid="button-theme-toggle"
            className="h-8 w-8"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
