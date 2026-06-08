import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Package, Trash2, ExternalLink, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import BOMLineDestructiveConfirmDialog from "./BOMLineDestructiveConfirmDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: (line: any) => void;
  onDeleted: (lineId: string) => void;
  line: any | null;
  bom: any;
  approvedSuppliers: any[];
  suppliers: any[];
  lovTypes: any[];
  lovValues: any[];
}

const EDITABLE_STATUSES = ["draft", "in_review"];
const isBomEditable = (bom: any) => bom && EDITABLE_STATUSES.includes(bom.status);

const getLovValues = (lovTypes: any[], lovValues: any[], code: string) => {
  const t = lovTypes.find(x => x.code === code);
  if (!t) return [];
  return lovValues.filter(v => v.type_of_lov_id === t.id).map(v => v.name).sort();
};

const getRoleOptionsFiltered = (lovTypes: any[], lovValues: any[], bomType?: string) => {
  const roleType = lovTypes.find(t => t.code === "bom_line_role");
  const bomTypeType = lovTypes.find(t => t.code === "bom_type");
  if (!roleType) return [];
  const all = lovValues.filter(v => v.type_of_lov_id === roleType.id);
  if (!bomTypeType || !bomType) return all.map(v => v.name).sort();
  const match = lovValues.find(v => v.type_of_lov_id === bomTypeType.id && v.name === bomType);
  if (!match) return all.map(v => v.name).sort();
  return all.filter(v => !v.depends_on_value_id || v.depends_on_value_id === match.id).map(v => v.name).sort();
};

export default function BOMLineEditPanel({
  open, onClose, onUpdated, onDeleted, line: lineProp, bom, lovTypes, lovValues,
}: Props) {
  const { toast } = useToast();
  const [line, setLine] = useState<any>(lineProp);
  const [componentProduct, setComponentProduct] = useState<any>(null);
  const [componentApprovedSuppliers, setComponentApprovedSuppliers] = useState<any[]>([]);
  const [variantCount, setVariantCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showSwap, setShowSwap] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const saveTimers = useRef<Record<string, any>>({});

  const editable = isBomEditable(bom);

  useEffect(() => {
    setLine(lineProp);
    setLastSavedAt(null);
  }, [lineProp?.id]);

  useEffect(() => {
    if (!line?.component_product_id) { setComponentProduct(null); return; }
    supabase.from("products")
      .select("id,name,type,images,default_uom,default_uom_for_purchasing")
      .eq("id", line.component_product_id).maybeSingle()
      .then(({ data }) => setComponentProduct(data));
  }, [line?.component_product_id]);

  useEffect(() => {
    if (!line?.component_product_id) { setComponentApprovedSuppliers([]); return; }
    supabase.from("approved_suppliers")
      .select("*, suppliers!inner(id,name,code)")
      .eq("product_id", line.component_product_id)
      .eq("status", "active")
      .order("rank")
      .then(({ data }) => setComponentApprovedSuppliers(data ?? []));
  }, [line?.component_product_id]);

  useEffect(() => {
    if (!line?.id) { setVariantCount(0); return; }
    supabase.from("bom_line_variants").select("id", { count: "exact", head: true })
      .eq("bom_line_id", line.id)
      .then(({ count }) => setVariantCount(count ?? 0));
  }, [line?.id]);

  const roleOptions = useMemo(() => getRoleOptionsFiltered(lovTypes, lovValues, bom?.bom_type), [lovTypes, lovValues, bom?.bom_type]);
  const uomOptions = useMemo(() => getLovValues(lovTypes, lovValues, "uom"), [lovTypes, lovValues]);
  const resolutionModeOptions = useMemo(() => getLovValues(lovTypes, lovValues, "bom_line_resolution_mode"), [lovTypes, lovValues]);

  const updateFields = (patch: Record<string, any>) => {
    if (!line) return;
    const next = { ...line, ...patch };
    setLine(next);
    const key = Object.keys(patch).join("|");
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      const { error } = await supabase.from("bom_lines").update(patch).eq("id", line.id);
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
      } else {
        setLastSavedAt(Date.now());
        onUpdated(next);
      }
    }, 600);
  };

  const handleUomChange = (val: string) => {
    if (val === "inherit") {
      updateFields({ uom: null, uom_is_overridden: false });
    } else {
      const overridden = !!componentProduct?.default_uom && val !== componentProduct.default_uom;
      updateFields({ uom: val, uom_is_overridden: overridden });
    }
  };

  const handleSwap = async (newProductId: string) => {
    updateFields({ component_product_id: newProductId, line_level_approved_supplier_id: null });
    setShowSwap(false);
  };

  const handleDelete = async () => {
    if (!line) return;
    await supabase.from("bom_line_variants").delete().eq("bom_line_id", line.id);
    const { error } = await supabase.from("bom_lines").delete().eq("id", line.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    onDeleted(line.id);
    setShowDelete(false);
    onClose();
    toast({ title: "Line deleted" });
  };

  if (!line) return null;

  const uomSelectValue = line.uom ?? "inherit";

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <div className="p-5 border-b">
            <SheetHeader>
              <SheetTitle>Edit BOM Line</SheetTitle>
            </SheetHeader>
            <p className="text-xs text-muted-foreground mt-1">
              Position #{line.position} · {componentProduct?.name || "—"}
            </p>
            {lastSavedAt && (
              <p className="text-[10px] text-green-600 mt-1">Saved</p>
            )}
          </div>

          {!editable && (
            <div className="m-5 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900">
              This BOM is <strong>{bom?.status}</strong>. Fields are read-only — create a new revision or version to edit.
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* Component swap */}
            <div>
              <Label className="text-xs">Component Product</Label>
              <div className="mt-1 flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {componentProduct?.images?.[0]
                    ? <img src={componentProduct.images[0]} alt="" className="w-full h-full object-contain" />
                    : <Package className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{componentProduct?.name || "Unknown"}</p>
                  {componentProduct?.type && <p className="text-[10px] text-muted-foreground">{componentProduct.type}</p>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setShowSwap(true)} disabled={!editable} className="gap-1">
                  <Repeat className="w-3.5 h-3.5" />Swap
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Role</Label>
              <Select value={line.component_role || ""} onValueChange={(v) => updateFields({ component_role: v })} disabled={!editable}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select role…" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Base Quantity</Label>
                <Input
                  type="number"
                  step="any"
                  value={line.base_quantity ?? ""}
                  onChange={(e) => updateFields({ base_quantity: e.target.value === "" ? null : Number(e.target.value) })}
                  disabled={!editable}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">UOM</Label>
                <Select value={uomSelectValue} onValueChange={handleUomChange} disabled={!editable}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">
                      <span className="italic text-muted-foreground">
                        Inherit ({componentProduct?.default_uom || "none"})
                      </span>
                    </SelectItem>
                    {uomOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Resolution Mode</Label>
              <Select value={line.resolution_mode || "pinned"} onValueChange={(v) => updateFields({ resolution_mode: v })} disabled={!editable}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {resolutionModeOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Line-level Approved Supplier</Label>
              <Select
                value={line.line_level_approved_supplier_id || "none"}
                onValueChange={(v) => updateFields({ line_level_approved_supplier_id: v === "none" ? null : v })}
                disabled={!editable}
              >
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use component's primary supplier (default)</SelectItem>
                  {componentApprovedSuppliers.map(as => {
                    const sup = as.suppliers;
                    const label = `${sup?.name || "—"} · ${as.is_primary ? "Primary" : `Rank ${as.rank}`}${as.supplier_reference ? ` · ${as.supplier_reference}` : ""}`;
                    return <SelectItem key={as.id} value={as.id}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Varies By</Label>
              <div className="mt-2 space-y-1.5">
                {[
                  { key: "varies_by_color", label: "Varies by colorway" },
                  { key: "varies_by_size", label: "Varies by size" },
                  { key: "varies_by_color_and_more", label: "Varies by colorway + more variation" },
                  { key: "varies_by_supplier", label: "Varies by parent supplier scenario" },
                ].map(o => (
                  <label key={o.key} className={cn("flex items-center gap-2 text-sm", !editable && "opacity-60 cursor-not-allowed")}>
                    <Checkbox
                      checked={!!line[o.key]}
                      onCheckedChange={(c) => updateFields({ [o.key]: !!c })}
                      disabled={!editable}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label className={cn("flex items-center gap-2 text-sm cursor-help", !editable && "opacity-60")}>
                      <Checkbox
                        checked={!!line.is_phantom}
                        onCheckedChange={(c) => updateFields({ is_phantom: !!c })}
                        disabled={!editable}
                      />
                      Is Phantom
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>
                    Phantom lines are organizational placeholders that don't consume actual material.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div>
              <Label className="text-xs">Reference Document URL</Label>
              <Input
                value={line.reference_document_url || ""}
                onChange={(e) => updateFields({ reference_document_url: e.target.value || null })}
                disabled={!editable}
                className="h-9 mt-1"
                placeholder="https://…"
              />
              {line.reference_document_url && (
                <a href={line.reference_document_url} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline">
                  Open reference <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={3}
                value={line.notes || ""}
                onChange={(e) => updateFields({ notes: e.target.value || null })}
                disabled={!editable}
                className="mt-1"
              />
            </div>
          </div>

          <div className="sticky bottom-0 p-4 border-t bg-background flex items-center justify-between">
            {editable ? (
              <Button variant="outline" size="sm" onClick={() => setShowDelete(true)} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />Delete line
              </Button>
            ) : <div />}
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
          </div>
        </SheetContent>
      </Sheet>

      <SwapComponentDialog
        open={showSwap}
        onClose={() => setShowSwap(false)}
        onPick={handleSwap}
        currentId={line.component_product_id}
      />

      <BOMLineDestructiveConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        line={line}
        variantCount={variantCount}
      />
    </>
  );
}

function SwapComponentDialog({
  open, onClose, onPick, currentId,
}: { open: boolean; onClose: () => void; onPick: (id: string) => void; currentId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    supabase.from("products")
      .select("id,name,type,images,default_uom")
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => (p.name || "").toLowerCase().includes(q));
  }, [products, search]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Swap Component Product</DialogTitle></DialogHeader>
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
        <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              disabled={p.id === currentId}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50",
                p.id === currentId && "opacity-40 cursor-not-allowed bg-accent",
              )}
            >
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt="" className="w-full h-full object-contain" />
                  : <Package className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{p.name}</p>
              </div>
              {p.type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{p.type}</span>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
