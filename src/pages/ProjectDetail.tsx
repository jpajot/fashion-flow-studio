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
import { ArrowLeft, Loader2, Trash2, Plus, Search, X, Package, Palette, Layers, FileText, Building2, ClipboardList, FileSearch, FlaskConical, SwatchBook, LayoutTemplate, BarChart2, Info, ExternalLink, AlertTriangle, Clock, GitBranch, XCircle, Upload } from "lucide-react";
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
function StylesSection({ projectId, linkedStyles, onRefresh }: { projectId:string; linkedStyles:any[]; onRefresh:()=>void }) {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("products").select("id,code,name,type,sub_type,category").order("name").then(({data})=>setAllProducts(data??[]));
  }, []);

  const filtered = search.trim() ? linkedStyles.filter(p => `${p.name} ${p.code}`.toLowerCase().includes(search.toLowerCase())) : linkedStyles;

  const handleLink = async (ids: string[]) => {
    setLinking(true);
    const rows = ids.map(product_id => ({ product_id, project_id: projectId }));
    await supabase.from("product_project_links").upsert(rows, { onConflict: "product_id,project_id", ignoreDuplicates: true });
    setLinking(false); setShowLink(false); onRefresh();
    toast.success(`${ids.length} style${ids.length>1?"s":""} linked`);
  };

  const handleUnlink = async (productId: string) => {
    await supabase.from("product_project_links").delete().eq("product_id", productId).eq("project_id", projectId);
    onRefresh(); toast.success("Style unlinked");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search styles…" className="pl-8 h-8 text-xs" />
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={()=>setShowLink(true)}><Plus className="w-3.5 h-3.5"/>Link Style</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedStyles.length === 0 ? "No styles linked yet" : "No matches"}</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>{["Code","Name","Type","Sub-type","Category",""].map((h,i)=><th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p=>(
                <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={()=>navigate(`/products/${p.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.code??"—"}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.type??"—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.sub_type??"—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.category??"—"}</td>
                  <td className="px-2 py-3">
                    <button type="button" onClick={e=>{e.stopPropagation();handleUnlink(p.id);}}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Unlink">
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
function ColorwaysSection({ projectId, linkedColorways, onRefresh }: { projectId:string; linkedColorways:any[]; onRefresh:()=>void }) {
  const navigate = useNavigate();
  const [allColorways, setAllColorways] = useState<any[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("product_colors").select("id,color_name,colorway_code,color_hex,colorway_status,product_id,products(name,code)").order("color_name")
      .then(({data})=>setAllColorways(data??[]));
  }, []);

  const filtered = search.trim()
    ? linkedColorways.filter(c => `${c.color_name} ${c.colorway_code} ${(c as any).product_name}`.toLowerCase().includes(search.toLowerCase()))
    : linkedColorways;

  const handleLink = async (ids: string[]) => {
    setLinking(true);
    const rows = ids.map(product_color_id => ({ product_color_id, project_id: projectId }));
    await supabase.from("product_color_project_links").upsert(rows, { onConflict: "product_color_id,project_id", ignoreDuplicates: true });
    setLinking(false); setShowLink(false); onRefresh();
    toast.success(`${ids.length} colorway${ids.length>1?"s":""} linked`);
  };

  const handleUnlink = async (colorId: string) => {
    await supabase.from("product_color_project_links").delete().eq("product_color_id", colorId).eq("project_id", projectId);
    onRefresh(); toast.success("Colorway unlinked");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search colorways…" className="pl-8 h-8 text-xs"/>
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={()=>setShowLink(true)}><Plus className="w-3.5 h-3.5"/>Link Colorway</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Palette className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedColorways.length===0?"No colorways linked yet":"No matches"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((c:any) => (
            <div key={c.id} className="group relative bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer"
              onClick={()=>c.product_id && navigate(`/products/${c.product_id}`)}>
              <div className="aspect-square" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
              <div className="p-2.5 space-y-1">
                <p className="text-xs font-medium truncate">{c.color_name || "—"}</p>
                {c.colorway_code && <p className="text-[10px] font-mono text-muted-foreground truncate">{c.colorway_code}</p>}
                {c.colorway_status && (
                  <span className={`text-[10px] px-1 py-0.5 rounded ${CW_STATUS[c.colorway_status]||"bg-gray-100 text-gray-600"}`}>{c.colorway_status.replace(/_/g," ")}</span>
                )}
                {(c as any).product_name && <p className="text-[10px] text-muted-foreground truncate">{(c as any).product_name}</p>}
              </div>
              <button type="button" onClick={e=>{e.stopPropagation();handleUnlink(c.id);}}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 p-1 rounded-full text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
        </div>
      )}

      <LinkModal open={showLink} onClose={()=>setShowLink(false)} title="Link Colorways"
        items={allColorways} alreadyLinkedIds={linkedColorways.map(c=>c.id)}
        onConfirm={handleLink} confirming={linking}
        renderItem={item=>(
          <>
            <div className="w-5 h-5 rounded shrink-0 border border-border" style={{backgroundColor:item.color_hex||"#e5e7eb"}}/>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{item.color_name||"—"}</span>
              {item.colorway_code && <span className="ml-1 font-mono text-muted-foreground">{item.colorway_code}</span>}
              {(item as any).products?.name && <span className="ml-1 text-muted-foreground">· {(item as any).products.name}</span>}
            </div>
          </>
        )}
      />
    </div>
  );
}

// ── VARIATIONS TAB ───────────────────────────────────────────────────────────
function VariationsSection({ projectId, linkedVariations, onRefresh }: { projectId:string; linkedVariations:any[]; onRefresh:()=>void }) {
  const [allVariations, setAllVariations] = useState<any[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("product_color_and_more").select("id,name,sequence,pack_code,variant,color_hex,product_color_id,product_colors(color_name,colorway_code,products(name))")
      .order("created_at", {ascending:false})
      .then(({data})=>setAllVariations(data??[]));
  }, []);

  const filtered = search.trim() ? linkedVariations.filter(v=>`${v.name||""} ${v.sequence||""} ${v.pack_code||""}`.toLowerCase().includes(search.toLowerCase())) : linkedVariations;

  const handleLink = async (ids: string[]) => {
    setLinking(true);
    const rows = ids.map(product_color_and_more_id=>({product_color_and_more_id, project_id:projectId}));
    await supabase.from("product_color_and_more_project_links").upsert(rows,{onConflict:"product_color_and_more_id,project_id",ignoreDuplicates:true});
    setLinking(false); setShowLink(false); onRefresh();
    toast.success(`${ids.length} variation${ids.length>1?"s":""} linked`);
  };

  const handleUnlink = async (varId: string) => {
    await supabase.from("product_color_and_more_project_links").delete().eq("product_color_and_more_id",varId).eq("project_id",projectId);
    onRefresh(); toast.success("Variation unlinked");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search variations…" className="pl-8 h-8 text-xs"/>
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={()=>setShowLink(true)}><Plus className="w-3.5 h-3.5"/>Link Variation</Button>
      </div>
      {filtered.length===0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">{linkedVariations.length===0?"No variations linked yet":"No matches"}</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>{["Seq.","Name","Pack Code","Variant","Colorway",""].map((h,i)=><th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v:any)=>(
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.sequence??"—"}</td>
                  <td className="px-4 py-3 font-medium">{v.name||"—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{v.pack_code??"—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{v.variant??"—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {v.color_hex && <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{backgroundColor:v.color_hex}}/>}
                      <span className="text-xs text-muted-foreground">{v.product_colors?.color_name??v.product_color_id?.slice(0,8)??"—"}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <button type="button" onClick={()=>handleUnlink(v.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Unlink">
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LinkModal open={showLink} onClose={()=>setShowLink(false)} title="Link Variations"
        items={allVariations} alreadyLinkedIds={linkedVariations.map(v=>v.id)}
        onConfirm={handleLink} confirming={linking}
        renderItem={item=>(
          <>
            {item.color_hex && <div className="w-4 h-4 rounded shrink-0 border border-border" style={{backgroundColor:item.color_hex}}/>}
            <div className="flex-1 min-w-0">
              <span className="font-medium">{item.name||item.sequence||"—"}</span>
              {item.pack_code&&<span className="ml-1 text-muted-foreground font-mono">{item.pack_code}</span>}
              {item.product_colors?.color_name&&<span className="ml-1 text-muted-foreground">· {item.product_colors.color_name}</span>}
            </div>
          </>
        )}
      />
    </div>
  );
}

// ── BOM STATUS TAB ───────────────────────────────────────────────────────────
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

  useEffect(() => { setOptions({ items: [] }); return () => setOptions(null); }, [activeTab, setOptions]);

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

        {activeTab === "styles"    && <StylesSection    projectId={id!} linkedStyles={linkedStyles}       onRefresh={loadAll}/>}
        {activeTab === "colorways" && <ColorwaysSection projectId={id!} linkedColorways={linkedColorways} onRefresh={loadAll}/>}
        {activeTab === "variations"&& <VariationsSection projectId={id!} linkedVariations={linkedVariations} onRefresh={loadAll}/>}
        {activeTab === "bom_status"&& <BOMStatusSection linkedStyles={linkedStyles}/>}
        {activeTab === "sourcing"  && <SourcingSection  linkedStyles={linkedStyles}/>}
        {activeTab === "documents" && <DocumentsSection projectId={id!}/>}
        {activeTab === "palettes"  && <StubSection icon={SwatchBook} label="Color Palettes" note="Full palette management coming in Phase 2"/>}
        {activeTab === "dc_per_cot"&& <StubSection icon={BarChart2}  label="DC per CoT Planning" note="Full distribution channel × channel of trade planning coming in Phase 2"/>}
        {activeTab === "boards"    && <StubSection icon={LayoutTemplate} label="Boards" note="Boards feature coming soon"/>}
        {activeTab === "rfqs"      && <StubSection icon={FileSearch} label="Supplier Requests" note="RFQ management coming in Domain 6"/>}
        {activeTab === "samples"   && <StubSection icon={FlaskConical} label="Samples" note="Sample management coming in Domain 7"/>}
      </div>
    </div>
  );
}
