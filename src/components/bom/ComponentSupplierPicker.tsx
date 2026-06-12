import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, X, Plus, ArrowLeft } from "lucide-react";

interface Props {
  componentProductId: string;
  currentApprovedSupplierId?: string | null;
  onSelect: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function ComponentSupplierPicker({
  componentProductId,
  currentApprovedSupplierId,
  onSelect,
  onReset,
  onClose,
}: Props) {
  const [approvedSuppliers, setApprovedSuppliers] = useState<any[]>([]);
  const [supplierMap, setSupplierMap] = useState<Record<string, any>>({});
  const [componentProduct, setComponentProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(currentApprovedSupplierId || null);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = async () => {
    if (!componentProductId) { setLoading(false); return; }
    setLoading(true);
    const [asRes, prodRes] = await Promise.all([
      supabase.from("approved_suppliers").select("*").eq("product_id", componentProductId).eq("status", "active"),
      supabase.from("products").select("id,name,type").eq("id", componentProductId).maybeSingle(),
    ]);
    const sorted = (asRes.data ?? []).sort((a: any, b: any) => (a.rank || 99) - (b.rank || 99));
    const ids = [...new Set(sorted.map((a: any) => a.supplier_id).filter(Boolean))];
    const sups = ids.length
      ? (await supabase.from("suppliers").select("*").in("id", ids as string[])).data ?? []
      : [];
    const map: Record<string, any> = {};
    sups.forEach((s: any) => { map[s.id] = s; });
    setApprovedSuppliers(sorted);
    setSupplierMap(map);
    setComponentProduct(prodRes.data ?? null);
    setLoading(false);
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [componentProductId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return approvedSuppliers;
    const q = search.toLowerCase();
    return approvedSuppliers.filter((as: any) => {
      const sup = supplierMap[as.supplier_id];
      return (sup?.name?.toLowerCase().includes(q) || sup?.code?.toLowerCase().includes(q) || as.supplier_reference?.toLowerCase().includes(q));
    });
  }, [approvedSuppliers, supplierMap, search]);

  const isService = componentProduct?.type === "Service";

  if (showCreate) {
    return (
      <CreateApprovedSupplierInline
        componentProductId={componentProductId}
        isService={isService}
        existingSupplierIds={approvedSuppliers.map(a => a.supplier_id)}
        nextRank={approvedSuppliers.reduce((m, a) => Math.max(m, a.rank || 0), 0) + 1}
        isFirst={approvedSuppliers.length === 0}
        onCancel={() => setShowCreate(false)}
        onCreated={async (newAsId) => {
          await loadData();
          setShowCreate(false);
          onSelect(newAsId);
        }}
      />
    );
  }

  return (
    <div className="w-72 bg-popover border border-border rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[420px]">
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">{isService ? "Pick Operation Supplier" : "Pick Component Supplier"}</p>
          <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…" className="h-7 text-xs pl-7" autoFocus />
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {approvedSuppliers.length === 0
              ? `No active suppliers approved for this ${isService ? "operation" : "component"} yet.`
              : "No suppliers match your search."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((as: any) => {
              const sup = supplierMap[as.supplier_id];
              const isSelected = selected === as.id;
              return (
                <button key={as.id} type="button" onClick={() => setSelected(isSelected ? null : as.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/10" : ""}`}>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{sup?.name || as.supplier_id}</span>
                      {as.is_primary
                        ? <span className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary font-medium border border-primary/20">Primary</span>
                        : <span className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground border border-border">Alt {as.rank}</span>}
                      {sup?.country && <span className="text-[9px] text-muted-foreground">{sup.country}</span>}
                    </div>
                    {as.supplier_reference && (<div className="font-mono text-[10px] text-muted-foreground">{as.supplier_reference}</div>)}
                  </div>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-primary hover:bg-primary/5 border-t border-border"
        >
          <Plus className="w-3.5 h-3.5" />
          Create new approved supplier
        </button>
      </div>

      <div className="px-3 py-2 border-t border-border flex gap-2 shrink-0">
        <Button size="sm" className="flex-1 h-7 text-xs" disabled={!selected} onClick={() => { if (selected) onSelect(selected); }}>Select</Button>
        {currentApprovedSupplierId && (<Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReset}>Reset</Button>)}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

function CreateApprovedSupplierInline({
  componentProductId, isService, existingSupplierIds, nextRank, isFirst, onCancel, onCreated,
}: {
  componentProductId: string;
  isService: boolean;
  existingSupplierIds: string[];
  nextRank: number;
  isFirst: boolean;
  onCancel: () => void;
  onCreated: (newApprovedSupplierId: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<any | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    supabase.from("suppliers").select("id,name,code").order("name").then(({ data }) => {
      setSuppliers(data ?? []);
    });
  }, []);

  // Show all suppliers (no filtering for "already approved" — user wants the full list visible)
  const availSuppliers = suppliers;

  // When supplier changes, check if (product_id, supplier_id) row already exists
  useEffect(() => {
    if (!supplierId) { setExisting(null); return; }
    let cancelled = false;
    setChecking(true);
    supabase
      .from("approved_suppliers")
      .select("id, is_primary, rank")
      .eq("product_id", componentProductId)
      .eq("supplier_id", supplierId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setExisting(data ?? null);
        setChecking(false);
      });
    return () => { cancelled = true; };
  }, [supplierId, componentProductId]);

  const isUniqueViolation = (err: any) =>
    err?.code === "23505" ||
    (typeof err?.message === "string" && err.message.includes("approved_suppliers_product_supplier_unique"));

  const handleCreate = async () => {
    if (!supplierId) { setError("Pick a supplier"); return; }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase.from("approved_suppliers").insert({
      product_id: componentProductId,
      supplier_id: supplierId,
      rank: nextRank,
      is_primary: isFirst,
      notes: notes || null,
      status: "active",
      approved_at: new Date().toISOString(),
    }).select().single();
    setSaving(false);
    if (err) {
      if (isUniqueViolation(err)) {
        // Re-fetch the existing row so the UI can offer "Use this approved supplier"
        const { data: existingRow } = await supabase
          .from("approved_suppliers")
          .select("id, is_primary, rank")
          .eq("product_id", componentProductId)
          .eq("supplier_id", supplierId)
          .maybeSingle();
        if (existingRow) { setExisting(existingRow); return; }
      }
      setError(err.message);
      return;
    }
    if (data?.id) onCreated(data.id);
  };

  return (
    <div className="w-80 bg-popover border border-border rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[520px]">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <button type="button" onClick={onCancel} className="p-0.5 rounded hover:bg-muted">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <p className="text-xs font-semibold">
          {isService ? "New approved supplier for this operation" : "New approved supplier for this material"}
        </p>
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-2.5">
        <div>
          <Label className="text-[11px]">Supplier *</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select supplier…" /></SelectTrigger>
            <SelectContent className="z-[10000]">
              {availSuppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {existing ? (
          <div className="rounded-md border border-border bg-muted/40 p-2.5 space-y-2">
            <p className="text-[11px] text-foreground">
              This supplier is already approved for this {isService ? "operation" : "product"}. You can assign it to this line instead.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => onCreated(existing.id)}
              >
                Use this approved supplier
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => { setSupplierId(""); setExisting(null); }}
              >
                Choose another supplier
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-[11px]">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs mt-1" />
          </div>
        )}
        {checking && <p className="text-[10px] text-muted-foreground">Checking…</p>}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
      {!existing && (
        <div className="px-3 py-2 border-t border-border flex gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreate} disabled={saving || !supplierId}>
            {saving ? "Creating…" : "Create & select"}
          </Button>
        </div>
      )}
    </div>
  );
}
