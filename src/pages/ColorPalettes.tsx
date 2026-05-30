import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  SwatchBook,
  Palette as PaletteIcon,
  X,
  GripVertical,
  Search,
  Link as LinkIcon,
} from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { cn } from "@/lib/utils";
import {
  colorToHex,
  TechDialog,
  CommDialog,
  TechnicalTab,
  CommercialTab,
  TechPicker,
} from "@/pages/ColorLibrary";
import LinkCommercialColorDialog from "@/components/LinkCommercialColorDialog";

type Tech = {
  id: string;
  code: string;
  name: string;
  hex: string | null;
  rgb: string | null;
  cmyk: string | null;
  rgb_r?: number | null;
  rgb_g?: number | null;
  rgb_b?: number | null;
  color_group: string | null;
  color_sub_group: string | null;
};
type Comm = {
  id: string;
  sub_type: string;
  code: string;
  color_name: string;
  main_technical_color_id: string | null;
  linked_technical_color_ids: string[] | null;
};
type Lov = { id: string; name: string; depends_on_value_id: string | null };
type Project = { id: string; name: string };
type Palette = { id: string; name: string; project_id: string | null; projects?: { name: string } | null };
type PaletteColor = {
  id: string;
  palette_id: string;
  color_type: "technical" | "commercial";
  color_id: string;
  sort_order: number;
};

const NONE = "__none__";

const SIZE_CONFIGS = {
  S: { cols: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5", cardClass: "text-[10px]", swatchSize: "w-5 h-5", codeClass: "text-[9px]" },
  M: { cols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", cardClass: "text-xs", swatchSize: "w-6 h-6", codeClass: "text-[10px]" },
  L: { cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", cardClass: "text-sm", swatchSize: "w-8 h-8", codeClass: "text-xs" },
};

export default function ColorPalettes() {
  const { toast } = useToast();
  const { setOptions } = usePageOptions();

  const [activeSection, setActiveSection] = useState<"palettes" | "technical" | "commercial">("palettes");

  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [paletteColors, setPaletteColors] = useState<PaletteColor[]>([]);
  const [tech, setTech] = useState<Tech[]>([]);
  const [comm, setComm] = useState<Comm[]>([]);
  const [groups, setGroups] = useState<Lov[]>([]);
  const [subGroups, setSubGroups] = useState<Lov[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [palDialog, setPalDialog] = useState(false);
  const [editingPal, setEditingPal] = useState<Palette | null>(null);
  const [palForm, setPalForm] = useState({ name: "", project_id: NONE });
  const [deletePal, setDeletePal] = useState<Palette | null>(null);
  const [showAddColor, setShowAddColor] = useState(false);
  const [linkingTechColor, setLinkingTechColor] = useState<Tech | null>(null);
  const [paletteCardSize, setPaletteCardSize] = useState<"S" | "M" | "L">(() => {
    try { return (localStorage.getItem("palette_card_size") as "S" | "M" | "L") || "M"; }
    catch { return "M"; }
  });

  // Library-section dialogs
  const [editingTech, setEditingTech] = useState<Tech | null>(null);
  const [showTechDialog, setShowTechDialog] = useState(false);
  const [deleteTech, setDeleteTech] = useState<Tech | null>(null);
  const [editingComm, setEditingComm] = useState<Comm | null>(null);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [deleteComm, setDeleteComm] = useState<Comm | null>(null);

  const loadData = async () => {
    const [p, pc, t, c, pr] = await Promise.all([
      supabase.from("color_palettes").select("*, projects(name)").order("name"),
      supabase.from("color_palette_colors").select("*").order("sort_order"),
      supabase.from("technical_colors").select("*").order("code"),
      supabase.from("commercial_colors").select("*").order("code"),
      supabase.from("projects").select("id, name").eq("status", "Active").order("name"),
    ]);
    setPalettes((p.data ?? []) as any);
    setPaletteColors((pc.data ?? []) as any);
    setTech((t.data ?? []) as any);
    setComm((c.data ?? []) as any);
    setProjects((pr.data ?? []) as any);

    const { data: typeRows } = await supabase
      .from("type_of_lov")
      .select("id, code")
      .or("code.eq.ColorGroup,code.eq.ColorSubGroup");
    const groupId = (typeRows ?? []).find((r: any) => r.code === "ColorGroup")?.id;
    const subId = (typeRows ?? []).find((r: any) => r.code === "ColorSubGroup")?.id;
    if (groupId) {
      const { data } = await supabase
        .from("list_of_values")
        .select("id,name,depends_on_value_id")
        .eq("type_of_lov_id", groupId)
        .order("name");
      setGroups((data ?? []) as Lov[]);
    }
    if (subId) {
      const { data } = await supabase
        .from("list_of_values")
        .select("id,name,depends_on_value_id")
        .eq("type_of_lov_id", subId)
        .order("name");
      setSubGroups((data ?? []) as Lov[]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Color Studio internal sub-nav
  useRegisterSubNav(
    [
      { id: "palettes", label: "Palettes", count: palettes.length, icon: PaletteIcon },
      { id: "technical", label: "Technical Colors", count: tech.length, icon: SwatchBook },
      { id: "commercial", label: "Commercial Colors", count: comm.length, icon: SwatchBook },
    ],
    activeSection,
    (id) => setActiveSection(id as any),
    "Color Studio",
  );

  const openNewPalette = () => {
    setEditingPal(null);
    setPalForm({ name: "", project_id: NONE });
    setPalDialog(true);
  };
  const openEditPalette = (p: Palette) => {
    setEditingPal(p);
    setPalForm({ name: p.name, project_id: p.project_id ?? NONE });
    setPalDialog(true);
  };

  // Options drawer adapts to active section
  useEffect(() => {
    const items =
      activeSection === "palettes"
        ? [
            { label: "New Palette", icon: Plus, onClick: openNewPalette },
            { divider: true },
            { label: "Refresh", icon: RefreshCw, onClick: loadData },
            ...(selectedId ? [
              { divider: true },
              {
                label: "S",
                onClick: () => { setPaletteCardSize("S"); try { localStorage.setItem("palette_card_size", "S"); } catch {} },
                className: `px-2 py-1 text-xs font-medium rounded border ${paletteCardSize === "S" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`
              },
              {
                label: "M",
                onClick: () => { setPaletteCardSize("M"); try { localStorage.setItem("palette_card_size", "M"); } catch {} },
                className: `px-2 py-1 text-xs font-medium rounded border ${paletteCardSize === "M" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`
              },
              {
                label: "L",
                onClick: () => { setPaletteCardSize("L"); try { localStorage.setItem("palette_card_size", "L"); } catch {} },
                className: `px-2 py-1 text-xs font-medium rounded border ${paletteCardSize === "L" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`
              },
            ] : []),
          ]
        : activeSection === "technical"
        ? [
            { label: "Add Technical Color", icon: Plus, onClick: () => { setEditingTech(null); setShowTechDialog(true); } },
            { divider: true },
            { label: "Refresh", icon: RefreshCw, onClick: loadData },
          ]
        : [
            { label: "Add Commercial Color", icon: Plus, onClick: () => { setEditingComm(null); setShowCommDialog(true); } },
            { divider: true },
            { label: "Refresh", icon: RefreshCw, onClick: loadData },
          ];
    setOptions({ items });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, paletteCardSize, selectedId]);

  const techMap = useMemo(() => Object.fromEntries(tech.map((t) => [t.id, t])), [tech]);
  const commMap = useMemo(() => Object.fromEntries(comm.map((c) => [c.id, c])), [comm]);

  // Resolve a palette entry to display info (incl. multi-hex segments for combined comm)
  type Swatch = { hex: string; code: string; name: string; linkedHexes?: string[] };
  const resolveSwatch = (pc: PaletteColor): Swatch => {
    if (pc.color_type === "technical") {
      const t = techMap[pc.color_id];
      return { hex: colorToHex(t), code: t?.code ?? "?", name: t?.name ?? "Unknown" };
    }
    const c = commMap[pc.color_id];
    if (!c) return { hex: "#cccccc", code: "?", name: "Unknown" };
    const mainHex = colorToHex(c.main_technical_color_id ? techMap[c.main_technical_color_id] : null);
    const ids =
      c.sub_type?.toLowerCase() === "combined" && c.linked_technical_color_ids?.length
        ? c.linked_technical_color_ids
        : null;
    const linkedHexes = ids ? ids.map((id) => colorToHex(techMap[id])) : undefined;
    return { hex: mainHex, code: c.code, name: c.color_name, linkedHexes };
  };

  const getSwatchData = (colors: PaletteColor[]): Swatch[] => {
    const commEntries = colors.filter((e) => e.color_type === "commercial");
    const commColorIdsInPalette = new Set(commEntries.map((e) => e.color_id));
    const result: Swatch[] = [];

    for (const e of commEntries) {
      const c = commMap[e.color_id];
      if (!c) continue;
      const linkedIds =
        c.sub_type?.toLowerCase() === "combined" && c.linked_technical_color_ids?.length
          ? c.linked_technical_color_ids
          : null;
      const linkedHexes = linkedIds ? linkedIds.map((id) => colorToHex(techMap[id])) : undefined;
      const mainHex = colorToHex(c.main_technical_color_id ? techMap[c.main_technical_color_id] : null);
      result.push({ hex: mainHex, name: c.color_name, code: c.code, linkedHexes });
    }

    for (const e of colors.filter((e) => e.color_type === "technical")) {
      const linkedComm = comm.find(
        (c) =>
          (c.main_technical_color_id === e.color_id ||
            (c.linked_technical_color_ids ?? []).includes(e.color_id)) &&
          commColorIdsInPalette.has(c.id),
      );
      if (linkedComm) continue;
      const t = techMap[e.color_id];
      if (!t) continue;
      result.push({ hex: colorToHex(t), name: t.name, code: t.code });
    }
    return result;
  };

  const getSwatchDataByPaletteId = (paletteId: string): Swatch[] => {
    const colors = paletteColors
      .filter((c) => c.palette_id === paletteId)
      .sort((a, b) => a.sort_order - b.sort_order);
    return getSwatchData(colors);
  };

  const filteredPalettes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? palettes.filter((p) => p.name.toLowerCase().includes(q)) : palettes;
  }, [palettes, search]);

  const selectedPal = palettes.find((p) => p.id === selectedId) ?? null;
  const selectedColors = useMemo(
    () =>
      paletteColors
        .filter((c) => c.palette_id === selectedId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [paletteColors, selectedId],
  );
  const selectedSwatches = useMemo(
    () => getSwatchData(selectedColors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedColors, techMap, commMap, comm],
  );

  const colorsCountByPalette = useMemo(() => {
    const m: Record<string, number> = {};
    paletteColors.forEach((c) => (m[c.palette_id] = (m[c.palette_id] ?? 0) + 1));
    return m;
  }, [paletteColors]);

  const savePalette = async () => {
    if (!palForm.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: palForm.name.trim(),
      project_id: palForm.project_id === NONE ? null : palForm.project_id,
    };
    const res = editingPal
      ? await supabase.from("color_palettes").update(payload).eq("id", editingPal.id)
      : await supabase.from("color_palettes").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingPal ? "Palette updated" : "Palette created" });
    setPalDialog(false);
    loadData();
  };

  const doDeletePalette = async () => {
    if (!deletePal) return;
    const count = colorsCountByPalette[deletePal.id] ?? 0;
    if (count > 0) {
      toast({
        title: "Cannot delete palette",
        description: `Palette has ${count} color${count > 1 ? "s" : ""}. Remove them first.`,
        variant: "destructive",
      });
      setDeletePal(null);
      return;
    }
    const { error } = await supabase.from("color_palettes").delete().eq("id", deletePal.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else toast({ title: "Palette deleted" });
    setDeletePal(null);
    if (selectedId === deletePal.id) setSelectedId(null);
    loadData();
  };

  const removeColor = async (pc: PaletteColor) => {
    const { error } = await supabase.from("color_palette_colors").delete().eq("id", pc.id);
    if (error) toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    else loadData();
  };

  // Drag and drop reordering with optimistic state update
  const [dragId, setDragId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const reordered = [...selectedColors];
    const fromIdx = reordered.findIndex((c) => c.id === dragId);
    const toIdx = reordered.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDragId(null);
      return;
    }
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderedIds = reordered.map((c) => c.id);
    setDragId(null);
    // Optimistic update
    setPaletteColors((prev) =>
      prev.map((pc) => {
        const newIdx = orderedIds.indexOf(pc.id);
        return newIdx !== -1 ? { ...pc, sort_order: newIdx } : pc;
      }),
    );
    // Persist in background
    await Promise.all(
      reordered.map((c, i) =>
        supabase.from("color_palette_colors").update({ sort_order: i }).eq("id", c.id),
      ),
    );
  };

  const addColorToPalette = async (type: "technical" | "commercial", colorId: string) => {
    if (!selectedId) return;
    const existing = selectedColors.find((c) => c.color_type === type && c.color_id === colorId);
    if (existing) return;
    const maxSort = selectedColors.reduce((m, c) => Math.max(m, c.sort_order), -1);
    const { error } = await supabase.from("color_palette_colors").insert({
      palette_id: selectedId,
      color_type: type,
      color_id: colorId,
      sort_order: maxSort + 1,
    });
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else loadData();
  };

  // ============ Section: Technical Colors ============
  if (activeSection === "technical") {
    return (
      <div className="px-3 py-3 sm:px-4 md:px-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Technical Colors</h1>
          <p className="text-sm text-muted-foreground">Pantone TCX color library.</p>
        </div>
        <TechnicalTab
          rows={tech as any}
          groups={groups as any}
          commByTechId={(() => {
            const m: Record<string, Comm[]> = {};
            comm.forEach((c) => {
              const ids = new Set<string>();
              if (c.main_technical_color_id) ids.add(c.main_technical_color_id);
              (c.linked_technical_color_ids ?? []).forEach((id) => ids.add(id));
              ids.forEach((id) => {
                m[id] = m[id] ?? [];
                m[id].push(c as any);
              });
            });
            return m;
          })()}
          onAdd={() => { setEditingTech(null); setShowTechDialog(true); }}
          onEdit={(r) => { setEditingTech(r as any); setShowTechDialog(true); }}
          onDelete={(r) => setDeleteTech(r as any)}
        />
        {showTechDialog && (
          <TechDialog
            open={showTechDialog}
            onOpenChange={setShowTechDialog}
            editing={editingTech as any}
            groups={groups as any}
            subGroups={subGroups as any}
            onSaved={() => { setShowTechDialog(false); loadData(); }}
          />
        )}
        <AlertDialog open={!!deleteTech} onOpenChange={(o) => !o && setDeleteTech(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete technical color?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTech?.code} — {deleteTech?.name}. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deleteTech) return;
                  const { error } = await supabase.from("technical_colors").delete().eq("id", deleteTech.id);
                  if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
                  else toast({ title: "Technical color deleted" });
                  setDeleteTech(null);
                  loadData();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ============ Section: Commercial Colors ============
  if (activeSection === "commercial") {
    return (
      <div className="px-3 py-3 sm:px-4 md:px-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commercial Colors</h1>
          <p className="text-sm text-muted-foreground">Commercial color definitions used on products.</p>
        </div>
        <CommercialTab
          rows={comm as any}
          techById={techMap as any}
          onAdd={() => { setEditingComm(null); setShowCommDialog(true); }}
          onEdit={(r) => { setEditingComm(r as any); setShowCommDialog(true); }}
          onDelete={(r) => setDeleteComm(r as any)}
        />
        {showCommDialog && (
          <CommDialog
            open={showCommDialog}
            onOpenChange={setShowCommDialog}
            editing={editingComm as any}
            tech={tech as any}
            onSaved={() => { setShowCommDialog(false); loadData(); }}
          />
        )}
        <AlertDialog open={!!deleteComm} onOpenChange={(o) => !o && setDeleteComm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete commercial color?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteComm?.code} — {deleteComm?.color_name}. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deleteComm) return;
                  const { error } = await supabase.from("commercial_colors").delete().eq("id", deleteComm.id);
                  if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
                  else toast({ title: "Commercial color deleted" });
                  setDeleteComm(null);
                  loadData();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ============ Section: Palettes (default) ============
  return (
    <div className="px-3 py-3 sm:px-4 md:px-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Color Studio</h1>
        <p className="text-sm text-muted-foreground">
          Manage color palettes used by projects and products.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* LEFT — palette list */}
        <Card className={`p-3 space-y-3 h-[calc(100vh-220px)] flex-col ${selectedId ? "hidden lg:flex" : "flex"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm">Color Palettes ({palettes.length})</div>
            <Button size="sm" onClick={openNewPalette}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search palettes…"
              className="h-8 pl-7"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredPalettes.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">No palettes</div>
            )}
            {filteredPalettes.map((p) => {
              const swatches = getSwatchDataByPaletteId(p.id);
              const selected = p.id === selectedId;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "p-2 rounded border cursor-pointer hover:bg-muted/40 group",
                    selected && "border-primary bg-muted/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      {p.projects?.name && (
                        <div className="text-xs text-muted-foreground truncate">{p.projects.name}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {swatches.length} color{swatches.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); openEditPalette(p); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeletePal(p); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-6 rounded-md overflow-hidden flex mb-2">
                    {swatches.length === 0 ? (
                      <div className="w-full bg-muted rounded-md" />
                    ) : (
                      swatches.slice(0, 10).map((s, i) =>
                        s.linkedHexes && s.linkedHexes.length > 1 ? (
                          <div key={i} className="flex-1 flex overflow-hidden">
                            {s.linkedHexes.map((h, j) => (
                              <div key={j} className="flex-1 h-full" style={{ backgroundColor: h }} />
                            ))}
                          </div>
                        ) : (
                          <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} />
                        )
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* RIGHT — selected palette colors */}
        <Card className={`p-4 h-[calc(100vh-220px)] flex-col ${selectedId ? "flex" : "hidden lg:flex"}`}>
          {!selectedPal ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a palette to manage its colors
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mr-1"
                  >
                    ←
                  </button>
                  <h2 className="text-lg font-semibold truncate">{selectedPal.name}</h2>
                  {selectedPal.projects?.name && (
                    <Badge variant="secondary">{selectedPal.projects.name}</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    ({selectedColors.length})
                  </span>
                </div>
                <Button size="sm" onClick={() => setShowAddColor(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Color
                </Button>
              </div>

              {/* Palette color strip */}
              {selectedSwatches.length > 0 && (
                <div className="h-12 rounded-lg overflow-hidden flex border border-border mb-4">
                  {selectedSwatches.map((s, i) =>
                    s.linkedHexes && s.linkedHexes.length > 1 ? (
                      <div key={i} className="flex-1 flex overflow-hidden" title={s.name || s.code}>
                        {s.linkedHexes.map((h, j) => (
                          <div key={j} className="flex-1 h-full" style={{ backgroundColor: h }} />
                        ))}
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="flex-1"
                        style={{ backgroundColor: s.hex }}
                        title={s.name || s.code}
                      />
                    ),
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-6">
                {selectedColors.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No colors in this palette yet
                  </div>
                ) : (
                  (() => {
                    const commEntries = selectedColors.filter((c) => c.color_type === "commercial");
                    const techEntries = selectedColors.filter((c) => c.color_type === "technical");
                    const referencedTechIds = new Set<string>();
                    commEntries.forEach((ce) => {
                      const cc = commMap[ce.color_id];
                      if (!cc) return;
                      if (cc.main_technical_color_id) referencedTechIds.add(cc.main_technical_color_id);
                      (cc.linked_technical_color_ids ?? []).forEach((id) => referencedTechIds.add(id));
                    });
                    const unlinkedTech = techEntries.filter((te) => !referencedTechIds.has(te.color_id));

                    const renderCard = (pc: PaletteColor, opts?: { unlinked?: boolean }) => {
                      const r = resolveSwatch(pc);
                      const techRow = pc.color_type === "technical" ? techMap[pc.color_id] : null;
                      return (
                        <Card
                          key={pc.id}
                          draggable
                          onDragStart={() => onDragStart(pc.id)}
                          onDragOver={onDragOver}
                          onDrop={() => onDrop(pc.id)}
                          className={cn(
                            "overflow-hidden group relative",
                            dragId === pc.id && "opacity-50",
                            opts?.unlinked && "border-amber-300 border-2",
                          )}
                        >
                          {r.linkedHexes && r.linkedHexes.length > 1 ? (
                            <div className="aspect-square w-full flex">
                              {r.linkedHexes.map((h, j) => (
                                <div key={j} className="flex-1 h-full" style={{ backgroundColor: h }} />
                              ))}
                            </div>
                          ) : (
                            <div className="aspect-square w-full" style={{ backgroundColor: r.hex }} />
                          )}
                          <div className={cn("p-2 space-y-0.5", SIZE_CONFIGS[paletteCardSize].cardClass)}>
                            <div className="flex items-center justify-between gap-1">
                              <span className={cn("font-mono", SIZE_CONFIGS[paletteCardSize].codeClass)}>{r.code}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {pc.color_type}
                              </Badge>
                            </div>
                            <div className="font-medium truncate">{r.name}</div>
                            {opts?.unlinked && techRow && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setLinkingTechColor(techRow as any)}
                                className="w-full mt-1 h-7 bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                              >
                                <LinkIcon className="h-3 w-3 mr-1" /> Link
                              </Button>
                            )}
                          </div>
                          <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 cursor-grab">
                            <GripVertical className="h-4 w-4 text-white drop-shadow" />
                          </div>
                          <button
                            onClick={() => removeColor(pc)}
                            className="absolute top-1 right-1 p-0.5 rounded bg-background/80 opacity-0 group-hover:opacity-100 hover:bg-background"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </Card>
                      );
                    };

                    return (
                      <>
                        {commEntries.length > 0 && (
                          <div className={cn("grid gap-3", SIZE_CONFIGS[paletteCardSize].cols)}>
                            {commEntries.map((pc) => renderCard(pc))}
                          </div>
                        )}
                        {unlinkedTech.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Unlinked Technical Colors ({unlinkedTech.length})
                            </div>
                            <div className={cn("grid gap-3", SIZE_CONFIGS[paletteCardSize].cols)}>
                              {unlinkedTech.map((pc) => renderCard(pc, { unlinked: true }))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Palette dialog */}
      <Dialog open={palDialog} onOpenChange={setPalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPal ? "Edit Palette" : "New Palette"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={palForm.name}
                onChange={(e) => setPalForm({ ...palForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Project</Label>
              <Select
                value={palForm.project_id}
                onValueChange={(v) => setPalForm({ ...palForm, project_id: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPalDialog(false)}>Cancel</Button>
            <Button onClick={savePalette}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add color dialog */}
      <AddColorDialog
        open={showAddColor}
        onOpenChange={setShowAddColor}
        tech={tech}
        comm={comm}
        techMap={techMap}
        existing={selectedColors}
        onAdd={addColorToPalette}
        onReload={loadData}
        paletteId={selectedId}
        setCommColors={setComm as any}
      />

      {linkingTechColor && (
        <LinkCommercialColorDialog
          techColor={linkingTechColor}
          commColors={comm as any}
          setCommColors={(next) => setComm(next as any)}
          onClose={() => {
            setLinkingTechColor(null);
            loadData();
          }}
          paletteId={selectedId}
          setPaletteColors={(updater) => setPaletteColors((prev) => updater(prev))}
          tech={tech as any}
        />
      )}

      <AlertDialog open={!!deletePal} onOpenChange={(o) => !o && setDeletePal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete palette?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletePal?.name}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDeletePalette}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddColorDialog({
  open,
  onOpenChange,
  tech,
  comm,
  techMap,
  existing,
  onAdd,
  onReload,
  paletteId,
  setCommColors,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  tech: Tech[];
  comm: Comm[];
  techMap: Record<string, Tech>;
  existing: PaletteColor[];
  onAdd: (type: "technical" | "commercial", id: string) => void;
  onReload: () => void | Promise<void>;
  paletteId: string | null;
  setCommColors: (next: Comm[]) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"technical" | "commercial">("technical");
  const [q, setQ] = useState("");
  const [showTechNew, setShowTechNew] = useState(false);
  const [showCommNew, setShowCommNew] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSubType, setNewSubType] = useState("Solid");
  const [newMainTech, setNewMainTech] = useState<Tech | null>(null);
  const [newLinkedIds, setNewLinkedIds] = useState<string[]>([]);
  const [newCodeError, setNewCodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const regenCommCode = async () => {
    const { data, error } = await supabase.rpc("generate_code", {
      p_entity_name: "CommercialColor",
      p_entity_type: "",
    });
    if (error) {
      toast({ title: "Code generation failed", description: error.message, variant: "destructive" });
      return;
    }
    if (data) setNewCode(String(data));
  };

  useEffect(() => {
    if (showCommNew && !newCode) regenCommCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCommNew]);

  // Keep linked list in sync with main when switching sub-type
  useEffect(() => {
    if (newSubType === "Combined" && newMainTech && !newLinkedIds.includes(newMainTech.id)) {
      setNewLinkedIds([newMainTech.id, ...newLinkedIds]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSubType, newMainTech]);

  const resetCommForm = () => {
    setNewCode("");
    setNewName("");
    setNewSubType("Solid");
    setNewMainTech(null);
    setNewLinkedIds([]);
    setNewCodeError(null);
  };

  const saveNewComm = async () => {
    setNewCodeError(null);
    if (!newCode.trim() || !newName.trim()) {
      toast({ title: "Code and name required", variant: "destructive" });
      return;
    }
    const dup = comm.find((c) => c.code.toLowerCase() === newCode.trim().toLowerCase());
    if (dup) {
      setNewCodeError(
        `Code "${newCode.trim()}" is already used by "${dup.color_name}". Please use a different code.`,
      );
      return;
    }
    setSaving(true);
    const linkedIds =
      newSubType === "Combined"
        ? newLinkedIds
        : newMainTech
        ? [newMainTech.id]
        : [];
    const payload: any = {
      sub_type: newSubType,
      code: newCode.trim(),
      color_name: newName.trim(),
      main_technical_color_id: newMainTech?.id ?? null,
      linked_technical_color_ids: linkedIds,
    };
    const { data, error } = await supabase
      .from("commercial_colors")
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    setCommColors([...comm, data as Comm]);
    if (paletteId) onAdd("commercial", (data as any).id);
    toast({ title: "Commercial color created" });
    resetCommForm();
    setShowCommNew(false);
  };

  const existingTech = new Set(existing.filter((x) => x.color_type === "technical").map((x) => x.color_id));
  const existingComm = new Set(existing.filter((x) => x.color_type === "commercial").map((x) => x.color_id));

  const filteredTech = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? tech.filter((t) => `${t.code} ${t.name}`.toLowerCase().includes(s)) : tech;
    return list.slice(0, 300);
  }, [tech, q]);
  const filteredComm = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? comm.filter((c) => `${c.code} ${c.color_name}`.toLowerCase().includes(s))
      : comm;
    return list.slice(0, 300);
  }, [comm, q]);


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Color to Palette</DialogTitle>
          </DialogHeader>
          {showCommNew ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">New Commercial Color</div>
              <div>
                <Label>Sub-type</Label>
                <Select value={newSubType} onValueChange={setNewSubType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Solid">Solid</SelectItem>
                    <SelectItem value="Combined">Combined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Code *</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCode}
                    onChange={(e) => { setNewCode(e.target.value); setNewCodeError(null); }}
                    className="font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={regenCommCode} title="Regenerate">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {newCodeError && <p className="text-xs text-destructive mt-1">{newCodeError}</p>}
              </div>
              <div>
                <Label>Color Name *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <Label>Main Technical Color</Label>
                <TechPicker
                  tech={tech as any}
                  selected={newMainTech as any}
                  onPick={(t: any) => {
                    setNewMainTech(t);
                    if (newSubType === "Combined" && !newLinkedIds.includes(t.id)) {
                      setNewLinkedIds([t.id, ...newLinkedIds.filter((x) => x !== t.id)]);
                    }
                  }}
                  placeholder="Select technical color"
                />
              </div>
              {newSubType === "Combined" && (
                <div>
                  <Label>Linked Technical Colors</Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[44px]">
                    {newLinkedIds.map((id) => {
                      const t = techMap[id];
                      if (!t) return null;
                      const isMain = newMainTech?.id === id;
                      return (
                        <div
                          key={id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs"
                        >
                          <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: colorToHex(t) }} />
                          <span className="font-mono">{t.code}</span>
                          <span className="truncate max-w-[120px]">{t.name}</span>
                          {isMain && <Badge variant="outline" className="text-[10px] py-0 px-1">main</Badge>}
                          <button
                            onClick={() => setNewLinkedIds(newLinkedIds.filter((x) => x !== id))}
                            disabled={isMain}
                            className="ml-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                            type="button"
                            title={isMain ? "Main color cannot be removed" : "Remove"}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                    {newLinkedIds.length === 0 && (
                      <span className="text-xs text-muted-foreground py-1">No linked colors</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <TechPicker
                      tech={tech.filter((t) => !newLinkedIds.includes(t.id)) as any}
                      selected={null}
                      onPick={(t: any) => setNewLinkedIds([...newLinkedIds, t.id])}
                      placeholder="Add linked technical color"
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => { resetCommForm(); setShowCommNew(false); }}>
                  Back
                </Button>
                <Button onClick={saveNewComm} disabled={saving}>
                  {saving ? "Creating…" : "Create & Add"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
                <TabsList>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                  <TabsTrigger value="commercial">Commercial</TabsTrigger>
                </TabsList>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="mt-3 h-8"
                />
                <TabsContent value="technical" className="mt-3">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto">
                    {filteredTech.map((t) => {
                      const used = existingTech.has(t.id);
                      return (
                        <button
                          key={t.id}
                          disabled={used}
                          onClick={() => onAdd("technical", t.id)}
                          className={cn(
                            "rounded border overflow-hidden text-left hover:shadow-md transition",
                            used && "opacity-40 cursor-not-allowed",
                          )}
                        >
                          <div className="aspect-square w-full" style={{ backgroundColor: colorToHex(t) }} />
                          <div className="p-1.5">
                            <div className="font-mono text-[10px] truncate">{t.code}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{t.name}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
                <TabsContent value="commercial" className="mt-3">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto">
                    {filteredComm.map((c) => {
                      const used = existingComm.has(c.id);
                      const t = c.main_technical_color_id ? techMap[c.main_technical_color_id] : null;
                      return (
                        <button
                          key={c.id}
                          disabled={used}
                          onClick={() => onAdd("commercial", c.id)}
                          className={cn(
                            "rounded border overflow-hidden text-left hover:shadow-md transition",
                            used && "opacity-40 cursor-not-allowed",
                          )}
                        >
                          <div className="aspect-square w-full" style={{ backgroundColor: colorToHex(t) }} />
                          <div className="p-1.5">
                            <div className="font-mono text-[10px] truncate">{c.code}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{c.color_name}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter className="sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (tab === "technical") setShowTechNew(true);
                    else setShowCommNew(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> New
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {showTechNew && (
        <TechDialog
          open={showTechNew}
          onOpenChange={setShowTechNew}
          editing={null}
          groups={[]}
          subGroups={[]}
          onSaved={async () => {
            setShowTechNew(false);
            await onReload();
          }}
        />
      )}
    </>
  );
}
