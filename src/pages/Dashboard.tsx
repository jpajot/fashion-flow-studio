import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shirt, FolderKanban, GitBranch, DollarSign } from "lucide-react";

type Stats = { products: number; projects: number; ecos: number; rfqs: number };

const items = [
  { key: "products" as const, label: "Products", icon: Shirt, color: "text-indigo-600" },
  { key: "projects" as const, label: "Active Projects", icon: FolderKanban, color: "text-emerald-600" },
  { key: "ecos" as const, label: "Pending ECOs", icon: GitBranch, color: "text-amber-600" },
  { key: "rfqs" as const, label: "Open RFQs", icon: DollarSign, color: "text-rose-600" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ products: 0, projects: 0, ecos: 0, rfqs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const count = async (table: string, filter?: (q: any) => any) => {
        let q = supabase.from(table).select("*", { count: "exact", head: true });
        if (filter) q = filter(q);
        const { count: c } = await q;
        return c ?? 0;
      };
      const [products, projects, ecos, rfqs] = await Promise.all([
        count("products"),
        count("projects", (q) => q.in("status", ["active", "in_progress", "open"])),
        count("ecos", (q) => q.eq("status", "pending")),
        count("rfq_rounds", (q) => q.eq("status", "open")),
      ]);
      setStats({ products, projects, ecos, rfqs });
      setLoading(false);
    })().catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your product lifecycle</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "—" : stats[key]}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
