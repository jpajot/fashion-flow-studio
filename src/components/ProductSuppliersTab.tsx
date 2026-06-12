import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SupplierStatusBadge } from "@/pages/Suppliers";
import ProductColorSupplierLinkMatrix from "@/components/bom/ProductColorSupplierLinkMatrix";
import {
  Building2, LayoutGrid, Plus, Crown, ArrowUp,
  Pencil, Trash2, CheckCircle2, AlertTriangle, RefreshCw,
} from "lucide-react";

type Props = { product: any; colorVariants: any[] };

export default function ProductSuppliersTab({ product, colorVariants }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { setOptions } = usePageOptions();
  const [loading, setLoading] = useState(true);
  const [approvedSuppliers, setApprovedSuppliers] = useState<any[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [lovValues, setLovValues] = useState<any[]>([]);
  const [lovTypes, setLovTypes] = useState<any[]>([]);
  const [supplierModal, setSupplierModal] = useState<any>(null);
  const [delConfirm, setDelConfirm] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    const [apps, sups, lt, lv] = await Promise.all([
      supabase.from("approved_suppliers").select("*").eq("product_id", product.id).order("rank"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("type_of_lov").select("id,code"),
      supabase.from("list_of_values").select("*"),
    ]);
    setApprovedSuppliers((apps.data || []).sort((a: any, b: any) => (a.rank || 99) - (b.rank || 99)));
    setAllSuppliers(sups.data || []);
    setLovTypes(lt.data || []);
    setLovValues(lv.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [product.id]);

  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Supplier", icon: Plus, onClick: () => openAddSupplier(), className: "text-primary hover:bg-primary/10" },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: loadData },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line
  }, []);

  const openAddSupplier = () => setSupplierModal({ mode: "add", form: {
    supplier_id: "", supplier_reference: "", status: "active", notes: "",
  }});
  const openEditSupplier = (as: any) => setSupplierModal({ mode: "edit", as, form: { ...as }});

  const handleSaveSupplier = async (form: any) => {
    if (supplierModal.mode === "add") {
      const maxRank = approvedSuppliers.reduce((m, a) => Math.max(m, a.rank || 0), 0);
      const payload = {
        product_id: product.id,
        supplier_id: form.supplier_id,
        rank: maxRank + 1,
        is_primary: approvedSuppliers.length === 0,
        supplier_reference: form.supplier_reference || null,
        status: form.status || "active",
        notes: form.notes || null,
        approved_by: user?.email || null,
        approved_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("approved_suppliers").insert(payload);
      if (error) return toast({ title: "Add failed", description: error.message, variant: "destructive" });
    } else {
      const payload: any = {
        supplier_reference: form.supplier_reference || null,
        status: form.status || "active",
        notes: form.notes || null,
      };
      const { error } = await supabase.from("approved_suppliers").update(payload).eq("id", supplierModal.as.id);
      if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
    setSupplierModal(null);
    loadData();
  };

  const handlePromoteToPrimary = async (as: any) => {
    await supabase.from("approved_suppliers").update({ is_primary: false }).eq("product_id", product.id);
    await supabase.from("approved_suppliers").update({ is_primary: true }).eq("id", as.id);
    loadData();
  };

  const handleRemoveApprovedSupplier = async () => {
    if (!delConfirm) return;
    await supabase.from("approved_suppliers").delete().eq("id", delConfirm.id);
    setDelConfirm(null);
    loadData();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const apprStatusOpts = getLovList(lovTypes, lovValues, "approved_supplier_status");

  return (
    <div className="space-y-6">
      {/* 0. Summary */}
      <SourcingSummary
        approvedSuppliers={approvedSuppliers}
        allSuppliers={allSuppliers}
      />

      {/* 1. Approved Suppliers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" />{product.type === "Service" ? "Approved suppliers for this operation" : "Approved Suppliers"}</h3>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openAddSupplier}>
            <Plus className="w-3.5 h-3.5" />Add Supplier
          </Button>
        </div>
        {approvedSuppliers.length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed">
            <p className="text-sm text-muted-foreground">No approved suppliers yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {approvedSuppliers.map((as, idx) => {
              const sup = allSuppliers.find((s) => s.id === as.supplier_id);
              return (
                <div key={as.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                  <div className="flex flex-col items-center gap-1 shrink-0 w-6">
                    {as.is_primary && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    <span className="text-xs text-muted-foreground font-mono">{as.rank || idx + 1}</span>
                    {idx > 0 && !as.is_primary && (
                      <button type="button" onClick={() => handlePromoteToPrimary(as)} title="Promote to primary" className="text-muted-foreground hover:text-primary transition-colors">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{sup?.name || "Unknown"}</span>
                      <span className="text-xs font-mono text-muted-foreground">{sup?.code}</span>
                      <SupplierStatusBadge status={as.status} />
                      {as.is_primary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">Primary</span>
                      )}
                    </div>
                    {as.supplier_reference && (
                      <div className="flex gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                        <span>Ref: {as.supplier_reference}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => openEditSupplier(as)} className="p-1.5 rounded hover:bg-muted">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => setDelConfirm(as)} className="p-1.5 rounded hover:bg-muted text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Matrix */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><LayoutGrid className="w-4 h-4" />Colorway Availability Matrix</h3>
        <ProductColorSupplierLinkMatrix
          colorVariants={colorVariants}
          approvedSuppliers={approvedSuppliers}
          allSuppliers={allSuppliers}
        />
      </div>

      {/* Supplier modal */}
      <ApprovedSupplierModal
        open={!!supplierModal}
        modal={supplierModal}
        allSuppliers={allSuppliers}
        approvedSuppliers={approvedSuppliers}
        statusOpts={apprStatusOpts}
        onClose={() => setSupplierModal(null)}
        onSave={handleSaveSupplier}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!delConfirm} onOpenChange={(o) => !o && setDelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove approved supplier?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the supplier from this product's approved list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveApprovedSupplier}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getLovList(lovTypes: any[], lovValues: any[], code: string): string[] {
  const t = lovTypes.find((x) => x.code === code);
  if (!t) return [];
  return lovValues.filter((v) => v.type_of_lov_id === t.id).map((v) => v.name);
}

function SourcingSummary({ approvedSuppliers, allSuppliers }: any) {
  const primary = approvedSuppliers.find((a: any) => a.is_primary);
  const hasA = approvedSuppliers.length > 0;
  const mode = hasA ? "Single supplier" : "Not configured";
  const isReady = primary?.status === "active";
  return (
    <div className={`rounded-xl border p-4 flex flex-wrap gap-4 items-center justify-between ${isReady ? "bg-green-50/50 border-green-200" : "bg-amber-50/50 border-amber-200"}`}>
      <div className="flex items-center gap-2">
        {isReady ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
        <div>
          <p className="text-sm font-semibold">{mode}</p>
          <p className="text-xs text-muted-foreground">
            {!isReady ? "No active sourcing path — sourcing not ready" :
              primary ? `Primary: ${allSuppliers.find((s: any) => s.id === primary.supplier_id)?.name || "—"}` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-4 text-center">
        <div><p className="text-lg font-bold">{approvedSuppliers.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Suppliers</p></div>
      </div>
    </div>
  );
}

function ApprovedSupplierModal({ open, modal, allSuppliers, approvedSuppliers, statusOpts, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (modal) setForm({ ...modal.form }); }, [modal]);
  const isAdd = modal?.mode === "add";
  const usedSupplierIds = new Set(approvedSuppliers.map((a: any) => a.supplier_id));
  const availableSuppliers = (allSuppliers || []).filter((s: any) => !usedSupplierIds.has(s.id));
  const statuses = statusOpts.length ? statusOpts : ["active", "pending", "expired"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isAdd ? "Add Approved Supplier" : "Edit Approved Supplier"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {isAdd && (
            <div>
              <Label className="text-xs">Supplier *</Label>
              <Select value={form.supplier_id || ""} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                <SelectContent>
                  {availableSuppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Supplier Reference</Label>
              <Input value={form.supplier_reference || ""} onChange={(e) => setForm({ ...form, supplier_reference: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status || "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s: string) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={isAdd && !form.supplier_id}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
