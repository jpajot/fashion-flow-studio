import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Library } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ColorwayEditModal from "@/components/ColorwayEditModal";

export default function ColorwaySection({
  productId,
  product,
  styleSizes,
  projects,
  onCountChange,
}: {
  productId: string;
  product: any;
  styleSizes: any[];
  projects: any[];
  onCountChange?: (n: number) => void;
}) {
  const { toast } = useToast();
  const [colorways, setColorways] = useState<any[]>([]);
  const [techColors, setTechColors] = useState<any[]>([]);
  const [commColors, setCommColors] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerSel, setPickerSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [cw, tech, comm] = await Promise.all([
        supabase.from("product_colors").select("*").eq("product_id", productId).order("created_at", { ascending: false }),
        supabase.from("technical_colors").select("*").order("code"),
        supabase.from("commercial_colors").select("*").order("code"),
      ]);
      const list = (cw.data ?? []) as any[];
      setColorways(list);
      setTechColors((tech.data ?? []) as any[]);
      setCommColors((comm.data ?? []) as any[]);
      onCountChange?.(list.length);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, refresh]);

  const openNew = () => {
    setEditing(null);
    setEditOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setEditOpen(true);
  };

  const handleDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("product_colors").delete().eq("id", delId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Colorway deleted" });
      setRefresh((r) => r + 1);
    }
    setDelId(null);
  };

  const techById = useMemo(() => Object.fromEntries(techColors.map((t) => [t.id, t])), [techColors]);
  const commById = useMemo(() => Object.fromEntries(commColors.map((c) => [c.id, c])), [commColors]);

  const filteredComm = useMemo(() => {
    const k = pickerQ.toLowerCase();
    if (!k) return commColors.slice(0, 100);
    return commColors
      .filter((c) =>
        [c.code, c.color_name].filter(Boolean).some((s: string) => s.toLowerCase().includes(k)),
      )
      .slice(0, 100);
  }, [commColors, pickerQ]);

  const addFromLibrary = async () => {
    if (pickerSel.size === 0) return;
    const maxSeqStart = colorways.reduce((m, s) => Math.max(m, Number(s.sequence || 0)), 0);
    let n = 0;
    for (const cid of pickerSel) {
      const comm = commById[cid];
      if (!comm) continue;
      const main = techById[comm.main_technical_color_id];
      const { data: pc, error } = await supabase
        .from("product_colors")
        .insert({
          product_id: productId,
          color_name: comm.color_name,
          colorway_code: comm.code,
          color_hex: main?.hex || null,
          linked_tech_color_id: main?.id || null,
          linked_color_type: "commercial",
          linked_color_id: comm.id,
        })
        .select()
        .single();
      if (error) {
        toast({ title: "Insert failed", description: error.message, variant: "destructive" });
        continue;
      }
      n++;
      if (main?.id) {
        const seq = String(maxSeqStart + n).padStart(4, "0");
        const sizeIds = styleSizes.filter((s) => s.is_active !== false).map((s) => s.size_id || s.id);
        await supabase.from("product_color_and_more").insert({
          product_color_id: pc.id,
          name: comm.color_name || "Default",
          sequence: seq,
          size_ids: sizeIds,
        });
      }
    }
    setPickerOpen(false);
    setPickerSel(new Set());
    setPickerQ("");
    setRefresh((r) => r + 1);
    toast({ title: `${n} colorway${n !== 1 ? "s" : ""} added` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">{colorways.length} colorway{colorways.length !== 1 ? "s" : ""}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Library className="h-4 w-4 mr-2" /> Add from Library
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Add New
          </Button>
        </div>
      </div>

      {colorways.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No colorways yet</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {colorways.map((c) => {
            const tech = c.linked_tech_color_id ? techById[c.linked_tech_color_id] : null;
            const comm = c.linked_color_id ? commById[c.linked_color_id] : null;
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  {c.image_url ? (
                    <img src={c.image_url} className="w-full h-full object-cover" alt={c.color_name} />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                  )}
                </div>
                <CardContent className="p-3 space-y-1">
                  <div className="font-medium text-sm truncate">{c.color_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.colorway_code || "—"}</div>
                  {c.color_hex && <div className="text-xs text-muted-foreground font-mono">{c.color_hex}</div>}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tech && <Badge variant="outline" className="text-[10px]">T: {tech.code}</Badge>}
                    {comm && <Badge variant="outline" className="text-[10px]">C: {comm.code}</Badge>}
                  </div>
                  <div className="flex justify-end gap-1 pt-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDelId(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editOpen && (
        <ColorwayEditModal
          open={editOpen}
          onOpenChange={setEditOpen}
          productId={productId}
          existing={editing}
          siblings={colorways}
          techColors={techColors}
          commColors={commColors}
          projects={projects}
          styleSizes={styleSizes}
          onSaved={() => {
            setEditOpen(false);
            setRefresh((r) => r + 1);
          }}
          onCancel={() => setEditOpen(false)}
        />
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add from Color Library</DialogTitle>
          </DialogHeader>
          <Input placeholder="Search commercial colors…" value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {filteredComm.map((c) => {
              const main = techById[c.main_technical_color_id];
              const sel = pickerSel.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(pickerSel);
                    sel ? next.delete(c.id) : next.add(c.id);
                    setPickerSel(next);
                  }}
                  className={`flex items-center gap-2 border rounded-md p-2 text-left ${sel ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="h-8 w-8 rounded border shrink-0" style={{ backgroundColor: main?.hex || "#e5e7eb" }} />
                  <div className="min-w-0">
                    <div className="text-xs font-mono">{c.code}</div>
                    <div className="text-sm truncate">{c.color_name}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={addFromLibrary} disabled={pickerSel.size === 0}>
              Add {pickerSel.size > 0 ? `(${pickerSel.size})` : ""}
            </Button>
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
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
