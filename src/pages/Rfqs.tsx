import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PAGE_WRAPPER } from "@/lib/utils";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Search, FileSearch, Pencil, ChevronDown, ChevronRight, Trophy, MoreVertical, ExternalLink, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import DataTable from "@/components/shared/DataTable";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import ResponsesPanel from "@/components/rfq/ResponsesPanel";
import { toast } from "sonner";

const SR_STATUS_COLORS: Record<string, string> = {
  draft:         "bg-gray-100 text-gray-600 border-gray-200",
  submitted:     "bg-blue-100 text-blue-700 border-blue-200",
  in_collection: "bg-amber-100 text-amber-700 border-amber-200",
  closed:        "bg-green-100 text-green-700 border-green-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
};

const LINE_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-600 border-gray-200",
  answered:  "bg-blue-100 text-blue-700 border-blue-200",
  awarded:   "bg-green-100 text-green-700 border-green-200",
  declined:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

const RESP_STATUS_COLORS: Record<string, string> = {
  draft:        "bg-gray-100 text-gray-600 border-gray-200",
  submitted:    "bg-blue-100 text-blue-700 border-blue-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-200",
  awarded:      "bg-green-100 text-green-700 border-green-200",
  rejected:     "bg-red-100 text-red-700 border-red-200",
  superseded:   "bg-slate-100 text-slate-500 border-slate-200",
};

const SR_STATUS_OPTIONS = ["draft", "submitted", "in_collection", "closed", "archived"];

// ── Tracking Board ────────────────────────────────────────────────────────────
function TrackingBoard() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [loading, setLoading] = useState(true);
  const [srs, setSrs] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [refData, setRefData] = useState({ products: [] as any[], colors: [] as any[], pcams: [] as any[], steps: [] as any[], suppliers: [] as any[], currencies: [] as any[], rounds: [] as any[], projects: [] as any[] });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRound, setFilterRound] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [showKpis, setShowKpis] = useState(true);
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Award flow
  const [awardingResponse, setAwardingResponse] = useState<any>(null);
  const [awardingLine, setAwardingLine] = useState<any>(null);
  const [priorCost, setPriorCost] = useState<any>(null);
  const [awarding, setAwarding] = useState(false);
  const [showAwardConfirm, setShowAwardConfirm] = useState(false);

  // Response panel / quick-add
  const [panelLine, setPanelLine] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [srRes, prodRes, colorRes, pcamRes, stepRes, supRes, curRes, roundRes, projRes] = await Promise.all([
      supabase.from("supplier_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id,code,name,images"),
      supabase.from("product_colors").select("id,product_id,color_name,colorway_code,color_hex"),
      supabase.from("product_color_and_more").select("id,product_color_id,name,sequence,pack_code"),
      supabase.from("supplier_routing_steps").select("id,supplier_routing_id,sequence,step_type,supplier_id"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("currencies").select("id,code,decimal_places").eq("is_active", true),
      supabase.from("rfq_rounds").select("id,code,label,sequence").order("sequence"),
      supabase.from("projects").select("id,name").order("name"),
    ]);
    const allSrs = srRes.data ?? [];
    setSrs(allSrs);
    setRefData({ products: prodRes.data ?? [], colors: colorRes.data ?? [], pcams: pcamRes.data ?? [], steps: stepRes.data ?? [], suppliers: supRes.data ?? [], currencies: curRes.data ?? [], rounds: roundRes.data ?? [], projects: projRes.data ?? [] });

    if (allSrs.length > 0) {
      const srIds = allSrs.map(s => s.id);
      const { data: linesData } = await supabase.from("rfq_lines").select("*").in("supplier_request_id", srIds).order("created_at");
      const allLines = linesData ?? [];
      setLines(allLines);
      if (allLines.length > 0) {
        const { data: respData } = await supabase.from("rfq_responses").select("*").in("rfq_line_id", allLines.map(l => l.id)).order("created_at", { ascending: false });
        setResponses(respData ?? []);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const productMap  = useMemo(() => Object.fromEntries(refData.products.map(p => [p.id, p])), [refData.products]);
  const colorMap    = useMemo(() => Object.fromEntries(refData.colors.map(c => [c.id, c])), [refData.colors]);
  const pcamMap     = useMemo(() => Object.fromEntries(refData.pcams.map(p => [p.id, p])), [refData.pcams]);
  const stepMap     = useMemo(() => Object.fromEntries(refData.steps.map(s => [s.id, s])), [refData.steps]);
  const supplierMap = useMemo(() => Object.fromEntries(refData.suppliers.map(s => [s.id, s])), [refData.suppliers]);
  const currencyMap = useMemo(() => Object.fromEntries(refData.currencies.map(c => [c.id, c])), [refData.currencies]);
  const projectMap  = useMemo(() => Object.fromEntries(refData.projects.map(p => [p.id, p])), [refData.projects]);

  const kpis = useMemo(() => ({
    open:        lines.filter(l => ["pending","answered"].includes(l.status)).length,
    awarded:     lines.filter(l => l.status === "awarded").length,
    noResponses: lines.filter(l => l.status === "pending" && !responses.some(r => r.rfq_line_id === l.id)).length,
    avgResp:     lines.length > 0 ? (responses.length / lines.length).toFixed(1) : "0",
  }), [lines, responses]);

  const filteredLines = useMemo(() => {
    let list = lines;
    if (filterStatus !== "all") list = list.filter(l => l.status === filterStatus);
    if (filterRound !== "all") list = list.filter(l => {
      const sr = srs.find(s => s.id === l.supplier_request_id);
      return sr?.round_id === filterRound;
    });
    if (filterProject !== "all") list = list.filter(l => {
      const sr = srs.find(s => s.id === l.supplier_request_id);
      return sr?.project_id === filterProject;
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => {
        const p = productMap[l.product_id];
        const s = supplierMap[l.recipient_supplier_id];
        const sr = srs.find(x => x.id === l.supplier_request_id);
        return `${p?.code||""} ${p?.name||""} ${s?.name||""} ${sr?.code||""}`.toLowerCase().includes(q);
      });
    }
    return list;
  }, [lines, filterStatus, filterRound, filterProject, search, srs, productMap, supplierMap]);

  const getGranLabel = (l: any) => {
    if (l.product_color_and_more_id) {
      const c = colorMap[l.product_color_id]; const pc = pcamMap[l.product_color_and_more_id];
      return c && pc ? `${c.color_name} › ${pc.name||pc.sequence}` : "Variation";
    }
    if (l.product_color_id) { const c = colorMap[l.product_color_id]; return c ? c.color_name : "Color"; }
    return "Product";
  };

  const getBestQuote = (lineId: string) => {
    const lineResps = responses.filter(r => r.rfq_line_id === lineId && r.status === "submitted");
    if (!lineResps.length) return null;
    const best = lineResps.reduce((min, r) => (!min || r.total_cost_target_ccy < min.total_cost_target_ccy) ? r : min, null as any);
    const sr = srs.find(s => s.id === lines.find(l => l.id === lineId)?.supplier_request_id);
    const ccy = currencyMap[sr?.target_currency_id];
    return `${best.total_cost_target_ccy?.toFixed(ccy?.decimal_places ?? 2) ?? "—"} ${ccy?.code || "?"}`;
  };

  const getAwardedCost = (line: any) => {
    if (!line.awarded_response_id) return null;
    const r = responses.find(x => x.id === line.awarded_response_id);
    if (!r) return null;
    const sr = srs.find(s => s.id === line.supplier_request_id);
    const ccy = currencyMap[sr?.target_currency_id];
    return `${r.total_cost_target_ccy?.toFixed(ccy?.decimal_places ?? 2) ?? "—"} ${ccy?.code || "?"}`;
  };

  const handleAwardClick = async (response: any, line: any) => {
    const sr = srs.find(s => s.id === line.supplier_request_id);
    const { data: priors } = await supabase.from("product_costs")
      .select("id,total_cost_target_ccy,target_currency_id,awarded_at")
      .eq("status", "active").eq("project_id", sr?.project_id)
      .eq("product_id", line.product_id).eq("routing_step_id", line.routing_step_id).eq("supplier_id", line.recipient_supplier_id);
    setAwardingResponse(response);
    setAwardingLine(line);
    setPriorCost(priors?.[0] ?? null);
    setShowAwardConfirm(true);
  };

  const handleAwardConfirm = async () => {
    if (!awardingResponse || !awardingLine) return;
    setAwarding(true);
    try {
      const sr = srs.find(s => s.id === awardingLine.supplier_request_id);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/award-rfq-response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
          body: JSON.stringify({ rfq_line_id: awardingLine.id, response_id: awardingResponse.id, rfq_id: sr?.id }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Award failed");
      toast.success("Response awarded" + (json.prior_cost_superseded ? " — prior cost superseded" : ""));
      setShowAwardConfirm(false); setAwardingResponse(null); setAwardingLine(null); setPriorCost(null);
      load();
    } catch (err: any) { toast.error("Award failed: " + err.message); }
    setAwarding(false);
  };

  // Options menu
  useEffect(() => {
    setOptions({
      items: [{ label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu(v => !v) }],
      customContent: showViewMenu ? (
        <ViewDrawerContent
          pageKey="rfq_tracking_board"
          activeViewId={activeViewId}
          onSelectView={id => { setActiveViewId(id); setShowViewMenu(false); }}
          allFields={[
            { id: "sr", label: "SR Code" }, { id: "round", label: "Round" }, { id: "project", label: "Project" },
            { id: "product", label: "Product" }, { id: "scope", label: "Scope" }, { id: "step", label: "Routing Step" },
            { id: "supplier", label: "Recipient Supplier" }, { id: "qty", label: "Fcst. Qty" },
            { id: "responses", label: "Responses" }, { id: "best_quote", label: "Best Quote" },
            { id: "awarded_cost", label: "Awarded Cost" }, { id: "line_status", label: "Line Status" },
            { id: "sr_status", label: "SR Status" },
          ]}
          currentViewType={null}
        />
      ) : null,
    });
    return () => setOptions(null);
  }, [showViewMenu, activeViewId, setOptions]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowKpis(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
          <span className="text-sm font-semibold">Stats</span>
          <span className="text-sm text-muted-foreground font-semibold">{showKpis ? "−" : "+"}</span>
        </button>
        {showKpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 border-t border-border">
            <button type="button" onClick={() => setFilterStatus("pending")}
              className="text-left bg-muted/40 border border-border rounded-lg px-4 py-3 hover:bg-muted transition-colors">
              <p className="text-xs text-muted-foreground mb-1">Open Lines</p>
              <p className="text-2xl font-bold">{kpis.open}</p>
            </button>
            <button type="button" onClick={() => setFilterStatus("awarded")}
              className="text-left bg-green-50 border border-green-200 rounded-lg px-4 py-3 hover:bg-green-100 transition-colors">
              <p className="text-xs text-green-700 mb-1">Awarded</p>
              <p className="text-2xl font-bold text-green-700">{kpis.awarded}</p>
            </button>
            <div className={`rounded-lg px-4 py-3 border ${kpis.noResponses > 0 ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border"}`}>
              <p className={`text-xs mb-1 ${kpis.noResponses > 0 ? "text-amber-700" : "text-muted-foreground"}`}>No Responses</p>
              <p className={`text-2xl font-bold ${kpis.noResponses > 0 ? "text-amber-700" : ""}`}>{kpis.noResponses}</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Avg Resp/Line</p>
              <p className="text-2xl font-bold">{kpis.avgResp}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, supplier, SR code…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All line statuses</SelectItem>
            {["pending","answered","awarded","declined","cancelled"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRound} onValueChange={setFilterRound}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="All rounds" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rounds</SelectItem>
            {refData.rounds.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {refData.projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterRound !== "all" || filterProject !== "all") && (
          <button type="button" onClick={() => { setFilterStatus("all"); setFilterRound("all"); setFilterProject("all"); }}
            className="text-xs text-muted-foreground underline hover:text-foreground">Clear filters</button>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setExpandedIds(new Set(filteredLines.map(l => l.id)))}>
            <ChevronDown className="w-3 h-3" /> Expand all
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setExpandedIds(new Set())}>
            <ChevronRight className="w-3 h-3" /> Collapse all
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {filteredLines.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{lines.length === 0 ? "No RFQ lines yet — create a Supplier Request to start." : "No matches for current filters."}</p>
        </div>
      ) : (
        /* Tracking table — expandable: line rows with response child rows */
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-360px)] overflow-y-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 z-20 w-7 bg-muted/40 border-b border-border/60" />
                  {[
                    { id: "sr",        label: "SR",               w: 100 },
                    { id: "project",   label: "Project",          w: 150 },
                    { id: "product",   label: "Product",          w: 200 },
                    { id: "scope",     label: "Scope",            w: 160 },
                    { id: "step",      label: "Routing Step",     w: 160 },
                    { id: "supplier",  label: "Supplier",         w: 160 },
                    { id: "qty",       label: "Fcst. Qty",        w: 100 },
                    { id: "responses", label: "Resp.",            w: 70  },
                    { id: "best_quote",label: "Best Quote",       w: 120 },
                    { id: "awarded",   label: "Awarded Cost",     w: 120 },
                    { id: "line_status",label: "Line Status",     w: 110 },
                    { id: "sr_status", label: "SR Status",        w: 110 },
                    { id: "actions",   label: "",                 w: 44  },
                  ].map(col => (
                    <th key={col.id} style={{ width: col.w, minWidth: col.w }}
                      className="sticky top-0 z-20 bg-muted/40 px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border/60">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLines.map(line => {
                  const lineResps = responses.filter(r => r.rfq_line_id === line.id);
                  const isExpanded = expandedIds.has(line.id);
                  const sr = srs.find(s => s.id === line.supplier_request_id);
                  const prod = productMap[line.product_id];
                  const step = stepMap[line.routing_step_id];
                  const sup = supplierMap[line.recipient_supplier_id];
                  const proj = projectMap[sr?.project_id];
                  const targetCcy = currencyMap[sr?.target_currency_id];
                  const bestQuote = getBestQuote(line.id);
                  const awardedCost = getAwardedCost(line);
                  const submittedResps = lineResps.filter(r => r.status === "submitted");

                  return [
                    /* Line row */
                    <tr key={line.id} className="hover:bg-muted/20 transition-colors border-b border-border/40">
                      <td className="px-1 py-2 text-center">
                        {lineResps.length > 0 ? (
                          <button type="button" onClick={() => setExpandedIds(prev => { const n = new Set(prev); if (n.has(line.id)) n.delete(line.id); else n.add(line.id); return n; })}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        ) : <span className="text-muted-foreground/30"><ChevronRight className="w-3.5 h-3.5" /></span>}
                      </td>
                      <td className="px-3 py-2">
                        {sr ? (
                          <button type="button" onClick={() => navigate(`/supplier-requests/${sr.id}`)}
                            className="text-xs font-mono text-primary hover:underline">{sr.code}</button>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {proj ? <span className="text-xs text-muted-foreground">{proj.name}</span> : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {prod?.images?.[0] && <img src={prod.images[0]} className="w-6 h-6 object-contain rounded shrink-0" alt="" />}
                          <div><p className="text-xs font-medium">{prod?.name || "—"}</p>{prod?.code && <p className="text-[10px] font-mono text-muted-foreground">{prod.code}</p>}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className="text-xs text-muted-foreground">{getGranLabel(line)}</span></td>
                      <td className="px-3 py-2">{step ? <span className="text-xs text-muted-foreground">Step {step.sequence}: {(step.step_type||"").replace(/_/g," ")}</span> : <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-3 py-2">{sup ? <span className="text-xs">{sup.name}</span> : <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-3 py-2"><span className="text-xs text-muted-foreground font-mono">{line.forecasted_qty != null ? `${line.forecasted_qty} ${line.forecasted_qty_uom||""}`.trim() : "—"}</span></td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setPanelLine(panelLine?.id === line.id ? null : line)}
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold border cursor-pointer ${lineResps.length > 0 ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" : "bg-muted text-muted-foreground border-border"}`}>
                          {lineResps.length}
                        </button>
                      </td>
                      <td className="px-3 py-2"><span className="text-xs font-mono">{bestQuote || "—"}</span></td>
                      <td className="px-3 py-2"><span className="text-xs font-mono text-green-700">{awardedCost || "—"}</span></td>
                      <td className="px-3 py-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium capitalize ${LINE_STATUS_COLORS[line.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                          {(line.status || "pending").replace(/_/g," ")}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {sr && <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium capitalize ${SR_STATUS_COLORS[sr.status] ?? "bg-muted text-muted-foreground border-border"}`}>{(sr.status||"").replace(/_/g," ")}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {sr && <DropdownMenuItem onClick={() => navigate(`/supplier-requests/${sr.id}`)}><ExternalLink className="w-3.5 h-3.5 mr-2" />View SR</DropdownMenuItem>}
                            {submittedResps.length === 1 && !line.awarded_response_id && (
                              <DropdownMenuItem onClick={() => handleAwardClick(submittedResps[0], line)}>
                                <Trophy className="w-3.5 h-3.5 mr-2" />Quick Award
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>,

                    /* Response child rows */
                    ...(isExpanded ? lineResps.map(resp => {
                      const respCcy = currencyMap[resp.supplier_currency_id];
                      const canAward = !resp.is_awarded && ["submitted","under_review"].includes(resp.status);
                      return (
                        <tr key={resp.id} className="bg-muted/10 border-b border-border/30 border-l-2 border-l-slate-300">
                          <td className="px-1 py-1.5" />
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5 pl-6">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <ChevronRight className="w-3 h-3 shrink-0" /> Response
                            </span>
                          </td>
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5">
                            <span className="text-xs text-muted-foreground">{supplierMap[line.recipient_supplier_id]?.name || "—"}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="text-xs font-mono space-y-0.5">
                              {resp.min_qty != null && <div>Min: {resp.min_qty}</div>}
                              {resp.max_qty != null && <div>Max: {resp.max_qty}</div>}
                              {resp.leadtime_days && <div>{resp.leadtime_days}d lead</div>}
                            </div>
                          </td>
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5">
                            <span className="text-xs font-mono">
                              {resp.total_cost_supplier_ccy != null
                                ? `${resp.total_cost_supplier_ccy?.toFixed(respCcy?.decimal_places??2)} ${respCcy?.code||"?"}`
                                : "—"}
                              {resp.total_cost_target_ccy != null && resp.supplier_currency_id !== sr?.target_currency_id && targetCcy
                                ? ` = ${resp.total_cost_target_ccy?.toFixed(targetCcy?.decimal_places??2)} ${targetCcy.code}`
                                : ""}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            {resp.is_awarded && <span className="text-xs font-mono text-green-700">{resp.total_cost_target_ccy?.toFixed(targetCcy?.decimal_places??2)} {targetCcy?.code}</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${RESP_STATUS_COLORS[resp.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                              {(resp.status||"").replace(/_/g," ")}
                              {resp.is_awarded && " ★"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5">
                            {canAward && (
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Award this response" onClick={e => { e.stopPropagation(); handleAwardClick(resp, line); }}>
                                <Trophy className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    }) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Responses side panel (from row click) */}
      {panelLine && (
        <ResponsesPanel
          line={panelLine}
          rfq={srs.find(s => s.id === panelLine.supplier_request_id) ?? {}}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onClose={() => setPanelLine(null)}
          onLineChanged={load}
        />
      )}

      {/* Award confirm */}
      <AlertDialog open={showAwardConfirm} onOpenChange={o => { if (!o) { setShowAwardConfirm(false); setAwardingResponse(null); setAwardingLine(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Award this response?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {awardingResponse && (
                  <div className="bg-blue-50/50 rounded-lg p-3 text-xs border border-blue-200/50 space-y-1">
                    <div className="font-semibold text-blue-900">
                      {awardingResponse.total_cost_supplier_ccy} {currencyMap[awardingResponse.supplier_currency_id]?.code}
                      {awardingResponse.total_cost_target_ccy && awardingResponse.supplier_currency_id !== srs.find(s => s.id === awardingLine?.supplier_request_id)?.target_currency_id
                        ? ` = ${awardingResponse.total_cost_target_ccy} ${currencyMap[srs.find(s => s.id === awardingLine?.supplier_request_id)?.target_currency_id]?.code}` : ""}
                    </div>
                    {awardingResponse.leadtime_days && <div className="text-muted-foreground">Lead time: {awardingResponse.leadtime_days} days</div>}
                  </div>
                )}
                {priorCost && (
                  <div className="bg-amber-50/70 rounded-lg p-3 border border-amber-200/50 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900">
                      <p className="font-semibold">Existing cost will be superseded</p>
                      <p className="mt-0.5">{priorCost.total_cost_target_ccy} {currencyMap[priorCost.target_currency_id]?.code}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">All other responses for this line will be rejected.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={awarding}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAwardConfirm} disabled={awarding} className="gap-2">
              {awarding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Confirm Award
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Supplier Requests list ────────────────────────────────────────────────────
function SupplierRequestsList() {
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

  const roundMap    = useMemo(() => Object.fromEntries(rounds.map(r => [r.id, r])), [rounds]);
  const currencyMap = useMemo(() => Object.fromEntries(currencies.map(c => [c.id, c])), [currencies]);
  const projectMap  = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

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
    { id: "code",    label: "Code",        width: 110, sortKey: (r: any) => r.code || "",    render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code || "—"}</span> },
    { id: "name",    label: "Name",        width: 240, sortKey: (r: any) => r.name || "",    render: (r: any) => <span className="font-medium text-sm">{r.name || "—"}</span> },
    { id: "project", label: "Project",     width: 180, sortKey: (r: any) => projectMap[r.project_id]?.name || "", render: (r: any) => { const p = projectMap[r.project_id]; return p ? <button type="button" onClick={e => { e.stopPropagation(); navigate(`/projects/${r.project_id}`); }} className="text-xs text-primary hover:underline">{p.name}</button> : <span className="text-muted-foreground/40">—</span>; } },
    { id: "round",   label: "Round",       width: 90,  sortKey: (r: any) => roundMap[r.round_id]?.label || "", render: (r: any) => { const rnd = roundMap[r.round_id]; return rnd ? <span className="text-xs font-mono font-semibold tracking-widest text-muted-foreground">{rnd.code}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { id: "status",  label: "Status",      width: 140, sortKey: (r: any) => r.status || "",  render: (r: any) => <span className={`text-[11px] px-2 py-0.5 rounded border font-medium capitalize ${SR_STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground border-border"}`}>{(r.status ?? "draft").replace(/_/g, " ")}</span> },
    { id: "due_date",label: "Due Date",    width: 120, sortKey: (r: any) => r.due_date || "", render: (r: any) => { if (!r.due_date) return <span className="text-muted-foreground/40">—</span>; const isPast = new Date(r.due_date) < new Date(); return <span className={`text-xs ${isPast && r.status !== "closed" && r.status !== "archived" ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{new Date(r.due_date).toLocaleDateString()}</span>; } },
    { id: "target_currency", label: "Target Ccy", width: 100, sortKey: (r: any) => currencyMap[r.target_currency_id]?.code || "", render: (r: any) => { const ccy = currencyMap[r.target_currency_id]; return ccy ? <span className="text-xs font-mono text-muted-foreground">{ccy.code}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { id: "created_at", label: "Created",  width: 120, sortKey: (r: any) => r.created_at || "", render: (r: any) => <span className="text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span> },
    { id: "created_by", label: "Created By", width: 160, sortKey: (r: any) => r.created_by || "", render: (r: any) => <span className="text-xs text-muted-foreground truncate">{r.created_by || "—"}</span> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [roundMap, currencyMap, projectMap]);

  useEffect(() => {
    setOptions({
      items: [{ label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu(v => !v) }],
      customContent: showViewMenu ? (
        <ViewDrawerContent
          pageKey="supplier_requests_list"
          activeViewId={activeViewId}
          onSelectView={id => { setActiveViewId(id); setShowViewMenu(false); }}
          allFields={tableColumns.map(c => ({ id: c.id, label: c.label }))}
          currentViewType={null}
        />
      ) : null,
    });
    return () => setOptions(null);
  }, [showViewMenu, activeViewId, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or name…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{SR_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterRound} onValueChange={setFilterRound}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All rounds" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All rounds</SelectItem>{rounds.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{requests.length === 0 ? "No Supplier Requests yet" : "No results match your filters"}</p>
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          onRowClick={r => navigate(`/supplier-requests/${r.id}`)}
          fixedColumns={pinnedCols}
          onPinColumn={id => setPinnedCols(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          {...({ activeViewId } as any)}
        />
      )}
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function Rfqs() {
  const [activeTab, setActiveTab] = useState<"list" | "board">("list");

  const TABS = [
    { id: "list",  label: "Supplier Requests" },
    { id: "board", label: "Tracking Board"     },
  ] as const;

  return (
    <div className={PAGE_WRAPPER}>
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Costing</p>
        <h1 className="font-display text-2xl font-semibold mt-0.5">RFQ & Costing</h1>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border mb-5">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "list"  && <SupplierRequestsList />}
      {activeTab === "board" && <TrackingBoard />}
    </div>
  );
}
