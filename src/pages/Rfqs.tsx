import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PAGE_WRAPPER } from "@/lib/utils";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, X, FileSearch, Pencil } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import ViewDrawerContent from "@/components/ViewDrawerContent";

const STATUS_COLORS: Record<string, string> = {
  draft:         "bg-gray-100 text-gray-600 border-gray-200",
  submitted:     "bg-blue-100 text-blue-700 border-blue-200",
  in_collection: "bg-amber-100 text-amber-700 border-amber-200",
  closed:        "bg-green-100 text-green-700 border-green-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
};
const STATUS_OPTIONS = ["draft", "submitted", "in_collection", "closed", "archived"];

export default function Rfqs() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [requests, setRequests] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRound, setFilterRound] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [pinnedCols, setPinnedCols] = useState<string[]>(["code", "name"]);

  const load = useCallback(async () => {
    setLoading(true);
    const [srRes, rndRes, curRes, projRes] = await Promise.all([
      supabase.from("supplier_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("rfq_rounds").select("id,code,label,sequence").order("sequence"),
      supabase.from("currencies").select("id,code").eq("is_active", true).order("code"),
      supabase.from("projects").select("id,name").order("name"),
    ]);
    setRequests(srRes.data ?? []);
    setRounds(rndRes.data ?? []);
    setCurrencies(curRes.data ?? []);
    setProjects(projRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setOptions(null); return () => setOptions(null); }, [setOptions]);

  const roundMap = useMemo(() => Object.fromEntries(rounds.map(r => [r.id, r])), [rounds]);
  const currencyMap = useMemo(() => Object.fromEntries(currencies.map(c => [c.id, c])), [currencies]);
  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  const filtered = useMemo(() => requests.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterRound !== "all" && r.round_id !== filterRound) return false;
    if (filterProject !== "all" && r.project_id !== filterProject) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!`${r.code || ""} ${r.name || ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [requests, filterStatus, filterRound, filterProject, search]);

  const tableColumns = useMemo(() => [
    { id: "code", label: "Code", width: 110, sortKey: (r: any) => r.code || "", render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code || "—"}</span> },
    { id: "name", label: "Name", width: 240, sortKey: (r: any) => r.name || "", render: (r: any) => <span className="font-medium text-sm">{r.name || "—"}</span> },
    { id: "project", label: "Project", width: 180, sortKey: (r: any) => projectMap[r.project_id]?.name || "", render: (r: any) => { const p = projectMap[r.project_id]; return p ? <button type="button" onClick={e => { e.stopPropagation(); navigate(`/projects/${r.project_id}`); }} className="text-xs text-primary hover:underline">{p.name}</button> : <span className="text-muted-foreground/40">—</span>; } },
    { id: "round", label: "Round", width: 90, sortKey: (r: any) => roundMap[r.round_id]?.label || "", render: (r: any) => { const rnd = roundMap[r.round_id]; return rnd ? <span className="text-xs font-mono font-semibold tracking-widest text-muted-foreground">{rnd.code}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { id: "status", label: "Status", width: 140, sortKey: (r: any) => r.status || "", render: (r: any) => <span className={`text-[11px] px-2 py-0.5 rounded border font-medium capitalize ${STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground border-border"}`}>{(r.status ?? "draft").replace(/_/g, " ")}</span> },
    { id: "due_date", label: "Due Date", width: 120, sortKey: (r: any) => r.due_date || "", render: (r: any) => { if (!r.due_date) return <span className="text-muted-foreground/40">—</span>; const isPast = new Date(r.due_date) < new Date(); return <span className={`text-xs ${isPast && r.status !== "closed" && r.status !== "archived" ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{new Date(r.due_date).toLocaleDateString()}</span>; } },
    { id: "target_currency", label: "Target Ccy", width: 100, sortKey: (r: any) => currencyMap[r.target_currency_id]?.code || "", render: (r: any) => { const ccy = currencyMap[r.target_currency_id]; return ccy ? <span className="text-xs font-mono text-muted-foreground">{ccy.code}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { id: "created_at", label: "Created", width: 120, sortKey: (r: any) => r.created_at || "", render: (r: any) => <span className="text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span> },
    { id: "created_by", label: "Created By", width: 160, sortKey: (r: any) => r.created_by || "", render: (r: any) => <span className="text-xs text-muted-foreground truncate">{r.created_by || "—"}</span> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [roundMap, currencyMap, projectMap]);

  return (
    <div className={PAGE_WRAPPER}>
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Costing</p>
        <h1 className="font-display text-2xl font-semibold mt-0.5">Supplier Requests</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All supplier cost collection requests across projects.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or name…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRound} onValueChange={setFilterRound}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All rounds" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rounds</SelectItem>
            {rounds.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {(filterStatus !== "all" || filterRound !== "all" || filterProject !== "all") && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {filterStatus !== "all" && (
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Status: {filterStatus.replace(/_/g, " ")}
              <button type="button" onClick={() => setFilterStatus("all")} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterRound !== "all" && (
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Round: {roundMap[filterRound]?.label}
              <button type="button" onClick={() => setFilterRound("all")} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterProject !== "all" && (
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Project: {projectMap[filterProject]?.name}
              <button type="button" onClick={() => setFilterProject("all")} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {requests.length === 0 ? "No Supplier Requests yet" : "No results match your filters"}
          </p>
        </div>
      ) : (
        <DataTable columns={tableColumns} rows={filtered} onRowClick={r => navigate(`/supplier-requests/${r.id}`)} fixedColumns={["code", "name"]} />
      )}
    </div>
  );
}
