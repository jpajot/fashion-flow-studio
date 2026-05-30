import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/lib/badges";
import { Check, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

type Supplier = Record<string, any> & { id: string };

const CAPABILITIES = ["Cut & Sew", "Knitting", "Weaving", "Dyeing", "Embroidery", "Printing"];
const CERTS = ["GOTS", "OEKO-TEX", "ISO 9001", "BSCI"];
const STATUSES = ["active", "inactive", "suspended"];

const empty = {
  name: "", code: "", country: "", region: "", city: "",
  primary_contact_name: "", primary_contact_email: "", primary_contact_phone: "",
  capabilities: [] as string[], certifications: [] as string[],
  status: "active", portal_access_enabled: false, notes: "",
};

export default function Suppliers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground">Manage suppliers and portal access</p>
      </div>
      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Supplier Directory</TabsTrigger>
          <TabsTrigger value="invites">Portal Invites</TabsTrigger>
        </TabsList>
        <TabsContent value="directory"><Directory /></TabsContent>
        <TabsContent value="invites"><Invites /></TabsContent>
      </Tabs>
    </div>
  );
}

function Directory() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("suppliers").select("*").order("name").limit(500);
      setItems((data as Supplier[]) ?? []);
    })();
  }, [refresh]);

  const filtered = items.filter((s) =>
    !search || `${s.name} ${s.code} ${s.country ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({
      name: s.name ?? "", code: s.code ?? "", country: s.country ?? "", region: s.region ?? "", city: s.city ?? "",
      primary_contact_name: s.primary_contact_name ?? "", primary_contact_email: s.primary_contact_email ?? "", primary_contact_phone: s.primary_contact_phone ?? "",
      capabilities: s.capabilities ?? [], certifications: s.certifications ?? [],
      status: s.status ?? "active", portal_access_enabled: !!s.portal_access_enabled, notes: s.notes ?? "",
    });
    setOpen(true);
  };

  const toggle = (key: "capabilities" | "certifications", v: string) => {
    const arr: string[] = form[key];
    setForm({ ...form, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] });
  };

  const submit = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editId
      ? await supabase.from("suppliers").update(payload).eq("id", editId)
      : await supabase.from("suppliers").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Supplier updated" : "Supplier created");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("Supplier deleted");
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3">
        <Input placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Supplier</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" /><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Country</TableHead><TableHead>Region</TableHead><TableHead>Capabilities</TableHead><TableHead>Status</TableHead><TableHead>Portal</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <Fragment key={s.id}>
                <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  <TableCell>{expanded === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.country ?? "—"}</TableCell>
                  <TableCell>{s.region ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(s.capabilities ?? []).slice(0, 3).map((c: string) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                      {(s.capabilities ?? []).length > 3 && <span className="text-xs text-muted-foreground">+{s.capabilities!.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge value={s.status} /></TableCell>
                  <TableCell>{s.portal_access_enabled ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell><RowActions onEdit={() => openEdit(s)} onDelete={() => setDelId(s.id)} /></TableCell>
                </TableRow>
                {expanded === s.id && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2 text-sm">
                        <div><div className="text-xs text-muted-foreground">Primary Contact</div><div>{s.primary_contact_name ?? "—"}</div></div>
                        <div><div className="text-xs text-muted-foreground">Email</div><div>{s.primary_contact_email ?? "—"}</div></div>
                        <div><div className="text-xs text-muted-foreground">Phone</div><div>{s.primary_contact_phone ?? "—"}</div></div>
                        <div className="col-span-full">
                          <div className="text-xs text-muted-foreground mb-1">Certifications</div>
                          <div className="flex flex-wrap gap-1">{(s.certifications ?? []).map((c: string) => <Badge key={c} variant="outline">{c}</Badge>)}</div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Contact Name</Label><Input value={form.primary_contact_name} onChange={(e) => setForm({ ...form, primary_contact_name: e.target.value })} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={form.primary_contact_email} onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })} /></div>
            <div><Label>Contact Phone</Label><Input value={form.primary_contact_phone} onChange={(e) => setForm({ ...form, primary_contact_phone: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Capabilities</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {CAPABILITIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.capabilities.includes(c)} onCheckedChange={() => toggle("capabilities", c)} />{c}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Certifications</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {CERTS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.certifications.includes(c)} onCheckedChange={() => toggle("certifications", c)} />{c}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={form.portal_access_enabled} onCheckedChange={(v) => setForm({ ...form, portal_access_enabled: v })} />
              <Label>Portal access enabled</Label>
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
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
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

function Invites() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("supplier_portal_invites").select("*, supplier:supplier_id(name)").order("invited_at", { ascending: false }).limit(500).then(({ data }) => setItems(data ?? []));
  }, []);
  return (
    <Card className="mt-4">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead><TableHead>Invited</TableHead><TableHead>Expires</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.invited_email}</TableCell>
              <TableCell>{i.invited_name ?? "—"}</TableCell>
              <TableCell>{i.supplier?.name ?? "—"}</TableCell>
              <TableCell><StatusBadge value={i.status} /></TableCell>
              <TableCell className="text-muted-foreground text-sm">{i.invited_at ? new Date(i.invited_at).toLocaleDateString() : "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{i.expires_at ? new Date(i.expires_at).toLocaleDateString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
