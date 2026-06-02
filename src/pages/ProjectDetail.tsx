import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PAGE_WRAPPER } from "@/lib/utils";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Trash2, Plus, Search, X, Package, Palette, Layers, FileText, Building2, ClipboardList, FileSearch, FlaskConical, SwatchBook, LayoutTemplate, BarChart2, Info, ExternalLink, AlertTriangle, Clock, GitBranch, XCircle, Upload, LayoutGrid, List as ListIcon, Pencil, Download, Zap } from "lucide-react";
import GalleryView from "@/components/GalleryView";
import DataTable from "@/components/shared/DataTable";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import LinkCommercialColorDialog from "@/components/LinkCommercialColorDialog";
import { colorToHex } from "@/pages/ColorLibrary";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

// ── Constants ────────────────────────────────────────────────────────────────
const TYPES = ["Seasonal Collection","Artist Collaboration","Capsule","Limited Edition","Core Range","Other"];
const SEASONS = ["SS25","FW25","SS26","FW26","Evergreen"];
const STATUSES = ["Planning","Active","Archived"];
const STATUS_CONFIG: Record<string, { bg:string; text:string; border:string; dot:string }> = {
  Planning: { bg:"bg-amber-50",  text:"text-amber-700",  border:"border-amber-200",  dot:"bg-amber-400" },
  Active:   { bg:"bg-green-50",  text:"text-green-700",  border:"border-green-200",  dot:"bg-green-400" },
  Archived: { bg:"bg-slate-50",  text:"text-slate-500",  border:"border-slate-200",  dot:"bg-slate-400" },
};
const BOM_STATUS_CONFIG: Record<string, string> = {
  draft: "bg-blue-100 text-blue-700 border-blue-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-gray-100 text-gray-500 border-gray-300",
};

// ── Shared link/unlink modal ─────────────────────────────────────────────────
function LinkModal({ open, onClose, title, items, alreadyLinkedIds, onConfirm, confirming, renderItem }: {
  open: boolean; onClose: () => void; title: string;
  items: any[]; alreadyLinkedIds: string[];
  onConfirm: (ids: string[]) => Promise<void>; confirming: boolean;
  renderItem: (item: any) => React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { if (!open) { setSearch(""); setSelected(new Set()); } }, [open]);

  const available = items.filter(i => !alreadyLinkedIds.includes(i.id));
  const filtered = search.trim()
    ? available.filter(i => JSON.stringify(i).toLowerCase().includes(search.toLowerCase()))
    : available;

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8 text-xs" autoFocus />
          </div>
          <div className="border border-border rounded-lg overflow-y-auto" style={{ maxHeight: 320 }}>
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">{available.length === 0 ? "All items already linked" : "No matches"}</p>
            ) : filtered.map(item => (
              <button key={item.id} type="button" onClick={() => toggle(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-xs transition-colors border-b border-border last:border-0 ${selected.has(item.id) ? "bg-primary/8" : "hover:bg-muted/40"}`}>
                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${selected.has(item.id) ? "bg-primary border-primary" : "border-border"}`}>
                  {selected.has(item.id) && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {renderItem(item)}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <span className="text-xs text-muted-foreground mr-auto self-center">{selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={selected.size === 0 || confirming} onClick={() => onConfirm(Array.from(selected))}>
            {confirming ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1"/>Linking…</> : "Link selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Colorway status badge ────────────────────────────────────────────────────
const CW_STATUS: Record<string, string> = {
  approved: "bg-green-100 text-green-700", requested: "bg-orange-100 text-orange-700",
  in_progress: "bg-blue-100 text-blue-700", submitted_for_approval: "bg-purple-100 text-purple-700",
  rejected: "bg-red-100 text-red-700", obsolete: "bg-gray-100 text-gray-500",
};

// ── Link field constants ──────────────────────────────────────────────────────
const LINK_STATUS_OPTIONS = ["Development", "Confirmed", "Dropped", "On Hold"];
const DIST_CHANNEL_OPTIONS = ["Wholesale", "Direct To Customer"];

// Inline editable cell — number, text, select, or tag-multiselect
function LinkCell({ value, type = "text", options, onSave }: {
  value: any;
  type?: "text" | "number" | "select" | "multiselect";
  options?: string[];
  onSave: (v: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<any>(value ?? (type === "multiselect" ? [] : ""));
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => { setVal(value ?? (type === "multiselect" ? [] : "")); }, [JSON.stringify(value)]);
  useEffect(() => { if (editing && ref.current) (ref.current as HTMLElement).focus(); }, [editing]);

  const commit = (v: any) => { setEditing(false); onSave(v); };

  if (type === "multiselect") {
    const tags: string[] = Array.isArray(val) ? val : [];
    return (
      <div className="min-w-[120px]">
        <div className="flex flex-wrap gap-0.5 items-center min-h-[24px] cursor-pointer group" onClick={() => setEditing(v => !v)}>
          {tags.length === 0 ? <span className="text-[10px] text-muted-foreground/50 group-hover:text-primary/50">—</span>
            : tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{t}</span>)}
        </div>
        {editing && options && (
          <div className="mt-1 border border-border rounded-lg shadow-lg bg-popover z-50 overflow-hidden" style={{position:"relative"}}>
            {options.map(opt => {
              const selected = tags.includes(opt);
              return (
                <button key={opt} type="button"
                  onClick={() => { const next = selected ? tags.filter(x=>x!==opt) : [...tags, opt]; setVal(next); onSave(next); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${selected?"bg-primary/10 text-primary":"hover:bg-muted"}`}>
                  <div className={`w-3 h-3 rounded border flex-shrink-0 ${selected?"bg-primary border-primary":"border-border"}`}/>
                  {opt}
                </button>
              );
            })}
            <button type="button" onClick={() => setEditing(false)} className="w-full text-center text-[10px] text-muted-foreground py-1 hover:bg-muted border-t border-border">Done</button>
          </div>
        )}
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <select
        value={val || ""}
        onChange={e => commit(e.target.value || null)}
        className="text-xs bg-transparent border-0 outline-none cursor-pointer hover:bg-muted rounded px-1 py-0.5 w-full"
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="text-xs text-left w-full px-1 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground min-w-[60px]">
        {val !== null && val !== "" && val !== undefined ? String(val) : "—"}
      </button>
    );
  }
  return (
    <input
      ref={ref as any}
      type={type === "number" ? "number" : "text"}
      value={val ?? ""}
      onChange={e => setVal(e.target.value)}
      onBlur={() => commit(type === "number" ? (val === "" ? null : Number(val)) : (val || null))}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); } }}
      className="text-xs border-0 ring-1 ring-primary rounded px-1 py-0.5 bg-background w-full outline-none"
    />
  );
}

// ── STYLES TAB ───────────────────────────────────────────────────────────────
function StylesSection({ projectId, linkedStyles, onRefresh, setOptions }: { projectId:string; linkedStyles:any[]; onRefresh:()=>void; setOptions:any }) {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [linkMap, setLinkMap] = useState<Record<string,any>>({});
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid"|"list">(() => (localStorage.getItem("proj_styles_view") as any) ?? "list");
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    supabase.from("products").select("id,code,name,type,sub_type,category,images,creation_project_id,project_ids").order("name").then(({data})=>setAllProducts(data??[]));
    supabase.from("projects").select("id,name").order("name").then(({data})=>setProjects(data??[]));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    supabase.from("product_project_links").select("*").eq("project_id", projectId).then(({data}) => {
      const m: Record<string,any> = {};
      (data ?? []).forEach((l: any) => { m[l.product_id] = l; });
      setLinkMap(m);
    });
  }, [projectId, linkedStyles.length]);

  const saveLinkField = async (productId: string, field: string, rawValue: any) => {
    const value = rawValue;
    const existing = linkMap[productId];
    let updated: any;
    if (existing) {
      const { data } = await supabase.from("product_project_links").update({ [field]: value }).eq("id", existing.id).select().single();
      updated = data;
    } else {
      const { data } = await supabase.from("product_project_links").insert({ product_id: productId, project_id: projectId, [field]: value }).select().single();
      updated = data;
    }
    if (updated) setLinkMap(prev => ({ ...prev, [productId]: updated }));
  };

  useEffect(() => { localStorage.setItem("proj_styles_view", view); }, [view]);
  const filtered = search.trim() ? linkedStyles.filter(p => `${p.name} ${p.code}`.toLowerCase().includes(search.toLowerCase())) : linkedStyles;

  const handleLink = async (ids: string[]) => {
    setLinking(true);
    const rows = ids.map(product_id => ({ product_id, project_id: projectId }));
    await supabase.from("product_project_links").upsert(rows, { onConflict: "product_id,project_id", ignoreDuplicates: true });
    for (const pid of ids) {
      const { data } = await supabase.from("products").select("project_ids").eq("id", pid).single();
      const cur: string[] = data?.project_ids ?? [];
      if (!cur.includes(projectId)) await supabase.from("products").update({ project_ids: [...cur, projectId] }).eq("id", pid);
    }
    setLinking(false); setShowLink(false); onRefresh();
    toast.success(`${ids.length} style${ids.length > 1 ? "s" : ""} linked`);
  };

  const handleUnlink = async (productId: string) => {
    await supabase.from("product_project_links").delete().eq("product_id", productId).eq("project_id", projectId);
    const { data } = await supabase.from("products").select("project_ids").eq("id", productId).single();
    const cur: string[] = data?.project_ids ?? [];
    await supabase.from("products").update({ project_ids: cur.filter(id => id !== projectId) }).eq("id", productId);
    onRefresh(); toast.success("Style unlinked");
  };

  const galleryFields = useMemo(() => [
    { id:"code", label:"Code", getValue:(p:any)=>p.code, render:(p:any)=><span className="font-mono text-xs text-muted-foreground">{p.code||"—"}</span> },
    { id:"name", label:"Name", getValue:(p:any)=>p.name, render:(p:any)=><span className="font-medium text-xs">{p.name}</span> },
    { id:"type", label:"Type", getValue:(p:any)=>p.type, render:(p:any)=><span className="text-xs text-muted-foreground">{p.type||"—"}</span> },
    { id:"sub_type", label:"Sub-type", getValue:(p:any)=>p.sub_type, render:(p:any)=><span className="text-xs text-muted-foreground">{p.sub_type||"—"}</span> },
    { id:"category", label:"Category", getValue:(p:any)=>p.category, render:(p:any)=><span className="text-xs text-muted-foreground">{p.category||"—"}</span> },
    { id:"creation_project", label:"Creation Project",
      getValue:(p:any)=>projects.find((pr:any)=>pr.id===p.creation_project_id)?.name||"",
      render:(p:any)=>{ const pr=projects.find((x:any)=>x.id===p.creation_project_id); return <span className="text-xs text-muted-foreground">{pr?.name||"—"}</span>; } },
    { id:"linked_projects", label:"Linked Projects",
      getValue:(p:any)=>((p.project_ids||[]) as string[]).map((id:string)=>projects.find((pr:any)=>pr.id===id)?.name).filter(Boolean).join(", "),
      render:(p:any)=>{ const names=((p.project_ids||[]) as string[]).map((id:string)=>projects.find((pr:any)=>pr.id===id)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length?names.join(", "):"—"}</span>; } },
    { id:"link_status", label:"Project Status",
      getValue:(p:any)=>linkMap[p.id]?.status||"",
      render:(p:any)=><LinkCell value={linkMap[p.id]?.status} type="select" options={LINK_STATUS_OPTIONS} onSave={v=>saveLinkField(p.id,"status",v)}/> },
    { id:"link_notes", label:"Project Notes",
      getValue:(p:any)=>linkMap[p.id]?.notes||"",
      render:(p:any)=><LinkCell value={linkMap[p.id]?.notes} onSave={v=>saveLinkField(p.id,"notes",v)}/> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [projects, linkMap]);

  const tableColumns = useMemo(() => [
    { id:"code", label:"Code", width:110, sortKey:(p:any)=>p.code||"", render:(p:any)=><span className="font-mono text-xs text-muted-foreground">{p.code||"—"}</span> },
    { id:"name", label:"Name", width:200, sortKey:(p:any)=>p.name||"", render:(p:any)=><span className="font-medium text-sm">{p.name}</span> },
    { id:"type", label:"Type", width:140, sortKey:(p:any)=>p.type||"", render:(p:any)=><span className="text-xs text-muted-foreground">{p.type||"—"}</span> },
    { id:"sub_type", label:"Sub-type", width:130, sortKey:(p:any)=>p.sub_type||"", render:(p:any)=><span className="text-xs text-muted-foreground">{p.sub_type||"—"}</span> },
    { id:"category", label:"Category", width:130, sortKey:(p:any)=>p.category||"", render:(p:any)=><span className="text-xs text-muted-foreground">{p.category||"—"}</span> },
    { id:"creation_project", label:"Creation Project", width:160,
      sortKey:(p:any)=>projects.find((pr:any)=>pr.id===p.creation_project_id)?.name||"",
      render:(p:any)=>{ const pr=projects.find((x:any)=>x.id===p.creation_project_id); return <span className="text-xs text-muted-foreground">{pr?.name||"—"}</span>; } },
    { id:"linked_projects", label:"Linked Projects", width:200,
      render:(p:any)=>{ const names=((p.project_ids||[]) as string[]).map((id:string)=>projects.find((pr:any)=>pr.id===id)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length?names.join(", "):"—"}</span>; } },
    { id:"link_status", label:"Project Status", width:140,
      sortKey:(p:any)=>linkMap[p.id]?.status||"",
      render:(p:any)=><LinkCell value={linkMap[p.id]?.status} type="select" options={LINK_STATUS_OPTIONS} onSave={v=>saveLinkField(p.id,"status",v)}/> },
    { id:"link_notes", label:"Project Notes", width:200,
      render:(p:any)=><LinkCell value={linkMap[p.id]?.notes} onSave={v=>saveLinkField(p.id,"notes",v)}/> },
    { id:"unlink", label:"", width:44,
      render:(p:any)=><button type="button" onClick={e=>{e.stopPropagation();handleUnlink(p.id);}} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [projects, linkMap]);

  useEffect(() => {
    setOptions({
      items: [
        { label:"Link Style", icon:Plus, onClick:()=>setShowLink(true), className:"text-primary hover:bg-primary/10" },
        { divider:true },
        { label:view==="grid"?"View: List":"View: Grid", icon:view==="grid"?ListIcon:LayoutGrid, onClick:()=>setView(v=>v==="grid"?"list":"grid") },
        { label:"Manage Views", icon:Pencil, onClick:()=>setShowViewMenu(v=>!v) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent pageKey="project_styles" activeViewId={activeViewId}
          onSelectView={id=>{setActiveViewId(id);setShowViewMenu(false);}}
          allFields={view==="grid"?galleryFields:tableColumns}
          currentViewType={view==="grid"?"grid":null}/>
      ) : null,
    });
    return ()=>setOptions(null);
  }, [view, showViewMenu, activeViewId, galleryFields, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search styles…" className="pl-8 h-8 text-xs"/>
        </div>
      </div>
      {filtered.length===0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedStyles.length===0?"No styles linked yet":"No matches"}</p>
        </div>
      ) : view==="grid" ? (
        <GalleryView pageKey="project_styles" allFields={galleryFields} rows={filtered}
          renderThumbnail={(p)=>(
            <div className="w-full h-full bg-muted flex items-center justify-center overflow-hidden group">
              {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"/>
                : <Package className="w-8 h-8 text-muted-foreground/30"/>}
              <button type="button" onClick={e=>{e.stopPropagation();handleUnlink(p.id);}}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 p-1 rounded-full text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3"/>
              </button>
            </div>
          )}
          onClickItem={(p)=>navigate(`/products/${p.id}`)}
          activeViewId={activeViewId} onSelectView={setActiveViewId}/>
      ) : (
        <DataTable columns={tableColumns} rows={filtered}
          onRowClick={(p)=>navigate(`/products/${p.id}`)}
          fixedColumns={["code","name"]}
          {...({activeViewId} as any)}/>
      )}
      <LinkModal open={showLink} onClose={()=>setShowLink(false)} title="Link Styles"
        items={allProducts} alreadyLinkedIds={linkedStyles.map(s=>s.id)}
        onConfirm={handleLink} confirming={linking}
        renderItem={item=>(
          <div className="flex-1 min-w-0">
            <span className="font-medium">{item.name}</span>
            {item.code&&<span className="ml-1.5 text-muted-foreground font-mono">{item.code}</span>}
            {item.type&&<span className="ml-1.5 text-muted-foreground">· {item.type}</span>}
          </div>
        )}/>
    </div>
  );
}

// ── COLORWAYS TAB ────────────────────────────────────────────────────────────
function ColorwaysSection({ projectId, linkedColorways, onRefresh, setOptions }: { projectId:string; linkedColorways:any[]; onRefresh:()=>void; setOptions:any }) {
  const navigate = useNavigate();
  const [allColorways, setAllColorways] = useState<any[]>([]);
  const [techColors, setTechColors] = useState<any[]>([]);
  const [commColors, setCommColors] = useState<any[]>([]);
  const [productMap, setProductMap] = useState<Map<string,any>>(new Map());
  const [linkMap, setLinkMap] = useState<Record<string,any>>({});
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid"|"list">(() => (localStorage.getItem("proj_colorways_view") as any) ?? "grid");
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    supabase.from("product_colors").select("id,color_name,colorway_code,color_hex,colorway_status,product_id,linked_color_id,linked_color_type,linked_tech_color_id,image_url,project_ids,products(name,code)").order("color_name").then(({data})=>setAllColorways(data??[]));
    supabase.from("technical_colors").select("id,hex,code,name").then(({data})=>setTechColors(data??[]));
    supabase.from("commercial_colors").select("id,sub_type,linked_technical_color_ids,code,color_name").then(({data})=>setCommColors(data??[]));
  }, []);

  useEffect(() => {
    if (!linkedColorways.length) return;
    const pIds = [...new Set(linkedColorways.map(c=>c.product_id).filter(Boolean))] as string[];
    if (!pIds.length) return;
    supabase.from("products").select("id,images").in("id",pIds).then(({data})=>{ if(data) setProductMap(new Map(data.map(p=>[p.id,p]))); });
  }, [linkedColorways]);

  useEffect(() => {
    if (!projectId) return;
    supabase.from("product_color_project_links").select("*").eq("project_id", projectId).then(({data}) => {
      const m: Record<string,any> = {};
      (data ?? []).forEach((l: any) => { m[l.product_color_id] = l; });
      setLinkMap(m);
    });
  }, [projectId, linkedColorways.length]);

  const saveLinkField = async (colorwayId: string, field: string, rawValue: any) => {
    const value = field === "forecasted_quantity" ? (rawValue === "" || rawValue === null ? null : Number(rawValue)) : rawValue;
    const existing = linkMap[colorwayId];
    let updated: any;
    if (existing) {
      const { data } = await supabase.from("product_color_project_links").update({ [field]: value }).eq("id", existing.id).select().single();
      updated = data;
    } else {
      const { data } = await supabase.from("product_color_project_links").insert({ product_color_id: colorwayId, project_id: projectId, [field]: value }).select().single();
      updated = data;
    }
    if (updated) setLinkMap(prev => ({ ...prev, [colorwayId]: updated }));
  };

  useEffect(() => { localStorage.setItem("proj_colorways_view", view); }, [view]);

  const getLinkedHexes = (c: any) => {
    const cc = commColors.find(x=>x.id===c.linked_color_id);
    if (!cc || cc.sub_type !== "Combined") return null;
    const hexes = (cc.linked_technical_color_ids||[]).map((id:string)=>techColors.find(t=>t.id===id)?.hex).filter(Boolean) as string[];
    return hexes.length > 1 ? hexes : null;
  };

  const filtered = search.trim() ? linkedColorways.filter(c=>`${c.color_name} ${c.colorway_code}`.toLowerCase().includes(search.toLowerCase())) : linkedColorways;

  const handleLink = async (ids: string[]) => {
    setLinking(true);
    const rows = ids.map(product_color_id=>({product_color_id,project_id:projectId}));
    await supabase.from("product_color_project_links").upsert(rows,{onConflict:"product_color_id,project_id",ignoreDuplicates:true});
    for (const cwId of ids) {
      const {data:cw} = await supabase.from("product_colors").select("project_ids,product_id").eq("id",cwId).single();
      if(cw){
        const cur:string[]=cw.project_ids??[];
        if(!cur.includes(projectId)) await supabase.from("product_colors").update({project_ids:[...cur,projectId]}).eq("id",cwId);
        const {data:prod}=await supabase.from("products").select("project_ids").eq("id",cw.product_id).single();
        const curP:string[]=prod?.project_ids??[];
        if(!curP.includes(projectId)) await supabase.from("products").update({project_ids:[...curP,projectId]}).eq("id",cw.product_id);
      }
    }
    setLinking(false); setShowLink(false); onRefresh();
    toast.success(`${ids.length} colorway${ids.length>1?"s":""} linked`);
  };

  const handleUnlink = async (colorId: string) => {
    await supabase.from("product_color_project_links").delete().eq("product_color_id",colorId).eq("project_id",projectId);
    const {data:cw}=await supabase.from("product_colors").select("project_ids").eq("id",colorId).single();
    if(cw) await supabase.from("product_colors").update({project_ids:(cw.project_ids??[]).filter((id:string)=>id!==projectId)}).eq("id",colorId);
    onRefresh(); toast.success("Colorway unlinked");
  };

  const renderThumb = (c: any) => {
    const product = productMap.get(c.product_id);
    const productImage = product?.images?.[0];
    const useProductFallback = !c.image_url && !!productImage;
    const displayImage = c.image_url || productImage || null;
    const linkedHexes = getLinkedHexes(c);
    return (
      <div className="relative w-full h-full group">
        {displayImage ? <img src={displayImage} alt={c.color_name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"/>
          : linkedHexes ? <div className="w-full h-full flex">{linkedHexes.map((h:string,i:number)=><div key={i} className="flex-1 h-full" style={{backgroundColor:h}}/>)}</div>
          : <div className="w-full h-full" style={{backgroundColor:c.color_hex||"#e5e7eb"}}/>}
        {useProductFallback && (linkedHexes
          ? <div className="absolute bottom-2 left-2 h-5 rounded-md shadow-md border border-white/70 overflow-hidden flex" style={{width:linkedHexes.length*10}}>{linkedHexes.map((h:string,i:number)=><div key={i} className="flex-1 h-full" style={{backgroundColor:h}}/>)}</div>
          : c.color_hex ? <div className="absolute bottom-2 left-2 w-6 h-6 rounded-md border-2 border-white shadow-md" style={{backgroundColor:c.color_hex}}/> : null)}
        <button type="button" onClick={e=>{e.stopPropagation();handleUnlink(c.id);}}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 p-1 rounded-full text-muted-foreground hover:text-destructive">
          <X className="w-3 h-3"/>
        </button>
      </div>
    );
  };

  const ListSwatch = ({ c }: { c: any }) => {
    const linkedHexes = getLinkedHexes(c);
    const product = productMap.get(c.product_id);
    const displayImage = c.image_url || product?.images?.[0] || null;
    return (
      <div className="w-8 h-8 rounded border border-border overflow-hidden bg-muted flex-shrink-0">
        {displayImage ? <img src={displayImage} alt={c.color_name} className="w-full h-full object-contain"/>
          : linkedHexes ? <div className="w-full h-full flex">{linkedHexes.map((h:string,i:number)=><div key={i} className="flex-1 h-full" style={{backgroundColor:h}}/>)}</div>
          : <div className="w-full h-full" style={{backgroundColor:c.color_hex||"#e5e7eb"}}/>}
      </div>
    );
  };

  const galleryFields = useMemo(() => [
    { id:"color_name", label:"Color Name", getValue:(c:any)=>c.color_name, render:(c:any)=><span className="font-medium text-xs">{c.color_name||"—"}</span> },
    { id:"colorway_code", label:"Code", getValue:(c:any)=>c.colorway_code, render:(c:any)=><span className="font-mono text-[10px] text-muted-foreground">{c.colorway_code||"—"}</span> },
    { id:"colorway_status", label:"Status", getValue:(c:any)=>c.colorway_status,
      render:(c:any)=>c.colorway_status ? <span className={`text-[10px] px-1 py-0.5 rounded ${CW_STATUS[c.colorway_status]||"bg-gray-100 text-gray-600"}`}>{c.colorway_status.replace(/_/g," ")}</span> : <span className="text-muted-foreground/40">—</span> },
    { id:"product_name", label:"Style", getValue:(c:any)=>(c as any).products?.name||"",
      render:(c:any)=><span className="text-[10px] text-muted-foreground">{(c as any).products?.name||"—"}</span> },
    { id:"link_forecasted_qty", label:"Fcst. Qty",
      getValue:(c:any)=>linkMap[c.id]?.forecasted_quantity??null,
      render:(c:any)=><LinkCell value={linkMap[c.id]?.forecasted_quantity} type="number" onSave={v=>saveLinkField(c.id,"forecasted_quantity",v)}/> },
    { id:"link_channels", label:"Channels of Trade",
      getValue:(c:any)=>(linkMap[c.id]?.channels_of_trade||[]).join(", "),
      render:(c:any)=><LinkCell value={linkMap[c.id]?.channels_of_trade||[]} type="multiselect" options={["Wholesale","Direct To Customer","E-Commerce","Retail"]} onSave={v=>saveLinkField(c.id,"channels_of_trade",v)}/> },
    { id:"link_status", label:"Project Status",
      getValue:(c:any)=>linkMap[c.id]?.status||"",
      render:(c:any)=><LinkCell value={linkMap[c.id]?.status} type="select" options={LINK_STATUS_OPTIONS} onSave={v=>saveLinkField(c.id,"status",v)}/> },
    { id:"link_notes", label:"Project Notes",
      getValue:(c:any)=>linkMap[c.id]?.notes||"",
      render:(c:any)=><LinkCell value={linkMap[c.id]?.notes} onSave={v=>saveLinkField(c.id,"notes",v)}/> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [linkMap]);

  const tableColumns = useMemo(() => [
    { id:"swatch", label:"Color", width:48, render:(c:any)=><ListSwatch c={c}/> },
    { id:"color_name", label:"Color Name", width:180, sortKey:(c:any)=>c.color_name||"", render:(c:any)=><span className="font-medium text-sm">{c.color_name||"—"}</span> },
    { id:"colorway_code", label:"Code", width:120, sortKey:(c:any)=>c.colorway_code||"", render:(c:any)=><span className="font-mono text-xs text-muted-foreground">{c.colorway_code||"—"}</span> },
    { id:"colorway_status", label:"Status", width:150, sortKey:(c:any)=>c.colorway_status||"",
      render:(c:any)=>c.colorway_status ? <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CW_STATUS[c.colorway_status]||"bg-gray-100 text-gray-600"}`}>{c.colorway_status.replace(/_/g," ")}</span> : <span className="text-muted-foreground/40">—</span> },
    { id:"product_name", label:"Style", width:180, sortKey:(c:any)=>(c as any).products?.name||"",
      render:(c:any)=><span className="text-xs text-muted-foreground">{(c as any).products?.name||"—"}</span> },
    { id:"link_forecasted_qty", label:"Fcst. Qty", width:90,
      sortKey:(c:any)=>linkMap[c.id]?.forecasted_quantity??-1,
      render:(c:any)=><LinkCell value={linkMap[c.id]?.forecasted_quantity} type="number" onSave={v=>saveLinkField(c.id,"forecasted_quantity",v)}/> },
    { id:"link_channels", label:"Channels of Trade", width:200,
      render:(c:any)=><LinkCell value={linkMap[c.id]?.channels_of_trade||[]} type="multiselect" options={["Wholesale","Direct To Customer","E-Commerce","Retail"]} onSave={v=>saveLinkField(c.id,"channels_of_trade",v)}/> },
    { id:"link_status", label:"Project Status", width:140,
      sortKey:(c:any)=>linkMap[c.id]?.status||"",
      render:(c:any)=><LinkCell value={linkMap[c.id]?.status} type="select" options={LINK_STATUS_OPTIONS} onSave={v=>saveLinkField(c.id,"status",v)}/> },
    { id:"link_notes", label:"Project Notes", width:200,
      render:(c:any)=><LinkCell value={linkMap[c.id]?.notes} onSave={v=>saveLinkField(c.id,"notes",v)}/> },
    { id:"unlink", label:"", width:44,
      render:(c:any)=><button type="button" onClick={e=>{e.stopPropagation();handleUnlink(c.id);}} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [commColors, techColors, productMap, linkMap]);

  useEffect(() => {
    setOptions({
      items: [
        { label:"Link Colorway", icon:Plus, onClick:()=>setShowLink(true), className:"text-primary hover:bg-primary/10" },
        { divider:true },
        { label:view==="grid"?"View: List":"View: Grid", icon:view==="grid"?ListIcon:LayoutGrid, onClick:()=>setView(v=>v==="grid"?"list":"grid") },
        { label:"Manage Views", icon:Pencil, onClick:()=>setShowViewMenu(v=>!v) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent pageKey="project_colorways" activeViewId={activeViewId}
          onSelectView={id=>{setActiveViewId(id);setShowViewMenu(false);}}
          allFields={view==="grid"?galleryFields:tableColumns}
          currentViewType={view==="grid"?"grid":null}/>
      ) : null,
    });
    return ()=>setOptions(null);
  }, [view, showViewMenu, activeViewId, galleryFields, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search colorways…" className="pl-8 h-8 text-xs"/>
        </div>
      </div>
      {filtered.length===0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Palette className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedColorways.length===0?"No colorways linked yet":"No matches"}</p>
        </div>
      ) : view==="grid" ? (
        <GalleryView pageKey="project_colorways" allFields={galleryFields} rows={filtered}
          renderThumbnail={renderThumb}
          onClickItem={(c)=>c.product_id&&navigate(`/products/${c.product_id}`)}
          activeViewId={activeViewId} onSelectView={setActiveViewId}/>
      ) : (
        <DataTable columns={tableColumns} rows={filtered}
          onRowClick={(c)=>c.product_id&&navigate(`/products/${c.product_id}`)}
          fixedColumns={["swatch","color_name"]}
          {...({activeViewId} as any)}/>
      )}
      <LinkModal open={showLink} onClose={()=>setShowLink(false)} title="Link Colorways"
        items={allColorways} alreadyLinkedIds={linkedColorways.map(c=>c.id)}
        onConfirm={handleLink} confirming={linking}
        renderItem={item=>(
          <>
            <div className="w-5 h-5 rounded shrink-0 border border-border" style={{backgroundColor:item.color_hex||"#e5e7eb"}}/>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{item.color_name||"—"}</span>
              {item.colorway_code&&<span className="ml-1 font-mono text-muted-foreground">{item.colorway_code}</span>}
              {(item as any).products?.name&&<span className="ml-1 text-muted-foreground">· {(item as any).products.name}</span>}
            </div>
          </>
        )}/>
    </div>
  );
}

// ── VARIATIONS TAB ───────────────────────────────────────────────────────────
function VariationsSection({ projectId, linkedVariations, onRefresh, setOptions }: { projectId:string; linkedVariations:any[]; onRefresh:()=>void; setOptions:any }) {
  const navigate = useNavigate();
  const [allVariations, setAllVariations] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [linkMap, setLinkMap] = useState<Record<string,any>>({});
  const [channelOptions, setChannelOptions] = useState<string[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid"|"list">(() => (localStorage.getItem("proj_variations_view") as any) ?? "list");
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    supabase.from("product_color_and_more").select("id,name,sequence,pack_code,variant,color_hex,image_url,product_color_id,size_ids,product_colors(color_name,colorway_code,color_hex,products(name,images))").order("created_at",{ascending:false}).then(({data})=>setAllVariations(data??[]));
    supabase.from("sizes").select("id,name,size_code").then(({data})=>setSizes(data??[]));
    supabase.from("type_of_lov").select("id,code").eq("code","ChannelOfTrade").single().then(({data:lov})=>{
      if (!lov) return;
      supabase.from("list_of_values").select("name").eq("type_of_lov_id",lov.id).order("name").then(({data:vals})=>{
        if (vals) setChannelOptions(vals.map((v:any)=>v.name));
      });
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    supabase.from("product_color_and_more_project_links").select("*").eq("project_id", projectId).then(({data}) => {
      const m: Record<string,any> = {};
      (data ?? []).forEach((l: any) => { m[l.product_color_and_more_id] = l; });
      setLinkMap(m);
    });
  }, [projectId, linkedVariations.length]);

  const saveLinkField = async (variationId: string, field: string, rawValue: any) => {
    const value = (field === "channels_of_trade" || field === "distribution_channels") ? rawValue
      : field === "forecasted_quantity" ? (rawValue === "" || rawValue === null ? null : Number(rawValue))
      : rawValue;
    const existing = linkMap[variationId];
    let updated: any;
    if (existing) {
      const { data } = await supabase.from("product_color_and_more_project_links").update({ [field]: value }).eq("id", existing.id).select().single();
      updated = data;
    } else {
      const { data } = await supabase.from("product_color_and_more_project_links").insert({ product_color_and_more_id: variationId, project_id: projectId, [field]: value }).select().single();
      updated = data;
    }
    if (updated) setLinkMap(prev => ({ ...prev, [variationId]: updated }));
  };

  useEffect(() => { localStorage.setItem("proj_variations_view", view); }, [view]);
  const getSizes = (v: any) => ((v.size_ids||[]) as string[]).map((sid:string)=>sizes.find(s=>s.id===sid)).filter(Boolean);
  const filtered = search.trim() ? linkedVariations.filter(v=>`${v.name||""} ${v.sequence||""} ${v.pack_code||""} ${v.variant||""}`.toLowerCase().includes(search.toLowerCase())) : linkedVariations;

  const handleLink = async (ids: string[]) => {
    setLinking(true);
    const rows = ids.map(product_color_and_more_id=>({product_color_and_more_id,project_id:projectId}));
    await supabase.from("product_color_and_more_project_links").upsert(rows,{onConflict:"product_color_and_more_id,project_id",ignoreDuplicates:true});
    setLinking(false); setShowLink(false); onRefresh();
    toast.success(`${ids.length} variation${ids.length>1?"s":""} linked`);
  };

  const handleUnlink = async (varId: string) => {
    await supabase.from("product_color_and_more_project_links").delete().eq("product_color_and_more_id",varId).eq("project_id",projectId);
    onRefresh(); toast.success("Variation unlinked");
  };

  const renderThumb = (v: any) => {
    const cwColor = (v as any).product_colors?.color_hex;
    const productImg = (v as any).product_colors?.products?.images?.[0];
    const displayImage = v.image_url || productImg;
    const useColorFallback = !displayImage && (v.color_hex || cwColor);
    return (
      <div className="relative w-full h-full group bg-muted overflow-hidden">
        {displayImage ? <img src={displayImage} alt={v.name||v.sequence} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"/>
          : useColorFallback ? <div className="w-full h-full" style={{backgroundColor:v.color_hex||cwColor||"#e5e7eb"}}/>
          : <Layers className="w-8 h-8 text-muted-foreground/30 m-auto"/>}
        {displayImage && (v.color_hex||cwColor) && <div className="absolute bottom-2 left-2 w-6 h-6 rounded-md border-2 border-white shadow-md" style={{backgroundColor:v.color_hex||cwColor}}/>}
        <button type="button" onClick={e=>{e.stopPropagation();handleUnlink(v.id);}}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 p-1 rounded-full text-muted-foreground hover:text-destructive">
          <X className="w-3 h-3"/>
        </button>
      </div>
    );
  };

  const galleryFields = useMemo(() => [
    { id:"sequence", label:"Seq.", getValue:(v:any)=>v.sequence, render:(v:any)=><span className="font-mono text-[10px] text-muted-foreground">{v.sequence||"—"}</span> },
    { id:"name", label:"Name", getValue:(v:any)=>v.name, render:(v:any)=><span className="font-medium text-xs">{v.name||"—"}</span> },
    { id:"pack_code", label:"Pack Code", getValue:(v:any)=>v.pack_code, render:(v:any)=><span className="font-mono text-[10px] text-muted-foreground">{v.pack_code||"—"}</span> },
    { id:"variant", label:"Variant", getValue:(v:any)=>v.variant, render:(v:any)=><span className="text-[10px] text-muted-foreground">{v.variant||"—"}</span> },
    { id:"colorway", label:"Colorway", getValue:(v:any)=>(v as any).product_colors?.color_name||"",
      render:(v:any)=><div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-border shrink-0" style={{backgroundColor:(v as any).product_colors?.color_hex||"#e5e7eb"}}/><span className="text-[10px] text-muted-foreground truncate">{(v as any).product_colors?.color_name||"—"}</span></div> },
    { id:"sizes", label:"Sizes", getValue:(v:any)=>getSizes(v).map((s:any)=>s.name||s.size_code).join(","),
      render:(v:any)=>{ const sz=getSizes(v); return sz.length ? <div className="flex flex-wrap gap-0.5">{sz.slice(0,5).map((s:any)=><span key={s.id} className="text-[9px] px-1 bg-secondary text-secondary-foreground rounded">{s.name||s.size_code}</span>)}{sz.length>5&&<span className="text-[9px] text-muted-foreground">+{sz.length-5}</span>}</div> : <span className="text-muted-foreground/40">—</span>; } },
    { id:"link_forecasted_qty", label:"Fcst. Qty",
      getValue:(v:any)=>linkMap[v.id]?.forecasted_quantity??null,
      render:(v:any)=><LinkCell value={linkMap[v.id]?.forecasted_quantity} type="number" onSave={val=>saveLinkField(v.id,"forecasted_quantity",val)}/> },
    { id:"link_channels", label:"Channels of Trade",
      getValue:(v:any)=>(linkMap[v.id]?.channels_of_trade||[]).join(", "),
      render:(v:any)=><LinkCell value={linkMap[v.id]?.channels_of_trade||[]} type="multiselect" options={channelOptions.length?channelOptions:["Wholesale","Direct To Customer","E-Commerce","Retail"]} onSave={val=>saveLinkField(v.id,"channels_of_trade",val)}/> },
    { id:"link_dist_channels", label:"Distribution Channels",
      getValue:(v:any)=>(linkMap[v.id]?.distribution_channels||[]).join(", "),
      render:(v:any)=><LinkCell value={linkMap[v.id]?.distribution_channels||[]} type="multiselect" options={DIST_CHANNEL_OPTIONS} onSave={val=>saveLinkField(v.id,"distribution_channels",val)}/> },
    { id:"link_status", label:"Project Status",
      getValue:(v:any)=>linkMap[v.id]?.status||"",
      render:(v:any)=><LinkCell value={linkMap[v.id]?.status} type="select" options={LINK_STATUS_OPTIONS} onSave={val=>saveLinkField(v.id,"status",val)}/> },
    { id:"link_notes", label:"Project Notes",
      getValue:(v:any)=>linkMap[v.id]?.notes||"",
      render:(v:any)=><LinkCell value={linkMap[v.id]?.notes} onSave={val=>saveLinkField(v.id,"notes",val)}/> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sizes, linkMap, channelOptions]);

  const tableColumns = useMemo(() => [
    { id:"swatch", label:"", width:36,
      render:(v:any)=>{ const hex=v.color_hex||(v as any).product_colors?.color_hex; return <div className="w-5 h-5 rounded border border-border shrink-0" style={{backgroundColor:hex||"#e5e7eb"}}/>; } },
    { id:"sequence", label:"Seq.", width:80, sortKey:(v:any)=>v.sequence||"", render:(v:any)=><span className="font-mono text-xs text-muted-foreground">{v.sequence||"—"}</span> },
    { id:"name", label:"Name", width:180, sortKey:(v:any)=>v.name||"", render:(v:any)=><span className="font-medium text-sm">{v.name||"—"}</span> },
    { id:"pack_code", label:"Pack Code", width:110, sortKey:(v:any)=>v.pack_code||"", render:(v:any)=><span className="font-mono text-xs text-muted-foreground">{v.pack_code||"—"}</span> },
    { id:"variant", label:"Variant", width:110, sortKey:(v:any)=>v.variant||"", render:(v:any)=><span className="text-xs text-muted-foreground">{v.variant||"—"}</span> },
    { id:"colorway", label:"Colorway", width:160, sortKey:(v:any)=>(v as any).product_colors?.color_name||"",
      render:(v:any)=><div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{backgroundColor:(v as any).product_colors?.color_hex||"#e5e7eb"}}/><span className="text-xs text-muted-foreground">{(v as any).product_colors?.color_name||"—"}</span></div> },
    { id:"sizes", label:"Sizes", width:180,
      render:(v:any)=>{ const sz=getSizes(v); return sz.length ? <div className="flex flex-wrap gap-0.5">{sz.slice(0,6).map((s:any)=><span key={s.id} className="text-[10px] px-1 bg-secondary text-secondary-foreground rounded">{s.name||s.size_code}</span>)}{sz.length>6&&<span className="text-[10px] text-muted-foreground">+{sz.length-6}</span>}</div> : <span className="text-muted-foreground/40">—</span>; } },
    { id:"link_forecasted_qty", label:"Fcst. Qty", width:90,
      sortKey:(v:any)=>linkMap[v.id]?.forecasted_quantity??-1,
      render:(v:any)=><LinkCell value={linkMap[v.id]?.forecasted_quantity} type="number" onSave={val=>saveLinkField(v.id,"forecasted_quantity",val)}/> },
    { id:"link_channels", label:"Channels of Trade", width:200,
      render:(v:any)=><LinkCell value={linkMap[v.id]?.channels_of_trade||[]} type="multiselect" options={channelOptions.length?channelOptions:["Wholesale","Direct To Customer","E-Commerce","Retail"]} onSave={val=>saveLinkField(v.id,"channels_of_trade",val)}/> },
    { id:"link_dist_channels", label:"Distribution Channels", width:180,
      render:(v:any)=><LinkCell value={linkMap[v.id]?.distribution_channels||[]} type="multiselect" options={DIST_CHANNEL_OPTIONS} onSave={val=>saveLinkField(v.id,"distribution_channels",val)}/> },
    { id:"link_status", label:"Project Status", width:140,
      sortKey:(v:any)=>linkMap[v.id]?.status||"",
      render:(v:any)=><LinkCell value={linkMap[v.id]?.status} type="select" options={LINK_STATUS_OPTIONS} onSave={val=>saveLinkField(v.id,"status",val)}/> },
    { id:"link_notes", label:"Project Notes", width:200,
      render:(v:any)=><LinkCell value={linkMap[v.id]?.notes} onSave={val=>saveLinkField(v.id,"notes",val)}/> },
    { id:"unlink", label:"", width:44,
      render:(v:any)=><button type="button" onClick={e=>{e.stopPropagation();handleUnlink(v.id);}} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sizes, linkMap, channelOptions]);

  useEffect(() => {
    setOptions({
      items: [
        { label:"Link Variation", icon:Plus, onClick:()=>setShowLink(true), className:"text-primary hover:bg-primary/10" },
        { divider:true },
        { label:view==="grid"?"View: List":"View: Grid", icon:view==="grid"?ListIcon:LayoutGrid, onClick:()=>setView(v=>v==="grid"?"list":"grid") },
        { label:"Manage Views", icon:Pencil, onClick:()=>setShowViewMenu(v=>!v) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent pageKey="project_variations" activeViewId={activeViewId}
          onSelectView={id=>{setActiveViewId(id);setShowViewMenu(false);}}
          allFields={view==="grid"?galleryFields:tableColumns}
          currentViewType={view==="grid"?"grid":null}/>
      ) : null,
    });
    return ()=>setOptions(null);
  }, [view, showViewMenu, activeViewId, galleryFields, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search variations…" className="pl-8 h-8 text-xs"/>
        </div>
      </div>
      {filtered.length===0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedVariations.length===0?"No variations linked yet":"No matches"}</p>
        </div>
      ) : view==="grid" ? (
        <GalleryView pageKey="project_variations" allFields={galleryFields} rows={filtered}
          renderThumbnail={renderThumb}
          onClickItem={undefined}
          activeViewId={activeViewId} onSelectView={setActiveViewId}/>
      ) : (
        <DataTable columns={tableColumns} rows={filtered}
          fixedColumns={["swatch","sequence","name"]}
          {...({activeViewId} as any)}/>
      )}
      <LinkModal open={showLink} onClose={()=>setShowLink(false)} title="Link Variations"
        items={allVariations} alreadyLinkedIds={linkedVariations.map(v=>v.id)}
        onConfirm={handleLink} confirming={linking}
        renderItem={item=>(
          <>
            {item.color_hex&&<div className="w-4 h-4 rounded shrink-0 border border-border" style={{backgroundColor:item.color_hex}}/>}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">{item.name||item.sequence||"—"}</span>
                {item.pack_code&&<span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">{item.pack_code}</span>}
                {item.variant&&<span className="text-[10px] text-muted-foreground">{item.variant}</span>}
              </div>
              {item.product_colors?.color_name&&<span className="text-[10px] text-muted-foreground">↳ {item.product_colors.color_name}{item.product_colors?.products?.name?` · ${item.product_colors.products.name}`:""}</span>}
              {(item.size_ids?.length>0)&&(
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {(item.size_ids as string[]).slice(0,8).map((sid:string)=>{ const sz=sizes.find(s=>s.id===sid); return sz?<span key={sid} className="text-[10px] px-1 py-0 bg-secondary text-secondary-foreground rounded">{sz.name||sz.size_code}</span>:null; })}
                  {item.size_ids.length>8&&<span className="text-[10px] text-muted-foreground">+{item.size_ids.length-8}</span>}
                </div>
              )}
            </div>
          </>
        )}/>
    </div>
  );
}


// ── PALETTES TAB ─────────────────────────────────────────────────────────────
function PalettesSection({ projectId, setOptions }: { projectId: string; setOptions: any }) {
  type Tech2 = { id:string; code:string; name:string; hex:string|null; rgb:string|null; cmyk:string|null; rgb_r?:number|null; rgb_g?:number|null; rgb_b?:number|null; color_group:string|null; color_sub_group:string|null; };
  type Comm2 = { id:string; sub_type:string; code:string; color_name:string; main_technical_color_id:string|null; linked_technical_color_ids:string[]|null; };
  type Pal2 = { id:string; name:string; project_id:string|null; };
  type PalColor2 = { id:string; palette_id:string; color_type:"technical"|"commercial"; color_id:string; sort_order:number; };
  type Swatch2 = { hex:string; code:string; name:string; linkedHexes?:string[]; };

  const SIZE_CFGS = {
    S:{ cols:"grid-cols-3 sm:grid-cols-4 lg:grid-cols-5", cls:"text-[10px]", codeClass:"text-[9px]" },
    M:{ cols:"grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", cls:"text-xs", codeClass:"text-[10px]" },
    L:{ cols:"grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", cls:"text-sm", codeClass:"text-xs" },
  };

  const [palettes, setPalettes] = useState<Pal2[]>([]);
  const [paletteColors, setPaletteColors] = useState<PalColor2[]>([]);
  const [tech, setTech] = useState<Tech2[]>([]);
  const [comm, setComm] = useState<Comm2[]>([]);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string|null>(null);
  const [linkingTechColor, setLinkingTechColor] = useState<Tech2|null>(null);
  const [showAddColor, setShowAddColor] = useState(false);
  const [palDialog, setPalDialog] = useState(false);
  const [editingPal, setEditingPal] = useState<Pal2|null>(null);
  const [palFormName, setPalFormName] = useState("");
  const [palSaving, setPalSaving] = useState(false);
  const [deletePal, setDeletePal] = useState<Pal2|null>(null);
  const [paletteCardSize, setPaletteCardSize] = useState<"S"|"M"|"L">(() => {
    try { return (localStorage.getItem("palette_card_size") as any)||"M"; } catch { return "M"; }
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [p, pc, t, c] = await Promise.all([
      supabase.from("color_palettes").select("*").eq("project_id",projectId).order("name"),
      supabase.from("color_palette_colors").select("*").order("sort_order"),
      supabase.from("technical_colors").select("*").order("code"),
      supabase.from("commercial_colors").select("*").order("code"),
    ]);
    setPalettes((p.data??[]) as Pal2[]);
    setPaletteColors((pc.data??[]) as PalColor2[]);
    setTech((t.data??[]) as Tech2[]);
    setComm((c.data??[]) as Comm2[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const techMap = useMemo(()=>Object.fromEntries(tech.map(t=>[t.id,t])), [tech]);
  const commMap = useMemo(()=>Object.fromEntries(comm.map(c=>[c.id,c])), [comm]);

  const resolveSwatch = (pc: PalColor2): Swatch2 => {
    if (pc.color_type==="technical") {
      const t=techMap[pc.color_id];
      return { hex:colorToHex(t), code:t?.code??"?", name:t?.name??"Unknown" };
    }
    const c=commMap[pc.color_id];
    if (!c) return { hex:"#cccccc", code:"?", name:"Unknown" };
    const mainHex=colorToHex(c.main_technical_color_id?techMap[c.main_technical_color_id]:null);
    const ids=c.sub_type?.toLowerCase()==="combined"&&c.linked_technical_color_ids?.length?c.linked_technical_color_ids:null;
    const linkedHexes=ids?ids.map((id:string)=>colorToHex(techMap[id])):undefined;
    return { hex:mainHex, code:c.code, name:c.color_name, linkedHexes };
  };

  const getSwatchData = (palId: string): Swatch2[] => {
    const colors=paletteColors.filter(pc=>pc.palette_id===palId).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0));
    const commEntries=colors.filter(e=>e.color_type==="commercial");
    const commColorIds=new Set(commEntries.map(e=>e.color_id));
    const result:Swatch2[]=[];
    for (const e of commEntries) {
      const c=commMap[e.color_id]; if(!c) continue;
      const ids=c.sub_type?.toLowerCase()==="combined"&&c.linked_technical_color_ids?.length?c.linked_technical_color_ids:null;
      const linkedHexes=ids?ids.map((id:string)=>colorToHex(techMap[id])):undefined;
      result.push({hex:colorToHex(c.main_technical_color_id?techMap[c.main_technical_color_id]:null),name:c.color_name,code:c.code,linkedHexes});
    }
    for (const e of colors.filter(e=>e.color_type==="technical")) {
      const linkedComm=comm.find(c=>(c.main_technical_color_id===e.color_id||(c.linked_technical_color_ids??[]).includes(e.color_id))&&commColorIds.has(c.id));
      if (linkedComm) continue;
      const t=techMap[e.color_id]; if(!t) continue;
      result.push({hex:colorToHex(t),name:t.name,code:t.code});
    }
    return result;
  };

  const selectedColors=useMemo(()=>paletteColors.filter(pc=>pc.palette_id===selectedId).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)),[paletteColors,selectedId]);

  const exportASE = () => {
    if (!selectedId) return;
    const swatches=getSwatchData(selectedId); if(!swatches.length) return;
    const palette=palettes.find(p=>p.id===selectedId);
    const hexToRgb=(hex:string)=>{ const h=hex.replace("#",""); return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]; };
    const colorBlocks=swatches.map(s=>{
      const name=s.name||s.code||"Color"; const nc=name.length+1; const nb=nc*2;
      const bds=2+nb+4+12+2; const block=new ArrayBuffer(2+4+bds); const v=new DataView(block); let o=0;
      v.setUint16(o,0x0001);o+=2;v.setUint32(o,bds);o+=4;v.setUint16(o,nc);o+=2;
      for(let i=0;i<name.length;i++){v.setUint16(o,name.charCodeAt(i));o+=2;}
      v.setUint16(o,0);o+=2;v.setUint8(o,0x52);v.setUint8(o+1,0x47);v.setUint8(o+2,0x42);v.setUint8(o+3,0x20);o+=4;
      const[r,g,b]=hexToRgb(s.hex||"#cccccc");v.setFloat32(o,r);o+=4;v.setFloat32(o,g);o+=4;v.setFloat32(o,b);o+=4;v.setUint16(o,0);
      return block;
    });
    const hdr=new ArrayBuffer(12); const hv=new DataView(hdr);
    hv.setUint8(0,0x41);hv.setUint8(1,0x53);hv.setUint8(2,0x45);hv.setUint8(3,0x46);hv.setUint16(4,1);hv.setUint16(6,0);hv.setUint32(8,colorBlocks.length);
    const tot=12+colorBlocks.reduce((s,b)=>s+b.byteLength,0); const combined=new Uint8Array(tot); let off=0;
    combined.set(new Uint8Array(hdr),off);off+=12;
    for(const b of colorBlocks){combined.set(new Uint8Array(b),off);off+=b.byteLength;}
    const blob=new Blob([combined],{type:"application/octet-stream"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url;a.download=`${palette?.name?.replace(/\s+/g,"_")||"palette"}.ase`;a.click();URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const swatches=selectedId?getSwatchData(selectedId):[];
    setOptions({
      items:[
        {label:"New Palette",icon:Plus,onClick:()=>{setEditingPal(null);setPalFormName("");setPalDialog(true);},className:"text-primary hover:bg-primary/10"},
        ...(selectedId?[
          {divider:true},
          {label:"Add Color",icon:Plus,onClick:()=>setShowAddColor(true)},
          {divider:true},
          {label:"S",onClick:()=>{setPaletteCardSize("S");localStorage.setItem("palette_card_size","S");},className:`px-2 py-1 text-xs font-medium rounded border ${paletteCardSize==="S"?"bg-primary text-primary-foreground border-primary":"border-border hover:bg-muted"}`},
          {label:"M",onClick:()=>{setPaletteCardSize("M");localStorage.setItem("palette_card_size","M");},className:`px-2 py-1 text-xs font-medium rounded border ${paletteCardSize==="M"?"bg-primary text-primary-foreground border-primary":"border-border hover:bg-muted"}`},
          {label:"L",onClick:()=>{setPaletteCardSize("L");localStorage.setItem("palette_card_size","L");},className:`px-2 py-1 text-xs font-medium rounded border ${paletteCardSize==="L"?"bg-primary text-primary-foreground border-primary":"border-border hover:bg-muted"}`},
          ...(swatches.length>0?[{divider:true},{label:"Export .ase",icon:Download,onClick:exportASE}]:[]),
        ]:[]),
      ],
    });
    return ()=>setOptions(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedId,paletteCardSize,palettes,paletteColors,setOptions]);

  const addColorToPalette = async (type:"technical"|"commercial", colorId:string) => {
    if (!selectedId) return;
    const existing=selectedColors.find(c=>c.color_type===type&&c.color_id===colorId);
    if (existing) return;
    const maxSort=selectedColors.reduce((m,c)=>Math.max(m,c.sort_order??0),-1);
    await supabase.from("color_palette_colors").insert({palette_id:selectedId,color_type:type,color_id:colorId,sort_order:maxSort+1});
    loadData();
  };

  const removeColor = async (pc:PalColor2) => {
    await supabase.from("color_palette_colors").delete().eq("id",pc.id);
    loadData();
  };

  const onDragStart=(id:string)=>setDragId(id);
  const onDragOver=(e:React.DragEvent)=>e.preventDefault();
  const onDrop=async(targetId:string)=>{
    if(!dragId||dragId===targetId){setDragId(null);return;}
    const reordered=[...selectedColors];
    const fi=reordered.findIndex(c=>c.id===dragId); const ti=reordered.findIndex(c=>c.id===targetId);
    if(fi===-1||ti===-1){setDragId(null);return;}
    const[moved]=reordered.splice(fi,1); reordered.splice(ti,0,moved);
    setDragId(null);
    setPaletteColors(prev=>prev.map(pc=>{const ni=reordered.findIndex(c=>c.id===pc.id);return ni!==-1?{...pc,sort_order:ni}:pc;}));
    await Promise.all(reordered.map((c,i)=>supabase.from("color_palette_colors").update({sort_order:i}).eq("id",c.id)));
  };

  const savePalette=async()=>{
    if(!palFormName.trim())return;
    setPalSaving(true);
    if(editingPal){await supabase.from("color_palettes").update({name:palFormName.trim()}).eq("id",editingPal.id);}
    else{const{data}=await supabase.from("color_palettes").insert({name:palFormName.trim(),project_id:projectId}).select().single();if(data)setSelectedId(data.id);}
    setPalSaving(false);setPalDialog(false);loadData();
    toast.success(editingPal?"Palette updated":"Palette created");
  };

  const doDeletePalette=async()=>{
    if(!deletePal)return;
    await supabase.from("color_palette_colors").delete().eq("palette_id",deletePal.id);
    await supabase.from("color_palettes").delete().eq("id",deletePal.id);
    if(selectedId===deletePal.id)setSelectedId(null);
    setDeletePal(null);loadData();toast.success("Palette deleted");
  };

  const filteredPalettes=useMemo(()=>search.trim()?palettes.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())):palettes,[palettes,search]);
  const selectedPal=palettes.find(p=>p.id===selectedId)??null;
  const selectedSwatches=useMemo(()=>selectedId?getSwatchData(selectedId):[], [selectedId,paletteColors,techMap,commMap]);// eslint-disable-line
  const cfg=SIZE_CFGS[paletteCardSize];

  const renderCard=(pc:PalColor2,opts?:{unlinked?:boolean})=>{
    const r=resolveSwatch(pc);
    const techRow=pc.color_type==="technical"?techMap[pc.color_id]:null;
    return (
      <div
        key={pc.id}
        draggable
        onDragStart={()=>onDragStart(pc.id)}
        onDragOver={onDragOver}
        onDrop={()=>onDrop(pc.id)}
        className={`rounded-xl border overflow-hidden group relative bg-card ${dragId===pc.id?"opacity-50":""} ${opts?.unlinked?"border-amber-300 border-2":"border-border"}`}
      >
        {r.linkedHexes&&r.linkedHexes.length>1
          ?<div className="aspect-square w-full flex">{r.linkedHexes.map((h:string,j:number)=><div key={j} className="flex-1 h-full" style={{backgroundColor:h}}/>)}</div>
          :<div className="aspect-square w-full" style={{backgroundColor:r.hex}}/>}
        <div className={`p-2 space-y-0.5 ${cfg.cls}`}>
          <div className="flex items-center justify-between gap-1">
            <span className={`font-mono ${cfg.codeClass}`}>{r.code}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{pc.color_type}</span>
          </div>
          <div className="font-medium truncate">{r.name}</div>
          {opts?.unlinked&&techRow&&(
            <button type="button" onClick={()=>setLinkingTechColor(techRow)}
              className="w-full mt-1 text-[10px] px-1.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              Link
            </button>
          )}
        </div>
        <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 cursor-grab">
          <svg className="h-4 w-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zM8 12a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zM8 18a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z"/></svg>
        </div>
        <button type="button" onClick={()=>removeColor(pc)}
          className="absolute top-1 right-1 p-0.5 rounded bg-background/80 opacity-0 group-hover:opacity-100 hover:bg-background">
          <X className="h-3.5 w-3.5"/>
        </button>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <div className={`bg-card rounded-xl border border-border p-3 space-y-3 h-[calc(100vh-220px)] flex-col ${selectedId?"hidden lg:flex":"flex"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm">Palettes ({palettes.length})</div>
          <Button size="sm" onClick={()=>{setEditingPal(null);setPalFormName("");setPalDialog(true);}}>
            <Plus className="h-4 w-4 mr-1"/>New
          </Button>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search palettes…" className="h-8 pl-7"/>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredPalettes.length===0&&<div className="text-sm text-muted-foreground text-center py-6">No palettes</div>}
          {filteredPalettes.map(p=>{
            const swatches=getSwatchData(p.id);
            const sel=p.id===selectedId;
            return (
              <div key={p.id} onClick={()=>setSelectedId(p.id)}
                className={`p-2 rounded border cursor-pointer hover:bg-muted/40 group ${sel?"border-primary bg-muted/40":"border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{swatches.length} color{swatches.length!==1?"s":""}</div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={e=>{e.stopPropagation();setEditingPal(p);setPalFormName(p.name);setPalDialog(true);}} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3"/></button>
                    <button type="button" onClick={e=>{e.stopPropagation();setDeletePal(p);}} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3 w-3"/></button>
                  </div>
                </div>
                <div className="h-6 rounded-md overflow-hidden flex mt-2">
                  {swatches.length===0?<div className="w-full bg-muted rounded-md"/>:swatches.slice(0,10).map((s,i)=>
                    s.linkedHexes&&s.linkedHexes.length>1
                      ?<div key={i} className="flex-1 flex overflow-hidden">{s.linkedHexes.map((h:string,j:number)=><div key={j} className="flex-1 h-full" style={{backgroundColor:h}}/>)}</div>
                      :<div key={i} className="flex-1" style={{backgroundColor:s.hex}}/>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`bg-card rounded-xl border border-border p-4 h-[calc(100vh-220px)] flex-col ${selectedId?"flex":"hidden lg:flex"}`}>
        {!selectedPal?(
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a palette to manage its colors</div>
        ):(
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <button type="button" onClick={()=>setSelectedId(null)} className="lg:hidden text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mr-1">←</button>
                <h2 className="text-lg font-semibold truncate">{selectedPal.name}</h2>
                <span className="text-sm text-muted-foreground">({selectedColors.length})</span>
              </div>
              <Button size="sm" onClick={()=>setShowAddColor(true)}><Plus className="h-4 w-4 mr-1"/>Add Color</Button>
            </div>

            {selectedSwatches.length>0&&(
              <div className="h-12 rounded-lg overflow-hidden flex border border-border mb-4">
                {selectedSwatches.map((s,i)=>
                  s.linkedHexes&&s.linkedHexes.length>1
                    ?<div key={i} className="flex-1 flex overflow-hidden" title={s.name||s.code}>{s.linkedHexes.map((h:string,j:number)=><div key={j} className="flex-1 h-full" style={{backgroundColor:h}}/>)}</div>
                    :<div key={i} className="flex-1" style={{backgroundColor:s.hex}} title={s.name||s.code}/>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6">
              {selectedColors.length===0?(
                <div className="h-full flex items-center justify-center text-muted-foreground">No colors in this palette yet</div>
              ):(()=>{
                const commEntries=selectedColors.filter(c=>c.color_type==="commercial");
                const techEntries=selectedColors.filter(c=>c.color_type==="technical");
                const referencedTechIds=new Set<string>();
                commEntries.forEach(ce=>{
                  const cc=commMap[ce.color_id]; if(!cc) return;
                  if(cc.main_technical_color_id) referencedTechIds.add(cc.main_technical_color_id);
                  (cc.linked_technical_color_ids??[]).forEach((id:string)=>referencedTechIds.add(id));
                });
                const unlinkedTech=techEntries.filter(te=>!referencedTechIds.has(te.color_id));
                return (
                  <>
                    {commEntries.length>0&&(
                      <div className={`grid gap-3 ${cfg.cols}`}>
                        {commEntries.map(pc=>renderCard(pc))}
                      </div>
                    )}
                    {unlinkedTech.length>0&&(
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unlinked Technical Colors ({unlinkedTech.length})</div>
                        <div className={`grid gap-3 ${cfg.cols}`}>
                          {unlinkedTech.map(pc=>renderCard(pc,{unlinked:true}))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      <Dialog open={palDialog} onOpenChange={o=>{if(!o){setPalDialog(false);setEditingPal(null);}}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingPal?"Edit Palette":"New Palette"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name *</Label><Input value={palFormName} onChange={e=>setPalFormName(e.target.value)} autoFocus/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPalDialog(false)}>Cancel</Button>
            <Button disabled={palSaving||!palFormName.trim()} onClick={savePalette}>{palSaving?<><Loader2 className="w-4 h-4 animate-spin mr-1"/>Saving…</>:editingPal?"Save":"Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddColorDialogForProject
        open={showAddColor}
        onOpenChange={setShowAddColor}
        tech={tech as any}
        comm={comm as any}
        techMap={techMap}
        existing={selectedColors}
        onAdd={addColorToPalette}
        onReload={loadData}
        paletteId={selectedId}
        setCommColors={(fn:any)=>setComm(typeof fn==="function"?fn(comm):fn)}
      />

      {linkingTechColor&&(
        <LinkCommercialColorDialog
          techColor={linkingTechColor}
          commColors={comm as any}
          setCommColors={(fn:any)=>setComm(typeof fn==="function"?fn(comm):fn)}
          onClose={()=>{setLinkingTechColor(null);loadData();}}
          paletteId={selectedId}
          setPaletteColors={(fn:any)=>setPaletteColors(typeof fn==="function"?fn(paletteColors):fn)}
          tech={tech as any}
        />
      )}

      <AlertDialog open={!!deletePal} onOpenChange={o=>!o&&setDeletePal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete palette?</AlertDialogTitle><AlertDialogDescription>"{deletePal?.name}" will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={doDeletePalette}>Delete</AlertDialogAction></AlertFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddColorDialogForProject({
  open, onOpenChange, tech, comm, techMap, existing, onAdd, onReload, paletteId, setCommColors,
}: {
  open:boolean; onOpenChange:(b:boolean)=>void;
  tech:any[]; comm:any[]; techMap:Record<string,any>;
  existing:any[]; onAdd:(type:"technical"|"commercial",id:string)=>void;
  onReload:()=>void|Promise<void>; paletteId:string|null;
  setCommColors:(fn:any)=>void;
}) {
  const [tab, setTab] = useState<"technical"|"commercial">("technical");
  const [q, setQ] = useState("");
  const [showTechNew, setShowTechNew] = useState(false);
  const [showCommNew, setShowCommNew] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSubType, setNewSubType] = useState("Solid");
  const [newMainTech, setNewMainTech] = useState<any>(null);
  const [newLinkedIds, setNewLinkedIds] = useState<string[]>([]);
  const [newCodeError, setNewCodeError] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);

  const regenCommCode=async()=>{
    const{data,error}=await supabase.rpc("generate_code",{p_entity_name:"CommercialColor",p_entity_type:""});
    if(!error&&data) setNewCode(String(data));
  };
  useEffect(()=>{ if(showCommNew&&!newCode) regenCommCode(); },[showCommNew]);// eslint-disable-line
  useEffect(()=>{ if(newSubType==="Combined"&&newMainTech&&!newLinkedIds.includes(newMainTech.id)) setNewLinkedIds([newMainTech.id,...newLinkedIds]); },[newSubType,newMainTech]);// eslint-disable-line

  const resetComm=()=>{ setNewCode("");setNewName("");setNewSubType("Solid");setNewMainTech(null);setNewLinkedIds([]);setNewCodeError(null); };

  const saveNewComm=async()=>{
    setNewCodeError(null);
    if(!newCode.trim()||!newName.trim()){toast.error("Code and name required");return;}
    const dup=comm.find((c:any)=>c.code.toLowerCase()===newCode.trim().toLowerCase());
    if(dup){setNewCodeError(`Code "${newCode.trim()}" is already used by "${dup.color_name}".`);return;}
    setSaving(true);
    const linkedIds=newSubType==="Combined"?newLinkedIds:newMainTech?[newMainTech.id]:[];
    const{data,error}=await supabase.from("commercial_colors").insert({sub_type:newSubType,code:newCode.trim(),color_name:newName.trim(),main_technical_color_id:newMainTech?.id??null,linked_technical_color_ids:linkedIds}).select().single();
    setSaving(false);
    if(error||!data){toast.error("Create failed: "+error?.message);return;}
    setCommColors((prev:any[])=>[...prev,data]);
    if(paletteId) onAdd("commercial",(data as any).id);
    toast.success("Commercial color created");
    resetComm();setShowCommNew(false);
  };

  const existingTech=new Set(existing.filter(x=>x.color_type==="technical").map(x=>x.color_id));
  const existingComm=new Set(existing.filter(x=>x.color_type==="commercial").map(x=>x.color_id));
  const filteredTech=useMemo(()=>{ const s=q.trim().toLowerCase(); return (s?tech.filter((t:any)=>`${t.code} ${t.name}`.toLowerCase().includes(s)):tech).slice(0,300); },[tech,q]);
  const filteredComm=useMemo(()=>{ const s=q.trim().toLowerCase(); return (s?comm.filter((c:any)=>`${c.code} ${c.color_name}`.toLowerCase().includes(s)):comm).slice(0,300); },[comm,q]);

  const TechPickerInline=({selected,onPick,placeholder,exclude=[]}:{selected:any;onPick:(t:any)=>void;placeholder:string;exclude?:string[]})=>{
    const [sq,setSq]=useState("");
    const filtered=useMemo(()=>(sq?tech.filter((t:any)=>!exclude.includes(t.id)&&`${t.code} ${t.name}`.toLowerCase().includes(sq.toLowerCase())):tech.filter((t:any)=>!exclude.includes(t.id))).slice(0,100),[sq,exclude]);
    if(selected) return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
        <div className="w-4 h-4 rounded-sm" style={{backgroundColor:colorToHex(selected)}}/>
        <span className="text-xs flex-1">{selected.code} – {selected.name}</span>
        <button type="button" onClick={()=>onPick(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>
    );
    return (
      <div className="relative">
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="p-2 border-b border-border"><Input value={sq} onChange={e=>setSq(e.target.value)} placeholder={placeholder} className="h-8 text-xs" autoFocus={false}/></div>
          <div className="max-h-36 overflow-y-auto">
            {filtered.map((t:any)=>(
              <button key={t.id} type="button" onClick={()=>{onPick(t);setSq("");}} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left">
                <div className="w-4 h-4 rounded-sm shrink-0" style={{backgroundColor:colorToHex(t)}}/>
                <span className="text-xs">{t.code} – {t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Color to Palette</DialogTitle></DialogHeader>
          {showCommNew?(
            <div className="space-y-3">
              <div className="text-sm font-medium">New Commercial Color</div>
              <div><Label>Sub-type</Label>
                <Select value={newSubType} onValueChange={setNewSubType}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="Solid">Solid</SelectItem><SelectItem value="Combined">Combined</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Code *</Label>
                <div className="flex gap-2">
                  <Input value={newCode} onChange={e=>{setNewCode(e.target.value);setNewCodeError(null);}} className="font-mono"/>
                  <Button variant="outline" size="icon" onClick={regenCommCode} title="Regenerate"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></Button>
                </div>
                {newCodeError&&<p className="text-xs text-destructive mt-1">{newCodeError}</p>}
              </div>
              <div><Label>Color Name *</Label><Input value={newName} onChange={e=>setNewName(e.target.value)}/></div>
              <div><Label>Main Technical Color</Label>
                <TechPickerInline selected={newMainTech} onPick={(t)=>{setNewMainTech(t);if(t&&newSubType==="Combined"&&!newLinkedIds.includes(t.id))setNewLinkedIds([t.id,...newLinkedIds.filter((x:string)=>x!==t.id)]);}} placeholder="Select technical color"/>
              </div>
              {newSubType==="Combined"&&(
                <div><Label>Linked Technical Colors</Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[44px]">
                    {newLinkedIds.map((id:string)=>{ const t=techMap[id]; if(!t)return null; const isMain=newMainTech?.id===id; return(
                      <div key={id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">
                        <div className="w-3 h-3 rounded-sm border" style={{backgroundColor:colorToHex(t)}}/>
                        <span className="font-mono">{t.code}</span><span className="truncate max-w-[120px]">{t.name}</span>
                        {isMain&&<span className="text-[10px] px-1 border rounded">main</span>}
                        <button onClick={()=>setNewLinkedIds(newLinkedIds.filter((x:string)=>x!==id))} disabled={isMain} className="ml-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed" type="button"><X className="h-3 w-3"/></button>
                      </div>
                    );})}
                    {newLinkedIds.length===0&&<span className="text-xs text-muted-foreground py-1">No linked colors</span>}
                  </div>
                  <div className="mt-2"><TechPickerInline selected={null} onPick={(t)=>{if(t)setNewLinkedIds([...newLinkedIds,t.id]);}} placeholder="Add linked technical color" exclude={newLinkedIds}/></div>
                </div>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={()=>{resetComm();setShowCommNew(false);}}>Back</Button>
                <Button onClick={saveNewComm} disabled={saving}>{saving?"Creating…":"Create & Add"}</Button>
              </DialogFooter>
            </div>
          ):(
            <>
              <div className="flex gap-2 border-b border-border pb-2 mb-3">
                {(["technical","commercial"] as const).map(t=>(
                  <button key={t} type="button" onClick={()=>{setTab(t);setQ("");}} className={`text-xs px-3 py-1.5 rounded-md transition-colors ${tab===t?"bg-secondary text-secondary-foreground":"text-muted-foreground hover:bg-muted"}`}>{t==="technical"?"Technical":"Commercial"}</button>
                ))}
              </div>
              <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="h-8 mb-3"/>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto">
                {tab==="technical"?filteredTech.map((t:any)=>{
                  const used=existingTech.has(t.id);
                  return(<button key={t.id} disabled={used} onClick={()=>onAdd("technical",t.id)} className={`rounded border overflow-hidden text-left hover:shadow-md transition ${used?"opacity-40 cursor-not-allowed":""}`}>
                    <div className="aspect-square w-full" style={{backgroundColor:colorToHex(t)}}/>
                    <div className="p-1.5"><div className="font-mono text-[10px] truncate">{t.code}</div><div className="text-[10px] text-muted-foreground truncate">{t.name}</div></div>
                  </button>);
                }):filteredComm.map((c:any)=>{
                  const used=existingComm.has(c.id);
                  const t=c.main_technical_color_id?techMap[c.main_technical_color_id]:null;
                  return(<button key={c.id} disabled={used} onClick={()=>onAdd("commercial",c.id)} className={`rounded border overflow-hidden text-left hover:shadow-md transition ${used?"opacity-40 cursor-not-allowed":""}`}>
                    <div className="aspect-square w-full" style={{backgroundColor:colorToHex(t)}}/>
                    <div className="p-1.5"><div className="font-mono text-[10px] truncate">{c.code}</div><div className="text-[10px] text-muted-foreground truncate">{c.color_name}</div></div>
                  </button>);
                })}
              </div>
              <DialogFooter className="sm:justify-between mt-3">
                <Button variant="outline" onClick={()=>{ if(tab==="technical")setShowTechNew(true); else setShowCommNew(true); }}><Plus className="h-4 w-4 mr-1"/>New</Button>
                <Button variant="outline" onClick={()=>onOpenChange(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {showTechNew&&(
        <Dialog open={showTechNew} onOpenChange={setShowTechNew}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Technical Color</DialogTitle></DialogHeader>
            <NewTechColorForm onSaved={async()=>{ setShowTechNew(false); await onReload(); }} onClose={()=>setShowTechNew(false)}/>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function NewTechColorForm({onSaved,onClose}:{onSaved:(t:any)=>void;onClose:()=>void}) {
  const [code,setCode]=useState("");const[name,setName]=useState("");const[hex,setHex]=useState("#cccccc");const[saving,setSaving]=useState(false);
  const save=async()=>{
    if(!code.trim()||!name.trim()) return;
    setSaving(true);
    const{data,error}=await supabase.from("technical_colors").insert({code:code.trim(),name:name.trim(),hex}).select().single();
    setSaving(false);
    if(!error&&data){toast.success("Technical color created");onSaved(data);}
    else toast.error("Create failed: "+error?.message);
  };
  return(
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Code</Label><Input value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. 19-4150 TCX" required/></div>
        <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={name} onChange={e=>setName(e.target.value)} required/></div>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">HEX</Label>
        <div className="flex gap-2">
          <input type="color" value={hex} onChange={e=>setHex(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer"/>
          <Input value={hex} onChange={e=>setHex(e.target.value)} className="flex-1"/>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={saving||!code.trim()||!name.trim()} onClick={save}>{saving?<><Loader2 className="w-4 h-4 animate-spin mr-1"/>Creating…</>:"Create & Add"}</Button>
      </DialogFooter>
    </div>
  );
}

// ── DC PER COT TAB ───────────────────────────────────────────────────────────
function NumberCell({ value, onSave }: { value: number|null; onSave: (v:number|null)=>void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>(value!=null?String(value):"");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(()=>{ setVal(value!=null?String(value):""); },[value]);
  useEffect(()=>{ if(editing&&ref.current) ref.current.focus(); },[editing]);
  const save = () => { setEditing(false); const num=val===""?null:Number(val); if(num!==(value??null)) onSave(num); };
  if(!editing) return <button type="button" onClick={()=>setEditing(true)} className="text-left text-xs w-full block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">{value!=null?value:"—"}</button>;
  return <input ref={ref} type="number" value={val} onChange={e=>setVal(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape"){setVal(value!=null?String(value):"");setEditing(false);}}} className="text-xs border-0 ring-1 ring-primary rounded px-2 py-1.5 bg-background w-full outline-none"/>;
}

function DCperCOTSection({ projectId, linkedVariations, setOptions }: { projectId:string; linkedVariations:any[]; setOptions:any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDC, setFilterDC] = useState("all");
  const [filterCoT, setFilterCoT] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showStats, setShowStats] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allVariations, setAllVariations] = useState<any[]>([]);
  const [colorways, setColorways] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [linkMap, setLinkMap] = useState<Record<string,any>>({});
  // View management
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [pinnedCols, setPinnedCols] = useState<string[]>(["style","colorway"]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const [dcRows, links, vars, cws, prods] = await Promise.all([
      supabase.from("product_color_and_more_project_dc_cot_links").select("*").eq("project_id", projectId),
      supabase.from("product_color_and_more_project_links").select("*").eq("project_id", projectId),
      supabase.from("product_color_and_more").select("id,name,sequence,pack_code,variant,color_hex,product_color_id,image_url"),
      supabase.from("product_colors").select("id,color_name,colorway_code,color_hex,product_id"),
      supabase.from("products").select("id,name,code,sub_type,category,images"),
    ]);
    setItems(dcRows.data ?? []);
    const m: Record<string,any> = {};
    (links.data ?? []).forEach((l:any) => { m[l.id] = l; });
    setLinkMap(m);
    setAllVariations(vars.data ?? []);
    setColorways(cws.data ?? []);
    setProducts(prods.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const getVar = useCallback((linkId: string) => {
    const link = linkMap[linkId];
    if (!link) return null;
    return allVariations.find(v=>v.id===link.product_color_and_more_id) || null;
  }, [linkMap, allVariations]);

  const getCW = useCallback((v: any) => v ? colorways.find(c=>c.id===v.product_color_id) : null, [colorways]);
  const getProd = useCallback((v: any) => { const cw=getCW(v); return cw ? products.find(p=>p.id===cw.product_id) : null; }, [getCW, products]);

  const updateForecast = async (itemId: string, value: number|null) => {
    await supabase.from("product_color_and_more_project_dc_cot_links").update({ forecasted_quantity: value }).eq("id", itemId);
    setItems(prev => prev.map(i=>i.id===itemId?{...i,forecasted_quantity:value}:i));
  };

  const updateStatus = async (itemId: string, status: string) => {
    await supabase.from("product_color_and_more_project_dc_cot_links").update({ forecast_status: status }).eq("id", itemId);
    setItems(prev => prev.map(i=>i.id===itemId?{...i,forecast_status:status}:i));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const { data: links } = await supabase.from("product_color_and_more_project_links").select("*").eq("project_id", projectId);
    const { data: existing } = await supabase.from("product_color_and_more_project_dc_cot_links").select("*").eq("project_id", projectId);
    const existingKeys = new Set((existing||[]).map((e:any)=>`${e.project_link_id}__${e.distribution_channel}__${e.channel_of_trade}`));
    const toCreate: any[] = [];
    for (const link of (links||[])) {
      for (const dc of (link.distribution_channels||[])) {
        for (const cot of (link.channels_of_trade||[])) {
          const key = `${link.id}__${dc}__${cot}`;
          if (!existingKeys.has(key)) { toCreate.push({ project_link_id: link.id, project_id: projectId, distribution_channel: dc, channel_of_trade: cot }); existingKeys.add(key); }
        }
      }
    }
    if (toCreate.length) await supabase.from("product_color_and_more_project_dc_cot_links").insert(toCreate);
    setGenerating(false);
    loadItems();
    toast.success(toCreate.length > 0 ? `Generated ${toCreate.length} new rows` : "All rows already exist");
  };

  const handleExport = async () => {
    const toExport = selected.size > 0 ? filtered.filter(i=>selected.has(i.id)) : filtered;
    if (!toExport.length) return;
    await Promise.all(toExport.map(i=>supabase.from("product_color_and_more_project_dc_cot_links").update({forecast_status:"In Progress"}).eq("id",i.id)));
    setItems(prev=>prev.map(i=>toExport.some(e=>e.id===i.id)?{...i,forecast_status:"In Progress"}:i));
    const rows = toExport.map(item=>{
      const v=getVar(item.project_link_id); const cw=getCW(v); const prod=getProd(v);
      return {"Item ID":item.id,"Style Name":prod?.name||"","Style Sub-type":prod?.sub_type||"","Colorway Name":cw?.color_name||"","Colorway Code":cw?.colorway_code||"","Sequence":v?.sequence||"","Pack Code":v?.pack_code||"","Variant":v?.variant||"","Distribution Channel":item.distribution_channel||"","Channel of Trade":item.channel_of_trade||"","Forecast Qty":item.forecasted_quantity??""};
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DC per CoT");
    XLSX.writeFile(wb, "dc_per_cot.xlsx");
    setSelected(new Set());
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const updates = rows.filter(r=>r["Item ID"]&&r["Forecast Qty"]!=null&&r["Forecast Qty"]!=="").map(r=>({id:r["Item ID"],qty:Number(r["Forecast Qty"])}));
      await Promise.all(updates.map(u=>supabase.from("product_color_and_more_project_dc_cot_links").update({forecasted_quantity:u.qty,forecast_status:"Done"}).eq("id",u.id)));
      await loadItems();
      toast.success(`Imported ${updates.length} rows`);
    } catch { toast.error("Import failed"); }
    setImporting(false);
  };

  const allDCs = useMemo(()=>[...new Set(items.map(i=>i.distribution_channel).filter(Boolean))].sort(),[items]);
  const allCoTs = useMemo(()=>[...new Set(items.map(i=>i.channel_of_trade).filter(Boolean))].sort(),[items]);

  const filtered = useMemo(()=>items.filter(item=>{
    if(filterDC!=="all"&&item.distribution_channel!==filterDC) return false;
    if(filterCoT!=="all"&&item.channel_of_trade!==filterCoT) return false;
    if(filterStatus!=="all"&&(item.forecast_status||"Not Started")!==filterStatus) return false;
    if(!search.trim()) return true;
    const q=search.toLowerCase(); const v=getVar(item.project_link_id); const cw=getCW(v); const prod=getProd(v);
    return item.distribution_channel?.toLowerCase().includes(q)||item.channel_of_trade?.toLowerCase().includes(q)||prod?.name?.toLowerCase().includes(q)||v?.pack_code?.toLowerCase().includes(q)||cw?.color_name?.toLowerCase().includes(q);
  }),[items,filterDC,filterCoT,filterStatus,search,getVar,getCW,getProd]);

  const totalItems=filtered.length; const doneItems=filtered.filter(i=>i.forecast_status==="Done").length;
  const forecastProgress=totalItems>0?Math.round((doneItems/totalItems)*100):0;
  const qtyByDC=useMemo(()=>{ const m:Record<string,number>={}; filtered.forEach(i=>{if(i.forecast_status==="Done"){m[i.distribution_channel]=(m[i.distribution_channel]||0)+(i.forecasted_quantity||0);}}); return m; },[filtered]);
  const qtyByCoT=useMemo(()=>{ const m:Record<string,number>={}; filtered.forEach(i=>{if(i.forecast_status==="Done"){m[i.channel_of_trade]=(m[i.channel_of_trade]||0)+(i.forecasted_quantity||0);}}); return m; },[filtered]);

  const FORECAST_STATUS_COLORS: Record<string,string> = { "Not Started":"bg-muted text-muted-foreground","In Progress":"bg-blue-100 text-blue-800","Done":"bg-green-100 text-green-800","Revised":"bg-amber-100 text-amber-800" };

  // DataTable columns
  const tableColumns = useMemo(() => [
    { id:"_select", label:"",  width:44,
      render:(item:any)=>(
        <input type="checkbox" className="w-4 h-4 cursor-pointer"
          checked={selected.has(item.id)}
          onChange={e=>{const n=new Set(selected);e.target.checked?n.add(item.id):n.delete(item.id);setSelected(n);}}
          onClick={e=>e.stopPropagation()}/>
      )
    },
    { id:"style", label:"Style", width:180,
      sortKey:(item:any)=>getProd(getVar(item.project_link_id))?.name||"",
      render:(item:any)=>{ const v=getVar(item.project_link_id); const prod=getProd(v); return (
        <div className="flex items-center gap-2">
          {prod?.images?.[0]&&<img src={prod.images[0]} className="w-7 h-7 object-contain rounded border border-border shrink-0" alt=""/>}
          <div><p className="text-xs font-medium">{prod?.name||"—"}</p>{prod?.code&&<p className="text-[10px] font-mono text-muted-foreground">{prod.code}</p>}</div>
        </div>
      );}
    },
    { id:"colorway", label:"Colorway", width:160,
      sortKey:(item:any)=>getCW(getVar(item.project_link_id))?.color_name||"",
      render:(item:any)=>{ const cw=getCW(getVar(item.project_link_id)); return (
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded shrink-0 border border-border" style={{backgroundColor:cw?.color_hex||"#e5e7eb"}}/>
          <span className="text-xs">{cw?.color_name||"—"}</span>
        </div>
      );}
    },
    { id:"sequence", label:"Seq.", width:70,
      sortKey:(item:any)=>getVar(item.project_link_id)?.sequence||"",
      render:(item:any)=><span className="font-mono text-xs text-muted-foreground">{getVar(item.project_link_id)?.sequence||"—"}</span>
    },
    { id:"pack_code", label:"Pack Code", width:110,
      sortKey:(item:any)=>getVar(item.project_link_id)?.pack_code||"",
      render:(item:any)=><span className="text-xs text-muted-foreground">{getVar(item.project_link_id)?.pack_code||"—"}</span>
    },
    { id:"variant", label:"Variant", width:100,
      sortKey:(item:any)=>getVar(item.project_link_id)?.variant||"",
      render:(item:any)=><span className="text-xs text-muted-foreground">{getVar(item.project_link_id)?.variant||"—"}</span>
    },
    { id:"distribution_channel", label:"Distribution Channel", width:170,
      sortKey:(item:any)=>item.distribution_channel||"",
      render:(item:any)=><span className="text-xs font-medium">{item.distribution_channel||"—"}</span>
    },
    { id:"channel_of_trade", label:"Channel of Trade", width:150,
      sortKey:(item:any)=>item.channel_of_trade||"",
      render:(item:any)=><span className="text-xs font-medium">{item.channel_of_trade||"—"}</span>
    },
    { id:"forecasted_quantity", label:"Forecast Qty", width:110,
      sortKey:(item:any)=>item.forecasted_quantity??-1,
      render:(item:any)=><NumberCell value={item.forecasted_quantity} onSave={val=>{updateForecast(item.id,val); if(item.forecast_status==="Done") updateStatus(item.id,"Revised");}}/>
    },
    { id:"forecast_status", label:"Status", width:150,
      sortKey:(item:any)=>item.forecast_status||"",
      render:(item:any)=>(
        <Select value={item.forecast_status||"Not Started"} onValueChange={v=>updateStatus(item.id,v)}>
          <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 hover:bg-muted rounded" onClick={e=>e.stopPropagation()}>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FORECAST_STATUS_COLORS[item.forecast_status||"Not Started"]}`}>{item.forecast_status||"Not Started"}</span>
          </SelectTrigger>
          <SelectContent>
            {["Not Started","In Progress","Done","Revised"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selected, linkMap, allVariations, colorways, products]);

  // Options menu
  useEffect(() => {
    setOptions({
      items: [
        { label: generating?"Generating…":"Generate DC per CoT", icon: Zap, onClick: handleGenerate, className: "text-primary hover:bg-primary/10" },
        { label: "Export XLSX", icon: Download, onClick: handleExport },
        { label: "Import XLSX", icon: Upload, onClick: () => document.getElementById("dc-import-input")?.click() },
        { divider: true },
        { label: showStats?"Hide Stats":"Show Stats", icon: BarChart2, onClick: ()=>setShowStats(v=>!v) },
        { label: "Manage Views", icon: Pencil, onClick: ()=>setShowViewMenu(v=>!v) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent
          pageKey="project_dc_per_cot"
          activeViewId={activeViewId}
          onSelectView={id=>{ setActiveViewId(id); setShowViewMenu(false); }}
          allFields={tableColumns.map(c=>({ id:c.id, label:c.label }))}
          currentViewType={null}
        />
      ) : null,
    });
    return () => setOptions(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, showStats, showViewMenu, activeViewId, tableColumns, selected.size, setOptions]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>;

  return (
    <div className="space-y-4">
      <input id="dc-import-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) handleImport(f); e.target.value="";}}/>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8 text-xs"/>
        </div>
        <Select value={filterDC} onValueChange={setFilterDC}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All DC"/></SelectTrigger>
          <SelectContent><SelectItem value="all">All DC</SelectItem>{allDCs.map(dc=><SelectItem key={dc} value={dc}>{dc}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterCoT} onValueChange={setFilterCoT}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All CoT"/></SelectTrigger>
          <SelectContent><SelectItem value="all">All CoT</SelectItem>{allCoTs.map(cot=><SelectItem key={cot} value={cot}>{cot}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Not Started","In Progress","Done","Revised"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtered.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5"
                checked={filtered.length>0&&selected.size===filtered.length}
                onChange={e=>{ if(e.target.checked) setSelected(new Set(filtered.map(i=>i.id))); else setSelected(new Set()); }}/>
              Select all
            </label>
            {selected.size > 0 && <span className="text-xs text-muted-foreground">{selected.size} selected</span>}
          </div>
        )}
        {importing&&<span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin"/>Importing…</span>}
      </div>

      {(filterDC!=="all"||filterCoT!=="all"||filterStatus!=="all") && (
        <div className="flex flex-wrap gap-1.5">
          {filterDC!=="all"&&<span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">DC: {filterDC}<button type="button" onClick={()=>setFilterDC("all")} className="hover:opacity-70"><X className="w-3 h-3"/></button></span>}
          {filterCoT!=="all"&&<span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">CoT: {filterCoT}<button type="button" onClick={()=>setFilterCoT("all")} className="hover:opacity-70"><X className="w-3 h-3"/></button></span>}
          {filterStatus!=="all"&&<span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Status: {filterStatus}<button type="button" onClick={()=>setFilterStatus("all")} className="hover:opacity-70"><X className="w-3 h-3"/></button></span>}
          <button type="button" onClick={()=>{setFilterDC("all");setFilterCoT("all");setFilterStatus("all");}} className="text-xs text-muted-foreground underline hover:text-foreground">Clear all</button>
        </div>
      )}

      {/* Stats */}
      {showStats&&(
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Forecast Progress</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden"><div className="bg-primary h-full transition-all" style={{width:`${forecastProgress}%`}}/></div>
              <span className="text-lg font-semibold">{forecastProgress}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{doneItems} of {totalItems} done</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Qty by DC</p>
            <div className="space-y-2">{Object.entries(qtyByDC).map(([dc,qty])=><div key={dc} className="flex justify-between text-xs"><span className="text-muted-foreground">{dc}</span><span className="font-semibold">{(qty as number).toLocaleString()}</span></div>)}{Object.keys(qtyByDC).length===0&&<p className="text-xs text-muted-foreground">No completed forecasts</p>}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Qty by CoT</p>
            <div className="space-y-2">{Object.entries(qtyByCoT).map(([cot,qty])=><div key={cot} className="flex justify-between text-xs"><span className="text-muted-foreground">{cot}</span><span className="font-semibold">{(qty as number).toLocaleString()}</span></div>)}{Object.keys(qtyByCoT).length===0&&<p className="text-xs text-muted-foreground">No completed forecasts</p>}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length===0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <BarChart2 className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{items.length===0?"No DC per CoT rows yet. Set Distribution Channels and Channels of Trade on your linked variations, then click \"Generate DC per CoT\" in the Options menu.":"No results match your filters."}</p>
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          fixedColumns={pinnedCols}
          onPinColumn={id=>setPinnedCols(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}
          {...({ activeViewId } as any)}
        />
      )}
    </div>
  );
}

function BOMStatusSection({ linkedStyles }: { linkedStyles:any[] }) {
  const navigate = useNavigate();
  const [boms, setBoms] = useState<any[]>([]);
  const [products, setProducts] = useState<Map<string,any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!linkedStyles.length) { setLoading(false); return; }
    const pIds = linkedStyles.map(s=>s.id);
    supabase.from("boms").select("*").in("product_id",pIds).order("updated_at",{ascending:false})
      .then(({data})=>{ setBoms(data??[]); setProducts(new Map(linkedStyles.map(s=>[s.id,s]))); setLoading(false); });
  }, [linkedStyles]);

  const filtered = useMemo(()=>boms.filter(b=>{
    if(filterType!=="all"&&b.bom_type!==filterType) return false;
    if(filterStatus!=="all"&&b.status!==filterStatus) return false;
    if(search.trim()){
      const prod = products.get(b.product_id);
      if(!`${prod?.name||""} ${prod?.code||""} ${b.revision_code||""} ${b.status}`.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  }),[boms,filterType,filterStatus,search,products]);

  const productsWithoutBOM = linkedStyles.filter(s=>!boms.some(b=>b.product_id===s.id));

  if(loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>;
  if(!linkedStyles.length) return <div className="text-center py-16 text-sm text-muted-foreground">Link styles to this project first to see their BOM status.</div>;

  return (
    <div className="space-y-4">
      {productsWithoutBOM.length>0&&(
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0"/>
          <span>{productsWithoutBOM.length} linked style{productsWithoutBOM.length>1?"s have":" has"} no BOM yet: {productsWithoutBOM.map(p=>p.name).join(", ")}</span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search BOMs…" className="pl-8 h-8 text-xs"/>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="development">Dev</SelectItem><SelectItem value="production">Prod</SelectItem></SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{["draft","in_review","released","superseded","obsolete"].map(s=><SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {filtered.length===0?(
        <div className="text-center py-16 text-sm text-muted-foreground">No BOMs match filters</div>
      ):(
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>{["Style","Type","Rev / Version","Status","Valid From","Valid Until",""].map((h,i)=><th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(b=>{
                const prod=products.get(b.product_id);
                const today=new Date();
                const isActive=b.status==="released"&&(!b.valid_from||!isBefore(today,parseISO(b.valid_from)))&&(!b.valid_until||!isAfter(today,parseISO(b.valid_until)));
                return(
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={()=>navigate(`/boms/${b.id}`)}>
                    <td className="px-4 py-3"><p className="font-medium text-xs">{prod?.name??b.product_id.slice(0,8)}</p>{prod?.code&&<p className="text-[10px] font-mono text-muted-foreground">{prod.code}</p>}</td>
                    <td className="px-4 py-3"><span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{b.bom_type==="production"?"PROD":"DEV"}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">Rev {b.revision_code??"—"} v{b.version}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium ${BOM_STATUS_CONFIG[b.status]||"bg-gray-100 text-gray-600"}`}>{b.status.replace(/_/g," ")}</span>
                        {isActive&&<span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" title="Active today"/>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.valid_from?format(parseISO(b.valid_from),"dd MMM yyyy"):"—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.valid_until?format(parseISO(b.valid_until),"dd MMM yyyy"):"—"}</td>
                    <td className="px-2 py-3"><ExternalLink className="w-3.5 h-3.5 text-muted-foreground"/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SOURCING TAB ─────────────────────────────────────────────────────────────
function SourcingSection({ linkedStyles }: { linkedStyles:any[] }) {
  const navigate = useNavigate();
  const [approvedSuppliers, setApprovedSuppliers] = useState<any[]>([]);
  const [routings, setRoutings] = useState<any[]>([]);
  const [routingSteps, setRoutingSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if(!linkedStyles.length){setLoading(false);return;}
    const pIds=linkedStyles.map(s=>s.id);
    Promise.all([
      supabase.from("approved_suppliers").select("*").in("product_id",pIds),
      supabase.from("supplier_routings").select("*").in("product_id",pIds),
      supabase.from("supplier_routing_steps").select("supplier_routing_id,supplier_id"),
    ]).then(([a,r,s])=>{
      setApprovedSuppliers(a.data??[]);
      setRoutings(r.data??[]);
      setRoutingSteps(s.data??[]);
      setLoading(false);
    });
  },[linkedStyles]);

  const stats=useMemo(()=>{
    if(!linkedStyles.length) return{noSourcing:[],pendingApproval:[],expiringSoon:[],incompleteRoutings:[]};
    const today=new Date(); const in60=new Date(today.getTime()+60*24*60*60*1000);
    return{
      noSourcing: linkedStyles.filter(p=>!approvedSuppliers.some(a=>a.product_id===p.id&&a.is_primary&&a.status==="active")&&!routings.some(r=>r.product_id===p.id&&r.is_default&&r.status==="released")),
      pendingApproval: linkedStyles.filter(p=>approvedSuppliers.some(a=>a.product_id===p.id&&a.is_primary&&a.status==="pending_approval")),
      expiringSoon: linkedStyles.filter(p=>{
        const pri=approvedSuppliers.find(a=>a.product_id===p.id&&a.is_primary);
        if(pri?.valid_until){const d=new Date(pri.valid_until);if(d>=today&&d<=in60)return true;}
        const rt=routings.find(r=>r.product_id===p.id&&r.is_default);
        if(rt?.valid_until){const d=new Date(rt.valid_until);if(d>=today&&d<=in60)return true;}
        return false;
      }),
      incompleteRoutings: linkedStyles.filter(p=>routings.filter(r=>r.product_id===p.id).some(r=>routingSteps.filter(s=>s.supplier_routing_id===r.id).some(s=>!s.supplier_id))),
    };
  },[linkedStyles,approvedSuppliers,routings,routingSteps]);

  if(loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>;
  if(!linkedStyles.length) return <div className="text-center py-16 text-sm text-muted-foreground">Link styles to this project first to see sourcing status.</div>;

  const total=linkedStyles.length;
  const ready=total-(stats.noSourcing?.length||0);
  const pct=total>0?Math.round((ready/total)*100):0;

  const CARDS=[
    {icon:XCircle,label:"No sourcing path",items:stats.noSourcing,color:"bg-red-50/60 border-red-200 text-red-700"},
    {icon:Clock,label:"Pending approval",items:stats.pendingApproval,color:"bg-amber-50/60 border-amber-200 text-amber-700"},
    {icon:AlertTriangle,label:"Expiring within 60 days",items:stats.expiringSoon,color:"bg-orange-50/60 border-orange-200 text-orange-700"},
    {icon:GitBranch,label:"Routings missing suppliers",items:stats.incompleteRoutings,color:"bg-yellow-50/60 border-yellow-200 text-yellow-700"},
  ];

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{ready} of {total} products have an active sourcing path</p>
        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARDS.map(({icon:Icon,label,items,color})=>(
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon className="w-4 h-4"/><span className="text-sm font-semibold">{label}</span></div>
              <span className="text-2xl font-bold">{items?.length||0}</span>
            </div>
            {(items?.length||0)>0&&(
              <div className="mt-2 pt-2 border-t border-current/20 space-y-1 max-h-32 overflow-y-auto">
                {items!.map(p=>(
                  <button key={p.id} type="button" onClick={()=>navigate(`/products/${p.id}`)}
                    className="w-full text-left flex items-center gap-2 py-0.5 hover:opacity-80 text-xs">
                    <div className="w-5 h-5 rounded bg-current/10 flex-shrink-0 overflow-hidden">{p.images?.[0]&&<img src={p.images[0]} className="w-full h-full object-contain" alt=""/>}</div>
                    <span className="truncate font-medium">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DOCUMENTS TAB ────────────────────────────────────────────────────────────
function DocumentsSection({ projectId }: { projectId:string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    const {data}=await supabase.from("uploaded_documents").select("*").eq("project_id",projectId).order("created_at",{ascending:false});
    setDocs(data??[]);setLoading(false);
  },[projectId]);

  useEffect(()=>{load();},[load]);

  const filtered=search.trim()?docs.filter(d=>`${d.original_filename||""} ${d.document_type||""} ${d.collection_name||""}`.toLowerCase().includes(search.toLowerCase())):docs;

  const STATUS_BADGE: Record<string,string>={processed:"bg-green-100 text-green-700",error:"bg-red-100 text-red-700",processing:"bg-blue-100 text-blue-700",staged:"bg-amber-100 text-amber-700",uploaded:"bg-muted text-muted-foreground"};

  if(loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>;

  return(
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents…" className="pl-8 h-8 text-xs"/>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-1.5">
          <Upload className="w-3.5 h-3.5"/><span>Document upload & AI parsing — Domain 9</span>
        </div>
      </div>
      {filtered.length===0?(
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{docs.length===0?"No documents yet":"No matches"}</p>
        </div>
      ):(
        <div className="space-y-2">
          {filtered.map(doc=>(
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.original_filename||"Document"}</p>
                <p className="text-xs text-muted-foreground">{doc.document_type} · {doc.upload_date?new Date(doc.upload_date).toLocaleDateString():"—"}</p>
                {doc.collection_name&&<p className="text-xs text-primary mt-0.5">{doc.collection_name}</p>}
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[doc.status]||STATUS_BADGE.uploaded}`}>
                {doc.status==="processed"?"Processed":doc.status==="error"?"Error":doc.status==="processing"?"Parsing…":doc.status==="staged"?"Staged":"Uploaded"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── STUB SECTION ─────────────────────────────────────────────────────────────
function StubSection({ icon: Icon, label, note }: { icon:any; label:string; note:string }) {
  return(
    <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
      <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{note}</p>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams<{id:string}>();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");

  // Linked data
  const [linkedStyles, setLinkedStyles] = useState<any[]>([]);
  const [linkedColorways, setLinkedColorways] = useState<any[]>([]);
  const [linkedVariations, setLinkedVariations] = useState<any[]>([]);
  const [paletteCount, setPaletteCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [projRes, stylesRes, colorwaysRes, variationsRes, palRes, docRes, sampRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("product_project_links").select("product_id, product:product_id(id,code,name,type,sub_type,category,images)").eq("project_id", id),
      supabase.from("product_color_project_links").select("product_color_id, pc:product_color_id(id,color_name,colorway_code,color_hex,colorway_status,product_id,linked_color_id,linked_color_type,linked_tech_color_id,image_url,project_ids)").eq("project_id", id),
      supabase.from("product_color_and_more_project_links").select("product_color_and_more_id, v:product_color_and_more_id(id,name,sequence,pack_code,variant,color_hex,product_color_id,product_colors(color_name,colorway_code))").eq("project_id", id),
      supabase.from("color_palettes").select("id",{count:"exact",head:true}).eq("project_id", id),
      supabase.from("uploaded_documents").select("id",{count:"exact",head:true}).eq("project_id", id),
      supabase.from("samples").select("id",{count:"exact",head:true}).eq("project_id", id),
    ]);
    setProject(projRes.data);
    setLinkedStyles(((stylesRes.data ?? []) as any[]).map((r:any)=>r.product).filter(Boolean));
    setLinkedColorways(((colorwaysRes.data ?? []) as any[]).map((r:any)=>{const pc=r.pc; if(!pc)return null; return {...pc,product_name:undefined};}).filter(Boolean));
    setLinkedVariations(((variationsRes.data ?? []) as any[]).map((r:any)=>r.v).filter(Boolean));
    setPaletteCount(palRes.count??0);
    setDocCount(docRes.count??0);
    setSampleCount(sampRes.count??0);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Sub-nav
  const subNavItems = useMemo(() => [
    { id:"details",    label:"Details",         icon:Info },
    { id:"styles",     label:"Styles",          count:linkedStyles.length,    icon:Package },
    { id:"colorways",  label:"Colorways",       count:linkedColorways.length, icon:Palette },
    { id:"variations", label:"Variations",      count:linkedVariations.length,icon:Layers },
    { id:"palettes",   label:"Palettes",        count:paletteCount,           icon:SwatchBook },
    { id:"dc_per_cot", label:"DC per CoT",      icon:BarChart2 },
    { id:"bom_status", label:"BOM Status",      icon:ClipboardList },
    { id:"sourcing",   label:"Sourcing",        icon:Building2 },
    { id:"documents",  label:"Documents",       count:docCount,               icon:FileText },
    { id:"boards",     label:"Boards",          icon:LayoutTemplate },
    { id:"rfqs",       label:"Supplier Requests", icon:FileSearch },
    { id:"samples",    label:"Samples",         count:sampleCount,            icon:FlaskConical },
  ], [linkedStyles.length, linkedColorways.length, linkedVariations.length, paletteCount, docCount, sampleCount]);

  useRegisterSubNav(subNavItems, activeTab, setActiveTab, project?.name ?? "Project");

  

  // Auto-save for details
  const updateField = (field: string, value: any) => {
    setProject((p: any) => {
      const updated = { ...p, [field]: value };
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        const { error } = await supabase.from("projects").update({ [field]: value }).eq("id", id!);
        if (error) toast.error("Auto-save failed");
      }, 800);
      return updated;
    });
  };

  const handleDelete = async () => {
    await supabase.from("projects").delete().eq("id", id!);
    navigate("/projects");
    toast.success("Project deleted");
  };

  if (loading) return <div className={`${PAGE_WRAPPER} flex items-center justify-center py-20`}><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div>;
  if (!project) return <div className={`${PAGE_WRAPPER} text-center py-20 text-muted-foreground`}>Project not found</div>;

  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.Planning;

  return (
    <div className={PAGE_WRAPPER}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={()=>navigate("/projects")}><ArrowLeft className="w-4 h-4"/></Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-semibold truncate">{project.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {project.type&&<span className="text-xs text-muted-foreground">{project.type}</span>}
            {project.season&&<span className="text-xs text-muted-foreground">· {project.season}</span>}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{project.status}
            </span>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Tab content */}
      <div className="mt-2">
        {activeTab === "details" && (
          <div className="bg-card rounded-xl border border-border p-5 max-w-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Name</Label><Input value={project.name||""} onChange={e=>updateField("name",e.target.value)}/></div>
              <div className="space-y-1.5"><Label className="text-xs">Type</Label>
                <Select value={project.type||"__none"} onValueChange={v=>updateField("type",v==="__none"?"":v)}>
                  <SelectTrigger><SelectValue placeholder="Select…"/></SelectTrigger>
                  <SelectContent><SelectItem value="__none">—</SelectItem>{TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Season</Label>
                <Select value={project.season||"__none"} onValueChange={v=>updateField("season",v==="__none"?"":v)}>
                  <SelectTrigger><SelectValue placeholder="Select…"/></SelectTrigger>
                  <SelectContent><SelectItem value="__none">—</SelectItem>{SEASONS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Status</Label>
                <Select value={project.status||"Planning"} onValueChange={v=>updateField("status",v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{STATUSES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={project.description||""} onChange={e=>updateField("description",e.target.value)} rows={3}/></div>
            </div>
            <p className="text-[10px] text-muted-foreground">Changes save automatically</p>
          </div>
        )}

        {activeTab === "styles"    && <StylesSection    projectId={id!} linkedStyles={linkedStyles}       onRefresh={loadAll} setOptions={setOptions}/>}
        {activeTab === "colorways" && <ColorwaysSection projectId={id!} linkedColorways={linkedColorways} onRefresh={loadAll} setOptions={setOptions}/>}
        {activeTab === "variations"&& <VariationsSection projectId={id!} linkedVariations={linkedVariations} onRefresh={loadAll} setOptions={setOptions}/>}
        {activeTab === "bom_status"&& <BOMStatusSection linkedStyles={linkedStyles}/>}
        {activeTab === "sourcing"  && <SourcingSection  linkedStyles={linkedStyles}/>}
        {activeTab === "documents" && <DocumentsSection projectId={id!}/>}
        {activeTab === "palettes"  && <PalettesSection projectId={id!} setOptions={setOptions}/>}
        {activeTab === "dc_per_cot"&& <DCperCOTSection projectId={id!} linkedVariations={linkedVariations} setOptions={setOptions}/>}
        {activeTab === "boards"    && <StubSection icon={LayoutTemplate} label="Boards" note="Boards feature coming soon"/>}
        {activeTab === "rfqs"      && <SupplierRequestsSection projectId={id!} setOptions={setOptions} />}
        {activeTab === "samples"   && <StubSection icon={FlaskConical} label="Samples" note="Sample management coming in Domain 7"/>}
      </div>
    </div>
  );
}
