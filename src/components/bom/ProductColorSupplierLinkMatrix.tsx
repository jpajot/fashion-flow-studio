import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["available", "not_applicable", "pending_confirmation", "discontinued"];
const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-700 border-green-200",
  not_applicable: "bg-gray-100 text-gray-500 border-gray-200",
  pending_confirmation: "bg-amber-100 text-amber-700 border-amber-200",
  discontinued: "bg-red-100 text-red-700 border-red-200",
};

type Props = {
  colorVariants: any[];
  approvedSuppliers: any[];
  allSuppliers: any[];
};

export default function ProductColorSupplierLinkMatrix({ colorVariants, approvedSuppliers, allSuppliers }: Props) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<any>(null);

  useEffect(() => {
    if (!colorVariants?.length || !approvedSuppliers?.length) { setLoading(false); return; }
    const cvIds = colorVariants.map((cv) => cv.id);
    supabase.from("product_color_supplier_links").select("*").in("product_color_id", cvIds)
      .then(({ data }) => { setLinks(data ?? []); setLoading(false); });
  }, [colorVariants, approvedSuppliers]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!approvedSuppliers?.length) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed">
        <p className="text-sm text-muted-foreground">No approved suppliers yet. Add suppliers in the Approved Suppliers section above.</p>
      </div>
    );
  }
  if (!colorVariants?.length) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed">
        <p className="text-sm text-muted-foreground">No colorways yet.</p>
      </div>
    );
  }

  const findLink = (cwId: string, asId: string) =>
    links.find((l) => l.product_color_id === cwId && l.approved_supplier_id === asId);

  const handleSave = async (form: any) => {
    const payload: any = {
      colorway_supplier_status: form.colorway_supplier_status || "available",
      colorway_supplier_reference: form.colorway_supplier_reference || null,
      notes: form.notes || null,
    };
    if (editCell.existing) {
      await supabase.from("product_color_supplier_links").update(payload).eq("id", editCell.existing.id);
      setLinks((prev) => prev.map((l) => (l.id === editCell.existing.id ? { ...l, ...payload } : l)));
    } else {
      const { data } = await supabase.from("product_color_supplier_links").insert({
        product_color_id: editCell.colorway.id,
        approved_supplier_id: editCell.approvedSupplier.id,
        ...payload,
      }).select().single();
      if (data) setLinks((prev) => [...prev, data]);
    }
    setEditCell(null);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-max border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted-foreground font-medium p-2 sticky left-0 bg-background">Colorway</th>
            {approvedSuppliers.map((as) => {
              const sup = allSuppliers.find((s) => s.id === as.supplier_id);
              return (
                <th key={as.id} className="text-left text-xs font-medium p-2 min-w-[140px]">
                  <div className="flex items-center gap-1">
                    {as.is_primary && <Crown className="w-3 h-3 text-amber-500" />}
                    <span>{sup?.name || "Unknown"}</span>
                    <span className="text-[10px] text-muted-foreground">#{as.rank || "—"}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {colorVariants.map((cw) => (
            <tr key={cw.id} className="border-t border-border">
              <td className="p-2 sticky left-0 bg-background">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: cw.color_hex || "#e5e7eb" }} />
                  <span className="text-xs">{cw.color_name || cw.name || "—"}</span>
                  {cw.code && <span className="text-[10px] text-muted-foreground font-mono">{cw.code}</span>}
                </div>
              </td>
              {approvedSuppliers.map((as) => {
                const link = findLink(cw.id, as.id);
                const sup = allSuppliers.find((s) => s.id === as.supplier_id);
                return (
                  <td key={as.id} className="p-2 align-middle">
                    {link ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setEditCell({ colorway: cw, approvedSupplier: as, existing: link, supplierName: sup?.name || "" })}
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize",
                            STATUS_COLORS[link.colorway_supplier_status || "available"]
                          )}
                        >
                          {(link.colorway_supplier_status || "available").replace(/_/g, " ")}
                        </button>
                        {link.colorway_supplier_reference && (
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[80px]">
                            {link.colorway_supplier_reference}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditCell({ colorway: cw, approvedSupplier: as, existing: null, supplierName: sup?.name || "" })}
                        className="w-6 h-6 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <LinkEditModal
        open={!!editCell}
        onClose={() => setEditCell(null)}
        onSave={handleSave}
        colorway={editCell?.colorway}
        supplierName={editCell?.supplierName}
        existing={editCell?.existing}
      />
    </div>
  );
}

function LinkEditModal({ open, onClose, onSave, colorway, supplierName, existing }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (open) {
      setForm(existing ? { ...existing } : {
        colorway_supplier_status: "available",
        colorway_supplier_reference: "",
        notes: "",
      });
    }
  }, [open, existing]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Colorway–Supplier Link</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {colorway?.color_name || colorway?.name} × {supplierName}
        </p>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.colorway_supplier_status || "available"} onValueChange={(v) => setForm({ ...form, colorway_supplier_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Colorway-specific Supplier Reference</Label>
            <Input value={form.colorway_supplier_reference || ""} onChange={(e) => setForm({ ...form, colorway_supplier_reference: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
