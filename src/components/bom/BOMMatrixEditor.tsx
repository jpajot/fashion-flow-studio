import { useMemo } from "react";
import { LayoutGrid, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import BOMVariantCellEditor from "./BOMVariantCellEditor";
import { useState } from "react";

const EDITABLE_STATUSES = ["draft", "in_review"];
const isBomEditable = (bom: any) => bom && EDITABLE_STATUSES.includes(bom.status);

interface Props {
  bom: any;
  bomLines: any[];
  bomVariants: any[];
  colorways: any[];
  variations: any[];
  approvedSuppliers: any[];
  styleSizes: any[];
  sizes: any[];
  suppliers: any[];
  currencies: any[];
  allProducts: any[];
  lovTypes: any[];
  lovValues: any[];
  colorSupplierLinks: any[];

  columnAxis: string;
  secondaryColumnAxis: string | null;
  filterConfig: any;

  onVariantsChange: (variants: any[]) => void;
  onLineEdit: (line: any) => void;
}

type ColumnDef = {
  id: string;
  label: string;
  subLabel?: string;
  swatch?: string;
};

const fkFieldForAxis = (axis: string): string => {
  switch (axis) {
    case "color": return "product_color_id";
    case "size": return "size_id";
    case "color_and_more": return "product_color_and_more_id";
    case "supplier": return "parent_approved_supplier_id";
    default: return "product_color_id";
  }
};

function buildColumnsForAxis(
  axis: string,
  colorways: any[],
  styleSizes: any[],
  sizes: any[],
  variations: any[],
  approvedSuppliers: any[],
  suppliers: any[],
): ColumnDef[] {
  if (axis === "color") {
    return colorways.map(c => ({
      id: c.id,
      label: c.color_name || "—",
      subLabel: c.colorway_code,
      swatch: c.color_hex,
    }));
  }
  if (axis === "size") {
    return styleSizes
      .filter(ss => ss.active !== false)
      .map(ss => {
        const s = sizes.find(x => x.id === ss.size_id);
        return { id: ss.size_id, label: s?.size_code || "—", subLabel: s?.name };
      });
  }
  if (axis === "color_and_more") {
    return variations.map(v => {
      const cw = colorways.find(c => c.id === v.product_color_id);
      return {
        id: v.id,
        label: v.name || "—",
        subLabel: [cw?.color_name, v.pack_code, v.variant].filter(Boolean).join(" · "),
        swatch: cw?.color_hex,
      };
    });
  }
  if (axis === "supplier") {
    return approvedSuppliers.map(as => {
      const sup = suppliers.find(s => s.id === as.supplier_id);
      return {
        id: as.id,
        label: sup?.name || "—",
        subLabel: as.is_primary ? "Primary" : `Rank ${as.rank}`,
      };
    });
  }
  return [];
}

function ColumnHeaderContent({ col, small = false }: { col: ColumnDef; small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {col.swatch && (
        <div
          className={cn("rounded shrink-0 border border-border", small ? "w-3 h-3" : "w-4 h-4")}
          style={{ backgroundColor: col.swatch }}
        />
      )}
      <div className="min-w-0">
        <p className={cn("font-semibold truncate", small ? "text-[10px]" : "text-xs")}>{col.label}</p>
        {col.subLabel && <p className={cn("text-muted-foreground truncate", small ? "text-[9px]" : "text-[10px]")}>{col.subLabel}</p>}
      </div>
    </div>
  );
}

function LineRowHeader({ line, componentProduct, approvedSuppliers, suppliers }: any) {
  let effectiveSupplierId: string | null = null;
  let supplierRef: string | null = null;
  if (line.line_level_approved_supplier_id) {
    const as = approvedSuppliers.find((a: any) => a.id === line.line_level_approved_supplier_id);
    if (as) {
      effectiveSupplierId = as.supplier_id;
      supplierRef = as.supplier_reference;
    }
  }
  const supplier = effectiveSupplierId ? suppliers.find((s: any) => s.id === effectiveSupplierId) : null;

  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">#{line.position}</span>
      <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {componentProduct?.images?.[0]
          ? <img src={componentProduct.images[0]} className="w-full h-full object-contain" alt="" />
          : <Package className="w-3 h-3 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate text-sm">{componentProduct?.name || "Unknown"}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {line.component_role && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-secondary text-secondary-foreground">
              {line.component_role.replace(/_/g, " ")}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">
            {line.base_quantity ?? "—"} {line.uom || componentProduct?.default_uom || ""}
          </span>
        </div>
        {supplier ? (
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate max-w-[140px]">
              {supplier.name}
            </span>
            {supplierRef && (
              <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]" title={`Supplier ref: ${supplierRef}`}>
                {supplierRef}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 mt-1 italic">component default supplier</p>
        )}
      </div>
    </div>
  );
}

function CellContent({ line, variant, colorSupplierLinks, columnAxis, columnId, approvedSuppliers, suppliers }: any) {
  if (!variant) {
    return (
      <div className="text-xs text-muted-foreground/40 italic">
        {line.base_quantity ?? "—"} <span className="text-muted-foreground/30">{line.uom || ""}</span>
      </div>
    );
  }
  if (variant.is_not_applicable) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">NA</span>
        {variant.na_reason && (
          <span className="text-[10px] text-muted-foreground truncate" title={variant.na_reason}>{variant.na_reason}</span>
        )}
      </div>
    );
  }
  const qty = variant.quantity ?? line.base_quantity;
  const isInherited = variant.quantity == null;
  const as = variant.approved_supplier_id ? approvedSuppliers.find((a: any) => a.id === variant.approved_supplier_id) : null;
  const sup = as ? suppliers.find((s: any) => s.id === as.supplier_id) : null;

  let colorwaySupplierRef: string | null = null;
  if (columnAxis === "color" && variant.approved_supplier_id) {
    const link = colorSupplierLinks.find((l: any) =>
      l.product_color_id === columnId && l.approved_supplier_id === variant.approved_supplier_id,
    );
    colorwaySupplierRef = link?.colorway_supplier_reference || null;
  }

  return (
    <div className="space-y-0.5">
      <div className={isInherited ? "text-xs text-muted-foreground italic" : "text-xs font-medium"}>
        {qty ?? "—"} {line.uom || ""}
        {isInherited && <span className="text-[9px] text-muted-foreground/60 ml-0.5">(inherit)</span>}
      </div>
      {variant.unit_cost_override != null && (
        <div className="text-[10px] text-muted-foreground">
          ${variant.unit_cost_override} {variant.currency_override || ""}
        </div>
      )}
      {sup && (
        <div className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate" title={sup.name}>
          {sup.name}
        </div>
      )}
      {colorwaySupplierRef && (
        <div className="text-[9px] font-mono text-muted-foreground truncate" title={`Colorway-specific supplier ref: ${colorwaySupplierRef}`}>
          {colorwaySupplierRef}
        </div>
      )}
    </div>
  );
}

export default function BOMMatrixEditor({
  bom, bomLines, bomVariants, colorways, variations, approvedSuppliers, styleSizes, sizes,
  suppliers, currencies, allProducts, colorSupplierLinks,
  columnAxis, secondaryColumnAxis, filterConfig,
  onVariantsChange, onLineEdit,
}: Props) {
  const [cellEditor, setCellEditor] = useState<any | null>(null);

  const primaryColumns = useMemo(
    () => buildColumnsForAxis(columnAxis, colorways, styleSizes, sizes, variations, approvedSuppliers, suppliers),
    [columnAxis, colorways, styleSizes, sizes, variations, approvedSuppliers, suppliers],
  );
  const secondaryColumns = useMemo(
    () => secondaryColumnAxis
      ? buildColumnsForAxis(secondaryColumnAxis, colorways, styleSizes, sizes, variations, approvedSuppliers, suppliers)
      : [],
    [secondaryColumnAxis, colorways, styleSizes, sizes, variations, approvedSuppliers, suppliers],
  );

  const isGrouped = !!secondaryColumnAxis && secondaryColumns.length > 0;

  const findVariant = (lineId: string, primaryColumnId: string, secondaryColumnId?: string) => {
    const primaryFk = fkFieldForAxis(columnAxis);
    return bomVariants.find((v: any) => {
      if (v.bom_line_id !== lineId) return false;
      if (v[primaryFk] !== primaryColumnId) return false;
      if (isGrouped && secondaryColumnAxis) {
        const secondaryFk = fkFieldForAxis(secondaryColumnAxis);
        if (v[secondaryFk] !== secondaryColumnId) return false;
      }
      return true;
    }) || null;
  };

  const filteredLines = useMemo(() => {
    return bomLines.filter(line => {
      if (filterConfig?.roles?.length && !filterConfig.roles.includes(line.component_role)) return false;
      if (filterConfig?.suppliers?.length) {
        const lineSup = line.line_level_approved_supplier_id;
        const hasSupAtLineLevel = lineSup && filterConfig.suppliers.includes(lineSup);
        const hasSupAtVariantLevel = bomVariants.some((v: any) =>
          v.bom_line_id === line.id && v.approved_supplier_id && filterConfig.suppliers.includes(v.approved_supplier_id),
        );
        if (!hasSupAtLineLevel && !hasSupAtVariantLevel) return false;
      }
      return true;
    });
  }, [bomLines, filterConfig, bomVariants]);

  const shouldShowCell = (variant: any) => {
    if (filterConfig?.na_mode === "only") return variant?.is_not_applicable === true;
    if (filterConfig?.na_mode === "exclude") return !variant?.is_not_applicable;
    return true;
  };

  const editable = isBomEditable(bom);

  if (bomLines.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed">
        <LayoutGrid className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Add BOM lines first, then variants will appear in the matrix.</p>
      </div>
    );
  }

  const totalColumnsCount = isGrouped ? primaryColumns.length * secondaryColumns.length : primaryColumns.length;

  const openCell = (line: any, pCol: ColumnDef, sCol: ColumnDef | undefined, variant: any) => {
    if (!editable) return;
    setCellEditor({
      line,
      columnId: pCol.id,
      columnLabel: pCol.label,
      columnAxis,
      secondaryColumnId: sCol?.id,
      secondaryColumnAxis: sCol ? secondaryColumnAxis : null,
      secondaryColumnLabel: sCol?.label,
      variant,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center text-xs text-muted-foreground">
        <span className="ml-auto">
          {filteredLines.length} {filteredLines.length === 1 ? "line" : "lines"} × {totalColumnsCount} {totalColumnsCount === 1 ? "column" : "columns"}
          {isGrouped && <span className="ml-1 text-[10px]">({primaryColumns.length}×{secondaryColumns.length})</span>}
        </span>
      </div>

      {primaryColumns.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">
            {columnAxis === "color" && "No colorways yet. Add colorways to the parent product first."}
            {columnAxis === "size" && "No active sizes. Configure sizes on the parent product first."}
            {columnAxis === "color_and_more" && "No variations yet. Add variations to the parent product first."}
            {columnAxis === "supplier" && "No approved suppliers yet. Add suppliers to the parent product first."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="border-collapse text-xs" style={{ minWidth: "100%" }}>
            <thead className="sticky top-0 bg-muted/40 z-20">
              {!isGrouped ? (
                <tr>
                  <th className="sticky left-0 z-30 bg-muted/40 text-left p-3 border-r border-b border-border min-w-[260px] max-w-[260px]">
                    <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Line</span>
                  </th>
                  {primaryColumns.map(col => (
                    <th key={col.id} className="p-3 border-b border-r border-border min-w-[140px] max-w-[200px] text-left">
                      <ColumnHeaderContent col={col} />
                    </th>
                  ))}
                </tr>
              ) : (
                <>
                  <tr>
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-30 bg-muted/40 text-left p-3 border-r border-b border-border min-w-[260px] max-w-[260px]"
                    >
                      <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Line</span>
                    </th>
                    {primaryColumns.map(col => (
                      <th
                        key={col.id}
                        colSpan={secondaryColumns.length}
                        className="p-2 border-b-2 border-r-2 border-border bg-muted/60 text-left"
                      >
                        <ColumnHeaderContent col={col} />
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {primaryColumns.flatMap(pCol =>
                      secondaryColumns.map((sCol, idx) => (
                        <th
                          key={`${pCol.id}_${sCol.id}`}
                          className={cn(
                            "p-2 border-b border-r border-border min-w-[120px] max-w-[180px] text-left bg-muted/30",
                            idx === secondaryColumns.length - 1 && "border-r-2",
                          )}
                        >
                          <ColumnHeaderContent col={sCol} small />
                        </th>
                      )),
                    )}
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {filteredLines.map(line => {
                const componentProduct = allProducts.find(p => p.id === line.component_product_id);
                return (
                  <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                    <td
                      className="sticky left-0 z-10 bg-card p-3 border-r border-b border-border min-w-[260px] max-w-[260px] cursor-pointer"
                      onClick={() => onLineEdit(line)}
                    >
                      <LineRowHeader
                        line={line}
                        componentProduct={componentProduct}
                        approvedSuppliers={approvedSuppliers}
                        suppliers={suppliers}
                      />
                    </td>
                    {!isGrouped
                      ? primaryColumns.map(col => {
                          const variant = findVariant(line.id, col.id);
                          const cellVisible = shouldShowCell(variant);
                          return (
                            <td
                              key={col.id}
                              className={cn(
                                "p-2 border-r border-b border-border align-top min-w-[140px] max-w-[200px]",
                                editable && cellVisible ? "cursor-pointer hover:bg-primary/5" : "cursor-default",
                                !cellVisible && "opacity-30",
                              )}
                              onClick={() => cellVisible && openCell(line, col, undefined, variant)}
                            >
                              {cellVisible ? (
                                <CellContent
                                  line={line}
                                  variant={variant}
                                  colorSupplierLinks={colorSupplierLinks}
                                  columnAxis={columnAxis}
                                  columnId={col.id}
                                  approvedSuppliers={approvedSuppliers}
                                  suppliers={suppliers}
                                />
                              ) : (
                                <span className="text-[10px] text-muted-foreground/30 italic">filtered</span>
                              )}
                            </td>
                          );
                        })
                      : primaryColumns.flatMap(pCol =>
                          secondaryColumns.map((sCol, idx) => {
                            const variant = findVariant(line.id, pCol.id, sCol.id);
                            const cellVisible = shouldShowCell(variant);
                            const isLastInGroup = idx === secondaryColumns.length - 1;
                            return (
                              <td
                                key={`${pCol.id}_${sCol.id}`}
                                className={cn(
                                  "p-2 border-r border-b border-border align-top min-w-[120px] max-w-[180px]",
                                  isLastInGroup && "border-r-2",
                                  editable && cellVisible ? "cursor-pointer hover:bg-primary/5" : "cursor-default",
                                  !cellVisible && "opacity-30",
                                )}
                                onClick={() => cellVisible && openCell(line, pCol, sCol, variant)}
                              >
                                {cellVisible ? (
                                  <CellContent
                                    line={line}
                                    variant={variant}
                                    colorSupplierLinks={colorSupplierLinks}
                                    columnAxis={columnAxis}
                                    columnId={pCol.id}
                                    approvedSuppliers={approvedSuppliers}
                                    suppliers={suppliers}
                                  />
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/30 italic">filtered</span>
                                )}
                              </td>
                            );
                          }),
                        )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BOMVariantCellEditor
        open={!!cellEditor}
        onClose={() => setCellEditor(null)}
        cell={cellEditor}
        line={cellEditor?.line}
        bom={bom}
        bomLines={bomLines}
        allProducts={allProducts}
        currencies={currencies}
        sizes={sizes}
        colorways={colorways}
        suppliers={suppliers}
        approvedSuppliers={approvedSuppliers}
        onSaved={(saved) => {
          const primaryFk = fkFieldForAxis(columnAxis);
          const idx = bomVariants.findIndex((v: any) => {
            if (v.bom_line_id !== saved.bom_line_id) return false;
            if (v[primaryFk] !== saved[primaryFk]) return false;
            if (isGrouped && secondaryColumnAxis) {
              const sFk = fkFieldForAxis(secondaryColumnAxis);
              if (v[sFk] !== saved[sFk]) return false;
            }
            return true;
          });
          let next = [...bomVariants];
          if (idx >= 0) next[idx] = saved;
          else next.push(saved);
          onVariantsChange(next);
          setCellEditor(null);
        }}
        onDeleted={(variantId) => {
          onVariantsChange(bomVariants.filter((v: any) => v.id !== variantId));
          setCellEditor(null);
        }}
      />
    </div>
  );
}
