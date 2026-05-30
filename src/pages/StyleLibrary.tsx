import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LayoutGrid, List, Plus, Shirt } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type Product = Record<string, any> & { id: string };

const PAGE = 24;

const SUB_TYPES = ["Top", "Bottom", "Dress", "Outerwear", "Accessory", "Knitwear", "Other"];
const CATEGORIES = ["Womenswear", "Menswear", "Unisex"];
const UOMS = ["m", "pcs", "kg", "roll"];
const BOM_PATTERNS = ["dev_then_prod", "direct_prod"];

const emptyForm = {
  name: "",
  code: "",
  sub_type: "",
  category: "",
  sub_category: "",
  customer_need: "",
  description: "",
  size_grid_id: "",
  creation_project_id: "",
  default_uom: "",
  bom_workflow_pattern: "",
};

export default function StyleLibrary() {
  const navigate = useNavigate();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sizeGrids, setSizeGrids] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("products")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (search) q = q.ilike("name", `%${search}%`);
      if (status !== "all") q = q.eq("status", status);
      const { data, count, error } = await q;
      if (!error) {
        setItems((data as Product[]) ?? []);
        setTotal(count ?? 0);
      }
      setLoading(false);
    })();
  }, [page, search, status, refreshKey]);

  useEffect(() => {
    if (!open) return;
    supabase.from("size_grids").select("id,name").then(({ data }) => setSizeGrids(data ?? []));
    supabase.from("projects").select("id,name").eq("status", "Active").then(({ data }) => setProjects(data ?? []));
  }, [open]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE)), [total]);

  const submit = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    const payload: any = { ...form, type: "Style" };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) payload.created_by = user.email;
    const { data, error } = await supabase.from("products").insert(payload).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Style created");
    setOpen(false);
    setForm(emptyForm);
    if (data?.id) navigate(`/styles/${data.id}`);
    else setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Style Library</h1>
          <p className="text-muted-foreground">{total} products</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 border rounded-md p-1">
            <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Style
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search styles…" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} className="max-w-sm" />
        <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No products found</CardContent></Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((p) => (
            <Card key={p.id} onClick={() => navigate(`/styles/${p.id}`)} className="overflow-hidden hover:shadow-md transition cursor-pointer">
              <div className="aspect-square bg-muted grid place-items-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Shirt className="h-10 w-10 text-muted-foreground/40" />}
              </div>
              <CardContent className="p-3">
                <div className="font-medium truncate text-sm">{p.name ?? p.style_code ?? p.id}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{p.style_code ?? p.code ?? ""}</span>
                  {p.status && <Badge variant="secondary" className="text-xs">{p.status}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} onClick={() => navigate(`/styles/${p.id}`)} className="cursor-pointer">
                  <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.style_code ?? p.code ?? "—"}</TableCell>
                  <TableCell>{p.category ?? "—"}</TableCell>
                  <TableCell>{p.status && <Badge variant="secondary">{p.status}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {page + 1} of {pages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Style</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div>
              <Label>Sub-type</Label>
              <Select value={form.sub_type} onValueChange={(v) => setForm({ ...form, sub_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SUB_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sub-category</Label><Input value={form.sub_category} onChange={(e) => setForm({ ...form, sub_category: e.target.value })} /></div>
            <div className="col-span-2"><Label>Customer need</Label><Input value={form.customer_need} onChange={(e) => setForm({ ...form, customer_need: e.target.value })} /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Size Grid</Label>
              <Select value={form.size_grid_id} onValueChange={(v) => setForm({ ...form, size_grid_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{sizeGrids.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Creation Project</Label>
              <Select value={form.creation_project_id} onValueChange={(v) => setForm({ ...form, creation_project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default UOM</Label>
              <Select value={form.default_uom} onValueChange={(v) => setForm({ ...form, default_uom: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{UOMS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>BOM Workflow</Label>
              <Select value={form.bom_workflow_pattern} onValueChange={(v) => setForm({ ...form, bom_workflow_pattern: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{BOM_PATTERNS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
