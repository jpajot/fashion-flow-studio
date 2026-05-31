import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutGrid, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import BOMVariantCellEditor from "./BOMVariantCellEditor";

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
  onVariantsChange: (variants: any[]) => void;
  onLineEdit: (line: any) => void;
}

type ColumnDef = {
  id: string;
  label: string;
  subLabel?: string;
  swatch?: string;
};

const fkFieldForAxis = (axis: string) => {
  switch (axis) {
    case "color": return "product_color_id";
    case "size": return "size_id";
    case "color_and_more": return "product_color_and_more_id";
    case "supplier": return "parent_approved_supplier_id";
    default: return "product_color_id";
  }
};

function CellContent({ line, variant, approvedSuppliers, suppliers }: any) {
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
      {variant.approved_supplier_id && (
        <div className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate">
          {sup?.name || "—"}
        </div>
      )}
    </div>
  );
}

export default function BOMMatrixEditor({
  bom, bomLines, bomVariants, colorways, variations, approvedSuppliers, styleSizes, sizes,
  suppliers, currencies, allProducts, onVariantsChange, onLineEdit,
}: Props) {
  const { user } = useAuth();
  const [columnAxis, setColumnAxis] = useState<string>("color");
  const [viewStateId, setViewStateId] = useState<string | null>(null);
  const [cellEditor, setCellEditor] = useState<any | null>(null);

  // Load view state
  useEffect(() => {
    if (!user?.id || !bom?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bom_matrix_view_states")
        .select("*")
        .eq("bom_id", bom.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setColumnAxis(data.column_axis || "color");
        setViewStateId(data.id);
      } else {
        const { data: created } = await supabase
          .from("bom_matrix_view_states")
          .insert({
            bom_id: bom.id,
            user_id: user.id,
            row_axis: "bom_line",
            column_axis: "color",
            last_used_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (!cancelled && created) setViewStateId(created.id);
      }
    })();
    return () => { cancelled = true; };
  }, [bom?.id, user?.id]);

  // Persist axis changes (debounced)
  useEffect(() => {
    if (!user?.id || !bom?.id || !viewStateId) return;
    const t = setTimeout(() => {
      supabase.from("bom_matrix_view_states").upsert({
        bom_id: bom.id,
        user_id: user.id,
        row_axis: "bom_line",
        column_axis: columnAxis,
        last_used_at: new Date().toISOString(),
      }, { onConflict: "bom_id,user_id" });
    }, 400);
    return () => clearTimeout(t);
  }, [columnAxis, viewStateId, bom?.id, user?.id]);

  const columns: ColumnDef[] = useMemo(() => {
    if (columnAxis === "color") {
      return colorways.map(c => ({
        id: c.id,
        label: c.color_name || "—",
        subLabel: c.colorway_code,
        swatch: c.color_hex,
      }));
    }
    if (columnAxis === "size") {
      return styleSizes
        .filter(ss => ss.active !== false)
        .map(ss => {
          const s = sizes.find(x => x.id === ss.size_id);
          return { id: ss.size_id, label: s?.size_code || "—", subLabel: s?.name };
        });
    }
    if (columnAxis === "color_and_more") {
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
    if (columnAxis === "supplier") {
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
  }, [columnAxis, colorways, styleSizes, sizes, variations, approvedSuppliers, suppliers]);

  const findVariant = (lineId: string, columnId: string) => {
    const fk = fkFieldForAxis(columnAxis);
    return bomVariants.find((v: any) => v.bom_line_id === lineId && v[fk] === columnId) || null;
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

  const axisOptions = [
    { id: "color", label: "Color" },
    { id: "size", label: "Size" },
    { id: "color_and_more", label: "Color & More" },
    { id: "supplier", label: "Supplier" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Columns:</span>
        <div className="flex gap-1.5">
          {axisOptions.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => setColumnAxis(o.id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                columnAxis === o.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border text-muted-foreground hover:border-foreground/50"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {bomLines.length} {bomLines.length === 1 ? "line" : "lines"} × {columns.length} {columns.length === 1 ? "column" : "columns"}
        </span>
      </div>

      {columns.length === 0 ? (
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
              <tr>
                <th className="sticky left-0 z-30 bg-muted/40 text-left p-3 border-r border-b border-border min-w-[260px] max-w-[260px]">
                  <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Line</span>
                </th>
                {columns.map(col => (
                  <th key={col.id} className="p-3 border-b border-r border-border min-w-[140px] max-w-[200px] text-left">
                    <div className="flex items-center gap-2">
                      {col.swatch && (
                        <div className="w-4 h-4 rounded shrink-0 border border-border" style={{ backgroundColor: col.swatch }} />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate">{col.label}</p>
                        {col.subLabel && <p className="text-[10px] text-muted-foreground truncate">{col.subLabel}</p>}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bomLines.map(line => {
                const componentProduct = allProducts.find(p => p.id === line.component_product_id);
                return (
                  <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                    <td
                      className="sticky left-0 z-10 bg-card p-3 border-r border-b border-border min-w-[260px] max-w-[260px] cursor-pointer"
                      onClick={() => onLineEdit(line)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">#{line.position}</span>
                        <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {componentProduct?.images?.[0]
                            ? <img src={componentProduct.images[0]} className="w-full h-full object-contain" alt="" />
                            : <Package className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm">{componentProduct?.name || "Unknown"}</p>
                          <div className="flex items-center gap-1.5">
                            {line.component_role && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-secondary text-secondary-foreground">
                                {line.component_role.replace(/_/g, " ")}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {line.base_quantity ?? "—"} {line.uom || componentProduct?.default_uom || ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {columns.map(col => {
                      const variant = findVariant(line.id, col.id);
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "p-2 border-r border-b border-border align-top min-w-[140px] max-w-[200px]",
                            editable ? "cursor-pointer hover:bg-primary/5" : "cursor-default"
                          )}
                          onClick={() => editable && setCellEditor({ line, columnId: col.id, columnLabel: col.label, columnAxis, variant })}
                        >
                          <CellContent
                            line={line}
                            variant={variant}
                            approvedSuppliers={approvedSuppliers}
                            suppliers={suppliers}
                          />
                        </td>
                      );
                    })}
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
          const fk = fkFieldForAxis(columnAxis);
          const idx = bomVariants.findIndex((v: any) => v.bom_line_id === saved.bom_line_id && v[fk] === saved[fk]);
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
