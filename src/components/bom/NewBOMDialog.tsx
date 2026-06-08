import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (newBom: any) => void;
  prefilledProductId?: string;
  mode?: "bom" | "routing";
}

export default function NewBOMDialog({ open, onClose, onCreated, prefilledProductId, mode = "bom" }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isRouting = mode === "routing";

  const [products, setProducts] = useState<any[]>([]);
  const [routings, setRoutings] = useState<any[]>([]);
  const [approvedSuppliers, setApprovedSuppliers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [productId, setProductId] = useState<string>(prefilledProductId || "");
  const [productSearch, setProductSearch] = useState("");
  const [bomPhase, setBomPhase] = useState<"development" | "production" | "sample">("development");
  const [name, setName] = useState("");
  const [selectedRoutingId, setSelectedRoutingId] = useState<string>("");

  const [customerRef, setCustomerRef] = useState("");
  const [seasonVariant, setSeasonVariant] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [region, setRegion] = useState("");
  const [factorySupplierId, setFactorySupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId(prefilledProductId || "");
    setBomPhase("development");
    setName("");
    setSelectedRoutingId("");
    setCustomerRef(""); setSeasonVariant(""); setTargetQuantity("");
    setRegion(""); setFactorySupplierId(""); setNotes("");
    setProductSearch("");
    (async () => {
      const [p, s] = await Promise.all([
        prefilledProductId
          ? Promise.resolve({ data: [] as any[] })
          : supabase.from("products").select("id,name,type").order("name"),
        supabase.from("suppliers").select("id,name"),
      ]);
      setProducts(p.data ?? []);
      setSuppliers(s.data ?? []);
    })();
  }, [open, prefilledProductId]);

  useEffect(() => {
    if (!productId) { setRoutings([]); setApprovedSuppliers([]); return; }
    (async () => {
      const [r, a] = await Promise.all([
        // Routings are now BOMs with bom_type='routing'.
        supabase.from("boms").select("*").eq("product_id", productId).eq("bom_type", "routing").eq("status", "released"),
        supabase.from("approved_suppliers").select("*").eq("product_id", productId),
      ]);
      setRoutings(r.data ?? []);
      setApprovedSuppliers(a.data ?? []);
    })();
  }, [productId]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 50);
    const q = productSearch.toLowerCase();
    return products.filter(p => (p.name || "").toLowerCase().includes(q)).slice(0, 50);
  }, [products, productSearch]);

  const supplierName = (sid: string) => suppliers.find(s => s.id === sid)?.name || "Unknown";

  const canCreate = !!productId && !!bomPhase && !saving;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    const order_context = bomPhase === "production" ? {
      customer_ref: customerRef || undefined,
      season_variant: seasonVariant || undefined,
      target_quantity: targetQuantity ? Number(targetQuantity) : undefined,
      region: region || undefined,
      factory_supplier_id: factorySupplierId || undefined,
    } : null;

    const { data, error } = await supabase.from("boms").insert({
      bom_type: "bom",
      bom_phase: bomPhase,
      product_id: productId,
      revision_code: "A",
      version: 1,
      status: "draft",
      selected_routing_id: bomPhase === "production" ? (selectedRoutingId || null) : null,
      order_context,
      notes: notes || null,
      created_by: user?.email,
    }).select().single();

    setSaving(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    onCreated(data);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New BOM</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!prefilledProductId && (
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Input
                placeholder="Search product…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto border rounded-md divide-y">
                {filteredProducts.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">No products</div>
                ) : filteredProducts.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent ${productId === p.id ? "bg-accent" : ""}`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{p.type}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>BOM Phase</Label>
            <Select value={bomPhase} onValueChange={(v) => setBomPhase(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {bomPhase === "production" && (
            <>
              <div className="space-y-1.5">
                <Label>Initial Routing</Label>
                <Select value={selectedRoutingId || "none"} onValueChange={(v) => setSelectedRoutingId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select later" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select later</SelectItem>
                    {routings.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name || "Routing"} · Rev {r.revision_code} v{r.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {productId && routings.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No released routings for this product.</p>
                )}
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronDown className="w-3 h-3" /> Order context (optional)
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Customer Reference</Label>
                      <Input value={customerRef} onChange={e => setCustomerRef(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Season / Variant</Label>
                      <Input value={seasonVariant} onChange={e => setSeasonVariant(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Target Quantity</Label>
                      <Input type="number" value={targetQuantity} onChange={e => setTargetQuantity(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Region</Label>
                      <Input value={region} onChange={e => setRegion(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Factory Supplier</Label>
                    <Select value={factorySupplierId || "none"} onValueChange={(v) => setFactorySupplierId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {approvedSuppliers.map(a => (
                          <SelectItem key={a.id} value={a.supplier_id}>
                            {supplierName(a.supplier_id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {saving ? "Creating…" : "Create BOM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
