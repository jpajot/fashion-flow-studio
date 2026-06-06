import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, X } from "lucide-react";
import RoutingLifecycleSection from "@/components/supplier/RoutingLifecycleSection";
import { useToast } from "@/hooks/use-toast";

const BOM_TYPE_LABEL: Record<string, string> = { development: "Dev", production: "Prod", sample: "Sample" };
const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};
function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE_COLORS[status] || "bg-muted text-muted-foreground border-border";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-block ${cls}`}>{status}</span>;
}

export default function MfgOpsTab({ bom, allProducts, onOpenChangeRouting }: { bom: any; allProducts: any[]; onOpenChangeRouting?: (preselectedId?: string) => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [impactedBoms, setImpactedBoms] = useState<any[]>([]);
  const [newlyCreatedRouting, setNewlyCreatedRouting] = useState<any>(null);
  const routingId = bom?.selected_routing_id;

  const fetchImpacted = async () => {
    if (!routingId) { setImpactedBoms([]); return; }
    const { data } = await supabase.from("boms").select("*").eq("selected_routing_id", routingId);
    setImpactedBoms((data ?? []).filter((b: any) => b.id !== bom.id));
  };

  useEffect(() => { fetchImpacted(); /* eslint-disable-next-line */ }, [routingId, bom?.id]);

  useEffect(() => {
    if (newlyCreatedRouting && bom?.selected_routing_id === newlyCreatedRouting.id) setNewlyCreatedRouting(null);
  }, [bom?.selected_routing_id, newlyCreatedRouting?.id]);

  const handleRoutingCreated = (newRouting: any) => {
    setNewlyCreatedRouting(newRouting);
    fetchImpacted();
    toast({
      title: "New routing created",
      description: `Created ${newRouting.name} Rev ${newRouting.revision_code} v${newRouting.version}. This BOM still points to the original routing.`,
    });
  };

  if (!routingId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-sm font-medium text-foreground">No routing linked to this BOM</p>
        <p className="text-xs text-muted-foreground max-w-xs">Link a routing from the BOM header to populate manufacturing operations.</p>
      </div>
    );
  }

  const displayedImpacted = impactedBoms.slice(0, 5);
  const extraCount = impactedBoms.length - 5;

  return (
    <div className="space-y-3">
      {newlyCreatedRouting && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-blue-900">New routing version available</p>
            <p className="text-xs text-blue-800"><span className="font-medium">{newlyCreatedRouting.name}</span> · Rev {newlyCreatedRouting.revision_code} v{newlyCreatedRouting.version} · <StatusBadge status={newlyCreatedRouting.status} /> was just created. This BOM still uses the original routing.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenChangeRouting && (
              <Button size="sm" className="h-7 text-xs" onClick={() => onOpenChangeRouting(newlyCreatedRouting.id)}>Switch BOM</Button>
            )}
            <button type="button" className="text-blue-400 hover:text-blue-700 transition-colors" onClick={() => setNewlyCreatedRouting(null)} title="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {impactedBoms.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-semibold text-amber-900">This routing is also used by {impactedBoms.length} other BOM{impactedBoms.length > 1 ? "s" : ""}</p>
            <p className="text-xs text-amber-800">
              {displayedImpacted.map((b: any, i: number) => {
                const prod = allProducts.find((p: any) => p.id === b.product_id);
                const label = `${prod?.code || prod?.name || "Unknown"} · ${BOM_TYPE_LABEL[b.bom_phase] || b.bom_phase} Rev ${b.revision_code} v${b.version}`;
                return (
                  <span key={b.id}>{i > 0 && ", "}<button type="button" className="underline underline-offset-2 hover:text-amber-900 transition-colors" onClick={() => navigate(`/boms/${b.id}`)}>{label}</button>{" "}<StatusBadge status={b.status} /></span>
                );
              })}
              {extraCount > 0 && `, and ${extraCount} more`}
            </p>
            <p className="text-xs text-amber-700">Changes here will be visible on those BOMs too once the routing is released.</p>
          </div>
        </div>
      )}

      <RoutingLifecycleSection mode="single" routingId={routingId} onRoutingCreated={handleRoutingCreated} />
    </div>
  );
}
