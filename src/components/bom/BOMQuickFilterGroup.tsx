import { X } from "lucide-react";

interface Props {
  filterConfig: any;
  setFilterConfig: (v: any) => void;
  bomLines: any[];
  approvedSuppliers: any[];
  suppliers: any[];
}

export default function BOMQuickFilterGroup({
  filterConfig, setFilterConfig, approvedSuppliers, suppliers,
}: Props) {
  const pills: { key: string; label: string; onRemove: () => void }[] = [];

  (filterConfig.roles || []).forEach((role: string) => {
    pills.push({
      key: `role:${role}`,
      label: `Role: ${role.replace(/_/g, " ")}`,
      onRemove: () => setFilterConfig({ ...filterConfig, roles: filterConfig.roles.filter((r: string) => r !== role) }),
    });
  });

  (filterConfig.suppliers || []).forEach((sid: string) => {
    const as = approvedSuppliers.find((a: any) => a.id === sid);
    const sup = as ? suppliers.find((s: any) => s.id === as.supplier_id) : null;
    pills.push({
      key: `supplier:${sid}`,
      label: `Supplier: ${sup?.name || "—"}`,
      onRemove: () => setFilterConfig({ ...filterConfig, suppliers: filterConfig.suppliers.filter((s: string) => s !== sid) }),
    });
  });

  if (filterConfig.na_mode === "only") {
    pills.push({ key: "na:only", label: "NA only", onRemove: () => setFilterConfig({ ...filterConfig, na_mode: "all" }) });
  }
  if (filterConfig.na_mode === "exclude") {
    pills.push({ key: "na:exclude", label: "Hide NA", onRemove: () => setFilterConfig({ ...filterConfig, na_mode: "all" }) });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Filters:</span>
      {pills.map(p => (
        <button
          key={p.key}
          type="button"
          onClick={p.onRemove}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
        >
          {p.label}
          <X className="w-3 h-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => setFilterConfig({ roles: [], suppliers: [], na_mode: "all" })}
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
      >
        Clear all
      </button>
    </div>
  );
}
