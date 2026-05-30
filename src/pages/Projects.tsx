import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RowActions } from "@/components/ui/RowActions";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type Project = Record<string, any> & { id: string };

const TYPES = ["Seasonal Collection", "Artist Collaboration", "Capsule", "Limited Edition", "Core Range", "Other"];
const SEASONS = ["SS25", "FW25", "SS26", "FW26", "Evergreen"];
const STATUSES = ["Planning", "Active", "Archived"];

const empty = { name: "", type: "", season: "", status: "Planning", description: "" };

export default function Projects() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(100);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data } = await q;
      setItems((data as Project[]) ?? []);
      setLoading(false);
    })();
  }, [search, refresh]);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Project) => {
    setEditId(p.id);
    setForm({ name: p.name ?? "", type: p.type ?? "", season: p.season ?? "", status: p.status ?? "Planning", description: p.description ?? "" });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editId
      ? await supabase.from("projects").update(payload).eq("id", editId)
      : await supabase.from("projects").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Project updated" : "Project created");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("projects").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">{items.length} projects</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Project</Button>
      </div>
      <Input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Season</TableHead><TableHead>Status</TableHead><TableHead>Target Date</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No projects</TableCell></TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                  <TableCell>{p.type ?? "—"}</TableCell>
                  <TableCell>{p.season ?? "—"}</TableCell>
                  <TableCell>{p.status && <Badge variant="secondary">{p.status}</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.target_date ? new Date(p.target_date).toLocaleDateString() : p.due_date ? new Date(p.due_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell><RowActions onEdit={() => openEdit(p)} onDelete={() => setDelId(p.id)} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
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
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editId ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
