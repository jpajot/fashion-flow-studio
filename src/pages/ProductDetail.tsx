import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/lib/badges";
import { ArrowLeft, Shirt, Check, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

const COLORWAY_STATUSES = ["approved", "requested", "in_progress", "rejected", "obsolete"];

function ColorwaysTab({ id, product }: { id: string; product: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const empty = { color_name: "", colorway_code: "", color_hex: "#000000", colorway_status: "approved", image_url: "" };
  const [form, setForm] = useState<any>(empty);

  useEffect(() => {
    supabase.from("product_colors").select("*").eq("product_id", id).then(({ data }) => setRows(data ?? []));
  }, [id, refresh]);

  const openNew = () => {
    setEditId(null);
    const next = `${product?.code ?? product?.style_code ?? "CW"}-${String(rows.length + 1).padStart(3, "0")}`;
    setForm({ ...empty, colorway_code: next });
    setOpen(true);
  };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      color_name: c.color_name ?? "", colorway_code: c.colorway_code ?? "",
      color_hex: c.color_hex ?? "#000000", colorway_status: c.colorway_status ?? "approved", image_url: c.image_url ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.color_name) return toast.error("Color name required");
    setSaving(true);
    const payload: any = { ...form, product_id: id };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editId
      ? await supabase.from("product_colors").update(payload).eq("id", editId)
      : await supabase.from("product_colors").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Colorway updated" : "Colorway created");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("product_colors").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("Colorway deleted");
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Colorway</Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center">No colorways</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="aspect-square bg-muted overflow-hidden">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.color_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ backgroundColor: c.color_hex ?? "#e5e7eb" }} />
                )}
              </div>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-4 w-4 rounded-full border shrink-0" style={{ backgroundColor: c.color_hex ?? "#e5e7eb" }} />
                    <div className="font-medium text-sm truncate">{c.color_name}</div>
                  </div>
                  <RowActions onEdit={() => openEdit(c)} onDelete={() => setDelId(c.id)} />
                </div>
                <div className="text-xs text-muted-foreground font-mono">{c.colorway_code}</div>
                <StatusBadge value={c.colorway_status} className="text-xs" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Colorway" : "New Colorway"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Color Name *</Label><Input value={form.color_name} onChange={(e) => setForm({ ...form, color_name: e.target.value })} /></div>
            <div><Label>Colorway Code</Label><Input value={form.colorway_code} onChange={(e) => setForm({ ...form, colorway_code: e.target.value })} /></div>
            <div>
              <Label>Color Hex</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} className="w-16 p-1 h-10" />
                <Input value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.colorway_status} onValueChange={(v) => setForm({ ...form, colorway_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COLORWAY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
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
            <AlertDialogTitle>Delete colorway?</AlertDialogTitle>
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

function VariationsTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [colorways, setColorways] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const empty = { product_color_id: "", sequence: "", name: "", description: "", color_hex: "#000000", pack_code: "", variant: "" };
  const [form, setForm] = useState<any>(empty);

  useEffect(() => {
    (async () => {
      const { data: cws } = await supabase.from("product_colors").select("id,color_name,colorway_code").eq("product_id", id);
      setColorways(cws ?? []);
      const ids = (cws ?? []).map((c) => c.id);
      if (ids.length === 0) { setRows([]); return; }
      const { data } = await supabase.from("product_color_and_more")
        .select("*, product_colors(product_id, color_name, colorway_code)")
        .in("product_color_id", ids);
      setRows(data ?? []);
    })();
  }, [id, refresh]);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (v: any) => {
    setEditId(v.id);
    setForm({
      product_color_id: v.product_color_id ?? "", sequence: v.sequence ?? "", name: v.name ?? "",
      description: v.description ?? "", color_hex: v.color_hex ?? "#000000", pack_code: v.pack_code ?? "", variant: v.variant ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.product_color_id) return toast.error("Colorway required");
    setSaving(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editId
      ? await supabase.from("product_color_and_more").update(payload).eq("id", editId)
      : await supabase.from("product_color_and_more").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Variation updated" : "Variation created");
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("product_color_and_more").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("Variation deleted");
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} disabled={colorways.length === 0}><Plus className="h-4 w-4 mr-2" /> New Variation</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colorway</TableHead><TableHead>Seq</TableHead><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Pack</TableHead><TableHead>Variant</TableHead><TableHead>Color</TableHead><TableHead>Created</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No variations</TableCell></TableRow>
            ) : rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="text-sm">{v.product_colors?.color_name} <span className="text-muted-foreground font-mono text-xs">{v.product_colors?.colorway_code}</span></TableCell>
                <TableCell>{v.sequence ?? "—"}</TableCell>
                <TableCell className="font-medium">{v.name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{v.description ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{v.pack_code ?? "—"}</TableCell>
                <TableCell>{v.variant ?? "—"}</TableCell>
                <TableCell><div className="h-5 w-5 rounded border" style={{ backgroundColor: v.color_hex ?? "#e5e7eb" }} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(v.created_at)}</TableCell>
                <TableCell><RowActions onEdit={() => openEdit(v)} onDelete={() => setDelId(v.id)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Variation" : "New Variation"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Colorway *</Label>
              <Select value={form.product_color_id} onValueChange={(v) => setForm({ ...form, product_color_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{colorways.map((c) => <SelectItem key={c.id} value={c.id}>{c.color_name} ({c.colorway_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Sequence</Label><Input value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} /></div>
              <div><Label>Pack Code</Label><Input value={form.pack_code} onChange={(e) => setForm({ ...form, pack_code: e.target.value })} /></div>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Variant</Label><Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} /></div>
              <div>
                <Label>Color Hex</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} className="w-16 p-1 h-10" />
                  <Input value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} />
                </div>
              </div>
            </div>
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
            <AlertDialogTitle>Delete variation?</AlertDialogTitle>
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

function SizesTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("style_sizes").select("*, sizes(size_code,name)").eq("product_id", id).then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Size Code</TableHead><TableHead>Name</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No sizes</TableCell></TableRow>
            : rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.sizes?.size_code}</TableCell>
                <TableCell>{s.sizes?.name}</TableCell>
                <TableCell>{s.active !== false && <Check className="h-4 w-4 text-emerald-600" />}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function BomsTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("boms").select("*").eq("product_id", id).order("version", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Revision</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Released</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No BOMs</TableCell></TableRow>
            : rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell><Badge variant="outline">{b.bom_type}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{b.revision_code}</TableCell>
                <TableCell>v{b.version}</TableCell>
                <TableCell><StatusBadge value={b.status} /></TableCell>
                <TableCell>{fmtDate(b.released_at)}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{b.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function RoutingTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("supplier_routings").select("*").eq("product_id", id).order("version", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Revision</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Default</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No routings</TableCell></TableRow>
            : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.routing_type}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.revision_code}</TableCell>
                <TableCell>v{r.version}</TableCell>
                <TableCell><StatusBadge value={r.status} /></TableCell>
                <TableCell>{r.is_default && <Check className="h-4 w-4 text-emerald-600" />}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      setProduct(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!product) return <div>Product not found</div>;

  const firstImage = Array.isArray(product.images) ? product.images[0] : product.image_url;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/styles")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Style Library
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">
        <Card>
          <div className="aspect-square bg-muted grid place-items-center overflow-hidden">
            {firstImage ? <img src={firstImage} alt={product.name} className="w-full h-full object-cover" /> : <Shirt className="h-20 w-20 text-muted-foreground/40" />}
          </div>
          <CardContent className="p-5 space-y-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
              <p className="text-sm font-mono text-muted-foreground">{product.style_code ?? product.code}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.type && <Badge variant="outline">{product.type}</Badge>}
              {product.sub_type && <Badge variant="secondary">{product.sub_type}</Badge>}
              {product.status && <StatusBadge value={product.status} />}
            </div>
            <div className="space-y-2 text-sm pt-2 border-t">
              {product.category && <div><span className="text-muted-foreground">Category: </span>{product.category}</div>}
              {product.sub_category && <div><span className="text-muted-foreground">Sub-category: </span>{product.sub_category}</div>}
              {product.customer_need && <div><span className="text-muted-foreground">Customer need: </span>{product.customer_need}</div>}
              {product.bom_workflow_pattern && (
                <div className="pt-2"><Badge variant="outline">BOM: {product.bom_workflow_pattern}</Badge></div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="colorways">
          <TabsList>
            <TabsTrigger value="colorways">Colorways</TabsTrigger>
            <TabsTrigger value="variations">Variations</TabsTrigger>
            <TabsTrigger value="sizes">Sizes</TabsTrigger>
            <TabsTrigger value="boms">BOMs</TabsTrigger>
            <TabsTrigger value="routing">Routing</TabsTrigger>
          </TabsList>
          <TabsContent value="colorways" className="mt-6"><ColorwaysTab id={id!} product={product} /></TabsContent>
          <TabsContent value="variations" className="mt-6"><VariationsTab id={id!} /></TabsContent>
          <TabsContent value="sizes" className="mt-6"><SizesTab id={id!} /></TabsContent>
          <TabsContent value="boms" className="mt-6"><BomsTab id={id!} /></TabsContent>
          <TabsContent value="routing" className="mt-6"><RoutingTab id={id!} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
