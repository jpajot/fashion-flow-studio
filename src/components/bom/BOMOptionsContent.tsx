import { cn } from "@/lib/utils";
import { LayoutGrid, List, Layers, Plus, ChevronDown } from "lucide-react";

const EDITABLE_STATUSES = ["draft", "in_review"];
const isBomEditable = (bom: any) => bom && EDITABLE_STATUSES.includes(bom.status);

const AXIS_OPTIONS = [
  { id: "color", label: "Color" },
  { id: "size", label: "Size" },
  { id: "color_and_more", label: "Color & More" },
  { id: "supplier", label: "Supplier" },
];

interface Props {
  bom: any;
  bomLines: any[];
  bomVariants: any[];
  approvedSuppliers: any[];
  suppliers: any[];

  columnAxis: string;
  setColumnAxis: (v: string) => void;
  secondaryColumnAxis: string | null;
  setSecondaryColumnAxis: (v: string | null) => void;
  filterConfig: any;
  setFilterConfig: (v: any) => void;

  groupsState: { view: boolean; lines: boolean; bom: boolean };
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


function Section({ label, icon: Icon, open, onToggle, children }: any) {
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
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

export default function BOMOptionsContent({
  bom, bomLines, approvedSuppliers, suppliers,
  columnAxis, setColumnAxis, secondaryColumnAxis, setSecondaryColumnAxis,
  filterConfig, setFilterConfig, groupsState, setGroupsState, onAddLine,
  onSubmitForReview, onBackToDraft, onRelease, onCreateVersion, onCreateRevision,
  onCreateProductionBOM, onMarkObsolete, onRestoreToDraft,
}: Props) {

  const editable = isBomEditable(bom);
  const rolesAvailable = [...new Set(bomLines.map(l => l.component_role).filter(Boolean))] as string[];

  return (
    <div className="space-y-3 p-1">
      {/* VIEW */}
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
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Quick filters</label>
            <div className="mt-2 space-y-2">
              {rolesAvailable.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium mb-1">By role</p>
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
                  <p className="text-[11px] font-medium mb-1">By supplier</p>
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
                <p className="text-[11px] font-medium mb-1">NA cells</p>
                <div className="flex gap-1">
                  {[
                    { id: "all", label: "Show all" },
                    { id: "only", label: "NA only" },
                    { id: "exclude", label: "Hide NA" },
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
            </div>
          </div>
        </div>
      </Section>

      {/* LINES */}
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
            Bulk actions (set role, set supplier, set NA) and auto-resolve sourcing — coming soon.
          </p>
        </div>
      </Section>

      {/* BOM */}
      <Section
        label="BOM"
        icon={Layers}
        open={groupsState.bom}
        onToggle={() => setGroupsState({ ...groupsState, bom: !groupsState.bom })}
      >
        <p className="text-[11px] text-muted-foreground px-1">
          Lifecycle actions (release, new revision, new version, mark obsolete, derive production) — coming in Phase 5.
        </p>
      </Section>
    </div>
  );
}
