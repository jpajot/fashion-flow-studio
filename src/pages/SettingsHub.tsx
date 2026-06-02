import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  ListChecks,
  Hash,
  SwatchBook,
  Palette,
  Ruler,
  CircleDollarSign,
  Settings as SettingsIcon,
  RefreshCw,
} from "lucide-react";

const SECTIONS = [
  {
    to: "/list-of-values",
    title: "List of Values",
    desc: "Reference data types and values",
    icon: ListChecks,
    ready: true,
  },
  { to: "/code-generators", title: "Code Generators", desc: "System code generation rules", icon: Hash, ready: true },
  { to: "/color-palettes", title: "Color Studio", desc: "Palettes, technical & commercial colors", icon: SwatchBook, ready: true },
  { to: "/size-studio", title: "Size Studio", desc: "Size grids and size library", icon: Ruler, ready: true },
  { to: "/currencies", title: "Currencies", desc: "Currencies and pricing units", icon: CircleDollarSign, ready: true },
  { to: "/app-config", title: "App Config", desc: "Application configuration values", icon: SettingsIcon, ready: true },
];

export default function SettingsHub() {
  return (
    <div className="px-3 py-3 sm:px-4 md:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Reference data and configuration for the platform.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const inner = (
            <Card className="p-4 hover:bg-muted/40 transition cursor-pointer h-full">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 text-primary p-2">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </div>
            </Card>
          );
          return s.ready ? (
            <Link key={s.title} to={s.to}>
              {inner}
            </Link>
          ) : (
            <div key={s.title} className="opacity-60">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
