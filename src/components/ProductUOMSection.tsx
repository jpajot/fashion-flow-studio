import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

const NONE = "__none__";

export default function ProductUOMSection({
  product,
  lovTypes,
  lovValues,
  onUpdate,
}: {
  product: any;
  lovTypes: any[];
  lovValues: any[];
  onUpdate: (field: string, value: any) => void;
}) {
  const uomTypeId = useMemo(
    () => lovTypes.find((t) => (t.code || "").toLowerCase() === "uom")?.id,
    [lovTypes],
  );
  const uomOptions = useMemo(() => {
    if (!uomTypeId) return [];
    return lovValues.filter((v) => v.type_of_lov_id === uomTypeId).map((v) => v.name);
  }, [lovValues, uomTypeId]);

  const defaultUom = product?.default_uom || "";
  const purchUom = product?.default_uom_for_purchasing || "";
  const sameUom = purchUom && purchUom === defaultUom;
  const hasPurch = !!purchUom && !sameUom;

  return (
    <div className="space-y-3 bg-card rounded-lg border border-border p-4 mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">Unit of Measure</h3>
        {!defaultUom && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Required for BOM use
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Default UOM (consumption)</Label>
          <Select
            value={defaultUom || NONE}
            onValueChange={(v) => onUpdate("default_uom", v === NONE ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {uomOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Purchasing UOM (optional)</Label>
          <Select
            value={purchUom || NONE}
            onValueChange={(v) => {
              const next = v === NONE ? "" : v;
              onUpdate("default_uom_for_purchasing", next);
              if (!next) onUpdate("uom_conversion_factor", null);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Same as default" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Same as default</SelectItem>
              {uomOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Conversion Factor {hasPurch ? `(${defaultUom} per ${purchUom})` : "(X per Y)"}
          </Label>
          <Input
            type="number"
            value={product?.uom_conversion_factor ?? ""}
            onChange={(e) =>
              onUpdate("uom_conversion_factor", e.target.value === "" ? null : parseFloat(e.target.value))
            }
            disabled={!hasPurch}
            placeholder={hasPurch ? "e.g. 50" : "N/A"}
          />
        </div>
      </div>
      {hasPurch && product?.uom_conversion_factor && (
        <div className="text-xs text-muted-foreground">
          1 {purchUom} = {product.uom_conversion_factor} {defaultUom}
        </div>
      )}
    </div>
  );
}
