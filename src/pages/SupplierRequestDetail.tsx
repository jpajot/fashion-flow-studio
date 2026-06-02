import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PAGE_WRAPPER } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileSearch } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft:         "bg-gray-100 text-gray-600 border-gray-200",
  submitted:     "bg-blue-100 text-blue-700 border-blue-200",
  in_collection: "bg-amber-100 text-amber-700 border-amber-200",
  closed:        "bg-green-100 text-green-700 border-green-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
};

export default function SupplierRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sr, setSr] = useState<any>(null);
  const [round, setRound] = useState<any>(null);
  const [currency, setCurrency] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("supplier_requests").select("*").eq("id", id).single();
      if (!data) { setLoading(false); return; }
      setSr(data);
      const [rnd, cur, proj] = await Promise.all([
        data.round_id ? supabase.from("rfq_rounds").select("id,code,label").eq("id", data.round_id).single() : Promise.resolve({ data: null }),
        data.target_currency_id ? supabase.from("currencies").select("id,code,name").eq("id", data.target_currency_id).single() : Promise.resolve({ data: null }),
        data.project_id ? supabase.from("projects").select("id,name").eq("id", data.project_id).single() : Promise.resolve({ data: null }),
      ]);
      setRound(rnd.data);
      setCurrency(cur.data);
      setProject(proj.data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className={`${PAGE_WRAPPER} flex justify-center py-20`}><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!sr) return (
    <div className={`${PAGE_WRAPPER} text-center py-20`}>
      <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Supplier Request not found.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>Go back</Button>
    </div>
  );

  const sc = STATUS_COLORS[sr.status] ?? "bg-muted text-muted-foreground border-border";

  return (
    <div className={PAGE_WRAPPER}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        {project && (
          <>
            <span>/</span>
            <button type="button" onClick={() => navigate(`/projects/${project.id}`)} className="hover:text-foreground transition-colors">{project.name}</button>
          </>
        )}
        <span>/</span>
        <span className="text-foreground font-medium">{sr.code || "Supplier Request"}</span>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-3 mb-6">
        <div className="flex items-start gap-3 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold tracking-tight">{sr.code || "—"}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium capitalize ${sc}`}>
                {(sr.status ?? "draft").replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-base font-medium text-muted-foreground mt-0.5 truncate">{sr.name}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-muted-foreground block">Round</span><span className="font-mono font-semibold">{round?.code || "—"} {round?.label ? `· ${round.label}` : ""}</span></div>
          <div><span className="text-muted-foreground block">Target Currency</span><span className="font-mono">{currency?.code || "—"}</span></div>
          <div><span className="text-muted-foreground block">Due Date</span><span>{sr.due_date ? new Date(sr.due_date).toLocaleDateString() : "—"}</span></div>
          <div><span className="text-muted-foreground block">Created By</span><span>{sr.created_by || "—"}</span></div>
        </div>
        {sr.description && <p className="text-sm text-muted-foreground border-t border-border pt-3">{sr.description}</p>}
      </div>

      <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
        <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-muted-foreground">RFQ Lines & responses — Phase 2</p>
        <p className="text-xs text-muted-foreground mt-1">Line builder, response collection, and award flow coming next.</p>
      </div>
    </div>
  );
}
