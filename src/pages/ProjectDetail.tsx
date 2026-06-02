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

// ── STYLES TAB ───────────────────────────────────────────────────────────────
function StylesSection({ projectId, linkedStyles, onRefresh, setOptions }: { projectId:string; linkedStyles:any[]; onRefresh:()=>void; setOptions:any }) {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
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
    { id: "code",    label: "Code",     getValue: (p:any) => p.code,     render: (p:any) => <span className="font-mono text-xs text-muted-foreground">{p.code||"—"}</span> },
    { id: "name",    label: "Name",     getValue: (p:any) => p.name,     render: (p:any) => <span className="font-medium text-xs">{p.name}</span> },
    { id: "type",    label: "Type",     getValue: (p:any) => p.type,     render: (p:any) => <span className="text-xs text-muted-foreground">{p.type||"—"}</span> },
    { id: "sub_type",label: "Sub-type", getValue: (p:any) => p.sub_type, render: (p:any) => <span className="text-xs text-muted-foreground">{p.sub_type||"—"}</span> },
    { id: "category",label: "Category", getValue: (p:any) => p.category, render: (p:any) => <span className="text-xs text-muted-foreground">{p.category||"—"}</span> },
    { id: "creation_project", label: "Creation Project",
      getValue: (p:any) => projects.find((pr:any) => pr.id === p.creation_project_id)?.name || "",
      render: (p:any) => { const pr = projects.find((x:any) => x.id === p.creation_project_id); return <span className="text-xs text-muted-foreground">{pr?.name||"—"}</span>; } },
    { id: "linked_projects", label: "Linked Projects",
      getValue: (p:any) => ((p.project_ids||[]) as string[]).map((id:string) => projects.find((pr:any) => pr.id === id)?.name).filter(Boolean).join(", "),
      render: (p:any) => { const names = ((p.project_ids||[]) as string[]).map((id:string) => projects.find((pr:any) => pr.id === id)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length ? names.join(", ") : "—"}</span>; } },
  ], [projects]);

  const tableColumns = useMemo(() => [
    { id:"code",    label:"Code",     width:110, sortKey:(p:any)=>p.code||"",     render:(p:any)=><span className="font-mono text-xs text-muted-foreground">{p.code||"—"}</span> },
    { id:"name",    label:"Name",     width:200, sortKey:(p:any)=>p.name||"",     render:(p:any)=><span className="font-medium text-sm">{p.name}</span> },
    { id:"type",    label:"Type",     width:140, sortKey:(p:any)=>p.type||"",     render:(p:any)=><span className="text-xs text-muted-foreground">{p.type||"—"}</span> },
    { id:"sub_type",label:"Sub-type", width:130, sortKey:(p:any)=>p.sub_type||"", render:(p:any)=><span className="text-xs text-muted-foreground">{p.sub_type||"—"}</span> },
    { id:"category",label:"Category", width:130, sortKey:(p:any)=>p.category||"", render:(p:any)=><span className="text-xs text-muted-foreground">{p.category||"—"}</span> },
    { id:"creation_project", label:"Creation Project", width:160,
      sortKey:(p:any)=>projects.find((pr:any)=>pr.id===p.creation_project_id)?.name||"",
      render:(p:any)=>{ const pr=projects.find((x:any)=>x.id===p.creation_project_id); return <span className="text-xs text-muted-foreground">{pr?.name||"—"}</span>; } },
    { id:"linked_projects", label:"Linked Projects", width:200,
      render:(p:any)=>{ const names=((p.project_ids||[]) as string[]).map((id:string)=>projects.find((pr:any)=>pr.id===id)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length?names.join(", "):"—"}</span>; } },
    { id:"unlink", label:"", width:44,
      render:(p:any)=><button type="button" onClick={e=>{e.stopPropagation();handleUnlink(p.id);}} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button> },
  ], [projects]);

  useEffect(() => {
    setOptions({
      items: [
        { label: "Link Style", icon: Plus, onClick: () => setShowLink(true), className: "text-primary hover:bg-primary/10" },
        { divider: true },
        { label: view === "grid" ? "View: List" : "View: Grid", icon: view === "grid" ? ListIcon : LayoutGrid,
          onClick: () => setView(v => v === "grid" ? "list" : "grid") },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu(v => !v) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent
          pageKey="project_styles"
          activeViewId={activeViewId}
          onSelectView={id => { setActiveViewId(id); setShowViewMenu(false); }}
          allFields={view === "grid" ? galleryFields : tableColumns}
          currentViewType={view === "grid" ? "grid" : null}
        />
      ) : null,
    });
    return () => setOptions(null);
  }, [view, showViewMenu, activeViewId, galleryFields, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search styles…" className="pl-8 h-8 text-xs" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedStyles.length === 0 ? "No styles linked yet" : "No matches"}</p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="project_styles"
          allFields={galleryFields}
          rows={filtered}
          renderThumbnail={(p) => (
            <div className="w-full h-full bg-muted flex items-center justify-center overflow-hidden group">
              {p.images?.[0]
                ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"/>
                : <Package className="w-8 h-8 text-muted-foreground/30"/>}
              <button type="button" onClick={e=>{e.stopPropagation();handleUnlink(p.id);}}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 p-1 rounded-full text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3"/>
              </button>
            </div>
          )}
          onClickItem={(p) => navigate(`/products/${p.id}`)}
          activeViewId={activeViewId}
          onSelectView={setActiveViewId}
        />
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
          fixedColumns={["code","name"]}
          {...({ activeViewId } as any)}
        />
      )}

      <LinkModal open={showLink} onClose={()=>setShowLink(false)} title="Link Styles"
        items={allProducts} alreadyLinkedIds={linkedStyles.map(s=>s.id)}
        onConfirm={handleLink} confirming={linking}
        renderItem={item=>(
          <div className="flex-1 min-w-0">
            <span className="font-medium">{item.name}</span>
            {item.code && <span className="ml-1.5 text-muted-foreground font-mono">{item.code}</span>}
            {item.type && <span className="ml-1.5 text-muted-foreground">· {item.type}</span>}
          </div>
        )}
      />
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

  useEffect(() => { localStorage.setItem("proj_colorways_view", view); }, [view]);

  const getLinkedHexes = (c: any) => {
    const cc = commColors.find(x => x.id === c.linked_color_id);
    if (!cc || cc.sub_type !== "Combined") return null;
    const hexes = (cc.linked_technical_color_ids||[]).map((id:string) => techColors.find(t=>t.id===id)?.hex).filter(Boolean) as string[];
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
    { id:"color_name", label:"Color Name",  getValue:(c:any)=>c.color_name, render:(c:any)=><span className="font-medium text-xs">{c.color_name||"—"}</span> },
    { id:"colorway_code", label:"Code",     getValue:(c:any)=>c.colorway_code, render:(c:any)=><span className="font-mono text-[10px] text-muted-foreground">{c.colorway_code||"—"}</span> },
    { id:"colorway_status", label:"Status", getValue:(c:any)=>c.colorway_status,
      render:(c:any)=>c.colorway_status ? <span className={`text-[10px] px-1 py-0.5 rounded ${CW_STATUS[c.colorway_status]||"bg-gray-100 text-gray-600"}`}>{c.colorway_status.replace(/_/g," ")}</span> : <span className="text-muted-foreground/40">—</span> },
    { id:"product_name", label:"Style",
      getValue:(c:any)=>(c as any).products?.name||"",
      render:(c:any)=><span className="text-[10px] text-muted-foreground">{(c as any).products?.name||"—"}</span> },
  ], []);

  const tableColumns = useMemo(() => [
    { id:"swatch", label:"Color", width:48, render:(c:any)=><ListSwatch c={c}/> },
    { id:"color_name", label:"Color Name", width:180, sortKey:(c:any)=>c.color_name||"", render:(c:any)=><span className="font-medium text-sm">{c.color_name||"—"}</span> },
    { id:"colorway_code", label:"Code", width:120, sortKey:(c:any)=>c.colorway_code||"", render:(c:any)=><span className="font-mono text-xs text-muted-foreground">{c.colorway_code||"—"}</span> },
    { id:"colorway_status", label:"Status", width:150, sortKey:(c:any)=>c.colorway_status||"",
      render:(c:any)=>c.colorway_status ? <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CW_STATUS[c.colorway_status]||"bg-gray-100 text-gray-600"}`}>{c.colorway_status.replace(/_/g," ")}</span> : <span className="text-muted-foreground/40">—</span> },
    { id:"product_name", label:"Style", width:180, sortKey:(c:any)=>(c as any).products?.name||"",
      render:(c:any)=><span className="text-xs text-muted-foreground">{(c as any).products?.name||"—"}</span> },
    { id:"unlink", label:"", width:44,
      render:(c:any)=><button type="button" onClick={e=>{e.stopPropagation();handleUnlink(c.id);}} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [commColors, techColors, productMap]);

  useEffect(() => {
    setOptions({
      items: [
        { label: "Link Colorway", icon: Plus, onClick: ()=>setShowLink(true), className: "text-primary hover:bg-primary/10" },
        { divider: true },
        { label: view === "grid" ? "View: List" : "View: Grid", icon: view === "grid" ? ListIcon : LayoutGrid,
          onClick: () => setView(v => v === "grid" ? "list" : "grid") },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu(v=>!v) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent
          pageKey="project_colorways"
          activeViewId={activeViewId}
          onSelectView={id=>{ setActiveViewId(id); setShowViewMenu(false); }}
          allFields={view === "grid" ? galleryFields : tableColumns}
          currentViewType={view === "grid" ? "grid" : null}
        />
      ) : null,
    });
    return () => setOptions(null);
  }, [view, showViewMenu, activeViewId, galleryFields, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search colorways…" className="pl-8 h-8 text-xs"/>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Palette className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedColorways.length===0?"No colorways linked yet":"No matches"}</p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="project_colorways"
          allFields={galleryFields}
          rows={filtered}
          renderThumbnail={renderThumb}
          onClickItem={(c)=>c.product_id&&navigate(`/products/${c.product_id}`)}
          activeViewId={activeViewId}
          onSelectView={setActiveViewId}
        />
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          onRowClick={(c)=>c.product_id&&navigate(`/products/${c.product_id}`)}
          fixedColumns={["swatch","color_name"]}
          {...({ activeViewId } as any)}
        />
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
        )}
      />
    </div>
  );
}

// ── VARIATIONS TAB ───────────────────────────────────────────────────────────
function VariationsSection({ projectId, linkedVariations, onRefresh, setOptions }: { projectId:string; linkedVariations:any[]; onRefresh:()=>void; setOptions:any }) {
  const navigate = useNavigate();
  const [allVariations, setAllVariations] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid"|"list">(() => (localStorage.getItem("proj_variations_view") as any) ?? "list");
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    supabase.from("product_color_and_more").select("id,name,sequence,pack_code,variant,color_hex,image_url,product_color_id,size_ids,product_colors(color_name,colorway_code,color_hex,products(name,images))").order("created_at",{ascending:false}).then(({data})=>setAllVariations(data??[]));
    supabase.from("sizes").select("id,name,size_code").then(({data})=>setSizes(data??[]));
  }, []);

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
    { id:"sequence",  label:"Seq.",     getValue:(v:any)=>v.sequence,  render:(v:any)=><span className="font-mono text-[10px] text-muted-foreground">{v.sequence||"—"}</span> },
    { id:"name",      label:"Name",     getValue:(v:any)=>v.name,      render:(v:any)=><span className="font-medium text-xs">{v.name||"—"}</span> },
    { id:"pack_code", label:"Pack Code",getValue:(v:any)=>v.pack_code, render:(v:any)=><span className="font-mono text-[10px] text-muted-foreground">{v.pack_code||"—"}</span> },
    { id:"variant",   label:"Variant",  getValue:(v:any)=>v.variant,   render:(v:any)=><span className="text-[10px] text-muted-foreground">{v.variant||"—"}</span> },
    { id:"colorway",  label:"Colorway", getValue:(v:any)=>(v as any).product_colors?.color_name||"",
      render:(v:any)=><div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-border shrink-0" style={{backgroundColor:(v as any).product_colors?.color_hex||"#e5e7eb"}}/><span className="text-[10px] text-muted-foreground truncate">{(v as any).product_colors?.color_name||"—"}</span></div> },
    { id:"sizes",     label:"Sizes",    getValue:(v:any)=>getSizes(v).map((s:any)=>s.name||s.size_code).join(","),
      render:(v:any)=>{ const sz=getSizes(v); return sz.length ? <div className="flex flex-wrap gap-0.5">{sz.slice(0,5).map((s:any)=><span key={s.id} className="text-[9px] px-1 bg-secondary text-secondary-foreground rounded">{s.name||s.size_code}</span>)}{sz.length>5&&<span className="text-[9px] text-muted-foreground">+{sz.length-5}</span>}</div> : <span className="text-muted-foreground/40">—</span>; } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sizes]);

  const tableColumns = useMemo(() => [
    { id:"swatch", label:"", width:36,
      render:(v:any)=>{ const hex=v.color_hex||(v as any).product_colors?.color_hex; return <div className="w-5 h-5 rounded border border-border shrink-0" style={{backgroundColor:hex||"#e5e7eb"}}/>; } },
    { id:"sequence",  label:"Seq.",     width:80,  sortKey:(v:any)=>v.sequence||"",  render:(v:any)=><span className="font-mono text-xs text-muted-foreground">{v.sequence||"—"}</span> },
    { id:"name",      label:"Name",     width:180, sortKey:(v:any)=>v.name||"",      render:(v:any)=><span className="font-medium text-sm">{v.name||"—"}</span> },
    { id:"pack_code", label:"Pack Code",width:110, sortKey:(v:any)=>v.pack_code||"", render:(v:any)=><span className="font-mono text-xs text-muted-foreground">{v.pack_code||"—"}</span> },
    { id:"variant",   label:"Variant",  width:110, sortKey:(v:any)=>v.variant||"",   render:(v:any)=><span className="text-xs text-muted-foreground">{v.variant||"—"}</span> },
    { id:"colorway",  label:"Colorway", width:160, sortKey:(v:any)=>(v as any).product_colors?.color_name||"",
      render:(v:any)=><div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{backgroundColor:(v as any).product_colors?.color_hex||"#e5e7eb"}}/><span className="text-xs text-muted-foreground">{(v as any).product_colors?.color_name||"—"}</span></div> },
    { id:"sizes",     label:"Sizes",    width:200,
      render:(v:any)=>{ const sz=getSizes(v); return sz.length ? <div className="flex flex-wrap gap-0.5">{sz.slice(0,6).map((s:any)=><span key={s.id} className="text-[10px] px-1 bg-secondary text-secondary-foreground rounded">{s.name||s.size_code}</span>)}{sz.length>6&&<span className="text-[10px] text-muted-foreground">+{sz.length-6}</span>}</div> : <span className="text-muted-foreground/40">—</span>; } },
    { id:"unlink", label:"", width:44,
      render:(v:any)=><button type="button" onClick={e=>{e.stopPropagation();handleUnlink(v.id);}} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sizes]);

  useEffect(() => {
    setOptions({
      items: [
        { label: "Link Variation", icon: Plus, onClick: ()=>setShowLink(true), className: "text-primary hover:bg-primary/10" },
        { divider: true },
        { label: view === "grid" ? "View: List" : "View: Grid", icon: view === "grid" ? ListIcon : LayoutGrid,
          onClick: () => setView(v => v === "grid" ? "list" : "grid") },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu(v=>!v) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent
          pageKey="project_variations"
          activeViewId={activeViewId}
          onSelectView={id=>{ setActiveViewId(id); setShowViewMenu(false); }}
          allFields={view === "grid" ? galleryFields : tableColumns}
          currentViewType={view === "grid" ? "grid" : null}
        />
      ) : null,
    });
    return () => setOptions(null);
  }, [view, showViewMenu, activeViewId, galleryFields, tableColumns, setOptions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search variations…" className="pl-8 h-8 text-xs"/>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedVariations.length===0?"No variations linked yet":"No matches"}</p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="project_variations"
          allFields={galleryFields}
          rows={filtered}
          renderThumbnail={renderThumb}
          onClickItem={undefined}
          activeViewId={activeViewId}
          onSelectView={setActiveViewId}
        />
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          fixedColumns={["swatch","sequence","name"]}
          {...({ activeViewId } as any)}
        />
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
        )}
      />
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
    { id:"rfqs",       label:"RFQ Requests",    icon:FileSearch },
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
        {activeTab === "rfqs"      && <StubSection icon={FileSearch} label="Supplier Requests" note="RFQ management coming in Domain 6"/>}
        {activeTab === "samples"   && <StubSection icon={FlaskConical} label="Samples" note="Sample management coming in Domain 7"/>}
      </div>
    </div>
  );
}
