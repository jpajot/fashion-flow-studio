import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/lib/badges";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["Seasonal Collection", "Artist Collaboration", "Capsule", "Limited Edition", "Core Range", "Other"];
const SEASONS = ["SS25", "FW25", "SS26", "FW26", "Evergreen"];
const STATUSES = ["Planning", "Active", "Archived"];

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function StylesTab({ id }: { id: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [linked, setLinked] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("products").select("*").eq("creation_project_id", id).eq("type", "Style")
      .then(({ data }) => setRows(data ?? []));
    supabase.from("product_project_links").select("product:product_id(*)").eq("project_id", id)
      .then(({ data }) => setLinked((data ?? []).map((l: any) => l.product).filter(Boolean)));
  }, [id]);

  const creationIds = new Set(rows.map((r) => r.id));
  const extras = linked.filter((p) => !creationIds.has(p.id));

  const render = (list: any[], emptyMsg: string) =>
    list.length === 0 ? (
      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{emptyMsg}</TableCell></TableRow>
    ) : list.map((p) => (
      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/styles/${p.id}`)}>
        <TableCell className="font-mono text-xs">{p.style_code ?? p.code ?? "—"}</TableCell>
        <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
        <TableCell>{p.sub_type ?? "—"}</TableCell>
        <TableCell>{p.category ?? "—"}</TableCell>
        <TableCell>{p.bom_workflow_pattern && <Badge variant="outline">{p.bom_workflow_pattern}</Badge>}</TableCell>
      </TableRow>
    ));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Created in this project</h3>
        <Card>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Sub-type</TableHead><TableHead>Category</TableHead><TableHead>BOM</TableHead></TableRow></TableHeader>
            <TableBody>{render(rows, "No styles created in this project")}</TableBody>
          </Table>
        </Card>
      </div>
      {extras.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Additionally linked</h3>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Sub-type</TableHead><TableHead>Category</TableHead><TableHead>BOM</TableHead></TableRow></TableHeader>
              <TableBody>{render(extras, "")}</TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}

function ColorwaysTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("product_color_project_links")
      .select("*, product_colors(color_name, colorway_code, color_hex, colorway_status, products(name, code, style_code))")
      .eq("project_id", id)
      .then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Product</TableHead><TableHead>Colorway Code</TableHead><TableHead>Color</TableHead><TableHead /><TableHead>Status</TableHead><TableHead>Forecasted Qty</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No colorways linked</TableCell></TableRow>
          ) : rows.map((r) => {
            const pc = r.product_colors;
            const p = pc?.products;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{p?.name ?? "—"} <span className="text-muted-foreground font-mono text-xs">{p?.style_code ?? p?.code ?? ""}</span></TableCell>
                <TableCell className="font-mono text-xs">{pc?.colorway_code ?? "—"}</TableCell>
                <TableCell>{pc?.color_name ?? "—"}</TableCell>
                <TableCell><div className="h-5 w-5 rounded-full border" style={{ backgroundColor: pc?.color_hex ?? "#e5e7eb" }} /></TableCell>
                <TableCell><StatusBadge value={pc?.colorway_status} /></TableCell>
                <TableCell>{r.forecasted_quantity ?? r.forecast_quantity ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function SamplesTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("samples")
      .select("*, product:product_id(name), product_color:product_color_id(color_name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Code</TableHead><TableHead>Product</TableHead><TableHead>Colorway</TableHead><TableHead>Type</TableHead><TableHead>Phase</TableHead><TableHead>Conformity</TableHead><TableHead>Qty</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No samples</TableCell></TableRow>
          ) : rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs">{s.code}</TableCell>
              <TableCell className="font-medium">{s.product?.name ?? "—"}</TableCell>
              <TableCell>{s.product_color?.color_name ?? "—"}</TableCell>
              <TableCell><StatusBadge value={s.sample_type} /></TableCell>
              <TableCell><StatusBadge value={s.phase} /></TableCell>
              <TableCell><StatusBadge value={s.conformity_status} /></TableCell>
              <TableCell>{s.requested_quantity ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function RfqsTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("supplier_requests")
      .select("*, rfq_round:round_id(label)")
      .eq("project_id", id)
      .order("due_date", { ascending: true })
      .then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Round</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No RFQ requests</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.code}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.rfq_round?.label ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{fmtDate(r.due_date)}</TableCell>
              <TableCell><StatusBadge value={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", type: "", season: "", status: "Planning", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      setProject(data);
      setLoading(false);
    })();
  }, [id, refresh]);

  const openEdit = () => {
    if (!project) return;
    setForm({
      name: project.name ?? "", type: project.type ?? "", season: project.season ?? "",
      status: project.status ?? "Planning", description: project.description ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const { error } = await supabase.from("projects").update(payload).eq("id", id!);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Project updated");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!project) return <div>Project not found</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Button size="icon" variant="ghost" onClick={openEdit}><Pencil className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {project.type && <Badge variant="outline">{project.type}</Badge>}
              {project.season && <Badge variant="secondary">{project.season}</Badge>}
              {project.status && <StatusBadge value={project.status} />}
            </div>
            {project.description && (
              <div className="text-sm text-muted-foreground pt-2 border-t whitespace-pre-wrap">{project.description}</div>
            )}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Created {fmtDate(project.created_at)}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="styles">
          <TabsList>
            <TabsTrigger value="styles">Styles</TabsTrigger>
            <TabsTrigger value="colorways">Colorways</TabsTrigger>
            <TabsTrigger value="samples">Samples</TabsTrigger>
            <TabsTrigger value="rfqs">RFQ Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="styles" className="mt-6"><StylesTab id={id!} /></TabsContent>
          <TabsContent value="colorways" className="mt-6"><ColorwaysTab id={id!} /></TabsContent>
          <TabsContent value="samples" className="mt-6"><SamplesTab id={id!} /></TabsContent>
          <TabsContent value="rfqs" className="mt-6"><RfqsTab id={id!} /></TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Season</Label>
              <Select value={form.season} onValueChange={(v) => setForm({ ...form, season: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
