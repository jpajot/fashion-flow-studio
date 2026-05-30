import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ListChecks,
  Hash,
  SwatchBook,
  Ruler,
  CircleDollarSign,
  Settings,
  X,
  GripVertical,
  Search,
  Link as LinkIcon,
} from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { cn } from "@/lib/utils";
import { colorToHex, TechPicker, TechDialog } from "@/pages/ColorLibrary";
import LinkCommercialColorDialog from "@/components/LinkCommercialColorDialog";

type Tech = { id: string; code: string; name: string; hex: string | null; rgb?: string | null; cmyk?: string | null };
type Comm = {
  id: string;
  code: string;
  color_name: string;
  main_technical_color_id: string | null;
  linked_technical_color_ids: string[] | null;
};
type Project = { id: string; name: string };
type Palette = { id: string; name: string; project_id: string | null; projects?: { name: string } | null };
type PaletteColor = {
  id: string;
  palette_id: string;
  color_type: "technical" | "commercial";
  color_id: string;
  sort_order: number;
};

const SUB_NAV_ITEMS = [
  { id: "lov", label: "List of Values", icon: ListChecks },
  { id: "codegen", label: "Code Generators", icon: Hash },
  { id: "colors", label: "Color Studio", icon: SwatchBook },
  { id: "sizes", label: "Size Studio", icon: Ruler },
  { id: "currencies", label: "Currencies", icon: CircleDollarSign },
  { id: "config", label: "App Config", icon: Settings },
];
const SUB_NAV_ROUTES: Record<string, string> = {
  lov: "/list-of-values",
  codegen: "/code-generators",
  colors: "/color-palettes",
};
const NONE = "__none__";

export default function ColorPalettes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setOptions } = usePageOptions();

  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [colors, setColors] = useState<PaletteColor[]>([]);
  const [tech, setTech] = useState<Tech[]>([]);
  const [comm, setComm] = useState<Comm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [palDialog, setPalDialog] = useState(false);
  const [editingPal, setEditingPal] = useState<Palette | null>(null);
  const [palForm, setPalForm] = useState({ name: "", project_id: NONE });
  const [deletePal, setDeletePal] = useState<Palette | null>(null);
  const [showAddColor, setShowAddColor] = useState(false);

  const loadData = async () => {
    const [p, pc, t, c, pr] = await Promise.all([
      supabase.from("color_palettes").select("*, projects(name)").order("name"),
      supabase.from("color_palette_colors").select("*").order("sort_order"),
      supabase.from("technical_colors").select("id, code, name, hex, rgb, cmyk").order("code"),
      supabase
        .from("commercial_colors")
        .select("id, code, color_name, main_technical_color_id, linked_technical_color_ids")
        .order("code"),
      supabase.from("projects").select("id, name").eq("status", "Active").order("name"),
    ]);
    setPalettes((p.data ?? []) as any);
    setColors((pc.data ?? []) as any);
    setTech((t.data ?? []) as any);
    setComm((c.data ?? []) as any);
    setProjects((pr.data ?? []) as any);
  };

  useEffect(() => {
    loadData();
  }, []);

  useRegisterSubNav(
    SUB_NAV_ITEMS,
    "colors",
    (id) => navigate(SUB_NAV_ROUTES[id] ?? "/config"),
    "Settings",
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

  useEffect(() => {
    setOptions({
      items: [
        { label: "New Palette", icon: Plus, onClick: openNewPalette },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: loadData },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const techMap = useMemo(() => Object.fromEntries(tech.map((t) => [t.id, t])), [tech]);
  const commMap = useMemo(() => Object.fromEntries(comm.map((c) => [c.id, c])), [comm]);

  const resolveColor = (pc: PaletteColor): { hex: string; code: string; name: string } => {
    if (pc.color_type === "technical") {
      const t = techMap[pc.color_id];
      return { hex: colorToHex(t), code: t?.code ?? "?", name: t?.name ?? "Unknown" };
    }
    const c = commMap[pc.color_id];
    const t = c?.main_technical_color_id ? techMap[c.main_technical_color_id] : null;
    return { hex: colorToHex(t), code: c?.code ?? "?", name: c?.color_name ?? "Unknown" };
  };

  const filteredPalettes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? palettes.filter((p) => p.name.toLowerCase().includes(q)) : palettes;
  }, [palettes, search]);

  const selectedPal = palettes.find((p) => p.id === selectedId) ?? null;
  const selectedColors = useMemo(
    () =>
      colors
        .filter((c) => c.palette_id === selectedId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [colors, selectedId],
  );

  const colorsCountByPalette = useMemo(() => {
    const m: Record<string, number> = {};
    colors.forEach((c) => (m[c.palette_id] = (m[c.palette_id] ?? 0) + 1));
    return m;
  }, [colors]);

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

  // Drag and drop reordering
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
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setDragId(null);
    // persist sort_order
    await Promise.all(
      reordered.map((c, i) =>
        supabase.from("color_palette_colors").update({ sort_order: i }).eq("id", c.id),
      ),
    );
    loadData();
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

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Color Studio</h1>
        <p className="text-sm text-muted-foreground">
          Manage color palettes used by projects and products.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* LEFT — palette list */}
        <Card className="p-3 space-y-3 h-[calc(100vh-220px)] flex flex-col">
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
              const pcs = colors.filter((c) => c.palette_id === p.id).slice(0, 8);
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
                        {colorsCountByPalette[p.id] ?? 0} colors
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditPalette(p);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletePal(p);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {pcs.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {pcs.map((pc) => {
                        const r = resolveColor(pc);
                        return (
                          <div
                            key={pc.id}
                            className="w-3.5 h-3.5 rounded-sm border"
                            style={{ backgroundColor: r.hex }}
                            title={r.name}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* RIGHT — selected palette colors */}
        <Card className="p-4 h-[calc(100vh-220px)] flex flex-col">
          {!selectedPal ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a palette to manage its colors
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
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
              <div className="flex-1 overflow-y-auto">
                {selectedColors.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No colors in this palette yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {selectedColors.map((pc) => {
                      const r = resolveColor(pc);
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
                          )}
                        >
                          <div className="aspect-square w-full" style={{ backgroundColor: r.hex }} />
                          <div className="p-2 space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono text-xs">{r.code}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {pc.color_type}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium truncate">{r.name}</div>
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
                    })}
                  </div>
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
      />

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
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  tech: Tech[];
  comm: Comm[];
  techMap: Record<string, Tech>;
  existing: PaletteColor[];
  onAdd: (type: "technical" | "commercial", id: string) => void;
}) {
  const [tab, setTab] = useState<"technical" | "commercial">("technical");
  const [q, setQ] = useState("");

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Color to Palette</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
