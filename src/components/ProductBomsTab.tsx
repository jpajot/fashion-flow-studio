import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Layers, GitBranch } from "lucide-react";
import { StatusBadge } from "@/lib/badges";
import NewBOMDialog from "@/components/bom/NewBOMDialog";

type BomType = "bom" | "routing";

interface Props {
  productId: string;
  bomType?: BomType; // default "bom"
  compact?: boolean;
}

export default function ProductBomsTab({ productId, bomType = "bom", compact = false }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);

  const isRouting = bomType === "routing";
  const label = isRouting ? "Routing" : "BOM";
  const labelPlural = isRouting ? "Routings" : "BOMs";
  const Icon = isRouting ? GitBranch : Layers;

  const load = async () => {
    const { data } = await supabase
      .from("boms")
      .select("*")
      .eq("product_id", productId)
      .eq("bom_type", bomType)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { if (productId) load(); /* eslint-disable-next-line */ }, [productId, bomType]);

  const phaseStyle = (phase: string) => {
    if (phase === "production") return { bg: "#10B981", short: "PROD" };
    if (phase === "sample") return { bg: "#8B5CF6", short: "SAMPLE" };
    return { bg: "#6B7280", short: "DEV" };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Icon className="w-4 h-4" />{labelPlural}</h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="w-3.5 h-3.5" />New {label}
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className={`text-center bg-muted/30 rounded-xl border border-dashed ${compact ? "py-6" : "py-12"}`}>
          <p className="text-sm text-muted-foreground">No {labelPlural.toLowerCase()} yet for this product.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(b => {
            const ps = phaseStyle(b.bom_phase);
            return (
              <div
                key={b.id}
                onClick={() => navigate(`/boms/${b.id}`)}
                className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-all"
              >
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: ps.bg, color: "#fff" }}
                >
                  {ps.short}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {b.name && <span className="text-sm font-medium truncate">{b.name}</span>}
                    <span className="text-sm font-medium">Rev {b.revision_code} · v{b.version}</span>
                    <StatusBadge value={b.status} />
                    {b.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">default</span>
                    )}
                    {b.pending_eco_review_count > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                        {b.pending_eco_review_count} ECO pending
                      </span>
                    )}
                  </div>
                  {b.notes && !compact && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.notes}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(b.created_at).toLocaleDateString()}</span>
              </div>
            );
          })}
        </div>
      )}

      <NewBOMDialog
        open={showNew}
        mode={bomType}
        onClose={() => setShowNew(false)}
        prefilledProductId={productId}
        onCreated={(newRow) => {
          setShowNew(false);
          setRows(prev => [newRow, ...prev]);
          setTimeout(() => navigate(`/boms/${newRow.id}`), 300);
        }}
      />
    </div>
  );
}
