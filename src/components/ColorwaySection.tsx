import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Library, LayoutGrid, List as ListIcon, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ColorwayEditModal from "@/components/ColorwayEditModal";
import ColorLibraryPickerModal, { PickerItem } from "@/components/ColorLibraryPickerModal";
import { usePageOptions } from "@/contexts/PageOptionsContext";

const VIEW_KEY = "colorway_section_view";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  submitted_for_approval: "bg-purple-100 text-purple-700 border-purple-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  obsolete: "bg-gray-100 text-gray-500 border-gray-200",
};

function renderStatusBadge(status: string | null | undefined) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = STATUS_COLORS[status] || "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SwatchBlock({ cw, product, comm }: { cw: any; product: any; comm: any }) {
  // 1) colorway image
  if (cw.image_url) {
    return <img src={cw.image_url} className="w-full h-full object-cover" alt={cw.color_name} />;
  }
  // 2) product main image with hex overlay
  const productImg = Array.isArray(product?.images) && product.images[0];
  if (productImg) {
    return (
      <div className="relative w-full h-full">
        <img src={productImg} className="w-full h-full object-cover" alt="" />
        <div
          className="absolute bottom-1 left-1 h-6 w-6 rounded border-2 border-white shadow"
          style={{ backgroundColor: cw.color_hex || "#e5e7eb" }}
        />
      </div>
    );
  }
  // 3) Combined commercial color → split segments
  if (comm?.combined_color_ids && Array.isArray(comm.combined_color_ids) && comm.combined_color_ids.length > 1) {
    const hexes: string[] = comm.combined_hexes || comm.combined_color_ids.map(() => cw.color_hex || "#e5e7eb");
    return (
      <div className="flex w-full h-full">
        {hexes.map((h, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: h || "#e5e7eb" }} />
        ))}
      </div>
    );
  }
  // 4) solid
  return <div className="w-full h-full" style={{ backgroundColor: cw.color_hex || "#e5e7eb" }} />;
}

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
  const { setOptions } = usePageOptions();
  const [colorways, setColorways] = useState<any[]>([]);
  const [techColors, setTechColors] = useState<any[]>([]);
  const [commColors, setCommColors] = useState<any[]>([]);
  const [revByTarget, setRevByTarget] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">(() => {
    try { return (localStorage.getItem(VIEW_KEY) as any) || "grid"; } catch { return "grid"; }
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch {}
  }, [view]);

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

      if (list.length) {
        const ids = list.map((c) => c.id);
        const { data: revs } = await supabase
          .from("product_revisions")
          .select("target_id, revision_code")
          .in("target_id", ids)
          .eq("target_type", "product_color")
          .eq("is_current", true);
        const map: Record<string, string> = {};
        (revs ?? []).forEach((r: any) => { map[r.target_id] = r.revision_code; });
        setRevByTarget(map);
      } else {
        setRevByTarget({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, refresh]);

  const techById = useMemo(() => Object.fromEntries(techColors.map((t) => [t.id, t])), [techColors]);
  const commById = useMemo(() => Object.fromEntries(commColors.map((c) => [c.id, c])), [commColors]);

  const openNew = () => { setEditing(null); setEditOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setEditOpen(true); };

  const handleDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("product_colors").delete().eq("id", delId);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Colorway deleted" }); setRefresh((r) => r + 1); }
    setDelId(null);
  };

  const addFromLibrary = async (picks: PickerItem[]) => {
    if (picks.length === 0) return;
    const maxSeqStart = colorways.reduce((m, s) => Math.max(m, Number(s.sequence || 0)), 0);
    let n = 0;
    for (const p of picks) {
      let payload: any = {
        product_id: productId,
        color_name: p.name,
        colorway_code: p.code,
        color_hex: p.hex,
      };
      if (p.type === "technical") {
        payload.linked_tech_color_id = p.id;
        // try inherit commercial
        const comm = commColors.find((c) => c.main_technical_color_id === p.id);
        if (comm) {
          payload.linked_color_type = "commercial";
          payload.linked_color_id = comm.id;
          payload.colorway_code = comm.code;
          payload.color_name = comm.color_name || p.name;
        }
      } else {
        payload.linked_color_type = "commercial";
        payload.linked_color_id = p.id;
        if (p.mainTechId) payload.linked_tech_color_id = p.mainTechId;
      }
      const { data: pc, error } = await supabase
        .from("product_colors")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast({ title: "Insert failed", description: error.message, variant: "destructive" });
        continue;
      }
      n++;
      if (payload.linked_tech_color_id) {
        const seq = String(maxSeqStart + n).padStart(4, "0");
        const sizeIds = styleSizes.filter((s) => s.is_active !== false).map((s) => s.size_id || s.id);
        await supabase.from("product_color_and_more").insert({
          product_color_id: pc.id,
          name: payload.color_name || "Default",
          sequence: seq,
          size_ids: sizeIds,
        });
      }
    }
    setPickerOpen(false);
    setRefresh((r) => r + 1);
    toast({ title: `${n} colorway${n !== 1 ? "s" : ""} added` });
  };

  // Options drawer
  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Colorway", icon: Plus, onClick: openNew, className: "text-primary hover:bg-primary/10" },
        { label: "Add from Library", icon: Library, onClick: () => setPickerOpen(true) },
        { divider: true },
        {
          label: view === "grid" ? "View: List" : "View: Grid",
          icon: view === "grid" ? ListIcon : LayoutGrid,
          onClick: () => setView(view === "grid" ? "list" : "grid"),
        },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: () => setRefresh((r) => r + 1) },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {colorways.length} colorway{colorways.length !== 1 ? "s" : ""}
        </div>
        <div className="flex gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("list")}><ListIcon className="h-4 w-4" /></Button>
          </div>
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
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {colorways.map((c) => {
            const tech = c.linked_tech_color_id ? techById[c.linked_tech_color_id] : null;
            const comm = c.linked_color_id ? commById[c.linked_color_id] : null;
            const rev = revByTarget[c.id];
            return (
              <Card key={c.id} className="overflow-hidden group relative">
                <div className="aspect-square bg-muted relative">
                  <SwatchBlock cw={c} product={product} comm={comm} />
                  {/* badges overlay top-right */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    {!c.linked_color_id && (
                      <div title="No commercial color linked" className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-white" />
                    )}
                    {c.linked_color_id && (
                      <Badge className="bg-background/80 backdrop-blur text-foreground text-[9px] py-0 px-1.5 border">
                        {c.linked_color_type === "technical" ? "TCX" : "COM"}
                      </Badge>
                    )}
                    {rev && (
                      <Badge className="bg-primary text-primary-foreground text-[9px] py-0 px-1.5">{rev}</Badge>
                    )}
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-1">
                  <div className="font-medium text-sm truncate">{c.color_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.colorway_code || "—"}</div>
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
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tech</TableHead>
                <TableHead>Commercial</TableHead>
                <TableHead>Rev</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colorways.map((c) => {
                const tech = c.linked_tech_color_id ? techById[c.linked_tech_color_id] : null;
                const comm = c.linked_color_id ? commById[c.linked_color_id] : null;
                const rev = revByTarget[c.id];
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="h-8 w-8 rounded border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                    </TableCell>
                    <TableCell className="font-medium">{c.color_name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.colorway_code || "—"}</TableCell>
                    <TableCell>{renderStatusBadge(c.colorway_status)}</TableCell>
                    <TableCell className="text-xs">{tech ? `${tech.code} ${tech.name || ""}` : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {comm ? `${comm.code} ${comm.color_name || ""}` : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">⚠ none</Badge>
                      )}
                    </TableCell>
                    <TableCell>{rev ? <Badge>{rev}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDelId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
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
          onSaved={() => { setEditOpen(false); setRefresh((r) => r + 1); }}
          onCancel={() => setEditOpen(false)}
        />
      )}

      <ColorLibraryPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        techColors={techColors}
        commColors={commColors}
        onConfirm={addFromLibrary}
      />

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
