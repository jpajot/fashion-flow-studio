import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

export type QFField = { id: string; label: string; getValue: (row: any) => any };
export type QuickFilter = { fieldId: string; values: string[] };

export default function QuickFiltersPanel({
  fields,
  rows,
  activeFilters,
  onApply,
}: {
  fields: QFField[];
  rows: any[];
  activeFilters: QuickFilter[];
  onApply: (filters: QuickFilter[]) => void;
}) {
  const [activeFieldId, setActiveFieldId] = useState<string>(fields[0]?.id || "");
  const [q, setQ] = useState("");
  const field = fields.find((f) => f.id === activeFieldId) || fields[0];

  const values = useMemo(() => {
    if (!field) return [];
    const set = new Set<string>();
    rows.forEach((r) => {
      const v = field.getValue(r);
      if (v == null || v === "") return;
      set.add(String(v));
    });
    const arr = Array.from(set).sort();
    if (!q.trim()) return arr;
    const k = q.toLowerCase();
    return arr.filter((v) => v.toLowerCase().includes(k));
  }, [rows, field, q]);

  const current = activeFilters.find((f) => f.fieldId === activeFieldId);
  const selected = new Set(current?.values || []);

  const toggle = (v: string) => {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    const others = activeFilters.filter((f) => f.fieldId !== activeFieldId);
    if (next.size === 0) {
      onApply(others);
    } else {
      onApply([...others, { fieldId: activeFieldId, values: Array.from(next) }]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {fields.map((f) => {
          const count = activeFilters.find((a) => a.fieldId === f.id)?.values.length || 0;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFieldId(f.id)}
              className={`text-xs px-2 py-1 rounded border ${activeFieldId === f.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {f.label}
              {count > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{count}</Badge>}
            </button>
          );
        })}
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search values…"
        className="h-8"
      />
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {values.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3">No values</div>
        ) : (
          values.map((v) => {
            const on = selected.has(v);
            return (
              <button
                key={v}
                onClick={() => toggle(v)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left ${on ? "bg-primary/10" : "hover:bg-muted"}`}
              >
                <span className={`h-3.5 w-3.5 rounded border grid place-items-center ${on ? "bg-primary border-primary" : ""}`}>
                  {on && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                <span className="truncate flex-1">{v}</span>
              </button>
            );
          })
        )}
      </div>
      {activeFilters.length > 0 && (
        <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => onApply([])}>
          <X className="h-3 w-3 mr-1" /> Clear all
        </Button>
      )}
    </div>
  );
}

export function applyQuickFilters(rows: any[], fields: QFField[], filters: QuickFilter[]) {
  if (!filters.length) return rows;
  return rows.filter((row) =>
    filters.every((f) => {
      const field = fields.find((x) => x.id === f.fieldId);
      if (!field) return true;
      const v = field.getValue(row);
      return f.values.includes(String(v ?? ""));
    }),
  );
}
