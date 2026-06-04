import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, FlaskConical, Filter, Pencil, Download, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PAGE_WRAPPER } from "@/lib/utils";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import DataTable, { DataTableColumn } from "@/components/shared/DataTable";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import SampleFiltersPanel from "@/components/samples/SampleFiltersPanel";
import WorkflowStatusBadge from "@/components/samples/WorkflowStatusBadge";
import { StatusBadge } from "@/lib/badges";
import {
  Sample,
  SampleFilters,
  DEFAULT_SAMPLE_FILTERS,
} from "@/components/samples/SamplesDataTable";
import {
  CONFORMITY_STYLE_MAP,
  CONFORMITY_LABEL_MAP,
  SAMPLE_TYPE_LABELS,
} from "@/lib/sampleUtils";

interface Product { id: string; name: string; code?: string | null; images?: string[] | null; }
interface ProductColor { id: string; product_id?: string | null; color_name: string; colorway_code?: string | null; color_hex?: string | null; }
interface Project { id: string; name: string; }
interface Supplier { id: string; name: string; code?: string | null; }
interface SampleStep {
  id: string;
  sample_id: string;
  sequence: number;
  supplier_id?: string | null;
  due_date?: string | null;
  workflow_status?: string | null;
}

type Phase = "all" | "development" | "production";

const ALL_FIELDS = [
  { id: "code", label: "Code" },
  { id: "product", label: "Product" },
  { id: "colorway", label: "Colorway" },
  { id: "type", label: "Type" },
  { id: "phase", label: "Phase" },
  { id: "supplier", label: "Supplier" },
  { id: "due_date", label: "Due Date" },
  { id: "conformity", label: "Conformity" },
  { id: "workflow", label: "Status" },
  { id: "project", label: "Project" },
];

const CONFORMITY_PILLS: Array<{ key: string; label: string; cls: string }> = [
  { key: "not_assessed", label: "Not Assessed", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  { key: "pass", label: "Pass", cls: "bg-green-100 text-green-700 border-green-200" },
  { key: "fail_minor", label: "Fail Minor", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "fail_major", label: "Fail Major", cls: "bg-red-100 text-red-700 border-red-200" },
  { key: "pending_review", label: "Pending Review", cls: "bg-blue-100 text-blue-700 border-blue-200" },
];

export default function Samples() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, Product>>({});
  const [colorsMap, setColorsMap] = useState<Record<string, ProductColor>>({});
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({});
  const [supplierMap, setSupplierMap] = useState<Record<string, Supplier>>({});
  const [suppliersArray, setSuppliersArray] = useState<Supplier[]>([]);
  const [stepsMap, setStepsMap] = useState<Record<string, SampleStep[]>>({});

  const [activePhase, setActivePhase] = useState<Phase>("all");
  const [filters, setFilters] = useState<SampleFilters>(DEFAULT_SAMPLE_FILTERS);
  const [showQF, setShowQF] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [activeViewId, setActiveViewId] = useState("default");
  const [pinned, setPinned] = useState<string[]>(["code", "product"]);
  const [statsOpen, setStatsOpen] = useState(true);

  // Sub-nav
  useRegisterSubNav(
    [
      { id: "all", label: "All" },
      { id: "development", label: "Development" },
      { id: "production", label: "Production" },
    ],
    activePhase,
    (id) => setActivePhase(id as Phase),
    "Samples",
  );

  // Load all data
  const load = useCallback(async () => {
    setLoading(true);
    const [samplesRes, productsRes, colorsRes, projectsRes, suppliersRes] = await Promise.all([
      supabase.from("samples").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, code, images"),
      supabase.from("product_colors").select("id, product_id, color_name, colorway_code, color_hex"),
      supabase.from("projects").select("id, name"),
      supabase.from("suppliers").select("id, name, code"),
    ]);
    const samplesData = (samplesRes.data ?? []) as Sample[];
    setSamples(samplesData);

    const pMap: Record<string, Product> = {};
    (productsRes.data ?? []).forEach((p: any) => { pMap[p.id] = p; });
    setProductsMap(pMap);

    const cMap: Record<string, ProductColor> = {};
    (colorsRes.data ?? []).forEach((c: any) => { cMap[c.id] = c; });
    setColorsMap(cMap);

    const prjMap: Record<string, Project> = {};
    (projectsRes.data ?? []).forEach((p: any) => { prjMap[p.id] = p; });
    setProjectsMap(prjMap);

    const sArr = (suppliersRes.data ?? []) as Supplier[];
    setSuppliersArray(sArr);
    const sMap: Record<string, Supplier> = {};
    sArr.forEach((s) => { sMap[s.id] = s; });
    setSupplierMap(sMap);

    // Steps
    const ids = samplesData.map((s) => s.id);
    if (ids.length > 0) {
      const { data: stepsData } = await supabase
        .from("sample_steps")
        .select("*")
        .in("sample_id", ids)
        .order("sequence");
      const sm: Record<string, SampleStep[]> = {};
      ((stepsData ?? []) as SampleStep[]).forEach((st) => {
        if (!sm[st.sample_id]) sm[st.sample_id] = [];
        sm[st.sample_id].push(st);
      });
      setStepsMap(sm);
    } else {
      setStepsMap({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derived helpers
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const phaseFiltered = useMemo(() => {
    if (activePhase === "all") return samples;
    return samples.filter((s) => (s.phase ?? "") === activePhase);
  }, [samples, activePhase]);

  const isInDueWindow = useCallback((steps: SampleStep[], window: SampleFilters["dueWindow"]) => {
    if (window === "all") return true;
    const datePlus = (days: number) => {
      const d = new Date(); d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    return steps.some((st) => {
      if (!st.due_date) return false;
      const dd = st.due_date.slice(0, 10);
      if (window === "overdue") {
        const ws = st.workflow_status ?? "";
        if (ws === "received" || ws === "partially_received") return false;
        return dd < today;
      }
      if (window === "due_today") return dd === today;
      if (window === "due_2d") return dd >= today && dd <= datePlus(2);
      if (window === "due_7d") return dd >= today && dd <= datePlus(7);
      return false;
    });
  }, [today]);

  const filtered = useMemo(() => {
    return phaseFiltered.filter((s) => {
      if (filters.sampleTypes.length && !filters.sampleTypes.includes(s.sample_type ?? "")) return false;
      if (filters.phases.length && !filters.phases.includes(s.phase ?? "")) return false;
      if (filters.conformities.length && !filters.conformities.includes(s.conformity_status ?? "")) return false;
      if (filters.routing === "with" && !s.linked_routing_id) return false;
      if (filters.routing === "without" && s.linked_routing_id) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!s.code.toLowerCase().includes(q) && !(s.notes ?? "").toLowerCase().includes(q)) return false;
      }
      const steps = stepsMap[s.id] ?? [];
      if (filters.suppliers.length) {
        if (!steps.some((st) => st.supplier_id && filters.suppliers.includes(st.supplier_id))) return false;
      }
      if (filters.dueWindow !== "all") {
        if (!isInDueWindow(steps, filters.dueWindow)) return false;
      }
      return true;
    });
  }, [phaseFiltered, filters, stepsMap, isInDueWindow]);

  // Stats
  const stats = useMemo(() => {
    const acc: Record<string, number> = {};
    filtered.forEach((s) => {
      const k = s.conformity_status ?? "not_assessed";
      acc[k] = (acc[k] ?? 0) + 1;
    });
    return acc;
  }, [filtered]);

  // Per-sample derived helpers
  const getFirstStep = (s: Sample): SampleStep | undefined => (stepsMap[s.id] ?? [])[0];
  const getEarliestPendingDue = (s: Sample): string | null => {
    const steps = stepsMap[s.id] ?? [];
    const pending = steps.filter((st) => st.due_date && !["received", "partially_received"].includes(st.workflow_status ?? ""));
    if (pending.length === 0) return null;
    return pending.map((st) => st.due_date!).sort()[0];
  };
  const getLatestActiveStatus = (s: Sample): string | null => {
    const steps = stepsMap[s.id] ?? [];
    if (steps.length === 0) return null;
    const last = steps[steps.length - 1];
    return last.workflow_status ?? null;
  };

  // Columns
  const tableColumns: DataTableColumn<Sample>[] = useMemo(() => ([
    {
      id: "code", label: "Code", width: 110,
      render: (r) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-primary">{r.code}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(r.code);
              toast.success("Copied");
            }}
            className="opacity-50 hover:opacity-100"
            title="Copy code"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ),
    },
    {
      id: "product", label: "Product", width: 200,
      render: (r) => {
        const p = r.product_id ? productsMap[r.product_id] : null;
        if (!p) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{p.name}</div>
            {p.code && <div className="text-[10px] text-muted-foreground font-mono">{p.code}</div>}
          </div>
        );
      },
    },
    {
      id: "colorway", label: "Colorway", width: 150,
      render: (r) => {
        const c = r.product_color_id ? colorsMap[r.product_color_id] : null;
        if (!c) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            {c.color_hex && <span className="w-2.5 h-2.5 rounded-full border border-border shrink-0" style={{ backgroundColor: c.color_hex }} />}
            <span className="text-xs truncate">{c.color_name}</span>
          </div>
        );
      },
    },
    { id: "type", label: "Type", width: 100, render: (r) => <StatusBadge value={r.sample_type ?? undefined} /> },
    { id: "phase", label: "Phase", width: 110, render: (r) => <StatusBadge value={r.phase ?? undefined} /> },
    {
      id: "supplier", label: "Supplier", width: 160,
      render: (r) => {
        const fs = getFirstStep(r);
        const sup = fs?.supplier_id ? supplierMap[fs.supplier_id] : null;
        return <span className="text-xs">{sup?.name ?? "—"}</span>;
      },
    },
    {
      id: "due_date", label: "Due Date", width: 120,
      render: (r) => {
        const d = getEarliestPendingDue(r);
        if (!d) return <span className="text-muted-foreground">—</span>;
        const overdue = d.slice(0, 10) < today;
        return <span className={`text-xs ${overdue ? "text-red-600 font-medium" : ""}`}>{new Date(d).toLocaleDateString()}</span>;
      },
    },
    {
      id: "conformity", label: "Conformity", width: 140,
      render: (r) => {
        const conf = r.conformity_status ?? "not_assessed";
        return (
          <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border ${CONFORMITY_STYLE_MAP[conf] ?? ""}`}>
            {CONFORMITY_LABEL_MAP[conf] ?? conf}
          </span>
        );
      },
    },
    {
      id: "workflow", label: "Status", width: 130,
      render: (r) => <WorkflowStatusBadge status={getLatestActiveStatus(r)} />,
    },
    {
      id: "project", label: "Project", width: 160,
      render: (r) => {
        const p = r.project_id ? projectsMap[r.project_id] : null;
        return <span className="text-xs truncate">{p?.name ?? "—"}</span>;
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [productsMap, colorsMap, supplierMap, projectsMap, stepsMap, today]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = ["Code", "Product", "Product Code", "Colorway", "Type", "Phase", "Supplier", "Due Date", "Conformity", "Status", "Project"];
    const rows = filtered.map((r) => {
      const p = r.product_id ? productsMap[r.product_id] : null;
      const c = r.product_color_id ? colorsMap[r.product_color_id] : null;
      const fs = getFirstStep(r);
      const sup = fs?.supplier_id ? supplierMap[fs.supplier_id] : null;
      const due = getEarliestPendingDue(r);
      const prj = r.project_id ? projectsMap[r.project_id] : null;
      return [
        r.code,
        p?.name ?? "",
        p?.code ?? "",
        c?.color_name ?? "",
        r.sample_type ? SAMPLE_TYPE_LABELS[r.sample_type] ?? r.sample_type : "",
        r.phase ?? "",
        sup?.name ?? "",
        due ? new Date(due).toLocaleDateString() : "",
        CONFORMITY_LABEL_MAP[r.conformity_status ?? "not_assessed"] ?? "",
        getLatestActiveStatus(r) ?? "",
        prj?.name ?? "",
      ];
    });
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map((v) => esc(String(v))).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `samples_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, productsMap, colorsMap, supplierMap, projectsMap, stepsMap]);

  // Options menu
  const handleSelectView = useCallback((id: string) => setActiveViewId(id), []);

  useEffect(() => {
    const items: any[] = [
      { label: "Quick Filters", icon: Filter, onClick: () => { setShowQF((v) => !v); setShowViewMenu(false); }, keepOpen: true },
      { label: "Manage Views", icon: Pencil, onClick: () => { setShowViewMenu((v) => !v); setShowQF(false); }, keepOpen: true },
      { divider: true },
      { label: "Export CSV", icon: Download, onClick: exportCSV },
    ];
    const customContent = showQF ? (
      <SampleFiltersPanel filters={filters} onFiltersChange={setFilters} suppliersArray={suppliersArray} />
    ) : showViewMenu ? (
      <ViewDrawerContent
        pageKey="global_samples"
        activeViewId={activeViewId}
        onSelectView={handleSelectView}
        allFields={tableColumns.map((c) => ({ id: c.id, label: c.label }))}
        currentViewType={null}
      />
    ) : null;
    setOptions({ items, customContent });
    return () => setOptions(null);
  }, [setOptions, showQF, showViewMenu, filters, suppliersArray, activeViewId, handleSelectView, exportCSV, tableColumns]);

  if (loading) {
    return (
      <div className={PAGE_WRAPPER}>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const total = filtered.length;

  return (
    <div className={PAGE_WRAPPER + " space-y-4"}>
      {/* Stats bar */}
      <div className="border border-border rounded-lg bg-card">
        <button
          type="button"
          onClick={() => setStatsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40"
        >
          <span>Total: {total} sample{total !== 1 ? "s" : ""}</span>
          {statsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {statsOpen && (
          <div className="px-3 py-2 border-t border-border flex flex-wrap gap-2">
            {CONFORMITY_PILLS.map((p) => {
              const count = stats[p.key] ?? 0;
              const active = filters.conformities.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFilters({
                    ...filters,
                    conformities: active
                      ? filters.conformities.filter((x) => x !== p.key)
                      : [...filters.conformities, p.key],
                  })}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${p.cls} ${active ? "ring-2 ring-primary/40" : ""}`}
                >
                  <span>{p.label}</span>
                  <span className="font-semibold">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <FlaskConical className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No samples yet</p>
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          fixedColumns={pinned}
          onPinColumn={(id) =>
            setPinned((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
          }
          onRowClick={(r) => navigate(`/samples/${r.id}`)}
          {...({ activeViewId } as any)}
        />
      )}
    </div>
  );
}
