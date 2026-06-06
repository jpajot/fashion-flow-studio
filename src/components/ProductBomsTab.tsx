import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { StatusBadge } from "@/lib/badges";
import NewBOMDialog from "@/components/bom/NewBOMDialog";

export default function ProductBomsTab({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const [boms, setBoms] = useState<any[]>([]);
  const [showNewBOM, setShowNewBOM] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("boms").select("*").eq("product_id", productId).order("created_at", { ascending: false });
    setBoms(data ?? []);
  };
  useEffect(() => { if (productId) load(); /* eslint-disable-next-line */ }, [productId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4" />BOMs</h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNewBOM(true)}>
          <Plus className="w-3.5 h-3.5" />New BOM
        </Button>
      </div>
      {boms.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">No BOMs yet for this product.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {boms.map(b => (
            <div
              key={b.id}
              onClick={() => navigate(`/boms/${b.id}`)}
              className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-all"
            >
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ backgroundColor: b.bom_phase === "production" ? "#10B981" : "#6B7280", color: "#fff" }}
              >
                {b.bom_phase === "production" ? "PROD" : "DEV"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">Rev {b.revision_code} · v{b.version}</span>
                  <StatusBadge value={b.status} />
                  {b.pending_eco_review_count > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                      {b.pending_eco_review_count} ECO pending
                    </span>
                  )}
                </div>
                {b.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.notes}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(b.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      <NewBOMDialog
        open={showNewBOM}
        onClose={() => setShowNewBOM(false)}
        prefilledProductId={productId}
        onCreated={(newBom) => {
          setShowNewBOM(false);
          setBoms(prev => [newBom, ...prev]);
          setTimeout(() => navigate(`/boms/${newBom.id}`), 300);
        }}
      />
    </div>
  );
}
