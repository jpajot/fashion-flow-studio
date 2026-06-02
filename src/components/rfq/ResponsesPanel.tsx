import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { X, Loader2, MessageSquarePlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ResponseCard from "./ResponseCard";
import AddResponseDialog from "./AddResponseDialog";

interface Props {
  line: any;
  rfq: any;
  productMap: Record<string, any>;
  stepMap: Record<string, any>;
  supplierMap: Record<string, any>;
  onClose: () => void;
  onLineChanged: () => void;
}

export default function ResponsesPanel({ line, rfq, productMap, stepMap, supplierMap, onClose, onLineChanged }: Props) {
  const product  = productMap[line.product_id];
  const step     = stepMap[line.routing_step_id];
  const supplier = supplierMap[line.recipient_supplier_id];

  const [responses, setResponses] = useState<any[]>([]);
  const [currencyMap, setCurrencyMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingResponse, setEditingResponse] = useState<any>(null);

  const [awardingResponse, setAwardingResponse] = useState<any>(null);
  const [priorCost, setPriorCost] = useState<any>(null);
  const [awarding, setAwarding] = useState(false);
  const [showAwardConfirm, setShowAwardConfirm] = useState(false);

  const loadResponses = useCallback(async () => {
    setLoading(true);
    const [respRes, curRes] = await Promise.all([
      supabase.from("rfq_responses").select("*").eq("rfq_line_id", line.id).order("created_at", { ascending: false }),
      supabase.from("currencies").select("id,code,decimal_places").order("code"),
    ]);
    setResponses(respRes.data ?? []);
    setCurrencyMap(Object.fromEntries((curRes.data ?? []).map((c: any) => [c.id, c])));
    setLoading(false);
  }, [line.id]);

  useEffect(() => { loadResponses(); }, [loadResponses]);

  const lineWithTarget = { ...line, _targetCurrencyId: rfq.target_currency_id };

  const handleSaved = () => {
    setShowAddDialog(false);
    setEditingResponse(null);
    loadResponses();
    onLineChanged();
  };

  const handleDeleted = () => {
    loadResponses();
    onLineChanged();
  };

  const handleAwardClick = async (response: any) => {
    const { data: priors } = await supabase.from("product_costs")
      .select("id,total_cost_target_ccy,target_currency_id,source_sr_id,awarded_at")
      .eq("status", "active")
      .eq("project_id", rfq.project_id)
      .eq("product_id", line.product_id)
      .eq("routing_step_id", line.routing_step_id)
      .eq("supplier_id", line.recipient_supplier_id);

    setAwardingResponse(response);
    setPriorCost(priors?.[0] ?? null);
    setShowAwardConfirm(true);
  };

  const handleAwardConfirm = async () => {
    if (!awardingResponse) return;
    setAwarding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/award-rfq-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            rfq_line_id: line.id,
            response_id: awardingResponse.id,
            rfq_id: rfq.id,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Award failed");
      toast.success("Response awarded" + (json.prior_cost_superseded ? " — prior cost superseded" : ""));
      setShowAwardConfirm(false);
      setAwardingResponse(null);
      setPriorCost(null);
      loadResponses();
      onLineChanged();
    } catch (err: any) {
      toast.error("Award failed: " + err.message);
    }
    setAwarding(false);
  };

  const targetCurrency = currencyMap[rfq.target_currency_id];

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full z-40 flex flex-col bg-background border-l border-border shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">
              Responses — {product?.code || "?"} / Step {step?.sequence}: {(step?.step_type || "").replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Recipient: {supplier?.name || "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 w-full" onClick={() => setShowAddDialog(true)}>
            <MessageSquarePlus className="w-3.5 h-3.5" /> Add Response
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">No responses yet.</p>
              <p className="text-xs text-muted-foreground">Click Add Response to record one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map(resp => (
                <ResponseCard
                  key={resp.id}
                  response={resp}
                  currencyMap={currencyMap}
                  line={lineWithTarget}
                  onEdit={setEditingResponse}
                  onDeleted={handleDeleted}
                  onAward={handleAwardClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddDialog && (
        <AddResponseDialog line={line} rfq={rfq} productMap={productMap} stepMap={stepMap} supplierMap={supplierMap} onSaved={handleSaved} onClose={() => setShowAddDialog(false)} />
      )}
      {editingResponse && (
        <AddResponseDialog line={line} rfq={rfq} productMap={productMap} stepMap={stepMap} supplierMap={supplierMap} existingResponse={editingResponse} onSaved={handleSaved} onClose={() => setEditingResponse(null)} />
      )}

      <AlertDialog open={showAwardConfirm} onOpenChange={o => { if (!o) { setShowAwardConfirm(false); setAwardingResponse(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Award this response?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {awardingResponse && (
                  <div className="bg-blue-50/50 rounded-lg p-3 space-y-1 text-xs border border-blue-200/50">
                    <div className="font-semibold text-blue-900">
                      {awardingResponse.total_cost_supplier_ccy} {currencyMap[awardingResponse.supplier_currency_id]?.code}
                      {awardingResponse.total_cost_target_ccy && targetCurrency && awardingResponse.supplier_currency_id !== rfq.target_currency_id &&
                        ` = ${awardingResponse.total_cost_target_ccy} ${targetCurrency.code}`}
                    </div>
                    {awardingResponse.valid_from && <div className="text-muted-foreground">Valid: {awardingResponse.valid_from} → {awardingResponse.valid_until || "∞"}</div>}
                    {awardingResponse.leadtime_days && <div className="text-muted-foreground">Lead time: {awardingResponse.leadtime_days} days</div>}
                  </div>
                )}
                {priorCost && (
                  <div className="bg-amber-50/70 rounded-lg p-3 border border-amber-200/50 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900">
                      <p className="font-semibold">Existing cost will be superseded</p>
                      <p className="mt-1">{priorCost.total_cost_target_ccy} {currencyMap[priorCost.target_currency_id]?.code}, awarded {priorCost.awarded_at ? new Date(priorCost.awarded_at).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">All other responses for this line will be rejected.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={awarding}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAwardConfirm} disabled={awarding} className="gap-2">
              {awarding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Confirm Award
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
