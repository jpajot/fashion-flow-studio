import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Ban, GripVertical, Trash2, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import ComponentSupplierPicker from "./ComponentSupplierPicker";
import { createPortal } from "react-dom";

const NA_STYLE = {
  background: "repeating-linear-gradient(-45deg,#f3f4f6,#f3f4f6 2px,#e5e7eb 2px,#e5e7eb 4px)",
};

export default function BOMSupplierMatrix({
  bom,
  bomLines,
  bomLineVariants,
  allProducts,
  lovValues,
  isReadOnly,
  onDeleteLine,
  onUpdateLine,
  onUpsertVariant,
  getUom,
}: any) {
  const [parentVendors, setParentVendors] = useState<any[]>([]);
  const [parentSupplierMap, setParentSupplierMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [supplierCache, setSupplierCache] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!bom?.product_id) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      const asList = ((await supabase.from("approved_suppliers").select("*").eq("product_id", bom.product_id).eq("status", "active")).data ?? []) as any[];
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
      setParentVendors(sorted);
      setParentSupplierMap(map);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [bom?.product_id]);

  useEffect(() => {
    if (loading) return;
    const resolveAll = async () => {
      const updates: Record<string, any> = {};
      for (const line of bomLines) {
        for (const pv of parentVendors) {
          const variant = bomLineVariants.find((v: any) => v.bom_line_id === line.id && v.parent_approved_supplier_id === pv.id);
          const cacheKey = variant?.id || `${line.id}:${pv.id}`;
          if (supplierCache[cacheKey]) continue;
          let asId = variant?.approved_supplier_id || line.line_level_approved_supplier_id;
          if (!asId) {
            const primaries = ((await supabase.from("approved_suppliers").select("*").eq("product_id", line.component_product_id).eq("is_primary", true).eq("status", "active")).data ?? []) as any[];
            asId = primaries[0]?.id || null;
          }
          if (!asId) { updates[cacheKey] = { as: null, supplier: null, isFallback: true }; continue; }
          const asList = ((await supabase.from("approved_suppliers").select("*").eq("id", asId)).data ?? []) as any[];
          const as = asList[0] || null;
          if (!as) { updates[cacheKey] = { as: null, supplier: null, isFallback: true }; continue; }
          const sups = ((await supabase.from("suppliers").select("*").eq("id", as.supplier_id)).data ?? []) as any[];
          updates[cacheKey] = { as, supplier: sups[0] || null, isFallback: !variant?.approved_supplier_id };
        }
      }
      if (Object.keys(updates).length > 0) {
        setSupplierCache((c) => ({ ...c, ...updates }));
      }
    };
    resolveAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bomLines, bomLineVariants, parentVendors]);

  const getVariantForCell = (lineId: string, parentVendorId: string) => {
    return bomLineVariants.find((v: any) => v.bom_line_id === lineId && v.parent_approved_supplier_id === parentVendorId);
  };

  const handleAssignSupplier = (line: any, parentVendorId: string, approvedSupplierId: string) => {
    onUpsertVariant({
      bom_line_id: line.id,
      parent_approved_supplier_id: parentVendorId,
      product_color_id: null,
      size_id: null,
      product_color_and_more_id: null,
      approved_supplier_id: approvedSupplierId,
      is_not_applicable: false,
    });
  };

  const handleResetSupplier = (line: any, parentVendorId: string) => {
    onUpsertVariant({
      bom_line_id: line.id,
      parent_approved_supplier_id: parentVendorId,
      product_color_id: null,
      size_id: null,
      product_color_and_more_id: null,
      approved_supplier_id: null,
    });
  };

  const handleMarkNA = (line: any, parentVendorId: string) => {
    onUpsertVariant({
      bom_line_id: line.id,
      parent_approved_supplier_id: parentVendorId,
      product_color_id: null,
      size_id: null,
      product_color_and_more_id: null,
      is_not_applicable: true,
    });
  };

  const handleClearNA = (line: any, parentVendorId: string) => {
    onUpsertVariant({
      bom_line_id: line.id,
      parent_approved_supplier_id: parentVendorId,
      product_color_id: null,
      size_id: null,
      product_color_and_more_id: null,
      is_not_applicable: false,
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading parent vendors…</div>;
  }

  if (parentVendors.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No active approved suppliers for the parent product. Add suppliers to the parent product first.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-xl mx-2 mt-2">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="sticky top-0 z-[2] bg-card border-b border-border shadow-sm">
            <tr>
              <th className="px-3 py-2.5 w-8 sticky left-0 bg-card z-[3]"></th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground sticky left-8 bg-card z-[3] min-w-[220px]">Component</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-20">Base Qty</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-16">UOM</th>
              {parentVendors.map((pv: any) => {
                const sup = parentSupplierMap[pv.supplier_id];
                return (
                  <th key={pv.id} className="px-2 py-2.5 text-center font-semibold text-muted-foreground min-w-[120px]">
                    <div className="flex items-center justify-center gap-1">
                      {pv.is_primary && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />}
                      <span className="truncate max-w-[100px]" title={sup?.name}>{sup?.name || pv.supplier_reference || `Vendor ${pv.rank || ""}`}</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground font-normal">Rank {pv.rank || "—"}</div>
                  </th>
                );
              })}
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {bomLines.length === 0 ? (
              <tr>
                <td colSpan={4 + parentVendors.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                  No component lines yet.
                </td>
              </tr>
            ) : bomLines.map((line: any) => {
              const comp = allProducts.find((p: any) => p.id === line.component_product_id);
              const roleValues = lovValues.filter((v: any) => v.category === "bom_line_role");
              const roleLabel = roleValues.find((v: any) => v.name === line.component_role)?.name || line.component_role || "—";
              const uom = getUom(line);
              return (
                <tr key={line.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors group">
                  <td className="px-2 py-2 sticky left-0 bg-card z-10">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" />
                  </td>
                  <td className="px-3 py-2 sticky left-8 bg-card z-10 min-w-[220px]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {comp?.images?.[0] && (
                          <img src={comp.images[0]} alt="" className="w-6 h-6 rounded object-cover border border-border shrink-0" />
                        )}
                        <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">{roleLabel}</span>
                        {line.is_phantom && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px]">phantom</span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-foreground text-xs">
                          {comp ? `${comp.code || ""} ${comp.name}`.trim() : <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Missing</span>}
                        </span>
                      </div>
                      <div className="flex gap-1 flex-wrap items-center">
                        {line.varies_by_supplier && <span className="text-[10px] px-1 py-0.5 rounded bg-pink-100 text-pink-700 border border-pink-300">×supplier</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 w-20">
                    {isReadOnly ? (
                      <span className="text-foreground text-xs">{line.base_quantity ?? "—"}</span>
                    ) : (
                      <Input type="number" className="h-6 w-16 text-xs" value={line.base_quantity ?? ""}
                        onChange={(e) => onUpdateLine(line.id, { base_quantity: parseFloat(e.target.value) || null })} />
                    )}
                  </td>
                  <td className="px-3 py-2 w-16">
                    <span className="text-[10px] text-muted-foreground">{uom}</span>
                  </td>
                  {parentVendors.map((pv: any) => {
                    const variant = getVariantForCell(line.id, pv.id);
                    const isNA = variant?.is_not_applicable === true;
                    const cellKey = `${line.id}-${pv.id}`;
                    const cacheKey = variant?.id || `${line.id}:${pv.id}`;
                    const cached = supplierCache[cacheKey];

                    if (isNA) {
                      return (
                        <td key={cellKey} className="px-1 py-1 text-center">
                          <div className="relative w-full min-h-[36px] rounded border border-border flex items-center justify-center group/cell"
                            style={NA_STYLE}
                            title={variant?.na_reason || "Not Applicable"}>
                            <span className="text-[10px] text-muted-foreground font-medium select-none">N/A</span>
                            {!isReadOnly && (
                              <button type="button" onClick={() => handleClearNA(line, pv.id)}
                                className="absolute inset-0 w-full h-full opacity-0 group-hover/cell:opacity-100 flex items-center justify-center bg-background/70 rounded text-[10px] text-foreground transition-opacity">
                                Clear N/A
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    }

                    const hasExplicit = !!variant?.approved_supplier_id;
                    return (
                      <td key={cellKey} className="px-1 py-1 text-center">
                        {!isReadOnly ? (
                          <div className="relative group/cell">
                            <button type="button"
                              onClick={() => setOpenPicker(openPicker === cellKey ? null : cellKey)}
                              className={`w-full min-h-[40px] rounded border text-left px-1.5 py-1 transition-colors ${
                                hasExplicit
                                  ? "border-border hover:border-primary/60 hover:bg-primary/5"
                                  : cached?.supplier
                                    ? "border-border bg-muted/20 hover:border-primary/60 hover:bg-primary/5"
                                    : "border-2 border-dashed border-amber-300 bg-amber-50/50 hover:border-primary/60 hover:bg-primary/5"
                              }`}>
                              {cached?.supplier ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-medium truncate" title={cached.supplier.name}>{cached.supplier.name}</span>
                                  {cached.as?.supplier_reference && (
                                    <span className="text-[9px] text-muted-foreground font-mono truncate">{cached.as.supplier_reference}</span>
                                  )}
                                  {cached.isFallback && (
                                    <span className="text-[8px] italic text-muted-foreground/70">(component default)</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[9px] text-amber-600 font-medium">Pick supplier</span>
                              )}
                            </button>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); handleMarkNA(line, pv.id); }}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover/cell:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                              title="Mark as N/A">
                              <Ban className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-full min-h-[40px] rounded border border-border px-1.5 py-1 text-left">
                            {cached?.supplier ? (
                              <span className="text-[10px]">{cached.supplier.name}</span>
                            ) : (
                              <span className="text-[9px] text-muted-foreground">—</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 w-16">
                    {!isReadOnly && (
                      <button type="button" onClick={() => onDeleteLine(line.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete line">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 flex gap-4 text-[10px] text-muted-foreground flex-wrap items-center px-2 py-1.5 border-t border-border bg-background">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-dashed border-amber-400 bg-amber-50/50 inline-block" />
          Missing resolution
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-border bg-muted/20 inline-block" />
          Component-default supplier (fallback)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 2px, #e5e7eb 2px, #e5e7eb 4px)" }} />
          N/A
        </span>
        <span><Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 inline-block" /> = primary vendor</span>
      </div>

      {openPicker && (() => {
        const [lineId, pvId] = openPicker.split("-");
        const line = bomLines.find((l: any) => l.id === lineId);
        if (!line) return null;
        const variant = getVariantForCell(line.id, pvId);
        return createPortal(
          <>
            <div className="fixed inset-0 z-[9997]" onClick={() => setOpenPicker(null)} />
            <div className="fixed z-[9998]" style={{ top: "30%", left: "50%", transform: "translate(-50%, 0)" }}>
              <ComponentSupplierPicker
                componentProductId={line.component_product_id}
                currentApprovedSupplierId={variant?.approved_supplier_id || null}
                onSelect={(asId) => { handleAssignSupplier(line, pvId, asId); setOpenPicker(null); }}
                onClear={() => { handleResetSupplier(line, pvId); setOpenPicker(null); }}
                onClose={() => setOpenPicker(null)}
              />
            </div>
          </>,
          document.body
        );
      })()}
    </div>
  );
}
