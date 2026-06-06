import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { Plus, RefreshCw } from "lucide-react";
import { PAGE_WRAPPER } from "@/lib/utils";
import { StatusBadge } from "@/lib/badges";
import NewBOMDialog from "@/components/bom/NewBOMDialog";

export default function BOMs() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const [boms, setBoms] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [showNewBOM, setShowNewBOM] = useState(false);

  const loadAll = async () => {
    const [b, p] = await Promise.all([
      supabase.from("boms").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id,name,images,type").order("name"),
    ]);
    setBoms(b.data ?? []);
    setProducts(p.data ?? []);
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    setOptions({
      items: [
        { label: "New BOM", icon: Plus, onClick: () => setShowNewBOM(true), className: "text-primary hover:bg-primary/10" },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: loadAll },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productById = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);

  const filtered = boms.filter(b => {
    if (typeFilter !== "all" && b.bom_type !== typeFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (productFilter !== "all" && b.product_id !== productFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const prod = productById.get(b.product_id);
      const hay = `${prod?.name || ""} ${b.revision_code || ""} ${b.notes || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className={`${PAGE_WRAPPER} space-y-4`}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">BOMs</h1>
        <p className="text-sm text-muted-foreground">Bills of materials across all products</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search product, revision, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="released">Released</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
            <SelectItem value="obsolete">Obsolete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
            <p className="text-sm text-muted-foreground mb-3">No BOMs yet. Create one to start managing components.</p>
            <Button onClick={() => setShowNewBOM(true)} className="gap-1.5"><Plus className="w-4 h-4" />New BOM</Button>
          </div>
        ) : filtered.map(b => {
          const prod = productById.get(b.product_id);
          const isProd = b.bom_phase === "production";
          return (
            <div
              key={b.id}
              onClick={() => navigate(`/boms/${b.id}`)}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: isProd ? "#10B981" : "#6B7280", color: "#fff" }}>
                  {isProd ? "PROD" : "DEV"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{prod?.name || "Unknown product"}</span>
                  <span className="font-mono text-xs text-muted-foreground">Rev {b.revision_code || "—"} v{b.version || "—"}</span>
                  <StatusBadge value={b.status} />
                  {b.pending_eco_review_count > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                      {b.pending_eco_review_count} ECO pending
                    </span>
                  )}
                </div>
                {b.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{b.notes}</p>}
                {b.order_context?.target_quantity && (
                  <p className="text-xs text-muted-foreground mt-1">Target: {b.order_context.target_quantity} units</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{b.valid_from ? `Valid from ${b.valid_from}` : ""}</p>
              </div>
            </div>
          );
        })}
      </div>

      <NewBOMDialog
        open={showNewBOM}
        onClose={() => setShowNewBOM(false)}
        onCreated={(newBom) => {
          setShowNewBOM(false);
          setTimeout(() => navigate(`/boms/${newBom.id}`), 300);
        }}
      />
    </div>
  );
}
