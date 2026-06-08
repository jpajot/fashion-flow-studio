import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (line: any) => void;
  bomId: string;
  productId: string;
  currentLineCount: number;
  lovTypes: any[];
  lovValues: any[];
  bomType?: "bom" | "routing";
}

const getLovValues = (lovTypes: any[], lovValues: any[], code: string) => {
  const t = lovTypes.find(x => x.code === code);
  if (!t) return [];
  return lovValues.filter(v => v.type_of_lov_id === t.id).map(v => v.name).sort();
};

const getRoleOptionsFiltered = (lovTypes: any[], lovValues: any[], bomType: string) => {
  const roleType = lovTypes.find(t => t.code === "bom_line_role");
  const bomTypeType = lovTypes.find(t => t.code === "bom_type");
  if (!roleType) return [];
  const all = lovValues.filter(v => v.type_of_lov_id === roleType.id);
  if (!bomTypeType) return all.map(v => v.name).sort();
  const match = lovValues.find(v => v.type_of_lov_id === bomTypeType.id && v.name === bomType);
  if (!match) return all.map(v => v.name).sort();
  return all.filter(v => !v.depends_on_value_id || v.depends_on_value_id === match.id).map(v => v.name).sort();
};

export default function BOMLineAddDialog({
  open, onClose, onCreated, bomId, currentLineCount, lovTypes, lovValues, bomType = "bom",
}: Props) {
  const { toast } = useToast();
  const isRouting = bomType === "routing";
  const [candidates, setCandidates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [componentProductId, setComponentProductId] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [baseQuantity, setBaseQuantity] = useState<string>("");
  const [uomValue, setUomValue] = useState<string>("inherit");
  const [variesByColor, setVariesByColor] = useState(false);
  const [variesBySize, setVariesBySize] = useState(false);
  const [variesByColorAndMore, setVariesByColorAndMore] = useState(false);
  const [variesBySupplier, setVariesBySupplier] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch(""); setComponentProductId(""); setRole(""); setBaseQuantity("");
    setUomValue("inherit"); setVariesByColor(false); setVariesBySize(false);
    setVariesByColorAndMore(false); setVariesBySupplier(false); setNotes("");
    supabase.from("products")
      .select("id,name,type,images,default_uom,default_uom_for_purchasing,uom_conversion_factor")
      .order("name")
      .then(({ data }) => setCandidates(data ?? []));
  }, [open]);

  const componentProduct = candidates.find(c => c.id === componentProductId);
  const roleOptions = useMemo(() => getLovValues(lovTypes, lovValues, "bom_line_role"), [lovTypes, lovValues]);
  const uomOptions = useMemo(() => getLovValues(lovTypes, lovValues, "uom"), [lovTypes, lovValues]);

  const filteredCandidates = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return candidates;
    return candidates.filter(c => (c.name || "").toLowerCase().includes(q));
  }, [candidates, search]);

  const handleCreate = async () => {
    if (!componentProductId || !role || !baseQuantity) return;
    setSaving(true);
    const inheritUom = uomValue === "inherit";
    const finalUom = inheritUom ? null : uomValue;
    const isOverridden = !inheritUom && componentProduct?.default_uom && uomValue !== componentProduct.default_uom;

    const { data, error } = await supabase.from("bom_lines").insert({
      bom_id: bomId,
      position: currentLineCount + 1,
      component_role: role,
      component_product_id: componentProductId,
      resolution_mode: "pinned",
      base_quantity: Number(baseQuantity),
      uom: finalUom,
      uom_is_overridden: !!isOverridden,
      varies_by_color: variesByColor,
      varies_by_size: variesBySize,
      varies_by_color_and_more: variesByColorAndMore,
      varies_by_supplier: variesBySupplier,
      notes: notes || null,
    }).select().single();

    setSaving(false);
    if (error) {
      toast({ title: "Add line failed", description: error.message, variant: "destructive" });
      return;
    }
    onCreated(data);
  };

  const canSave = !!componentProductId && !!role && !!baseQuantity && !saving;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add BOM Line</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Component Product *</Label>
            <Input
              placeholder="Search component product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 mt-1"
            />
            <div className="mt-2 max-h-44 overflow-y-auto border rounded-md divide-y">
              {filteredCandidates.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">No matching products</div>
              )}
              {filteredCandidates.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setComponentProductId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50",
                    componentProductId === c.id && "bg-accent",
                  )}
                >
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {c.images?.[0]
                      ? <img src={c.images[0]} alt="" className="w-full h-full object-contain" />
                      : <Package className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.name}</p>
                  </div>
                  {c.type && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground shrink-0">
                      {c.type}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select role…" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => (
                    <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Base Quantity *</Label>
              <Input
                type="number"
                step="any"
                value={baseQuantity}
                onChange={(e) => setBaseQuantity(e.target.value)}
                className="h-9 mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">UOM</Label>
            <Select value={uomValue} onValueChange={setUomValue}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">
                  <span className="italic text-muted-foreground">
                    Inherit from component ({componentProduct?.default_uom || "none"})
                  </span>
                </SelectItem>
                {uomOptions.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Varies By</Label>
            <div className="mt-2 space-y-1.5">
              {[
                { id: "vc", label: "Varies by colorway", val: variesByColor, set: setVariesByColor },
                { id: "vs", label: "Varies by size", val: variesBySize, set: setVariesBySize },
                { id: "vcm", label: "Varies by colorway + more variation", val: variesByColorAndMore, set: setVariesByColorAndMore },
                { id: "vsup", label: "Varies by parent supplier scenario", val: variesBySupplier, set: setVariesBySupplier },
              ].map(o => (
                <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={o.val} onCheckedChange={(c) => o.set(!!c)} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canSave}>Add Line</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
