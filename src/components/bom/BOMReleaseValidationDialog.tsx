import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, XCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";

function checkVariantCompleteness(
  bomLines: any[],
  bomLineVariants: any[],
  colorVariants: any[],
  styleSizes: any[],
  colorAndMores: any[],
  isProduction: boolean,
) {
  const errors: any[] = [];
  for (const line of bomLines) {
    const lineVariants = bomLineVariants.filter((v) => v.bom_line_id === line.id);
    if (line.varies_by_color) {
      for (const cw of colorVariants) {
        const hasVariant = lineVariants.some((v) => v.product_color_id === cw.id);
        if (!hasVariant) errors.push({ type: "error", title: "Missing colorway resolution", body: `Line "${line.component_role || "component"}" has no variant for colorway "${cw.color_name}".`, lineId: line.id });
      }
    }
    if (line.varies_by_size) {
      for (const ss of styleSizes) {
        const hasVariant = lineVariants.some((v) => v.size_id === ss.size_id);
        if (!hasVariant) errors.push({ type: "error", title: "Missing size variant", body: `Line "${line.component_role || "component"}" has no variant for size "${ss.size_id}".`, lineId: line.id });
      }
    }
    if (line.varies_by_color_and_more) {
      for (const cam of colorAndMores) {
        const hasVariant = lineVariants.some((v) => v.product_color_and_more_id === cam.id);
        if (!hasVariant) errors.push({ type: "error", title: "Missing Color & More variant", body: `Line "${line.component_role || "component"}" has no variant for Color & More "${cam.id}".`, lineId: line.id });
      }
    }
    if (isProduction) {
      for (const v of lineVariants) {
        if (!v.approved_supplier_id && !v.is_not_applicable) errors.push({ type: "error", title: "Unresolved supplier", body: `Line "${line.component_role || "component"}" has a variant with no supplier assigned.`, lineId: line.id });
      }
    }
  }
  return errors;
}

export default function BOMReleaseValidationDialog({ open, onClose, onConfirm, bom, bomLines, bomLineVariants, colorVariants, styleSizes, colorAndMores, onOpenChangeRouting }: any) {
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [releasing, setReleasing] = useState(false);
  const isProduction = bom?.bom_type === "production";
  const expectedRoutingType = isProduction ? "production" : "development";

  useEffect(() => { if (open && bom) runValidation(); /* eslint-disable-next-line */ }, [open, bom?.id, bom?.selected_routing_id]);

  const runValidation = async () => {
    setValidating(true); setErrors([]); setWarnings([]);
    const allErrors: any[] = [];
    const allWarnings: any[] = [];
    allErrors.push(...checkVariantCompleteness(bomLines, bomLineVariants, colorVariants, styleSizes, colorAndMores, isProduction));
    if (!bom.selected_routing_id) {
      allErrors.push({ type: "error", kind: "no_routing", title: "No routing linked", body: "This BOM must be linked to a SupplierRouting before release.", action: { label: "Link a routing", handler: "open_change_routing" } });
    } else {
      const rs = (await supabase.from("supplier_routings").select("*").eq("id", bom.selected_routing_id)).data ?? [];
      const resolvedRouting = rs[0] || null;
      if (!resolvedRouting) {
        allErrors.push({ type: "error", kind: "no_routing", title: "Routing not found", body: "The linked routing could not be found.", action: { label: "Link a routing", handler: "open_change_routing" } });
      } else {
        if (resolvedRouting.routing_type !== expectedRoutingType) {
          allErrors.push({ type: "error", kind: "type_mismatch", title: "Routing type mismatch", body: `This ${isProduction ? "Production" : "Development"} BOM is linked to a "${resolvedRouting.routing_type}" routing. Link a "${expectedRoutingType}" routing before release.`, action: { label: "Change routing", handler: "open_change_routing" } });
        }
        if (isProduction && resolvedRouting.routing_type === expectedRoutingType && resolvedRouting.status !== "released") {
          allWarnings.push({ type: "warning", kind: "routing_not_released", title: "Production routing is not released", body: `The linked routing "${resolvedRouting.name}" is in status "${resolvedRouting.status}". The BOM can still be released, but the routing should normally be released first.` });
        }
      }
    }
    setErrors(allErrors); setWarnings(allWarnings); setValidating(false);
  };

  const handleActionClick = (action: any) => {
    if (action.handler === "open_change_routing") { onClose(); setTimeout(() => onOpenChangeRouting?.(), 50); }
  };

  const handleRelease = async () => { setReleasing(true); await onConfirm(); setReleasing(false); };

  const hasErrors = errors.length > 0;
  const allClear = !validating && errors.length === 0 && warnings.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">Release BOM <span className="text-muted-foreground font-normal text-xs">— Rev {bom?.revision_code} · v{bom?.version}</span></DialogTitle>
        </DialogHeader>
        {validating ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Running release checks…</div>
        ) : (
          <div className="space-y-3">
            {allClear && (<div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-green-900">All checks passed</p><p className="text-xs text-green-800 mt-0.5">This BOM is ready to be released.</p></div></div>)}
            {errors.length > 0 && (<div className="space-y-2"><p className="text-xs font-semibold text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{errors.length} error{errors.length !== 1 ? "s" : ""} — must fix before release</p>{errors.map((err, i) => (<div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 space-y-1"><p className="text-xs font-semibold text-destructive">{err.title}</p><p className="text-xs text-destructive/80">{err.body}</p>{err.action && (<button type="button" onClick={() => handleActionClick(err.action)} className="text-xs text-primary hover:underline font-medium mt-0.5">{err.action.label} →</button>)}</div>))}</div>)}
            {warnings.length > 0 && (<div className="space-y-2"><p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{warnings.length} warning{warnings.length !== 1 ? "s" : ""} — release still allowed</p>{warnings.map((w, i) => (<div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1"><p className="text-xs font-semibold text-amber-800">{w.title}</p><p className="text-xs text-amber-700">{w.body}</p></div>))}</div>)}
            {!hasErrors && warnings.length > 0 && (<div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5"><Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" /><p className="text-xs text-blue-800">Warnings present but no blocking errors. You can proceed.</p></div>)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={releasing}>Cancel</Button>
          <Button size="sm" onClick={handleRelease} disabled={validating || hasErrors || releasing}>
            {releasing && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            {hasErrors ? "Cannot Release" : "Approve & Release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
