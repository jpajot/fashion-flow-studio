import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PAGE_WRAPPER } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, LayoutGrid, List, FolderOpen, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["Seasonal Collection","Artist Collaboration","Capsule","Limited Edition","Core Range","Other"];
const SEASONS = ["SS25","FW25","SS26","FW26","Evergreen"];
const STATUSES = ["Planning","Active","Archived"];

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Planning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
  Active:   { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-400" },
  Archived: { bg: "bg-slate-50",  text: "text-slate-500",  border: "border-slate-200",  dot: "bg-slate-400" },
};

const EMPTY: any = { name: "", type: "", season: "", status: "Planning", description: "" };

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"gallery"|"table">(() => (localStorage.getItem("projects_view") as any) ?? "gallery");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter(p => !search.trim() || p.name?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p: any, e?: React.MouseEvent) => {
    e?.stopPropagation(); e?.preventDefault();
    setEditId(p.id);
    setForm({ name: p.name ?? "", type: p.type ?? "", season: p.season ?? "", status: p.status ?? "Planning", description: p.description ?? "" });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => payload[k] === "" && delete payload[k]);
    const res = editId
      ? await supabase.from("projects").update(payload).eq("id", editId)
      : await supabase.from("projects").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Project updated" : "Project created");
    setOpen(false); load();
  };

  const doDelete = async () => {
    if (!delId) return;
    await supabase.from("projects").delete().eq("id", delId);
    setDelId(null); load(); toast.success("Project deleted");
  };

  if (loading) return (
    <div className={`${PAGE_WRAPPER} flex items-center justify-center py-20`}>
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className={PAGE_WRAPPER}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />New Project</Button>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" className="pl-9 h-9" />
        </div>
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          {(["gallery","table"] as const).map(v => (
            <button key={v} type="button" onClick={() => { setView(v); localStorage.setItem("projects_view", v); }}
              className={`px-2.5 py-1.5 transition-colors ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
              {v === "gallery" ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FolderOpen className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">{search ? "No projects match" : "No projects yet"}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">{search ? "Try a different search" : "Create your first project to get started"}</p>
          {!search && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />New Project</Button>}
        </div>
      ) : view === "gallery" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => {
            const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.Planning;
            return (
              <div key={p.id}
                className={`group relative bg-card rounded-xl border ${sc.border} p-5 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer`}
                onClick={() => navigate(`/projects/${p.id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold group-hover:text-primary transition-colors truncate">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{[p.type, p.season].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <button type="button" onClick={e => openEdit(p, e)}
                    className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 ml-2">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                {p.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{p.description}</p>}
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                  <span className={`text-[11px] font-medium ${sc.text}`}>{p.status ?? "Planning"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["Name","Type","Season","Status",""].map((h,i) => (
                  <th key={i} className={`text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground${i===4?" w-10":""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => {
                const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.Planning;
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.type ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.season ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{p.status ?? "Planning"}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button type="button" onClick={e => openEdit(p, e)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div><Label className="text-xs">Name *</Label><Input className="mt-1" value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Type</Label>
                <Select value={form.type||"__none"} onValueChange={v => setForm({...form,type:v==="__none"?"":v})}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">—</SelectItem>{TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Season</Label>
                <Select value={form.season||"__none"} onValueChange={v => setForm({...form,season:v==="__none"?"":v})}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">—</SelectItem>{SEASONS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form,status:v})}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Description</Label><Textarea className="mt-1" value={form.description} onChange={e => setForm({...form,description:e.target.value})} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving?<><Loader2 className="w-4 h-4 animate-spin mr-1"/>Saving…</>:editId?"Save":"Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={o=>!o&&setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction></AlertFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
