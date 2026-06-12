import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Plus, AlertTriangle, Pencil } from "lucide-react";
import BOMVariantCellEditor from "./BOMVariantCellEditor";
import BOMSourcingBlock from "./BOMSourcingBlock";
import BOMLineDestructiveConfirmDialog from "./BOMLineDestructiveConfirmDialog";
import BOMGroupedMatrix from "./BOMGroupedMatrix";
import BOMSupplierMatrix from "./BOMSupplierMatrix";

const SIZE_VARIATION_MODE_OPTIONS = [
  { value: "consumption_grading", label: "Consumption grading" },
  { value: "component_size_mapping", label: "Component size mapping" },
  { value: "base_size_with_optional_grading", label: "Base size + optional grading" },
  { value: "both", label: "Both" },
];

const BASE_SIZE_REQUIRED_MODES = ["base_size_with_optional_grading", "component_size_mapping"];

function SizeVariationControls({ line, allSizes, isReadOnly, onUpdateLine }: any) {
  const mode = line.size_variation_mode;
  const showBaseSizePicker = BASE_SIZE_REQUIRED_MODES.includes(mode);
  const [compStyleSizes, setCompStyleSizes] = useState<any[]>([]);

  useEffect(() => {
    if (!line.component_product_id || !line.varies_by_size) return;
    (async () => {
      const { data } = await supabase.from("style_sizes").select("*").eq("product_id", line.component_product_id);
      setCompStyleSizes((data ?? []).filter((s: any) => s.active !== false));
    })();
  }, [line.component_product_id, line.varies_by_size]);

  const getSizeName = (sizeId: string) => {
    const s = allSizes.find((sz: any) => sz.id === sizeId);
    return s?.name || s?.size_code || sizeId;
  };

  if (!line.varies_by_size) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5 items-center">
      {!isReadOnly ? (
        <Select value={mode || ""} onValueChange={(v) => onUpdateLine(line.id, { size_variation_mode: v })}>
          <SelectTrigger className="h-6 text-[10px] w-44 border-green-300 bg-green-50 text-green-800 px-1.5">
            <SelectValue placeholder="Size variation mode…" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_VARIATION_MODE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        mode && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            {SIZE_VARIATION_MODE_OPTIONS.find((o) => o.value === mode)?.label || mode}
          </span>
        )
      )}
      {showBaseSizePicker && compStyleSizes.length > 0 && (
        !isReadOnly ? (
          <Select
            value={line.base_component_size_id || ""}
            onValueChange={(v) => onUpdateLine(line.id, { base_component_size_id: v || null })}
          >
            <SelectTrigger className="h-6 text-[10px] w-32 px-1.5">
              <SelectValue placeholder="Base size…" />
            </SelectTrigger>
            <SelectContent>
              {compStyleSizes.map((ss) => (
                <SelectItem key={ss.size_id} value={ss.size_id} className="text-xs">
                  {getSizeName(ss.size_id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          line.base_component_size_id && (
            <span className="text-[10px] text-muted-foreground">Base: {getSizeName(line.base_component_size_id)}</span>
          )
        )
      )}
      {showBaseSizePicker && !line.base_component_size_id && !isReadOnly && compStyleSizes.length > 0 && (
        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5" /> Pick a base size
        </span>
      )}
    </div>
  );
}

function SupplierSubscript({ compColorId, lineComponentProductId }: any) {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    if (!compColorId || !lineComponentProductId) return;
    let cancelled = false;
    (async () => {
      const { data: asList } = await supabase.from("approved_suppliers").select("*").match({
        product_id: lineComponentProductId, is_primary: true, status: "active",
      });
      if (cancelled || !asList || asList.length === 0) return;
      const as = asList[0];
      const { data: links } = await supabase.from("product_color_supplier_links").select("*").match({
        product_color_id: compColorId, approved_supplier_id: as.id,
      });
      if (cancelled) return;
      const { data: suppliers } = await supabase.from("suppliers").select("*").eq("id", as.supplier_id);
      if (cancelled) return;
      setInfo({ as, supplier: suppliers?.[0], link: links?.[0] || null });
    })();
    return () => { cancelled = true; };
  }, [compColorId, lineComponentProductId]);

  if (!info) return null;
  const { supplier, link, as } = info;
  const supplierName = supplier?.name || "Supplier";

  if (!link) {
    return (
      <div className="text-[9px] text-muted-foreground/60 mt-0.5 leading-tight">
        {supplierName}
        {as.supplier_reference && ` · ${as.supplier_reference}`}
        <span className="italic"> (product ref)</span>
      </div>
    );
  }

  const { colorway_supplier_status: status, colorway_supplier_reference: ref } = link;

  if (status === "not_applicable") {
    return (
      <div className="text-[9px] text-destructive mt-0.5 leading-tight flex items-center gap-0.5">
        <AlertTriangle className="w-2.5 h-2.5" />
        N/A @ {supplierName}
      </div>
    );
  }
  if (status === "discontinued") {
    return (
      <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight line-through">
        {supplierName}{ref ? ` · ${ref}` : ""}
      </div>
    );
  }

  return (
    <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
      {supplierName}{ref ? ` · ${ref}` : ""}
      {status === "pending_confirmation" && (
        <span className="ml-1 px-0.5 rounded bg-orange-100 text-orange-600 not-italic">pending</span>
      )}
    </div>
  );
}

interface Props {
  bom: any;
  bomLines: any[];
  bomLineVariants: any[];
  colorVariants: any[];
  styleSizes: any[];
  colorAndMores: any[];
  allProducts: any[];
  allProductColors: any[];
  techColors: any[];
  commColors: any[];
  lovValues: any[];
  allSizes?: any[];
  isReadOnly?: boolean;
  columnAxis: string;
  onColumnAxisChange?: (v: string) => void;
  secondaryAxis?: string | null;
  onSecondaryAxisChange?: (v: string | null) => void;
  showSourcing?: boolean;
  showRevisionSnapshots?: boolean;
  onUpdateLine: (id: string, updates: any) => void;
  onDeleteLine: (id: string) => void;
  onUpsertVariant: (payload: any) => void;
  onDeleteVariant: (id: string) => void;
  getUom: (line: any) => string;
  onAddLine: () => void;
  onReorderLines?: (lines: any[]) => void;
  onEditLineSaved?: (lineId: string, deletedVariantIds?: string[]) => void;
  onEditLine?: (line: any) => void;
  user?: any;
  externalSearch?: string;
}

export default function BOMMatrixEditor({
  bom, bomLines, bomLineVariants, colorVariants, styleSizes, colorAndMores,
  allProducts, allProductColors, techColors, commColors,
  lovValues, isReadOnly, columnAxis,
  secondaryAxis,
  showSourcing,
  onUpdateLine, onDeleteLine, onUpsertVariant, onDeleteVariant, getUom, onAddLine,
  onReorderLines, onEditLineSaved, onEditLine,
  allSizes = [],
  externalSearch = "",
}: Props) {
  const [inlineConfirm, setInlineConfirm] = useState<any>(null);

  const [dragLineId, setDragLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  const dragSourceIndex = useRef<number | null>(null);

  // Revision snapshots stubbed for Phase 3-bis
  const snapshotData = { snapshotted: {}, current: {} };

  const handleDragStart = (e: React.DragEvent, lineId: string, index: number) => {
    if (isReadOnly) { e.preventDefault(); return; }
    setDragLineId(lineId);
    dragSourceIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lineId);
  };

  const handleDragOver = (e: React.DragEvent, lineId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (lineId !== dragLineId) setDragOverLineId(lineId);
  };

  const handleDragEnd = () => {
    setDragLineId(null);
    setDragOverLineId(null);
    dragSourceIndex.current = null;
  };

  const handleDrop = async (e: React.DragEvent, targetLineId: string) => {
    e.preventDefault();
    setDragLineId(null);
    setDragOverLineId(null);
    if (!dragLineId || dragLineId === targetLineId) return;

    const currentOrder = [...bomLines];
    const fromIdx = currentOrder.findIndex((l) => l.id === dragLineId);
    const toIdx = currentOrder.findIndex((l) => l.id === targetLineId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...currentOrder];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const withPositions = reordered.map((line, idx) => ({ ...line, position: idx }));
    if (onReorderLines) onReorderLines(withPositions);

    const changed = withPositions.filter(
      (line) => line.position !== currentOrder.find((l) => l.id === line.id)?.position
    );
    await Promise.all(changed.map((line) =>
      supabase.from("bom_lines").update({ position: line.position }).eq("id", line.id)
    ));
  };

  const handleFlagToggle = (line: any, flag: string, newValue: boolean) => {
    if (newValue === true) { onUpdateLine(line.id, { [flag]: true }); return; }

    const lineVariants = bomLineVariants.filter((v) => v.bom_line_id === line.id);
    const cascadeIds = lineVariants
      .filter((v) => {
        if (flag === "varies_by_color") return v.product_color_id;
        if (flag === "varies_by_size") return v.size_id;
        if (flag === "varies_by_color_and_more") return v.product_color_and_more_id;
        if (flag === "varies_by_supplier") return v.parent_approved_supplier_id;
        return false;
      })
      .map((v) => v.id);

    if (cascadeIds.length === 0) { onUpdateLine(line.id, { [flag]: false }); return; }

    const flagLabel: any = {
      varies_by_color: "Varies by color",
      varies_by_size: "Varies by size",
      varies_by_color_and_more: "Varies by Color & More",
      varies_by_supplier: "Varies by supplier",
    }[flag] || flag;

    setInlineConfirm({
      lineId: line.id,
      field: flag,
      newValue: false,
      cascadeIds,
      description: (
        <p>Disabling <strong>"{flagLabel}"</strong> on this line will delete <strong>{cascadeIds.length} variant record{cascadeIds.length !== 1 ? "s" : ""}</strong>. This cannot be undone.</p>
      ),
    });
  };

  const executeInlineConfirm = async () => {
    const { lineId, field, newValue, cascadeIds } = inlineConfirm;
    setInlineConfirm(null);
    if (cascadeIds.length > 0) {
      await Promise.all(cascadeIds.map((vid: string) => supabase.from("bom_line_variants").delete().eq("id", vid)));
      if (onEditLineSaved) onEditLineSaved(lineId, cascadeIds);
    }
    onUpdateLine(lineId, { [field]: newValue });
  };

  const columnHeaders = useMemo(() => {
    if (columnAxis === "color") return colorVariants;
    if (columnAxis === "size") {
      return styleSizes.map((ss) => {
        const sizeRecord = allSizes.find((s) => s.id === ss.size_id);
        return { id: ss.size_id, size_id: ss.size_id, label: sizeRecord?.name || sizeRecord?.size_code || ss.size_id };
      });
    }
    if (columnAxis === "color_and_more") return colorAndMores;
    return colorVariants;
  }, [columnAxis, colorVariants, styleSizes, colorAndMores, allSizes]);

  const getColumnLabel = (col: any) => {
    if (columnAxis === "color") return col.color_name || col.colorway_code || "—";
    if (columnAxis === "size") return col.label || col.id;
    if (columnAxis === "color_and_more") return col.name || col.sequence || "—";
    return col.id;
  };

  const filteredLines = useMemo(() => {
    if (!externalSearch.trim()) return bomLines;
    const q = externalSearch.toLowerCase();
    return bomLines.filter((line) => {
      const comp = allProducts.find((p) => p.id === line.component_product_id);
      return comp?.name?.toLowerCase().includes(q) || comp?.code?.toLowerCase().includes(q) || line.component_role?.toLowerCase().includes(q);
    });
  }, [bomLines, externalSearch, allProducts]);

  const getVariantForCell = (lineId: string, col: any) => {
    return bomLineVariants.find((v) => {
      if (v.bom_line_id !== lineId) return false;
      if (columnAxis === "color") return v.product_color_id === col.id;
      if (columnAxis === "size") return v.size_id === col.id || v.size_id === col.size_id;
      if (columnAxis === "color_and_more") return v.product_color_and_more_id === col.id;
      return false;
    });
  };

  const uomLabel = (line: any) => {
    const u = getUom(line);
    const isOverride = line.uom_is_overridden;
    return (
      <span className={`text-[10px] ${isOverride ? "font-semibold text-amber-600" : "text-muted-foreground"}`}
        title={isOverride ? "UOM overridden" : "Inherited from component"}>
        {u}{isOverride ? " ●" : ""}
      </span>
    );
  };

  if (secondaryAxis && secondaryAxis !== columnAxis) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <BOMGroupedMatrix
          bom={bom}
          bomLines={bomLines}
          bomLineVariants={bomLineVariants}
          colorVariants={colorVariants}
          styleSizes={styleSizes}
          colorAndMores={colorAndMores}
          allProducts={allProducts}
          allProductColors={allProductColors}
          techColors={techColors}
          commColors={commColors}
          lovValues={lovValues}
          allSizes={allSizes}
          isReadOnly={isReadOnly}
          columnAxis={columnAxis}
          secondaryAxis={secondaryAxis}
          onUpdateLine={onUpdateLine}
          onDeleteLine={onDeleteLine}
          onUpsertVariant={onUpsertVariant}
          getUom={getUom}
          onAddLine={onAddLine}
          showSourcing={showSourcing}
        />
      </div>
    );
  }
  if (columnAxis === "supplier") {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <BOMSupplierMatrix
          bom={bom}
          bomLines={bomLines}
          bomLineVariants={bomLineVariants}
          allProducts={allProducts}
          lovValues={lovValues}
          isReadOnly={isReadOnly}
          onDeleteLine={onDeleteLine}
          onUpdateLine={onUpdateLine}
          onUpsertVariant={onUpsertVariant}
          getUom={getUom}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-xl mx-2 mt-2">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="sticky top-0 z-[2] bg-card border-b border-border shadow-sm">
            <tr>
              <th className="px-3 py-2.5 w-8 sticky left-0 bg-card z-[3]"></th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground sticky left-8 bg-card z-[3] min-w-[220px]">Component</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-20">Base Qty</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-16">UOM</th>
              {columnHeaders.map((col: any) => (
                <th key={col.id} className="px-2 py-2.5 text-center font-semibold text-muted-foreground min-w-[96px]">
                  <div className="truncate max-w-[96px] mx-auto" title={getColumnLabel(col)}>{getColumnLabel(col)}</div>
                  {columnAxis === "color" && col.color_hex && (
                    <div className="w-3 h-3 rounded-full mx-auto mt-0.5 border border-border/50" style={{ backgroundColor: col.color_hex }} />
                  )}
                </th>
              ))}
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.length === 0 ? (
              <tr>
                <td colSpan={5 + columnHeaders.length} className="px-4 py-12 text-center text-muted-foreground">
                  {bomLines.length === 0 ? (
                    <div className="space-y-2">
                      <p>No component lines yet.</p>
                      {!isReadOnly && (
                        <Button size="sm" variant="outline" onClick={onAddLine} className="gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Component Line
                        </Button>
                      )}
                    </div>
                  ) : "No results match your search."}
                </td>
              </tr>
            ) : filteredLines.map((line, idx) => {
              const comp = allProducts.find((p) => p.id === line.component_product_id);
              const roleValues = lovValues.filter((v) => v.category === "bom_line_role");
              const roleLabel = roleValues.find((v) => v.name === line.component_role)?.name || line.component_role || "—";
              const uom = getUom(line);
              const isDragging = dragLineId === line.id;
              const isDragOver = dragOverLineId === line.id;
              return (
                <tr
                  key={line.id}
                  onDragOver={(e) => handleDragOver(e, line.id)}
                  onDrop={(e) => handleDrop(e, line.id)}
                  onDragEnd={handleDragEnd}
                  className={`border-b border-border last:border-0 transition-colors group
                    ${isDragging ? "opacity-40" : "hover:bg-muted/10"}
                    ${isDragOver ? "border-t-2 border-t-primary" : ""}
                  `}
                >
                  <td className="px-2 py-2 sticky left-0 bg-card z-10">
                    {isReadOnly ? (
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/20" />
                    ) : (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, line.id, idx)}
                        className="cursor-grab active:cursor-grabbing"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
                      </div>
                    )}
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
                          {comp
                            ? `${comp.code || ""} ${comp.name}`.trim()
                            : <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Missing</span>}
                        </span>
                      </div>
                      <div className="flex gap-1 flex-wrap items-center">
                        {[
                          { flag: "varies_by_color", label: "×color", cls: "bg-blue-100 text-blue-700 border-blue-300" },
                          { flag: "varies_by_size", label: "×size", cls: "bg-green-100 text-green-700 border-green-300" },
                          { flag: "varies_by_color_and_more", label: "×more", cls: "bg-orange-100 text-orange-700 border-orange-300" },
                          { flag: "varies_by_supplier", label: "×supplier", cls: "bg-pink-100 text-pink-700 border-pink-300" },
                        ].map(({ flag, label, cls }) => (
                          !isReadOnly ? (
                            <button
                              key={flag}
                              type="button"
                              onClick={() => handleFlagToggle(line, flag, !line[flag])}
                              className={`text-[10px] px-1 py-0.5 rounded border transition-colors ${
                                line[flag]
                                  ? cls
                                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                              }`}
                              title={`Toggle ${label}`}
                            >
                              {label}
                            </button>
                          ) : (
                            line[flag] && <span key={flag} className={`text-[10px] px-1 py-0.5 rounded ${cls}`}>{label}</span>
                          )
                        ))}
                      </div>
                      <SizeVariationControls line={line} allSizes={allSizes} isReadOnly={isReadOnly} onUpdateLine={onUpdateLine} />
                      {showSourcing && <BOMSourcingBlock line={line} comp={comp} />}
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
                  <td className="px-3 py-2 w-16">{uomLabel(line)}</td>
                  {columnHeaders.map((col: any) => {
                    const variant = getVariantForCell(line.id, col);
                    const compColorId = columnAxis === "color" ? variant?.component_product_color_id : null;
                    return (
                      <td key={col.id} className="px-1.5 py-2 text-center min-w-[96px] align-top">
                        <BOMVariantCellEditor
                          variant={variant}
                          line={line}
                          col={col}
                          columnAxis={columnAxis}
                          uom={uom}
                          isReadOnly={isReadOnly}
                          allProductColors={allProductColors}
                          techColors={techColors}
                          commColors={commColors}
                          bomPhase={bom?.bom_phase}
                          onUpsertVariant={onUpsertVariant}
                          onDeleteVariant={onDeleteVariant}
                          allSizes={allSizes}
                          showRevisionSnapshots={false}
                          snapshotData={snapshotData}
                        />
                        {showSourcing && columnAxis === "color" && compColorId && (
                          <SupplierSubscript
                            compColorId={compColorId}
                            lineComponentProductId={line.component_product_id}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 w-16">
                    {!isReadOnly && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button type="button" onClick={() => onEditLine?.(line)}
                          className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          title="Edit line">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => onDeleteLine(line.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete line">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
          <span className="w-3 h-3 rounded border border-border bg-card inline-block" />
          Resolved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block"
            style={{ background: "repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 2px, #e5e7eb 2px, #e5e7eb 4px)" }} />
          N/A
        </span>
        <span className="flex items-center gap-1 text-amber-600">Δ = quantity graded</span>
      </div>

      {inlineConfirm && (
        <BOMLineDestructiveConfirmDialog
          open={true}
          description={inlineConfirm.description}
          deleteCount={inlineConfirm.cascadeIds.length}
          onConfirm={executeInlineConfirm}
          onCancel={() => setInlineConfirm(null)}
        />
      )}
    </div>
  );
}
