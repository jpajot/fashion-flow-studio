import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Ban } from "lucide-react";
import ComponentColorwayPicker from "./ComponentColorwayPicker";
import ComponentSizePicker from "./ComponentSizePicker";

interface Props {
  variant?: any;
  line: any;
  col: any;
  columnAxis: string;
  uom?: string;
  isReadOnly?: boolean;
  allProductColors: any[];
  techColors: any[];
  commColors: any[];
  bomType?: string;
  allSizes?: any[];
  onUpsertVariant: (payload: any) => void;
  onDeleteVariant?: (id: string) => void;
  showRevisionSnapshots?: boolean;
  snapshotData?: { snapshotted: any; current: any };
}

export default function BOMVariantCellEditor({
  variant, line, col, columnAxis, isReadOnly,
  allProductColors, techColors, commColors, bomType,
  allSizes, onUpsertVariant, onDeleteVariant,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Revision snapshots stubbed out for Phase 3-bis
  const revisionIndicator = null;

  const isNA = variant?.is_not_applicable === true;

  const buildPayload = (overrides: any = {}) => {
    const base: any = { bom_line_id: line.id };
    if (columnAxis === "color" && line.varies_by_color) {
      base.product_color_id = col.id;
      base.size_id = null;
      base.product_color_and_more_id = null;
    } else if (columnAxis === "size" && line.varies_by_size) {
      base.size_id = col.size_id || col.id;
      base.product_color_id = null;
      base.product_color_and_more_id = null;
    } else if (columnAxis === "color_and_more" && line.varies_by_color_and_more) {
      base.product_color_and_more_id = col.id;
      base.product_color_id = null;
      base.size_id = null;
    } else {
      console.warn("BOMVariantCellEditor: axis/line flag mismatch, skipping write", { columnAxis, line });
      return null;
    }
    return { ...base, ...overrides };
  };

  const safeUpsert = (overrides: any = {}) => {
    const payload = buildPayload(overrides);
    if (payload) onUpsertVariant(payload);
  };

  const handleMarkNA = () => safeUpsert({ is_not_applicable: true, quantity: null });

  const handleQtyBlur = () => {
    const val = parseFloat(qty);
    if (!isNaN(val)) safeUpsert({ quantity: val, is_not_applicable: false });
    setEditing(false);
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") setEditing(false);
  };

  // N/A cell
  if (isNA) {
    const naStyle = {
      background: "repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 2px, #e5e7eb 2px, #e5e7eb 4px)",
    };
    return (
      <div className="relative w-full min-h-[36px] rounded border border-border flex items-center justify-center group"
        style={naStyle} title={variant?.na_reason || "Not Applicable"}>
        <span className="text-[10px] text-muted-foreground font-medium select-none">N/A</span>
        {!isReadOnly && (
          <button type="button"
            onClick={() => {
              if (variant?.id && onDeleteVariant) onDeleteVariant(variant.id);
              else {
                const payload = buildPayload({ is_not_applicable: false, component_product_color_id: null });
                if (payload) onUpsertVariant(payload);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center bg-background/70 rounded text-[10px] text-foreground transition-opacity">
            Clear N/A
          </button>
        )}
      </div>
    );
  }

  // COLOR axis: colorway resolution cell
  if (columnAxis === "color") {
    const compColorId = variant?.component_product_color_id;
    const compColor = compColorId ? allProductColors.find((pc) => pc.id === compColorId) : null;
    const componentProductId = line.component_product_id;

    const resolveTcxCodes = () => {
      if (!compColor) return null;
      const codes: string[] = [];
      if (compColor.linked_color_type === "commercial" && compColor.linked_color_id) {
        const cc = commColors.find((c) => c.id === compColor.linked_color_id);
        if (cc) {
          if (cc.sub_type === "Combined" && Array.isArray(cc.linked_technical_color_ids)) {
            cc.linked_technical_color_ids.forEach((tcId: string) => {
              const tc = techColors.find((t) => t.id === tcId);
              if (tc) codes.push(tc.code);
            });
          } else if (cc.main_technical_color_id) {
            const tc = techColors.find((t) => t.id === cc.main_technical_color_id);
            if (tc) codes.push(tc.code);
          }
        }
      } else if (compColor.linked_tech_color_id) {
        const tc = techColors.find((t) => t.id === compColor.linked_tech_color_id);
        if (tc) codes.push(tc.code);
      }
      return codes.length > 0 ? codes.join(", ") : "—";
    };

    const tcxText = compColor ? resolveTcxCodes() : null;

    const STATUS_BADGE: Record<string, { dot: string; text: string; label: string }> = {
      requested:               { dot: "bg-orange-400", text: "text-orange-700", label: "Requested" },
      in_progress:             { dot: "bg-blue-400",   text: "text-blue-700",   label: "In progress" },
      submitted_for_approval:  { dot: "bg-purple-400", text: "text-purple-700", label: "Submitted" },
      approved:                { dot: "bg-green-400",  text: "text-green-700",  label: "Approved" },
      rejected:                { dot: "bg-red-400",    text: "text-red-700",    label: "Rejected" },
      obsolete:                { dot: "bg-gray-400",   text: "text-gray-500",   label: "Obsolete" },
    };
    const statusCfg = compColor?.colorway_status ? STATUS_BADGE[compColor.colorway_status] : null;

    const openPicker = () => {
      if (!showPicker && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPickerPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX + rect.width / 2 });
      }
      setShowPicker((v) => !v);
    };

    const picker = showPicker && createPortal(
      <div className="fixed z-[9999]" style={{ top: pickerPos.top, left: pickerPos.left, transform: "translateX(-50%)" }}>
        <ComponentColorwayPicker
          componentProductId={componentProductId}
          bomType={bomType}
          currentColorId={compColorId}
          techColors={techColors}
          commColors={commColors}
          onSelect={(selectedColorId) => { safeUpsert({ component_product_color_id: selectedColorId, is_not_applicable: false }); setShowPicker(false); }}
          onClear={() => { safeUpsert({ component_product_color_id: null }); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      </div>,
      document.body
    );

    if (!compColor && !isReadOnly) {
      return (
        <div className="relative flex flex-col items-center gap-1 py-1">
          <button ref={triggerRef} type="button" onClick={openPicker}
            className="w-full min-h-[44px] rounded border-2 border-dashed border-amber-300 bg-amber-50/50 flex flex-col items-center justify-center gap-0.5 px-1 hover:border-primary/60 hover:bg-primary/5 transition-colors"
            title="Pick component colorway">
            <span className="text-[9px] text-amber-600 font-medium leading-tight">Pick colorway</span>
          </button>
          <button type="button" onClick={handleMarkNA}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-destructive transition-colors"
            title="Mark as N/A">
            <Ban className="w-3 h-3" /><span>N/A</span>
          </button>
          {picker}
          {revisionIndicator}
        </div>
      );
    }

    if (!compColor && isReadOnly) {
      return (
        <div className="w-full min-h-[44px] rounded border-2 border-dashed border-amber-300 bg-amber-50/50 flex items-center justify-center">
          <span className="text-[9px] text-amber-600">—</span>
        </div>
      );
    }

    const cellContent = (
      <div className="flex flex-col gap-0.5 py-1 px-1 w-full relative">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded shrink-0 border border-border"
            style={{ backgroundColor: compColor.color_hex || "#e5e7eb" }}
            title={compColor.color_name} />
          <span className="text-[10px] font-medium text-foreground leading-tight truncate">
            {[compColor.colorway_code, compColor.color_name].filter(Boolean).join(" ")}
          </span>
        </div>
        {tcxText && (
          <span className="text-[9px] text-muted-foreground leading-tight truncate" title={tcxText}>{tcxText}</span>
        )}
        {statusCfg && (
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
            <span className={`text-[9px] ${statusCfg.text} leading-tight`}>{statusCfg.label}</span>
          </div>
        )}
      </div>
    );

    return (
      <div className="relative w-full">
        {!isReadOnly ? (
          <button ref={triggerRef} type="button" onClick={openPicker}
            className="w-full rounded border border-border hover:border-primary/60 hover:bg-primary/5 transition-colors text-left"
            title="Click to change component colorway">
            {cellContent}
          </button>
        ) : (
          <div className="w-full rounded border border-border">{cellContent}</div>
        )}
        {!isReadOnly && (
          <button type="button" onClick={handleMarkNA}
            className="absolute top-0.5 right-0.5 opacity-0 hover:opacity-100 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
            title="Mark as N/A">
            <Ban className="w-3 h-3" />
          </button>
        )}
        {picker}
        {revisionIndicator}
      </div>
    );
  }

  // SIZE axis: component_size_mapping mode
  if (columnAxis === "size" && line.size_variation_mode === "component_size_mapping") {
    const baseSizeId = line.base_component_size_id;
    const overrideSizeId = variant?.component_size_id;
    const resolvedSizeId = overrideSizeId || baseSizeId;
    const isOverride = !!overrideSizeId && overrideSizeId !== baseSizeId;

    const getSizeName = (sizeId?: string | null) => {
      if (!sizeId) return "—";
      const s = (allSizes || []).find((sz) => sz.id === sizeId);
      return s ? (s.name || s.size_code || sizeId) : sizeId;
    };

    const handleSizeSelect = (pickedSizeId: string) => {
      setShowPicker(false);
      if (pickedSizeId === baseSizeId && !variant?.quantity && !variant?.notes && !variant?.is_not_applicable) {
        if (variant?.id && onDeleteVariant) { onDeleteVariant(variant.id); return; }
      }
      safeUpsert({ component_size_id: pickedSizeId, is_not_applicable: false });
    };

    const handleResetToBase = () => {
      setShowPicker(false);
      if (variant?.id) {
        const hasOtherData = variant.quantity != null || variant.notes || variant.is_not_applicable;
        if (!hasOtherData && onDeleteVariant) { onDeleteVariant(variant.id); return; }
        safeUpsert({ component_size_id: null });
      }
    };

    const cellContent = (
      <div className={`flex items-center justify-center min-h-[36px] px-1 ${isOverride ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
        <span className="text-xs">
          {isOverride && <span className="text-amber-500 mr-0.5">Δ</span>}
          {getSizeName(resolvedSizeId)}
        </span>
      </div>
    );

    if (isReadOnly) {
      return <div className="w-full rounded border border-border">{cellContent}</div>;
    }

    const openPicker = () => {
      if (!showPicker && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPickerPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX + rect.width / 2 });
      }
      setShowPicker((v) => !v);
    };

    return (
      <div className="relative w-full group">
        <button ref={triggerRef} type="button" onClick={openPicker}
          className={`w-full rounded border transition-colors hover:border-primary/60 hover:bg-primary/5 ${
            isOverride ? "border-amber-300 bg-amber-50/30" : "border-border"
          }`}>
          {cellContent}
        </button>
        <button type="button" onClick={handleMarkNA}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
          title="Mark as N/A">
          <Ban className="w-3 h-3" />
        </button>
        {showPicker && createPortal(
          <div className="fixed z-[9999]" style={{ top: pickerPos.top, left: pickerPos.left, transform: "translateX(-50%)" }}>
            <ComponentSizePicker
              componentProductId={line.component_product_id}
              currentSizeId={resolvedSizeId}
              baseSizeId={baseSizeId}
              allSizes={allSizes || []}
              onSelect={handleSizeSelect}
              onClear={handleResetToBase}
              onClose={() => setShowPicker(false)}
            />
          </div>,
          document.body
        )}
      </div>
    );
  }

  // Default: quantity cell
  const cellQty = variant?.quantity;
  const baseQty = line.base_quantity;
  const isGraded = cellQty != null && cellQty !== baseQty;

  if (isReadOnly) {
    return (
      <div className="flex items-center justify-center min-h-[36px]">
        <span className={`text-xs ${isGraded ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
          {cellQty != null ? (isGraded ? `Δ ${cellQty}` : cellQty) : (baseQty ?? "—")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      {editing ? (
        <Input type="number" autoFocus
          className={`h-6 w-16 text-xs text-center ${isGraded ? "border-amber-400" : ""}`}
          defaultValue={cellQty ?? baseQty ?? ""}
          onChange={(e) => setQty(e.target.value)}
          onBlur={handleQtyBlur}
          onKeyDown={handleQtyKeyDown} />
      ) : (
        <button type="button"
          onClick={() => { setQty(String(cellQty ?? baseQty ?? "")); setEditing(true); }}
          className={`w-16 h-6 rounded border text-xs text-center transition-colors hover:border-primary hover:bg-primary/5 ${
            isGraded ? "border-amber-300 bg-amber-50 text-amber-700 font-semibold" : "border-border bg-transparent text-muted-foreground"
          }`}>
          {cellQty != null ? (isGraded ? `Δ ${cellQty}` : cellQty) : (baseQty != null ? baseQty : "—")}
        </button>
      )}
      <button type="button" onClick={handleMarkNA}
        className="text-[9px] text-muted-foreground/50 hover:text-destructive transition-colors"
        title="Mark as N/A">
        <Ban className="w-3 h-3" />
      </button>
    </div>
  );
}
