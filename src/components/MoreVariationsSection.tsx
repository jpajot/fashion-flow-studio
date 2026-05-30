import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function MoreVariationsSection({ productId }: { productId: string }) {
  const { toast } = useToast();
  const [colorways, setColorways] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const empty = { product_color_id: "", sequence: "", name: "", pack_code: "", variant: "" };
  const [form, setForm] = useState<any>(empty);

  useEffect(() => {
    (async () => {
      const { data: cws } = await supabase
        .from("product_colors")
        .select("id,color_name,colorway_code")
        .eq("product_id", productId);
      setColorways(cws ?? []);
      const ids = (cws ?? []).map((c) => c.id);
      if (!ids.length) { setRows([]); return; }
      const { data } = await supabase
        .from("product_color_and_more")
        .select("*, product_colors(color_name, colorway_code)")
        .in("product_color_id", ids)
        .order("sequence");
      setRows(data ?? []);
    })();
  }, [productId, refresh]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (v: any) => {
    setEditing(v);
    setForm({
      product_color_id: v.product_color_id ?? "",
      sequence: v.sequence ?? "",
      name: v.name ?? "",
      pack_code: v.pack_code ?? "",
      variant: v.variant ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.product_color_id) { toast({ title: "Colorway required", variant: "destructive" }); return; }
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    const res = editing
      ? await supabase.from("product_color_and_more").update(payload).eq("id", editing.id)
      : await supabase.from("product_color_and_more").insert(payload);
    if (res.error) { toast({ title: "Save failed", description: res.error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Updated" : "Created" });
    setOpen(false);
    setRefresh((r) => r + 1);
  };

  const doDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("product_color_and_more").delete().eq("id", delId);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    setDelId(null);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add variation</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colorway</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Sequence</TableHead>
              <TableHead>Pack code</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead className="w-24 text-right">Sizes</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No variations</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.product_colors?.color_name} <span className="text-muted-foreground font-mono text-xs">{r.product_colors?.colorway_code}</span></TableCell>
                  <TableCell>{r.name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.sequence || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.pack_code || "—"}</TableCell>
                  <TableCell>{r.variant || "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{(r.size_ids || []).length}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDelId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Variation" : "New Variation"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colorway *</Label>
              <Select value={form.product_color_id} onValueChange={(v) => setForm({ ...form, product_color_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {colorways.map((c) => <SelectItem key={c.id} value={c.id}>{c.color_name} ({c.colorway_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Sequence</Label><Input value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} /></div>
            <div><Label>Pack code</Label><Input value={form.pack_code} onChange={(e) => setForm({ ...form, pack_code: e.target.value })} /></div>
            <div><Label>Variant</Label><Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
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
