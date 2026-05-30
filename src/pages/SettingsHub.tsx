import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  ListChecks,
  Hash,
  SwatchBook,
  Ruler,
  CircleDollarSign,
  Settings as SettingsIcon,
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
  { to: "/color-palettes", title: "Color Studio", desc: "Manage colors and palettes", icon: SwatchBook, ready: true },
  { to: "/config", title: "Size Studio", desc: "Coming soon", icon: Ruler, ready: false },
  { to: "/config", title: "Currencies", desc: "Coming soon", icon: CircleDollarSign, ready: false },
  { to: "/config", title: "App Config", desc: "Coming soon", icon: SettingsIcon, ready: false },
];

export default function SettingsHub() {
  return (
    <div className="p-6 space-y-6">
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
