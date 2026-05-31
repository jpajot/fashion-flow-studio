import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LayoutGrid, List, Layers, Plus, ChevronDown, Filter, X, Check, Search } from "lucide-react";

const EDITABLE_STATUSES = ["draft", "in_review"];
const isBomEditable = (bom: any) => bom && EDITABLE_STATUSES.includes(bom.status);

const AXIS_OPTIONS = [
  { id: "color", label: "Color" },
  { id: "size", label: "Size" },
  { id: "color_and_more", label: "Color & More" },
  { id: "supplier", label: "Supplier" },
];

const COLORWAY_STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  requested:              { dot: "bg-orange-400", label: "Requested" },
  in_progress:            { dot: "bg-blue-400",   label: "In progress" },
  submitted_for_approval: { dot: "bg-purple-400", label: "Submitted" },
  approved:               { dot: "bg-green-400",  label: "Approved" },
  rejected:               { dot: "bg-red-400",    label: "Rejected" },
  obsolete:               { dot: "bg-slate-400",  label: "Obsolete" },
};

interface Props {
  bom: any;
  bomLines: any[];
  bomVariants: any[];
  approvedSuppliers: any[];
  suppliers: any[];
  colorways: any[];

  columnAxis: string;
  setColumnAxis: (v: string) => void;
  secondaryColumnAxis: string | null;
  setSecondaryColumnAxis: (v: string | null) => void;
  filterConfig: any;
  setFilterConfig: (v: any) => void;

  groupsState: { view: boolean; lines: boolean; bom: boolean; filters: boolean };
  setGroupsState: (v: any) => void;

  onAddLine: () => void;

  onSubmitForReview?: () => void;
  onBackToDraft?: () => void;
  onRelease?: () => void;
  onCreateVersion?: () => void;
  onCreateRevision?: () => void;
  onCreateProductionBOM?: () => void;
  onMarkObsolete?: () => void;
  onRestoreToDraft?: () => void;
}

function Section({ label, icon: Icon, open, onToggle, children, badge }: any) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
          {badge && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

function ColorwayMultiSelect({ colorways, selected, onChange }: {
  colorways: any[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return colorways;
    const q = search.toLowerCase();
    return colorways.filter(c =>
      c.color_name?.toLowerCase().includes(q) ||
      c.colorway_code?.toLowerCase().includes(q) ||
      (COLORWAY_STATUS_CONFIG[c.colorway_status || "approved"]?.label || "").toLowerCase().includes(q)
    );
  }, [colorways, search]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const label = selected.length === 0
    ? "All colorways"
    : selected.length === 1
      ? colorways.find(c => c.id === selected[0])?.color_name || "1 selected"
      : `${selected.length} colorways`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full h-7 px-2 flex items-center justify-between gap-1 rounded border text-xs transition-colors",
          selected.length > 0
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-border bg-background text-muted-foreground hover:bg-muted"
        )}
      >
        <div className="flex items-center gap-1 min-w-0">
          {selected.length > 0 && (
            <div className="flex -space-x-0.5 shrink-0">
              {selected.slice(0, 3).map(id => {
                const c = colorways.find(x => x.id === id);
                return c ? (
                  <div key={id} className="w-3 h-3 rounded-full border border-background"
                    style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                ) : null;
              })}
            </div>
          )}
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="hover:text-destructive transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-[9999] mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
          style={{ maxHeight: 260 }}>
          <div className="p-1.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search colorways…"
                className="w-full h-6 pl-6 pr-2 text-xs bg-background border border-input rounded outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No colorways match</p>
            ) : (
              filtered.map(c => {
                const isSelected = selected.includes(c.id);
                const statusCfg = COLORWAY_STATUS_CONFIG[c.colorway_status || "approved"] || COLORWAY_STATUS_CONFIG.approved;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors",
                      isSelected ? "bg-primary/8" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="w-4 h-4 rounded shrink-0 border border-border"
                      style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate">{c.color_name || "—"}</span>
                      {c.colorway_code && (
                        <span className="ml-1 text-[10px] text-muted-foreground font-mono">{c.colorway_code}</span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
                      <span className="text-[10px] text-muted-foreground">{statusCfg.label}</span>
                    </span>
                    {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="border-t border-border px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{selected.length} selected</span>
              <button type="button" onClick={() => onChange([])}
                className="text-[10px] text-destructive hover:underline">Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BOMOptionsContent({
  bom, bomLines, approvedSuppliers, suppliers, colorways,
  columnAxis, setColumnAxis, secondaryColumnAxis, setSecondaryColumnAxis,
  filterConfig, setFilterConfig, groupsState, setGroupsState, onAddLine,
  onSubmitForReview, onBackToDraft, onRelease, onCreateVersion, onCreateRevision,
  onCreateProductionBOM, onMarkObsolete, onRestoreToDraft,
}: Props) {

  const editable = isBomEditable(bom);
  const rolesAvailable = [...new Set(bomLines.map(l => l.component_role).filter(Boolean))] as string[];

  const showColorwayFilter = (columnAxis === "color" || secondaryColumnAxis === "color") && colorways.length > 0;

  const filtersActive =
    (filterConfig.roles?.length > 0) ||
    (filterConfig.suppliers?.length > 0) ||
    (filterConfig.colorway_ids?.length > 0) ||
    (filterConfig.na_mode && filterConfig.na_mode !== "all");

  return (
    <div className="space-y-3 p-1">

      <Section
        label="View"
        icon={LayoutGrid}
        open={groupsState.view}
        onToggle={() => setGroupsState({ ...groupsState, view: !groupsState.view })}
      >
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Row axis</label>
            <div className="mt-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">BOM line</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Primary column axis</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {AXIS_OPTIONS.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setColumnAxis(o.id);
                    if (secondaryColumnAxis === o.id) setSecondaryColumnAxis(null);
                  }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    columnAxis === o.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-muted-foreground hover:border-foreground/50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Secondary column axis (group by)</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSecondaryColumnAxis(null)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  !secondaryColumnAxis
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background border-border text-muted-foreground hover:border-foreground/50",
                )}
              >
                None
              </button>
              {AXIS_OPTIONS.filter(o => o.id !== columnAxis).map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSecondaryColumnAxis(o.id)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    secondaryColumnAxis === o.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-muted-foreground hover:border-foreground/50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              When set, the matrix shows nested column groups (primary outer, secondary inner).
            </p>
          </div>
        </div>
      </Section>

      <Section
        label="Quick Filters"
        icon={Filter}
        open={groupsState.filters ?? false}
        onToggle={() => setGroupsState({ ...groupsState, filters: !(groupsState.filters ?? false) })}
        badge={filtersActive}
      >
        <div className="space-y-3">

          {showColorwayFilter && (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                Colorway columns
              </label>
              <ColorwayMultiSelect
                colorways={colorways}
                selected={filterConfig.colorway_ids || []}
                onChange={(ids) => setFilterConfig({ ...filterConfig, colorway_ids: ids })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Restrict which parent colorways appear as columns.
              </p>
            </div>
          )}

          {rolesAvailable.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                By role
              </label>
              <div className="flex flex-wrap gap-1">
                {rolesAvailable.map(role => {
                  const active = (filterConfig.roles || []).includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? (filterConfig.roles || []).filter((r: string) => r !== role)
                          : [...(filterConfig.roles || []), role];
                        setFilterConfig({ ...filterConfig, roles: next });
                      }}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                        active
                          ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                          : "bg-background border-border text-muted-foreground hover:border-foreground/40",
                      )}
                    >
                      {role.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {approvedSuppliers.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                By supplier
              </label>
              <div className="flex flex-wrap gap-1">
                {approvedSuppliers.map(as => {
                  const sup = suppliers.find(s => s.id === as.supplier_id);
                  const active = (filterConfig.suppliers || []).includes(as.id);
                  return (
                    <button
                      key={as.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? (filterConfig.suppliers || []).filter((s: string) => s !== as.id)
                          : [...(filterConfig.suppliers || []), as.id];
                        setFilterConfig({ ...filterConfig, suppliers: next });
                      }}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                        active
                          ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                          : "bg-background border-border text-muted-foreground hover:border-foreground/40",
                      )}
                    >
                      {sup?.name || "—"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              N/A cells
            </label>
            <div className="flex gap-1">
              {[
                { id: "all", label: "Show all" },
                { id: "only", label: "N/A only" },
                { id: "exclude", label: "Hide N/A" },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilterConfig({ ...filterConfig, na_mode: opt.id })}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                    filterConfig.na_mode === opt.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={() => setFilterConfig({ roles: [], suppliers: [], colorway_ids: [], na_mode: "all" })}
              className="text-[10px] text-destructive hover:underline w-full text-left pt-1"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Section>

      <Section
        label="Lines"
        icon={List}
        open={groupsState.lines}
        onToggle={() => setGroupsState({ ...groupsState, lines: !groupsState.lines })}
      >
        <div className="space-y-2">
          <button
            type="button"
            disabled={!editable}
            onClick={onAddLine}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-colors",
              editable
                ? "bg-background border-border hover:bg-muted text-foreground"
                : "bg-muted/30 border-border text-muted-foreground cursor-not-allowed",
            )}
          >
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
          <p className="text-[10px] text-muted-foreground px-1">
            Bulk actions — coming soon.
          </p>
        </div>
      </Section>

      <Section
        label="BOM"
        icon={Layers}
        open={groupsState.bom}
        onToggle={() => setGroupsState({ ...groupsState, bom: !groupsState.bom })}
      >
        <div className="space-y-1.5">
          {bom?.status === "draft" && onSubmitForReview && (
            <button type="button" onClick={onSubmitForReview} className="w-full text-left px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors">Submit for Review</button>
          )}
          {bom?.status === "in_review" && onRelease && (
            <button type="button" onClick={onRelease} className="w-full text-left px-3 py-2 rounded-md border border-green-300 bg-green-50 text-green-800 text-xs hover:bg-green-100 transition-colors font-medium">Approve & Release</button>
          )}
          {bom?.status === "in_review" && onBackToDraft && (
            <button type="button" onClick={onBackToDraft} className="w-full text-left px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors">Back to Draft</button>
          )}
          {["draft", "in_review", "released"].includes(bom?.status) && onCreateVersion && (
            <button type="button" onClick={onCreateVersion} className="w-full text-left px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors">Create new version</button>
          )}
          {["draft", "in_review", "released"].includes(bom?.status) && onCreateRevision && (
            <button type="button" onClick={onCreateRevision} className="w-full text-left px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors">Create new revision</button>
          )}
          {bom?.status === "released" && bom?.bom_type === "development" && onCreateProductionBOM && (
            <button type="button" onClick={onCreateProductionBOM} className="w-full text-left px-3 py-2 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs hover:bg-indigo-100 transition-colors">Create Production BOM from this dev BOM</button>
          )}
          {bom?.status === "released" && onMarkObsolete && (
            <button type="button" onClick={onMarkObsolete} className="w-full text-left px-3 py-2 rounded-md border border-destructive/30 text-destructive text-xs hover:bg-destructive/5 transition-colors">Mark Obsolete</button>
          )}
          {bom?.status === "obsolete" && onRestoreToDraft && (
            <button type="button" onClick={onRestoreToDraft} className="w-full text-left px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors">Restore to Draft</button>
          )}
          {!bom?.status && <p className="text-[11px] text-muted-foreground px-1">No BOM loaded.</p>}
        </div>
      </Section>
    </div>
  );
}
