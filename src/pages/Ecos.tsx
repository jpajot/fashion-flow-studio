import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/lib/badges";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const REASONS = ["quality", "cost", "supplier_change", "design_change", "regulatory", "sourcing_update", "routing_update", "other"];
const PRIORITIES = ["low", "normal", "high", "critical"];
const ECO_STATUSES = ["proposed", "under_review", "approved", "rejected", "applied", "cancelled", "closed"];
const ECR_STATUSES = ["open", "under_investigation", "converted", "closed_no_action", "rejected"];
const ORIGINS = ["manual", "dev_bom_release", "routing_change", "sourcing_change", "component_revision", "ecr_conversion"];
const FLOW_TYPES = ["manual", "mixed", "A_dev_bom_release", "B_routing_change", "C_sourcing_change", "D_component_revision"];

export default function Ecos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Change Management</h1>
        <p className="text-muted-foreground">Engineering change orders and requests</p>
      </div>
      <Tabs defaultValue="ecos">
        <TabsList>
          <TabsTrigger value="ecos">ECOs</TabsTrigger>
          <TabsTrigger value="ecrs">ECRs</TabsTrigger>
        </TabsList>
        <TabsContent value="ecos"><EcosTab /></TabsContent>
        <TabsContent value="ecrs"><EcrsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

const ecoEmpty = { eco_number: "", title: "", reason_category: "", priority: "normal", status: "proposed", origin: "manual", flow_type: "manual", requested_by: "", description: "" };

function EcosTab() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(ecoEmpty);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      let q = supabase.from("ecos").select("*").order("requested_at", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("status", status);
      if (priority !== "all") q = q.eq("priority", priority);
      const { data } = await q;
      setItems(data ?? []);
    })();
  }, [status, priority, refresh]);

  const openNew = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setEditId(null);
    setForm({ ...ecoEmpty, requested_by: user?.email ?? "" });
    setOpen(true);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({
      eco_number: e.eco_number ?? "", title: e.title ?? "", reason_category: e.reason_category ?? "",
      priority: e.priority ?? "normal", status: e.status ?? "proposed", origin: e.origin ?? "manual",
      flow_type: e.flow_type ?? "manual", requested_by: e.requested_by ?? "", description: e.description ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.eco_number || !form.title) return toast.error("Number and title required");
    setSaving(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editId
      ? await supabase.from("ecos").update(payload).eq("id", editId)
      : await supabase.from("ecos").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "ECO updated" : "ECO created");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("ecos").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("ECO deleted");
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{["all", ...ECO_STATUSES].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>{["all", ...PRIORITIES].map((p) => <SelectItem key={p} value={p}>{p === "all" ? "All priorities" : p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New ECO</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ECO #</TableHead><TableHead>Title</TableHead><TableHead>Reason</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Origin</TableHead><TableHead>Requested by</TableHead><TableHead>Date</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.eco_number}</TableCell>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell className="capitalize text-sm">{e.reason_category?.replace(/_/g, " ") ?? "—"}</TableCell>
                <TableCell><StatusBadge value={e.priority} /></TableCell>
                <TableCell><StatusBadge value={e.status} /></TableCell>
                <TableCell className="text-sm capitalize">{e.origin ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_by ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_at ? new Date(e.requested_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell><RowActions onEdit={() => openEdit(e)} onDelete={() => setDelId(e.id)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit ECO" : "New ECO"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label>ECO Number *</Label><Input value={form.eco_number} onChange={(e) => setForm({ ...form, eco_number: e.target.value })} /></div>
            <div><Label>Requested by</Label><Input value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} /></div>
            <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Reason</Label>
              <Select value={form.reason_category} onValueChange={(v) => setForm({ ...form, reason_category: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{REASONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ECO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Origin</Label>
              <Select value={form.origin} onValueChange={(v) => setForm({ ...form, origin: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGINS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Flow Type</Label>
              <Select value={form.flow_type} onValueChange={(v) => setForm({ ...form, flow_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FLOW_TYPES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
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
            <AlertDialogTitle>Delete ECO?</AlertDialogTitle>
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

const ecrEmpty = { ecr_number: "", title: "", reason_category: "", priority: "normal", status: "open", requested_by: "", description: "" };

function EcrsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(ecrEmpty);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      let q = supabase.from("ecrs").select("*").order("requested_at", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("status", status);
      if (priority !== "all") q = q.eq("priority", priority);
      const { data } = await q;
      setItems(data ?? []);
    })();
  }, [status, priority, refresh]);

  const openNew = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setEditId(null);
    setForm({ ...ecrEmpty, requested_by: user?.email ?? "" });
    setOpen(true);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({
      ecr_number: e.ecr_number ?? "", title: e.title ?? "", reason_category: e.reason_category ?? "",
      priority: e.priority ?? "normal", status: e.status ?? "open", requested_by: e.requested_by ?? "", description: e.description ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.ecr_number || !form.title) return toast.error("Number and title required");
    setSaving(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editId
      ? await supabase.from("ecrs").update(payload).eq("id", editId)
      : await supabase.from("ecrs").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "ECR updated" : "ECR created");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("ecrs").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("ECR deleted");
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{["all", ...ECR_STATUSES].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>{["all", ...PRIORITIES].map((p) => <SelectItem key={p} value={p}>{p === "all" ? "All priorities" : p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New ECR</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ECR #</TableHead><TableHead>Title</TableHead><TableHead>Reason</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Requested by</TableHead><TableHead>Date</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.ecr_number}</TableCell>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell className="capitalize text-sm">{e.reason_category?.replace(/_/g, " ") ?? "—"}</TableCell>
                <TableCell><StatusBadge value={e.priority} /></TableCell>
                <TableCell><StatusBadge value={e.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_by ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_at ? new Date(e.requested_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell><RowActions onEdit={() => openEdit(e)} onDelete={() => setDelId(e.id)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit ECR" : "New ECR"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label>ECR Number *</Label><Input value={form.ecr_number} onChange={(e) => setForm({ ...form, ecr_number: e.target.value })} /></div>
            <div><Label>Requested by</Label><Input value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} /></div>
            <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Reason</Label>
              <Select value={form.reason_category} onValueChange={(v) => setForm({ ...form, reason_category: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{REASONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ECR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
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
            <AlertDialogTitle>Delete ECR?</AlertDialogTitle>
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
