import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const EDITABLE_STATUSES = ["draft", "in_review"];
const isBomEditable = (bom: any) => bom && EDITABLE_STATUSES.includes(bom.status);

interface Cell {
  line: any;
  columnId: string;
  columnLabel: string;
  columnAxis: string;
  secondaryColumnId?: string;
  secondaryColumnAxis?: string | null;
  secondaryColumnLabel?: string;
  variant: any | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  cell: Cell | null;
  line: any;
  bom: any;
  bomLines: any[];
  allProducts: any[];
  currencies: any[];
  sizes: any[];
  colorways: any[];
  suppliers: any[];
  approvedSuppliers: any[];
  onSaved: (variant: any) => void;
  onDeleted: (variantId: string) => void;
}

const emptyForm = {
  quantity: "" as any,
  unit_cost_override: "" as any,
  currency_override: "",
  lead_time_override_days: "" as any,
  wastage_pct: "" as any,
  is_not_applicable: false,
  na_reason: "",
  approved_supplier_id: "",
  component_product_color_id: "",
  component_size_id: "",
  notes: "",
};

export default function BOMVariantCellEditor({
  open, onClose, cell, line, bom, allProducts, currencies, onSaved, onDeleted,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [componentApprovedSuppliers, setComponentApprovedSuppliers] = useState<any[]>([]);
  const [componentColorways, setComponentColorways] = useState<any[]>([]);
  const [componentSizes, setComponentSizes] = useState<any[]>([]);

  const editable = isBomEditable(bom);
  const componentProduct = line ? allProducts.find(p => p.id === line.component_product_id) : null;
  const componentDefaultUom = componentProduct?.default_uom || "";

  useEffect(() => {
    if (!cell?.variant) {
      setForm({ ...emptyForm });
      return;
    }
    const v = cell.variant;
    setForm({
      quantity: v.quantity ?? "",
      unit_cost_override: v.unit_cost_override ?? "",
      currency_override: v.currency_override || "",
      lead_time_override_days: v.lead_time_override_days ?? "",
      wastage_pct: v.wastage_pct ?? "",
      is_not_applicable: !!v.is_not_applicable,
      na_reason: v.na_reason || "",
      approved_supplier_id: v.approved_supplier_id || "",
      component_product_color_id: v.component_product_color_id || "",
      component_size_id: v.component_size_id || "",
      notes: v.notes || "",
    });
  }, [cell?.variant?.id, cell?.variant, open]);

  useEffect(() => {
    if (!open || !line?.component_product_id) return;
    Promise.all([
      supabase.from("approved_suppliers").select("*, suppliers!inner(id,name)").eq("product_id", line.component_product_id).eq("status", "active").order("rank"),
      supabase.from("product_colors").select("id,color_name,colorway_code,color_hex").eq("product_id", line.component_product_id),
      supabase.from("style_sizes").select("size_id, active, sizes!inner(id,size_code,name)").eq("product_id", line.component_product_id).eq("active", true),
    ]).then(([a, c, s]) => {
      setComponentApprovedSuppliers(a.data ?? []);
      setComponentColorways(c.data ?? []);
      setComponentSizes((s.data ?? []).map((row: any) => row.sizes).filter(Boolean));
    });
  }, [open, line?.component_product_id]);

  if (!cell || !line) return null;

  const setField = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const intersectionFk: any = (() => {
      const primaryFk: any = (() => {
        switch (cell.columnAxis) {
          case "color": return { product_color_id: cell.columnId };
          case "size": return { size_id: cell.columnId };
          case "color_and_more": return { product_color_and_more_id: cell.columnId };
          case "supplier": return { parent_approved_supplier_id: cell.columnId };
          default: return {};
        }
      })();
      let secondaryFk: any = {};
      if (cell.secondaryColumnAxis && cell.secondaryColumnId) {
        switch (cell.secondaryColumnAxis) {
          case "color": secondaryFk = { product_color_id: cell.secondaryColumnId }; break;
          case "size": secondaryFk = { size_id: cell.secondaryColumnId }; break;
          case "color_and_more": secondaryFk = { product_color_and_more_id: cell.secondaryColumnId }; break;
          case "supplier": secondaryFk = { parent_approved_supplier_id: cell.secondaryColumnId }; break;
        }
      }
      return { ...primaryFk, ...secondaryFk };
    })();

    const payload: any = {
      bom_line_id: line.id,
      ...intersectionFk,
      quantity: form.quantity === "" || form.quantity == null ? null : Number(form.quantity),
      unit_cost_override: form.unit_cost_override === "" || form.unit_cost_override == null ? null : Number(form.unit_cost_override),
      currency_override: form.currency_override || null,
      lead_time_override_days: form.lead_time_override_days === "" || form.lead_time_override_days == null ? null : Number(form.lead_time_override_days),
      wastage_pct: form.wastage_pct === "" || form.wastage_pct == null ? 0 : Number(form.wastage_pct),
      is_not_applicable: !!form.is_not_applicable,
      na_reason: form.is_not_applicable && form.na_reason ? form.na_reason : null,
      approved_supplier_id: form.approved_supplier_id || null,
      component_product_color_id: form.component_product_color_id || null,
      component_size_id: form.component_size_id || null,
      notes: form.notes || null,
    };

    if (cell.variant?.id) {
      const { data, error } = await supabase.from("bom_line_variants").update(payload).eq("id", cell.variant.id).select().single();
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Cell saved" });
      onSaved(data);
    } else {
      const { data, error } = await supabase.from("bom_line_variants").insert(payload).select().single();
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Cell created" });
      onSaved(data);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!cell.variant?.id) return;
    const { error } = await supabase.from("bom_line_variants").delete().eq("id", cell.variant.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cell deleted" });
    onDeleted(cell.variant.id);
  };

  const axisLabel = ({ color: "Color", size: "Size", color_and_more: "Color & More", supplier: "Supplier" } as any)[cell.columnAxis] || cell.columnAxis;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cell.variant ? "Edit cell" : "Add cell"}</DialogTitle>
          <DialogDescription>
            {(line.component_role || "—").replace(/_/g, " ")} · {axisLabel}: {cell.columnLabel}
            {cell.secondaryColumnAxis && cell.secondaryColumnId && (
              <> · {({ color: "Color", size: "Size", color_and_more: "Color & More", supplier: "Supplier" } as any)[cell.secondaryColumnAxis] || cell.secondaryColumnAxis}: {cell.secondaryColumnLabel || "—"}</>
            )}
          </DialogDescription>
        </DialogHeader>

        {!editable && (
          <div className="text-xs px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
            This BOM is {bom?.status}. Fields are read-only.
          </div>
        )}

        <div className="space-y-4">
          {/* NA */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_not_applicable}
                onCheckedChange={(v) => setField("is_not_applicable", !!v)}
                disabled={!editable}
              />
              Mark this cell Not Applicable
            </label>
            {form.is_not_applicable && (
              <Textarea
                rows={2}
                placeholder="Reason (optional)"
                value={form.na_reason}
                onChange={(e) => setField("na_reason", e.target.value)}
                disabled={!editable}
              />
            )}
          </div>

          {!form.is_not_applicable && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantity</label>
                <Input
                  type="number"
                  step="any"
                  placeholder={`Inherit from line base (${line.base_quantity ?? "—"} ${line.uom || componentDefaultUom})`}
                  value={form.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                  disabled={!editable}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Component Colorway</label>
                  <Select value={form.component_product_color_id || "none"} onValueChange={(v) => setField("component_product_color_id", v === "none" ? "" : v)} disabled={!editable}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {componentColorways.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.color_name || "—"}{c.colorway_code ? ` · ${c.colorway_code}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Component Size</label>
                  <Select value={form.component_size_id || "none"} onValueChange={(v) => setField("component_size_id", v === "none" ? "" : v)} disabled={!editable}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {componentSizes.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.size_code || s.name || "—"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit cost override</label>
                  <Input
                    type="number"
                    step="any"
                    value={form.unit_cost_override}
                    onChange={(e) => setField("unit_cost_override", e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Currency</label>
                  <Select value={form.currency_override || "none"} onValueChange={(v) => setField("currency_override", v === "none" ? "" : v)} disabled={!editable}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {currencies.map(c => (
                        <SelectItem key={c.id} value={c.code}>{c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Lead time (days)</label>
                  <Input
                    type="number"
                    value={form.lead_time_override_days}
                    onChange={(e) => setField("lead_time_override_days", e.target.value)}
                    disabled={!editable}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Wastage %</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={form.wastage_pct}
                  onChange={(e) => setField("wastage_pct", e.target.value)}
                  disabled={!editable}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Component's Approved Supplier</label>
                <Select value={form.approved_supplier_id || "none"} onValueChange={(v) => setField("approved_supplier_id", v === "none" ? "" : v)} disabled={!editable}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {componentApprovedSuppliers.map(as => (
                      <SelectItem key={as.id} value={as.id}>
                        {as.suppliers?.name || "—"}{as.is_primary ? " · Primary" : as.rank ? ` · Rank ${as.rank}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  disabled={!editable}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div>
            {editable && cell.variant?.id && (
              <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete cell
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {editable && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
