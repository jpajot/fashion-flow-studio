import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X, Star } from "lucide-react";

interface Props {
  componentProductId: string;
  currentApprovedSupplierId?: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function ComponentSupplierPicker({
  componentProductId,
  currentApprovedSupplierId,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(currentApprovedSupplierId || null);

  useEffect(() => {
    if (!componentProductId) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      const asList = ((await supabase.from("approved_suppliers").select("*").eq("product_id", componentProductId).eq("status", "active")).data ?? []) as any[];
      const sorted = asList.sort((a: any, b: any) => (a.rank || 99) - (b.rank || 99));
      if (cancelled) return;
      const ids = [...new Set(sorted.map((a: any) => a.supplier_id).filter(Boolean))];
      const sups = await Promise.all(
        ids.map(async (sid: any) => {
          const { data } = await supabase.from("suppliers").select("*").eq("id", sid);
          return data?.[0] ?? null;
        })
      );
      if (cancelled) return;
      const map: Record<string, any> = {};
      sups.filter(Boolean).forEach((s: any) => { map[s.id] = s; });
      setRows(sorted.map((as: any) => ({ as, supplier: map[as.supplier_id] || null })));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [componentProductId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(({ supplier, as }) =>
      supplier?.name?.toLowerCase().includes(q) ||
      as.supplier_reference?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="w-72 bg-popover border border-border rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[420px]">
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Pick Component Supplier</p>
          <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="h-7 text-xs pl-7"
            autoFocus
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No active approved suppliers for this component.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(({ as, supplier }) => {
              const isSelected = selected === as.id;
              return (
                <button
                  key={as.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : as.id)}
                  className={`w-full flex items-start gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">
                        {supplier?.name || "—"}
                      </span>
                      {as.is_primary && (
                        <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                      <span className="text-[10px] text-muted-foreground">Rank {as.rank || "—"}</span>
                    </div>
                    {as.supplier_reference && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {as.supplier_reference}
                      </div>
                    )}
                    <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      {as.unit_cost != null && (
                        <span>{as.unit_cost} {as.currency || ""}</span>
                      )}
                      {as.lead_time_days != null && (
                        <span>· {as.lead_time_days}d</span>
                      )}
                      {as.moq != null && (
                        <span>· MOQ {as.moq}</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border flex gap-2 shrink-0">
        <Button size="sm" className="flex-1 h-7 text-xs" disabled={!selected}
          onClick={() => { if (selected) onSelect(selected); }}>
          Select
        </Button>
        {currentApprovedSupplierId && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClear}>
            Clear
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
