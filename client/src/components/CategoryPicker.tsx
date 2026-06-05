import { Badge } from "@/components/ui/badge";
import {
  Construction, Snowflake, Trash2, SprayCan, Lightbulb,
  AlertTriangle, PawPrint, Tent, SignpostBig, Car, Flame, BookOpen, Bus
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  "Potholes": Construction,
  "Maintenance - Snow  and  Ice": Snowflake,
  "Maintenance - Road Services  and  Repairs": Construction,
  "Litter": Trash2,
  "Graffiti": SprayCan,
  "Traffic Signals  and  Street Lights": Lightbulb,
  "Maintenance - Sidewalk/Concrete": Construction,
  "Animal Complaints": PawPrint,
  "Encampments": Tent,
  "Street Signs": SignpostBig,
  "Animal Pick Up Request": PawPrint,
  "Bylaw Complaints": BookOpen,
  "Public Parking Complaints": Car,
  "Collection  and  Disposal Services": Trash2,
  "Detours  and  Road Closures": AlertTriangle,
  "Maintenance - ETS": Bus,
  "Fire Safety  and  Prevention": Flame,
};

const LABELS: Record<string, string> = {
  "Potholes": "Potholes",
  "Maintenance - Snow  and  Ice": "Snow & Ice",
  "Maintenance - Road Services  and  Repairs": "Road Repairs",
  "Litter": "Litter",
  "Graffiti": "Graffiti",
  "Traffic Signals  and  Street Lights": "Traffic Lights",
  "Maintenance - Sidewalk/Concrete": "Sidewalks",
  "Animal Complaints": "Animals",
  "Encampments": "Encampments",
  "Street Signs": "Street Signs",
  "Animal Pick Up Request": "Animal Pickup",
  "Bylaw Complaints": "Bylaws",
  "Public Parking Complaints": "Parking",
  "Collection  and  Disposal Services": "Waste",
  "Detours  and  Road Closures": "Road Closures",
  "Maintenance - ETS": "Transit",
  "Fire Safety  and  Prevention": "Fire Safety",
};

export default function CategoryPicker({
  categories,
  selected,
  onChange,
}: {
  categories: string[];
  selected: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Browse by service category</p>
      <div className="flex flex-wrap gap-2" role="list">
        {categories.map((cat) => {
          const Icon = ICONS[cat] || Construction;
          const label = LABELS[cat] || cat;
          const isSelected = cat === selected;
          return (
            <button
              key={cat}
              role="listitem"
              data-testid={`button-category-${label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => onChange(cat)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-150 border
                ${isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-secondary"
                }
              `}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
