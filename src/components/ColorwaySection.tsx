import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Library, LayoutGrid, List as ListIcon, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ColorwayEditModal from "@/components/ColorwayEditModal";
import ColorLibraryPickerModal, { PickerItem } from "@/components/ColorLibraryPickerModal";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import DataTable from "@/components/shared/DataTable";
import GalleryView from "@/components/GalleryView";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import ImageLightbox from "@/components/ImageLightbox";
import RevisionBadge from "@/components/RevisionBadge";

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

function ListSwatch({ cw, product, techColors, commColors }: { cw: any; product: any; techColors: any[]; commColors: any[] }) {
  const commColor = commColors.find((c: any) => c.id === cw.linked_color_id);
  const useProductImage = !cw.image_url && !!product?.images?.[0];
  const displayImage = cw.image_url || product?.images?.[0] || null;
  const linkedHexes = (() => {
    if (!commColor || commColor.sub_type !== "Combined") return null;
    const ids: string[] = commColor.linked_technical_color_ids ?? [];
    const hexes = ids.map((id: string) => techColors.find((t: any) => t.id === id)?.hex).filter(Boolean) as string[];
    return hexes.length > 1 ? hexes : null;
  })();
  return (
    <div className="w-8 h-8 rounded border border-border relative overflow-hidden bg-muted flex items-center justify-center">
      {displayImage ? (
        <img src={displayImage} alt={cw.color_name} className="w-full h-full object-contain" />
      ) : linkedHexes ? (
        <div className="w-full h-full flex">
          {linkedHexes.map((h: string, i: number) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
        </div>
      ) : (
        <div className="w-full h-full" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
      )}
      {useProductImage && cw.color_hex && (
        <div className="absolute bottom-0.5 left-0.5 w-3 h-3 rounded-sm border border-white/70" style={{ backgroundColor: cw.color_hex }} />
      )}
    </div>
  );
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
  const [refresh, setRefresh] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">(() => {
    try { return (localStorage.getItem(VIEW_KEY) as any) || "grid"; } catch { return "grid"; }
  });
  const [colorwaysActiveViewId, _setColorwaysActiveViewId] = useState<string>(() => {
    try { return localStorage.getItem("gallery_active_view_product_colorways") || "default"; }
    catch { return "default"; }
  });
  const setColorwaysActiveViewId = (id: string) => {
    _setColorwaysActiveViewId(id);
    try { localStorage.setItem("gallery_active_view_product_colorways", id); } catch {}
  };
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [lightboxCv, setLightboxCv] = useState<any>(null);

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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, refresh]);

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
        const sizeIds = styleSizes.filter((s) => s.active !== false).map((s) => s.size_id || s.id);
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

  // ── Columns / Fields ──
  const colorwayColumns = useMemo(
    () => [
      {
        id: "swatch",
        label: "",
        width: 56,
        render: (cv: any) => (
          <SwatchThumb cw={cv} product={product} techColors={techColors} commColors={commColors} />
        ),
      },
      {
        id: "color_name",
        label: "Color Name",
        width: 180,
        sortKey: (cv: any) => cv.color_name,
        render: (cv: any) => <span className="font-medium text-sm">{cv.color_name}</span>,
      },
      {
        id: "colorway_code",
        label: "Code",
        width: 120,
        sortKey: (cv: any) => cv.colorway_code,
        render: (cv: any) => (
          <span className="font-mono text-xs text-muted-foreground">{cv.colorway_code || "—"}</span>
        ),
      },
      {
        id: "status",
        label: "Status",
        width: 150,
        sortKey: (cv: any) => cv.colorway_status,
        render: (cv: any) => renderStatusBadge(cv.colorway_status),
      },
      {
        id: "tech_color",
        label: "Technical Color",
        width: 160,
        render: (cv: any) => {
          const tc = techColors.find((t) => t.id === cv.linked_tech_color_id);
          return tc ? (
            <span className="text-xs font-mono text-muted-foreground">{tc.code}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          );
        },
      },
      {
        id: "comm_color",
        label: "Commercial Color",
        width: 170,
        render: (cv: any) => {
          const cc = commColors.find((c) => c.id === cv.linked_color_id);
          if (cc) return <span className="text-xs font-mono text-muted-foreground">{cc.code}</span>;
          if (cv.linked_tech_color_id)
            return (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                No commercial
              </span>
            );
          return <span className="text-muted-foreground/40">—</span>;
        },
      },
      {
        id: "actions",
        label: "",
        width: 80,
        render: (cv: any) => (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => openEdit(cv)} className="p-1.5 rounded hover:bg-muted">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button type="button" onClick={() => setDelId(cv.id)} className="p-1.5 rounded hover:bg-muted">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ),
      },
    ],
    [product, techColors, commColors],
  );

  const galleryFields = useMemo(
    () => [
      {
        id: "color_name",
        label: "Color Name",
        getValue: (cv: any) => cv.color_name,
        render: (cv: any) => (
          <div className="cursor-pointer hover:text-primary transition-colors" onClick={() => openEdit(cv)}>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full shrink-0 border border-border/50" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
              <span className="font-medium text-sm truncate">{cv.color_name}</span>
              <RevisionBadge target_type="product_color" target_id={cv.id} size="xs" />
            </div>
          </div>
        ),
      },
      {
        id: "colorway_code",
        label: "Code",
        getValue: (cv: any) => cv.colorway_code,
        render: (cv: any) => {
          const tc = techColors.find((t: any) => t.id === cv.linked_tech_color_id);
          return (
            <div className="flex items-center gap-1">
              {cv.colorway_code && <span className="font-mono text-xs text-muted-foreground">{cv.colorway_code}</span>}
              {tc && <span className="font-mono text-xs text-muted-foreground/60">{tc.code}</span>}
            </div>
          );
        },
      },
      {
        id: "status",
        label: "Status",
        getValue: (cv: any) => cv.colorway_status,
        render: (cv: any) => renderStatusBadge(cv.colorway_status),
      },
    ],
    [techColors, commColors],
  );

  // ── Options drawer ──
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
        { label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu((v) => !v) },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: () => setRefresh((r) => r + 1) },
      ],
      customContent: showViewMenu ? (
        <ViewDrawerContent
          pageKey="product_colorways"
          activeViewId={colorwaysActiveViewId}
          onSelectView={(id) => {
            setColorwaysActiveViewId(id);
            setShowViewMenu(false);
          }}
          allFields={colorwayColumns
            .map((c) => ({ id: c.id, label: c.label }))
            .filter((c) => !!c.label)}
          currentViewType={view === "grid" ? "grid" : null}
        />
      ) : null,
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, showViewMenu, colorwaysActiveViewId, colorwayColumns]);

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
        <GalleryView
          pageKey="product_colorways"
          allFields={galleryFields}
          rows={colorways}
          renderThumbnail={(cv) => <SwatchThumb cw={cv} product={product} techColors={techColors} commColors={commColors} asCard onEdit={() => openEdit(cv)} />}
          activeViewId={colorwaysActiveViewId}
        />
      ) : (
        <DataTable
          columns={colorwayColumns}
          rows={colorways}
          fixedColumns={["swatch", "color_name"]}
          hideColumnToggle
        />
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
