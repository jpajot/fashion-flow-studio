import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";

interface Props {
  line: any;
  rfq: any;
  productMap: Record<string, any>;
  stepMap: Record<string, any>;
  supplierMap: Record<string, any>;
  existingResponse?: any;
  onSaved: () => void;
  onClose: () => void;
}

export default function AddResponseDialog({ line, rfq, productMap, stepMap, supplierMap, existingResponse, onSaved, onClose }: Props) {
  const { user } = useAuth();
  const isEdit = !!existingResponse;

  const product  = productMap[line.product_id];
  const step     = stepMap[line.bom_line_id];
  const supplier = supplierMap[line.recipient_supplier_id];
  const dialogTitle = `${isEdit ? "Edit" : "Add"} Response — ${product?.code || "?"} / Step ${step?.sequence}: ${(step?.step_type || "").replace(/_/g, " ")} / ${supplier?.name || "?"}`;

  const [currencies, setCurrencies] = useState<any[]>([]);
  const [targetCurrency, setTargetCurrency] = useState<any>(null);
  const [conversionRate, setConversionRate] = useState<{ rate: number; effective_date: string | null; id: string | null } | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    valid_from: "", valid_until: "",
    min_qty: "", max_qty: "",
    leadtime_days: "",
    supplier_currency_id: "",
    total_cost_supplier_ccy: "",
    supplier_notes: "", reviewer_notes: "",
  });

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  useEffect(() => {
    Promise.all([
      supabase.from("currencies").select("id,code,name,decimal_places").eq("is_active", true).order("code"),
      rfq.target_currency_id
        ? supabase.from("currencies").select("id,code,decimal_places").eq("id", rfq.target_currency_id).single()
        : Promise.resolve({ data: null }),
    ]).then(([cRes, tcRes]) => {
      setCurrencies(cRes.data ?? []);
      setTargetCurrency((tcRes as any).data ?? null);

      if (isEdit && existingResponse) {
        setForm({
          valid_from: existingResponse.valid_from || "",
          valid_until: existingResponse.valid_until || "",
          min_qty: existingResponse.min_qty != null ? String(existingResponse.min_qty) : "",
          max_qty: existingResponse.max_qty != null ? String(existingResponse.max_qty) : "",
          leadtime_days: existingResponse.leadtime_days != null ? String(existingResponse.leadtime_days) : "",
          supplier_currency_id: existingResponse.supplier_currency_id || "",
          total_cost_supplier_ccy: existingResponse.total_cost_supplier_ccy != null ? String(existingResponse.total_cost_supplier_ccy) : "",
          supplier_notes: existingResponse.supplier_notes || "",
          reviewer_notes: existingResponse.reviewer_notes || "",
        });
      } else {
        const sup = supplierMap[line.recipient_supplier_id];
        const defaultCurrId = sup?.currency_default_id || rfq.target_currency_id || "";
        setForm(f => ({ ...f, supplier_currency_id: defaultCurrId }));
      }
      setLoadingInit(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.supplier_currency_id || !rfq.target_currency_id) return;
    if (form.supplier_currency_id === rfq.target_currency_id) {
      setConversionRate({ rate: 1, effective_date: null, id: null });
      return;
    }
    setRateLoading(true);
    const today = new Date().toISOString().split("T")[0];
    supabase.from("currency_conversion_rates")
      .select("id,rate,effective_date")
      .eq("from_currency_id", form.supplier_currency_id)
      .eq("to_currency_id", rfq.target_currency_id)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setConversionRate(data?.[0] ? { rate: data[0].rate, effective_date: data[0].effective_date, id: data[0].id } : null);
        setRateLoading(false);
      });
  }, [form.supplier_currency_id, rfq.target_currency_id]);

  const chosenCurrency = useMemo(() => currencies.find(c => c.id === form.supplier_currency_id), [currencies, form.supplier_currency_id]);
  const isSameCurrency = form.supplier_currency_id === rfq.target_currency_id;
  const rate = conversionRate?.rate ?? null;
  const costNum = parseFloat(form.total_cost_supplier_ccy);
  const convertedTotal = (!isNaN(costNum) && rate != null) ? costNum * rate : null;
  const decimalPlaces = chosenCurrency?.decimal_places ?? 2;
  const targetDecimalPlaces = targetCurrency?.decimal_places ?? 2;

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!form.supplier_currency_id) errs.supplier_currency_id = "Currency is required.";
    if (!form.total_cost_supplier_ccy || isNaN(parseFloat(form.total_cost_supplier_ccy))) errs.total_cost_supplier_ccy = "Total cost is required.";
    if (!isSameCurrency && rate == null && !errs.supplier_currency_id) errs.supplier_currency_id = "No conversion rate available. Add one in Settings → Currencies first.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    const totalSupplier = parseFloat(form.total_cost_supplier_ccy);
    const totalTarget = isSameCurrency ? totalSupplier : parseFloat((totalSupplier * rate!).toFixed(targetDecimalPlaces));

    const payload: any = {
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      min_qty: form.min_qty ? parseFloat(form.min_qty) : null,
      max_qty: form.max_qty ? parseFloat(form.max_qty) : null,
      leadtime_days: form.leadtime_days ? parseFloat(form.leadtime_days) : null,
      supplier_currency_id: form.supplier_currency_id,
      total_cost_supplier_ccy: totalSupplier,
      total_cost_target_ccy: totalTarget,
      conversion_rate_used: isSameCurrency ? 1 : rate,
      conversion_rate_id: isSameCurrency ? null : (conversionRate?.id ?? null),
      conversion_rate_date: isSameCurrency ? today : (conversionRate?.effective_date ?? null),
      supplier_notes: form.supplier_notes.trim() || null,
      reviewer_notes: form.reviewer_notes.trim() || null,
    };

    if (isEdit && existingResponse) {
      await supabase.from("rfq_responses").update(payload).eq("id", existingResponse.id);
    } else {
      await supabase.from("rfq_responses").insert({
        ...payload,
        rfq_line_id: line.id,
        status: "submitted",
        submitted_at: now,
        submitted_by: user?.email || "",
        is_awarded: false,
      });
      if (line.status === "pending") {
        await supabase.from("rfq_lines").update({ status: "answered" }).eq("id", line.id);
      }
    }

    setSubmitting(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm leading-snug">{dialogTitle}</DialogTitle>
        </DialogHeader>

        {loadingInit ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validity Window</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Valid From</Label><Input type="date" value={form.valid_from} onChange={e => set("valid_from", e.target.value)} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Valid Until</Label><Input type="date" value={form.valid_until} onChange={e => set("valid_until", e.target.value)} className="h-8 text-xs" /></div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantity Applicability</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Min Qty</Label><Input type="number" min={0} value={form.min_qty} onChange={e => set("min_qty", e.target.value)} className="h-8 text-xs" placeholder="—" /></div>
                <div className="space-y-1"><Label className="text-xs">Max Qty</Label><Input type="number" min={0} value={form.max_qty} onChange={e => set("max_qty", e.target.value)} className="h-8 text-xs" placeholder="—" /></div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead Time</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} value={form.leadtime_days} onChange={e => set("leadtime_days", e.target.value)} className="h-8 text-xs w-28" placeholder="—" />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Supplier Currency <span className="text-destructive">*</span></Label>
                  <Select value={form.supplier_currency_id || "__none"} onValueChange={v => set("supplier_currency_id", v === "__none" ? "" : v)}>
                    <SelectTrigger className={`h-8 text-xs ${errors.supplier_currency_id ? "border-destructive" : ""}`}><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" disabled>Select currency…</SelectItem>
                      {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.supplier_currency_id && <p className="text-xs text-destructive">{errors.supplier_currency_id}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total Cost (per unit) <span className="text-destructive">*</span></Label>
                  <Input type="number" min={0} step={Math.pow(10, -decimalPlaces)} value={form.total_cost_supplier_ccy}
                    onChange={e => set("total_cost_supplier_ccy", e.target.value)}
                    className={`h-8 text-xs ${errors.total_cost_supplier_ccy ? "border-destructive" : ""}`} placeholder="0.00" />
                  {errors.total_cost_supplier_ccy && <p className="text-xs text-destructive">{errors.total_cost_supplier_ccy}</p>}
                </div>
              </div>

              {form.supplier_currency_id && targetCurrency && (
                <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Converted to {targetCurrency.code}</p>
                  {rateLoading ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading rate…</div>
                  ) : isSameCurrency ? (
                    <p className="text-xs text-muted-foreground">Same currency — no conversion needed.</p>
                  ) : rate != null ? (
                    <>
                      <p className="text-sm font-mono">
                        {!isNaN(costNum) ? costNum.toFixed(decimalPlaces) : "—"} × {rate} = <span className="font-semibold text-foreground">{convertedTotal != null ? convertedTotal.toFixed(targetDecimalPlaces) : "—"} {targetCurrency.code}</span>
                      </p>
                      {conversionRate?.effective_date && <p className="text-[10px] text-muted-foreground">Rate effective: {conversionRate.effective_date}</p>}
                    </>
                  ) : (
                    <div className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>No conversion rate found. Add one in Settings → Currencies before submitting.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</Label>
              <div className="space-y-1"><Label className="text-xs">Supplier Notes</Label><Textarea value={form.supplier_notes} onChange={e => set("supplier_notes", e.target.value)} placeholder="Comments from the supplier." rows={3} /></div>
              <div className="space-y-1"><Label className="text-xs">Reviewer Notes</Label><Textarea value={form.reviewer_notes} onChange={e => set("reviewer_notes", e.target.value)} placeholder="Internal — not shared with supplier." rows={3} /></div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingInit} className="gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Submit Response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
