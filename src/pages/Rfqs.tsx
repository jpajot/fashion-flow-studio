import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PAGE_WRAPPER } from "@/lib/utils";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, FileSearch, Pencil } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import ViewDrawerContent from "@/components/ViewDrawerContent";

const SR_STATUS_COLORS: Record<string,string> = {
  draft:"bg-gray-100 text-gray-600 border-gray-200", submitted:"bg-blue-100 text-blue-700 border-blue-200",
  in_collection:"bg-amber-100 text-amber-700 border-amber-200", closed:"bg-green-100 text-green-700 border-green-200",
  archived:"bg-gray-100 text-gray-400 border-gray-200",
};

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
  const [pinnedCols, setPinnedCols] = useState<string[]>(["code","name"]);

  const load = useCallback(async () => {
    setLoading(true);
    const [srRes,rndRes,curRes,projRes] = await Promise.all([
      supabase.from("supplier_requests").select("*").order("created_at",{ascending:false}),
      supabase.from("rfq_rounds").select("id,code,label,sequence").order("sequence"),
      supabase.from("currencies").select("id,code").eq("is_active",true).order("code"),
      supabase.from("projects").select("id,name").order("name"),
    ]);
    setRequests(srRes.data??[]); setRounds(rndRes.data??[]); setCurrencies(curRes.data??[]); setProjects(projRes.data??[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const roundMap: Record<string, any>    = useMemo(() => Object.fromEntries(rounds.map((r:any) => [r.id,r])), [rounds]);
  const currencyMap: Record<string, any> = useMemo(() => Object.fromEntries(currencies.map((c:any) => [c.id,c])), [currencies]);
  const projectMap: Record<string, any>  = useMemo(() => Object.fromEntries(projects.map((p:any) => [p.id,p])), [projects]);

  const filtered = useMemo(() => requests.filter((r:any) => {
    if (filterStatus!=="all"&&r.status!==filterStatus) return false;
    if (filterRound!=="all"&&r.round_id!==filterRound) return false;
    if (filterProject!=="all"&&r.project_id!==filterProject) return false;
    if (search.trim()&&!`${r.code||""} ${r.name||""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [requests,filterStatus,filterRound,filterProject,search]);

  const tableColumns = useMemo(() => [
    {id:"code",label:"Code",width:110,sortKey:(r:any)=>r.code||"",render:(r:any)=><span className="font-mono text-xs font-semibold">{r.code||"—"}</span>},
    {id:"name",label:"Name",width:240,sortKey:(r:any)=>r.name||"",render:(r:any)=><span className="font-medium text-sm">{r.name||"—"}</span>},
    {id:"project",label:"Project",width:180,sortKey:(r:any)=>projectMap[r.project_id]?.name||"",render:(r:any)=>{const p=projectMap[r.project_id];return p?<button type="button" onClick={e=>{e.stopPropagation();navigate(`/projects/${r.project_id}`);}} className="text-xs text-primary hover:underline">{p.name}</button>:<span className="text-muted-foreground/40">—</span>;}},
    {id:"round",label:"Round",width:90,sortKey:(r:any)=>roundMap[r.round_id]?.label||"",render:(r:any)=>{const rnd=roundMap[r.round_id];return rnd?<span className="text-xs font-mono font-semibold tracking-widest text-muted-foreground">{rnd.code}</span>:<span className="text-muted-foreground/40">—</span>;}},
    {id:"status",label:"Status",width:140,sortKey:(r:any)=>r.status||"",render:(r:any)=><span className={`text-[11px] px-2 py-0.5 rounded border font-medium capitalize ${SR_STATUS_COLORS[r.status]??"bg-muted text-muted-foreground border-border"}`}>{(r.status??"draft").replace(/_/g," ")}</span>},
    {id:"due_date",label:"Due Date",width:120,sortKey:(r:any)=>r.due_date||"",render:(r:any)=>{if(!r.due_date)return<span className="text-muted-foreground/40">—</span>;const past=new Date(r.due_date)<new Date();return<span className={`text-xs ${past&&!["closed","archived"].includes(r.status)?"text-red-600 font-medium":"text-muted-foreground"}`}>{new Date(r.due_date).toLocaleDateString()}</span>;}},
    {id:"target_currency",label:"Ccy",width:80,sortKey:(r:any)=>currencyMap[r.target_currency_id]?.code||"",render:(r:any)=>{const c=currencyMap[r.target_currency_id];return c?<span className="text-xs font-mono text-muted-foreground">{c.code}</span>:<span className="text-muted-foreground/40">—</span>;}},
    {id:"created_at",label:"Created",width:110,sortKey:(r:any)=>r.created_at||"",render:(r:any)=><span className="text-xs text-muted-foreground">{r.created_at?new Date(r.created_at).toLocaleDateString():"—"}</span>},
    {id:"created_by",label:"Created By",width:160,sortKey:(r:any)=>r.created_by||"",render:(r:any)=><span className="text-xs text-muted-foreground truncate">{r.created_by||"—"}</span>},
  ], [roundMap, currencyMap, projectMap, navigate]);

  useEffect(() => {
    setOptions({
      items: [{label:"Manage Views",icon:Pencil,onClick:()=>setShowViewMenu(v=>!v),keepOpen:true}],
      customContent: showViewMenu ? (
        <ViewDrawerContent pageKey="supplier_requests_list" activeViewId={activeViewId}
          onSelectView={(id:string)=>{setActiveViewId(id);setShowViewMenu(false);}}
          allFields={tableColumns.map(c=>({id:c.id,label:c.label}))} currentViewType={null}/>
      ) : null,
    });
    return () => setOptions(null);
  }, [showViewMenu, activeViewId, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by code or name…" className="pl-8 h-8 text-xs"/>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses"/></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{["draft","submitted","in_collection","closed","archived"].map(s=><SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterRound} onValueChange={setFilterRound}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All rounds"/></SelectTrigger>
          <SelectContent><SelectItem value="all">All rounds</SelectItem>{rounds.map(r=><SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All projects"/></SelectTrigger>
          <SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{requests.length===0?"No Supplier Requests yet":"No results match your filters"}</p>
        </div>
      ) : (
        <DataTable columns={tableColumns} rows={filtered} onRowClick={(r:any)=>navigate(`/supplier-requests/${r.id}`)}
          fixedColumns={pinnedCols} onPinColumn={(id:string)=>setPinnedCols(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}
          {...({activeViewId} as any)}/>
      )}
    </div>
  );
}

export default function Rfqs() {
  return (
    <div className={PAGE_WRAPPER}>
      <SupplierRequestsList/>
    </div>
  );
}
