import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/lib/badges";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type Sample = Record<string, any> & { id: string };

const SAMPLE_TYPES = ["volume", "proto", "sample", "sms", "test_au_porter", "gold_seal", "pps"];
const PHASES = ["development", "production"];
const CONFORMITY = ["not_assessed", "pass", "fail_minor", "fail_major", "pending_review"];

const empty = {
  code: "", project_id: "", product_id: "", product_color_id: "",
  sample_type: "", phase: "", requested_quantity: "", conformity_status: "not_assessed", notes: "",
};

export default function Samples() {
  const [items, setItems] = useState<Sample[]>([]);
  const [sampleType, setSampleType] = useState("all");
  const [phase, setPhase] = useState("all");
  const [conformity, setConformity] = useState("all");
  const [selected, setSelected] = useState<Sample | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let q = supabase.from("samples").select("*, project:project_id(name), product:product_id(name)").order("created_at", { ascending: false }).limit(500);
      if (sampleType !== "all") q = q.eq("sample_type", sampleType);
      if (phase !== "all") q = q.eq("phase", phase);
      if (conformity !== "all") q = q.eq("conformity_status", conformity);
      const { data } = await q;
      setItems((data as any) ?? []);
    })();
  }, [sampleType, phase, conformity, refresh]);

  useEffect(() => {
    if (!selected) return;
    supabase.from("sample_steps").select("*").eq("sample_id", selected.id).order("sequence").then(({ data }) => setSteps(data ?? []));
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    supabase.from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
    supabase.from("products").select("id,name,code,style_code").eq("type", "Style").then(({ data }) => setProducts(data ?? []));
  }, [open]);

  useEffect(() => {
    if (!form.product_id) { setColors([]); return; }
    supabase.from("product_colors").select("id,color_name,colorway_code").eq("product_id", form.product_id).then(({ data }) => setColors(data ?? []));
  }, [form.product_id]);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (s: Sample) => {
    setEditId(s.id);
    setForm({
      code: s.code ?? "", project_id: s.project_id ?? "", product_id: s.product_id ?? "", product_color_id: s.product_color_id ?? "",
      sample_type: s.sample_type ?? "", phase: s.phase ?? "", requested_quantity: s.requested_quantity ?? "",
      conformity_status: s.conformity_status ?? "not_assessed", notes: s.notes ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.code) return toast.error("Code is required");
    setSaving(true);
    const payload: any = { ...form };
    if (payload.requested_quantity === "") payload.requested_quantity = null;
    else payload.requested_quantity = Number(payload.requested_quantity);
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editId
      ? await supabase.from("samples").update(payload).eq("id", editId)
      : await supabase.from("samples").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Sample updated" : "Sample created");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("samples").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("Sample deleted");
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sampling</h1>
          <p className="text-muted-foreground">Track sample requests and conformity</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Sample</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={sampleType} onValueChange={setSampleType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>{["all", ...SAMPLE_TYPES].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All types" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={phase} onValueChange={setPhase}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>{["all", ...PHASES].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All phases" : s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={conformity} onValueChange={setConformity}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Conformity" /></SelectTrigger>
          <SelectContent>{["all", ...CONFORMITY].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All conformity" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead><TableHead>Product</TableHead><TableHead>Project</TableHead><TableHead>Type</TableHead><TableHead>Phase</TableHead><TableHead>Conformity</TableHead><TableHead>Qty</TableHead><TableHead>Date</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                <TableCell className="font-mono text-xs">{s.code}</TableCell>
                <TableCell className="font-medium">{s.product?.name ?? "—"}</TableCell>
                <TableCell>{s.project?.name ?? "—"}</TableCell>
                <TableCell><StatusBadge value={s.sample_type} /></TableCell>
                <TableCell><StatusBadge value={s.phase} /></TableCell>
                <TableCell><StatusBadge value={s.conformity_status} /></TableCell>
                <TableCell>{s.requested_quantity ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell><RowActions onEdit={() => openEdit(s)} onDelete={() => setDelId(s.id)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{selected?.code}</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Product</div><div>{selected.product?.name ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Project</div><div>{selected.project?.name ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Type</div><StatusBadge value={selected.sample_type} /></div>
                <div><div className="text-xs text-muted-foreground">Phase</div><StatusBadge value={selected.phase} /></div>
                <div><div className="text-xs text-muted-foreground">Conformity</div><StatusBadge value={selected.conformity_status} /></div>
                <div><div className="text-xs text-muted-foreground">Quantity</div><div>{selected.requested_quantity ?? "—"}</div></div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Sample Steps</h3>
                {steps.length === 0 ? <p className="text-sm text-muted-foreground">No steps recorded</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>#</TableHead><TableHead>Step</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead>Conformity</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {steps.map((st) => (
                        <TableRow key={st.id}>
                          <TableCell>{st.sequence}</TableCell>
                          <TableCell className="capitalize">{st.step_type?.replace(/_/g, " ")}</TableCell>
                          <TableCell><StatusBadge value={st.workflow_status} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{st.due_date ? new Date(st.due_date).toLocaleDateString() : "—"}</TableCell>
                          <TableCell><StatusBadge value={st.conformity_status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Sample" : "New Sample"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div>
              <Label>Project</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v, product_color_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.style_code ?? p.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Colorway</Label>
              <Select value={form.product_color_id} onValueChange={(v) => setForm({ ...form, product_color_id: v })}>
                <SelectTrigger><SelectValue placeholder={form.product_id ? "Select" : "Pick a product first"} /></SelectTrigger>
                <SelectContent>{colors.map((c) => <SelectItem key={c.id} value={c.id}>{c.color_name} ({c.colorway_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sample Type</Label>
              <Select value={form.sample_type} onValueChange={(v) => setForm({ ...form, sample_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SAMPLE_TYPES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phase</Label>
              <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{PHASES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Requested Quantity</Label><Input type="number" value={form.requested_quantity} onChange={(e) => setForm({ ...form, requested_quantity: e.target.value })} /></div>
            <div>
              <Label>Conformity</Label>
              <Select value={form.conformity_status} onValueChange={(v) => setForm({ ...form, conformity_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONFORMITY.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editId ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sample?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
