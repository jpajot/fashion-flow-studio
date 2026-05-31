import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Ban, GripVertical, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BOMVariantCellEditor from "./BOMVariantCellEditor";
import ComponentSupplierPicker from "./ComponentSupplierPicker";
import { createPortal } from "react-dom";

const NA_STYLE = {
  background: "repeating-linear-gradient(-45deg,#f3f4f6,#f3f4f6 2px,#e5e7eb 2px,#e5e7eb 4px)",
};

export default function BOMGroupedMatrix({
  bom,
  bomLines,
  bomLineVariants,
  colorVariants,
  styleSizes,
  colorAndMores,
  allProducts,
  allProductColors,
  techColors,
  commColors,
  lovValues,
  allSizes,
  isReadOnly,
  columnAxis,
  secondaryAxis,
  onUpdateLine,
  onDeleteLine,
  onUpsertVariant,
  getUom,
  onAddLine,
  showSourcing,
}: any) {
  const [parentVendors, setParentVendors] = useState<any[]>([]);
  const [parentSupplierMap, setParentSupplierMap] = useState<Record<string, any>>({});
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [openPicker, setOpenPicker] = useState<{ lineId: string; pmId: string; smId: string } | null>(null);
  const [supplierCache, setSupplierCache] = useState<Record<string, any>>({});
  const navigate = useNavigate();

  const needsSupplierData = columnAxis === "supplier" || secondaryAxis === "supplier";

  useEffect(() => {
    if (!needsSupplierData || !bom?.product_id) return;
    setVendorsLoading(true);
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
      setVendorsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [needsSupplierData, bom?.product_id]);

  const buildMembers = (axis: string) => {
    if (axis === "color") return colorVariants.map((c: any) => ({ id: c.id, label: c.color_name || c.colorway_code || "—", hex: c.color_hex }));
    if (axis === "size") return styleSizes.map((ss: any) => {
      const s = allSizes.find((x: any) => x.id === ss.size_id);
      return { id: ss.size_id, label: s?.name || s?.size_code || ss.size_id };
    });
    if (axis === "color_and_more") return colorAndMores.map((cm: any) => ({ id: cm.id, label: cm.name || cm.sequence || "—" }));
    if (axis === "supplier") return parentVendors.map((v: any) => ({
      id: v.id,
      label: parentSupplierMap[v.supplier_id]?.name || v.supplier_reference || `Vendor ${v.rank || ""}`,
      isPrimary: v.is_primary,
      rank: v.rank,
    }));
    return [];
  };

  const primaryMembers = useMemo(() => buildMembers(columnAxis), [columnAxis, colorVariants, styleSizes, colorAndMores, allSizes, parentVendors, parentSupplierMap]);
  const secondaryMembers = useMemo(() => buildMembers(secondaryAxis), [secondaryAxis, colorVariants, styleSizes, colorAndMores, allSizes, parentVendors, parentSupplierMap]);

  const fkForAxis = (axis: string) => {
    if (axis === "color") return "product_color_id";
    if (axis === "size") return "size_id";
    if (axis === "color_and_more") return "product_color_and_more_id";
    if (axis === "supplier") return "parent_approved_supplier_id";
    return null;
  };

  const getVariantForCell = (lineId: string, primaryMember: any, secondaryMember: any) => {
    const pFk = fkForAxis(columnAxis);
    const sFk = fkForAxis(secondaryAxis);
    return bomLineVariants.find((v: any) => {
      if (v.bom_line_id !== lineId) return false;
      if (pFk && v[pFk] !== primaryMember.id) return false;
      if (sFk && v[sFk] !== secondaryMember.id) return false;
      return true;
    });
  };

  const resolveSupplier = async (line: any, parentVendorId: string, variant: any) => {
    const cacheKey = `${variant?.id || `${line.id}:${parentVendorId}`}`;
    if (supplierCache[cacheKey]) return supplierCache[cacheKey];
    let approvedSupplierId = variant?.approved_supplier_id || line.line_level_approved_supplier_id;
    if (!approvedSupplierId) {
      const compPrimary = ((await supabase.from("approved_suppliers").select("*").eq("product_id", line.component_product_id).eq("is_primary", true).eq("status", "active")).data ?? []) as any[];
      approvedSupplierId = compPrimary[0]?.id || null;
    }
    if (!approvedSupplierId) {
      const entry = { as: null, supplier: null };
      setSupplierCache((c) => ({ ...c, [cacheKey]: entry }));
      return entry;
    }
    const asList = ((await supabase.from("approved_suppliers").select("*").eq("id", approvedSupplierId)).data ?? []) as any[];
    const as = asList[0] || null;
    if (!as) {
      const entry = { as: null, supplier: null };
      setSupplierCache((c) => ({ ...c, [cacheKey]: entry }));
      return entry;
    }
    const sups = ((await supabase.from("suppliers").select("*").eq("id", as.supplier_id)).data ?? []) as any[];
    const entry = { as, supplier: sups[0] || null };
    setSupplierCache((c) => ({ ...c, [cacheKey]: entry }));
    return entry;
  };

  const handleAssignSupplier = (line: any, primaryMember: any, secondaryMember: any, approvedSupplierId: string) => {
    const payload: any = { bom_line_id: line.id };
    const pFk = fkForAxis(columnAxis);
    const sFk = fkForAxis(secondaryAxis);
    if (pFk) payload[pFk] = primaryMember.id;
    if (sFk) payload[sFk] = secondaryMember.id;
    ["product_color_id", "size_id", "product_color_and_more_id", "parent_approved_supplier_id"].forEach((f) => {
      if (f !== pFk && f !== sFk) payload[f] = null;
    });
    payload.approved_supplier_id = approvedSupplierId;
    payload.is_not_applicable = false;
    onUpsertVariant(payload);
  };

  const handleResetSupplier = (line: any, primaryMember: any, secondaryMember: any) => {
    const payload: any = { bom_line_id: line.id };
    const pFk = fkForAxis(columnAxis);
    const sFk = fkForAxis(secondaryAxis);
    if (pFk) payload[pFk] = primaryMember.id;
    if (sFk) payload[sFk] = secondaryMember.id;
    ["product_color_id", "size_id", "product_color_and_more_id", "parent_approved_supplier_id"].forEach((f) => {
      if (f !== pFk && f !== sFk) payload[f] = null;
    });
    payload.approved_supplier_id = null;
    onUpsertVariant(payload);
  };

  if (needsSupplierData && vendorsLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading parent vendors…</div>;
  }

  if (primaryMembers.length === 0 || secondaryMembers.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {columnAxis === "supplier" || secondaryAxis === "supplier"
          ? "No active approved suppliers for the parent product. Add suppliers to the parent product first."
          : "No data for the selected axes."}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-xl mx-2 mt-2">
        <table className="w-full text-xs min-w-[800px]">
          <thead className="sticky top-0 z-[2] bg-card border-b border-border shadow-sm">
            <tr>
              <th className="px-3 py-2.5 w-8 sticky left-0 bg-card z-[3]" rowSpan={2}></th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground sticky left-8 bg-card z-[3] min-w-[220px]" rowSpan={2}>Component</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-20" rowSpan={2}>Base Qty</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-16" rowSpan={2}>UOM</th>
              {primaryMembers.map((pm: any) => (
                <th
                  key={pm.id}
                  colSpan={secondaryMembers.length}
                  className="px-2 py-2 text-center font-semibold text-muted-foreground border-l-2 border-border bg-muted/30"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {columnAxis === "color" && pm.hex && (
                      <div className="w-3 h-3 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: pm.hex }} />
                    )}
                    {columnAxis === "supplier" && pm.isPrimary && (
                      <span className="text-amber-500 text-[10px]">★</span>
                    )}
                    <span className="truncate" title={pm.label}>{pm.label}</span>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2.5 w-8" rowSpan={2}></th>
            </tr>
            <tr>
              {primaryMembers.flatMap((pm: any) =>
                secondaryMembers.map((sm: any, sIdx: number) => (
                  <th
                    key={`${pm.id}-${sm.id}`}
                    className={`px-1.5 py-1.5 text-center text-[10px] font-medium text-muted-foreground min-w-[80px] ${sIdx === 0 ? "border-l-2 border-border" : ""}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {secondaryAxis === "color" && sm.hex && (
                        <div className="w-2 h-2 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: sm.hex }} />
                      )}
                      {secondaryAxis === "supplier" && sm.isPrimary && (
                        <span className="text-amber-500 text-[9px]">★</span>
                      )}
                      <span className="truncate" title={sm.label}>{sm.label}</span>
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {bomLines.length === 0 ? (
              <tr>
                <td colSpan={4 + primaryMembers.length * secondaryMembers.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="space-y-2">
                    <p>No component lines yet.</p>
                    {!isReadOnly && (
                      <Button size="sm" variant="outline" onClick={onAddLine} className="gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add Component Line
                      </Button>
                    )}
                  </div>
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
                        {[
                          { flag: "varies_by_color", label: "×color", cls: "bg-blue-100 text-blue-700 border-blue-300" },
                          { flag: "varies_by_size", label: "×size", cls: "bg-green-100 text-green-700 border-green-300" },
                          { flag: "varies_by_color_and_more", label: "×more", cls: "bg-orange-100 text-orange-700 border-orange-300" },
                          { flag: "varies_by_supplier", label: "×supplier", cls: "bg-pink-100 text-pink-700 border-pink-300" },
                        ].map(({ flag, label, cls }) => (
                          line[flag] && <span key={flag} className={`text-[10px] px-1 py-0.5 rounded ${cls}`}>{label}</span>
                        ))}
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
                  {primaryMembers.flatMap((pm: any) =>
                    secondaryMembers.map((sm: any, sIdx: number) => {
                      const variant = getVariantForCell(line.id, pm, sm);
                      const isNA = variant?.is_not_applicable === true;
                      const cellKey = `${line.id}-${pm.id}-${sm.id}`;
                      const isPickerOpen =
                        openPicker?.lineId === line.id &&
                        openPicker?.pmId === pm.id &&
                        openPicker?.smId === sm.id;

                      const isSupplierAxis = columnAxis === "supplier" || secondaryAxis === "supplier";
                      const supplierAxisIsPrimary = columnAxis === "supplier";
                      const parentVendorId = supplierAxisIsPrimary ? pm.id : (secondaryAxis === "supplier" ? sm.id : null);

                      if (isNA) {
                        return (
                          <td key={cellKey} className={`px-1 py-1 ${sIdx === 0 ? "border-l-2 border-border" : ""}`}>
                            <div className="relative w-full min-h-[36px] rounded border border-border flex items-center justify-center group/cell"
                              style={NA_STYLE}
                              title={variant?.na_reason || "Not Applicable"}>
                              <span className="text-[10px] text-muted-foreground font-medium select-none">N/A</span>
                              {!isReadOnly && (
                                <button type="button"
                                  onClick={() => onUpsertVariant({
                                    bom_line_id: line.id,
                                    ...(fkForAxis(columnAxis) ? { [fkForAxis(columnAxis)!]: pm.id } : {}),
                                    ...(fkForAxis(secondaryAxis) ? { [fkForAxis(secondaryAxis)!]: sm.id } : {}),
                                    is_not_applicable: false,
                                  })}
                                  className="absolute inset-0 w-full h-full opacity-0 group-hover/cell:opacity-100 flex items-center justify-center bg-background/70 rounded text-[10px] text-foreground transition-opacity">
                                  Clear N/A
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }

                      if (isSupplierAxis && parentVendorId) {
                        const cacheKey = `${variant?.id || `${line.id}:${parentVendorId}`}`;
                        if (!supplierCache[cacheKey]) {
                          resolveSupplier(line, parentVendorId, variant);
                        }
                        const cached = supplierCache[cacheKey];
                        const hasExplicit = !!variant?.approved_supplier_id;
                        const compApprovedSupplier = cached?.as || null;
                        const compSupplier = cached?.supplier || null;

                        const noCompSuppliers = cached && !cached.supplier && !hasExplicit;
                        if (noCompSuppliers) {
                          return (
                            <td key={cellKey} className={`px-1 py-1 ${sIdx === 0 ? "border-l-2 border-border" : ""}`}>
                              <div className="flex items-center justify-center gap-1 text-amber-600 text-[10px] min-h-[40px]">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <button
                                  type="button"
                                  onClick={() => navigate(`/products/${line.component_product_id}`)}
                                  className="underline hover:text-amber-800"
                                >
                                  No suppliers
                                </button>
                              </div>
                            </td>
                          );
                        }

                        const cellContent = compSupplier ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium truncate" title={compSupplier.name}>{compSupplier.name}</span>
                            {compApprovedSupplier?.supplier_reference && (
                              <span className="text-[9px] text-muted-foreground font-mono truncate">{compApprovedSupplier.supplier_reference}</span>
                            )}
                            {!hasExplicit && (
                              <span className="text-[8px] italic text-muted-foreground/70">(component default)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[9px] text-muted-foreground">Loading…</span>
                        );

                        return (
                          <td key={cellKey} className={`px-1 py-1 ${sIdx === 0 ? "border-l-2 border-border" : ""}`}>
                            <div className="relative group/cell">
                              {(!isReadOnly && line.varies_by_supplier) ? (
                                <button type="button"
                                  onClick={() => setOpenPicker(isPickerOpen ? null : { lineId: line.id, pmId: pm.id, smId: sm.id })}
                                  className={`w-full min-h-[40px] rounded border text-left px-1.5 py-1 transition-colors ${
                                    hasExplicit
                                      ? "border-border hover:border-primary/60 hover:bg-primary/5"
                                      : "border-border bg-muted/20 hover:border-primary/60 hover:bg-primary/5"
                                  }`}>
                                  {cellContent}
                                </button>
                              ) : (
                                <div className="w-full min-h-[40px] rounded border border-border px-1.5 py-1">
                                  {cellContent}
                                </div>
                              )}
                              {!isReadOnly && line.varies_by_supplier && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const pFk = fkForAxis(columnAxis);
                                    const sFk = fkForAxis(secondaryAxis);
                                    const payload: any = {
                                      bom_line_id: line.id,
                                      ...(pFk ? { [pFk]: pm.id } : {}),
                                      ...(sFk ? { [sFk]: sm.id } : {}),
                                      is_not_applicable: true,
                                    };
                                    ["product_color_id", "size_id", "product_color_and_more_id", "parent_approved_supplier_id"].forEach((f) => {
                                      if (f !== pFk && f !== sFk) payload[f] = null;
                                    });
                                    onUpsertVariant(payload);
                                  }}
                                  className="absolute top-0.5 right-0.5 opacity-0 group-hover/cell:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                                  title="Mark as N/A"
                                >
                                  <Ban className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }

                      const syntheticCol = {
                        id: pm.id,
                        size_id: pm.id,
                      };
                      const cellColumnAxis = columnAxis;
                      return (
                        <td key={cellKey} className={`px-1 py-1 ${sIdx === 0 ? "border-l-2 border-border" : ""}`}>
                          <BOMVariantCellEditor
                            variant={variant}
                            line={line}
                            col={syntheticCol}
                            columnAxis={cellColumnAxis}
                            uom={uom}
                            isReadOnly={isReadOnly}
                            allProductColors={allProductColors}
                            techColors={techColors}
                            commColors={commColors}
                            bomType={bom?.bom_type}
                            onUpsertVariant={(payload: any) => {
                              const sFk = fkForAxis(secondaryAxis);
                              if (sFk) payload[sFk] = sm.id;
                              onUpsertVariant(payload);
                            }}
                            allSizes={allSizes}
                          />
                        </td>
                      );
                    })
                  )}
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
          <span className="w-3 h-3 rounded inline-block" style={{ background: "repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 2px, #e5e7eb 2px, #e5e7eb 4px)" }} />
          N/A
        </span>
        <span>Primary axis: <strong>{columnAxis}</strong> · Secondary axis: <strong>{secondaryAxis}</strong></span>
      </div>

      {openPicker && (() => {
        const { lineId, pmId, smId } = openPicker;
        const line = bomLines.find((l: any) => l.id === lineId);
        const pm = primaryMembers.find((p: any) => p.id === pmId);
        const sm = secondaryMembers.find((s: any) => s.id === smId);
        if (!line || !pm || !sm) return null;
        const variant = getVariantForCell(line.id, pm, sm);
        return createPortal(
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpenPicker(null)}>
            <div className="absolute" style={{ top: "30%", left: "50%", transform: "translate(-50%, 0)" }} onClick={(e) => e.stopPropagation()}>
              <ComponentSupplierPicker
                componentProductId={line.component_product_id}
                currentApprovedSupplierId={variant?.approved_supplier_id || null}
                onSelect={(asId) => { handleAssignSupplier(line, pm, sm, asId); setOpenPicker(null); }}
                onReset={() => { handleResetSupplier(line, pm, sm); setOpenPicker(null); }}
                onClose={() => setOpenPicker(null)}
              />
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
