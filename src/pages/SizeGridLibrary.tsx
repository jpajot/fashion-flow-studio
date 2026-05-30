import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Grid3X3,
  Ruler,
  ListChecks,
  Hash,
  SwatchBook,
  CircleDollarSign,
  Settings,
  Search,
  X,
} from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { cn } from "@/lib/utils";

type SizeGrid = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sample_size_id: string | null;
  base_size_id: string | null;
};
type Size = { id: string; size_code: string; name: string };
type GridSize = { id: string; size_grid_id: string; size_id: string; active: boolean };

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
  sizes: "/size-studio",
  currencies: "/currencies",
  config: "/app-config",
};

const NONE = "__none__";
const EMPTY_GRID = { code: "", name: "", sample_size_id: NONE, base_size_id: NONE, active: true };
const EMPTY_SIZE = { size_code: "", name: "" };

export default function SizeGridLibrary() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [activeSection, setActiveSection] = useState<"grids" | "library">("grids");
  const [grids, setGrids] = useState<SizeGrid[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [gridSizes, setGridSizes] = useState<GridSize[]>([]);
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null);
  const [gridSearch, setGridSearch] = useState("");
  const [sizeSearch, setSizeSearch] = useState("");

  const [gridDialog, setGridDialog] = useState(false);
  const [editingGrid, setEditingGrid] = useState<SizeGrid | null>(null);
  const [gridForm, setGridForm] = useState<any>({ ...EMPTY_GRID });
  const [confirmDeleteGrid, setConfirmDeleteGrid] = useState<SizeGrid | null>(null);

  const [sizeDialog, setSizeDialog] = useState(false);
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [sizeForm, setSizeForm] = useState({ ...EMPTY_SIZE });
  const [confirmDeleteSize, setConfirmDeleteSize] = useState<Size | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const loadData = async () => {
    const [g, s, gs] = await Promise.all([
      supabase.from("size_grids").select("*").order("code"),
      supabase.from("sizes").select("*").order("size_code"),
      supabase.from("size_grid_sizes").select("*"),
    ]);
    setGrids((g.data ?? []) as SizeGrid[]);
    setSizes((s.data ?? []) as Size[]);
    setGridSizes((gs.data ?? []) as GridSize[]);
  };

  useEffect(() => {
    loadData();
  }, []);

  useRegisterSubNav(
    SUB_NAV_ITEMS,
    "sizes",
    (id) => navigate(SUB_NAV_ROUTES[id] ?? "/config"),
    "Settings",
  );

  // Internal section sub-nav (within Size Studio shell) — secondary, registered via page Options is not used.
  // We use a tabbed UI instead at the top of the content area.

  const filteredGrids = useMemo(
    () =>
      grids.filter((g) => {
        const q = gridSearch.toLowerCase();
        return !q || g.code.toLowerCase().includes(q) || g.name.toLowerCase().includes(q);
      }),
    [grids, gridSearch],
  );

  const filteredSizes = useMemo(
    () =>
      sizes.filter((s) => {
        const q = sizeSearch.toLowerCase();
        return !q || s.size_code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      }),
    [sizes, sizeSearch],
  );

  const selectedGrid = useMemo(
    () => grids.find((g) => g.id === selectedGridId) ?? null,
    [grids, selectedGridId],
  );

  const selectedGridSizes = useMemo(() => {
    if (!selectedGridId) return [];
    return gridSizes
      .filter((gs) => gs.size_grid_id === selectedGridId)
      .map((gs) => ({ ...gs, size: sizes.find((s) => s.id === gs.size_id) }))
      .sort((a, b) => (a.size?.size_code ?? "").localeCompare(b.size?.size_code ?? ""));
  }, [gridSizes, sizes, selectedGridId]);

  const availableSizesForPicker = useMemo(() => {
    if (!selectedGridId) return [];
    const linked = new Set(
      gridSizes.filter((gs) => gs.size_grid_id === selectedGridId).map((gs) => gs.size_id),
    );
    return sizes
      .filter((s) => !linked.has(s.id))
      .filter((s) => {
        const q = pickerSearch.toLowerCase();
        return !q || s.size_code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      });
  }, [sizes, gridSizes, selectedGridId, pickerSearch]);

  // ===== Grid CRUD =====
  const openNewGrid = () => {
    setEditingGrid(null);
    setGridForm({ ...EMPTY_GRID });
    setGridDialog(true);
  };
  const openEditGrid = (g: SizeGrid) => {
    setEditingGrid(g);
    setGridForm({
      code: g.code,
      name: g.name,
      sample_size_id: g.sample_size_id ?? NONE,
      base_size_id: g.base_size_id ?? NONE,
      active: g.active,
    });
    setGridDialog(true);
  };
  const saveGrid = async () => {
    if (!gridForm.code.trim() || !gridForm.name.trim()) {
      toast({ title: "Code and Name are required", variant: "destructive" });
      return;
    }
    const payload = {
      code: gridForm.code.trim(),
      name: gridForm.name.trim(),
      sample_size_id: gridForm.sample_size_id === NONE ? null : gridForm.sample_size_id,
      base_size_id: gridForm.base_size_id === NONE ? null : gridForm.base_size_id,
      active: gridForm.active,
    };
    const res = editingGrid
      ? await supabase.from("size_grids").update(payload).eq("id", editingGrid.id)
      : await supabase.from("size_grids").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingGrid ? "Grid updated" : "Grid created" });
    setGridDialog(false);
    loadData();
  };
  const deleteGrid = async () => {
    if (!confirmDeleteGrid) return;
    await supabase.from("size_grid_sizes").delete().eq("size_grid_id", confirmDeleteGrid.id);
    const { error } = await supabase.from("size_grids").delete().eq("id", confirmDeleteGrid.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Grid deleted" });
      if (selectedGridId === confirmDeleteGrid.id) setSelectedGridId(null);
    }
    setConfirmDeleteGrid(null);
    loadData();
  };

  // ===== GridSize ops =====
  const addSizeToGrid = async (sizeId: string) => {
    if (!selectedGridId) return;
    const exists = gridSizes.some(
      (gs) => gs.size_grid_id === selectedGridId && gs.size_id === sizeId,
    );
    if (exists) return;
    const { error } = await supabase
      .from("size_grid_sizes")
      .insert({ size_grid_id: selectedGridId, size_id: sizeId, active: true });
    if (error) {
      toast({ title: "Failed to add size", description: error.message, variant: "destructive" });
      return;
    }
    loadData();
  };
  const toggleGridSizeActive = async (gs: GridSize) => {
    const { error } = await supabase
      .from("size_grid_sizes")
      .update({ active: !gs.active })
      .eq("id", gs.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    loadData();
  };
  const removeGridSize = async (gs: GridSize) => {
    const { error } = await supabase.from("size_grid_sizes").delete().eq("id", gs.id);
    if (error) {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
      return;
    }
    loadData();
  };

  // ===== Size CRUD =====
  const openNewSize = () => {
    setEditingSize(null);
    setSizeForm({ ...EMPTY_SIZE });
    setSizeDialog(true);
  };
  const openEditSize = (s: Size) => {
    setEditingSize(s);
    setSizeForm({ size_code: s.size_code, name: s.name });
    setSizeDialog(true);
  };
  const saveSize = async () => {
    if (!sizeForm.size_code.trim() || !sizeForm.name.trim()) {
      toast({ title: "Code and Name are required", variant: "destructive" });
      return;
    }
    const payload = { size_code: sizeForm.size_code.trim(), name: sizeForm.name.trim() };
    const res = editingSize
      ? await supabase.from("sizes").update(payload).eq("id", editingSize.id)
      : await supabase.from("sizes").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingSize ? "Size updated" : "Size created" });
    setSizeDialog(false);
    loadData();
  };
  const deleteSize = async () => {
    if (!confirmDeleteSize) return;
    const { error } = await supabase.from("sizes").delete().eq("id", confirmDeleteSize.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Size deleted" });
    }
    setConfirmDeleteSize(null);
    loadData();
  };

  // ===== Page Options =====
  useEffect(() => {
    const items =
      activeSection === "grids"
        ? [
            { label: "Add Grid", icon: Plus, onClick: openNewGrid },
            { divider: true },
            { label: "Refresh", icon: RefreshCw, onClick: loadData },
          ]
        : [
            { label: "Add Size", icon: Plus, onClick: openNewSize },
            { divider: true },
            { label: "Refresh", icon: RefreshCw, onClick: loadData },
          ];
    setOptions({ items });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  return (
    <div className="px-3 py-3 sm:px-4 md:px-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Size Studio</h1>
          <p className="text-sm text-muted-foreground">
            Manage size grids and the master size library.
          </p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b">
        {[
          { id: "grids", label: "Size Grids", count: grids.length, icon: Grid3X3 },
          { id: "library", label: "Size Library", count: sizes.length, icon: Ruler },
        ].map((s) => {
          const Icon = s.icon as any;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id as any)}
              className={cn(
                "px-3 py-2 text-sm flex items-center gap-2 border-b-2 -mb-px transition",
                active
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {s.label}
              <span className="text-xs text-muted-foreground">({s.count})</span>
            </button>
          );
        })}
      </div>

      {activeSection === "grids" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Grids list */}
          <Card className={`p-3 space-y-3 ${selectedGridId ? "hidden lg:block" : "block"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm">Grids ({filteredGrids.length})</div>
              <Button size="sm" onClick={openNewGrid}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={gridSearch}
                onChange={(e) => setGridSearch(e.target.value)}
                placeholder="Search grids..."
                className="pl-7 h-8 text-sm"
              />
            </div>
            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredGrids.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6">No grids</div>
              ) : (
                filteredGrids.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGridId(g.id)}
                    className={cn(
                      "p-2 rounded-md cursor-pointer flex items-start justify-between gap-2 transition",
                      selectedGridId === g.id ? "bg-secondary" : "hover:bg-muted",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {g.code}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditGrid(g);
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
                          setConfirmDeleteGrid(g);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Right: Grid sizes */}
          <Card className={`p-3 lg:col-span-2 space-y-3 ${selectedGridId ? "block" : "hidden lg:block"}`}>
            <div className="font-semibold text-sm flex items-center gap-2">
              {selectedGrid && (
                <button
                  type="button"
                  onClick={() => setSelectedGridId(null)}
                  className="lg:hidden text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mr-1"
                >
                  ←
                </button>
              )}
              {selectedGrid
                ? `Sizes — ${selectedGrid.name}`
                : "Select a grid to manage its sizes"}
            </div>
            {selectedGrid && (
              <>
                {selectedGridSizes.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6">
                    No sizes in this grid yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-24">Active</TableHead>
                        <TableHead className="w-20 text-right">Remove</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGridSizes.map((gs) => (
                        <TableRow key={gs.id}>
                          <TableCell className="font-mono">{gs.size?.size_code ?? "—"}</TableCell>
                          <TableCell>{gs.size?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Checkbox
                              checked={gs.active}
                              onCheckedChange={() => toggleGridSizeActive(gs)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeGridSize(gs)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {!pickerOpen ? (
                  <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Size
                  </Button>
                ) : (
                  <div className="border rounded-md p-2 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                        <Input
                          autoFocus
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          placeholder="Search available sizes..."
                          className="pl-7 h-8 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPickerOpen(false);
                          setPickerSearch("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {availableSizesForPicker.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-3">
                          No sizes available
                        </div>
                      ) : (
                        availableSizesForPicker.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => addSizeToGrid(s.id)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-background text-sm flex items-center gap-3"
                          >
                            <span className="font-mono text-xs w-12">{s.size_code}</span>
                            <span>{s.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative w-72">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={sizeSearch}
                onChange={(e) => setSizeSearch(e.target.value)}
                placeholder="Search sizes..."
                className="pl-7 h-8 text-sm"
              />
            </div>
            <Button size="sm" onClick={openNewSize}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Size
            </Button>
          </div>
          {filteredSizes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Ruler className="h-10 w-10 mb-2 opacity-50" />
              <div>No sizes yet.</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSizes.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.size_code}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEditSize(s)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setConfirmDeleteSize(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Grid dialog */}
      <Dialog open={gridDialog} onOpenChange={setGridDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGrid ? "Edit Grid" : "New Grid"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={gridForm.code}
                onChange={(e) => setGridForm({ ...gridForm, code: e.target.value })}
                placeholder="INTL-XS-XL"
              />
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={gridForm.name}
                onChange={(e) => setGridForm({ ...gridForm, name: e.target.value })}
                placeholder="International XS–XL"
              />
            </div>
            <div>
              <Label>Sample Size</Label>
              <Select
                value={gridForm.sample_size_id}
                onValueChange={(v) => setGridForm({ ...gridForm, sample_size_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sample size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {sizes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.size_code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base Size</Label>
              <Select
                value={gridForm.base_size_id}
                onValueChange={(v) => setGridForm({ ...gridForm, base_size_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select base size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {sizes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.size_code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={gridForm.active}
                onCheckedChange={(v) => setGridForm({ ...gridForm, active: !!v })}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGridDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveGrid}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Size dialog */}
      <Dialog open={sizeDialog} onOpenChange={setSizeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSize ? "Edit Size" : "New Size"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={sizeForm.size_code}
                onChange={(e) => setSizeForm({ ...sizeForm, size_code: e.target.value })}
                placeholder="XS"
              />
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={sizeForm.name}
                onChange={(e) => setSizeForm({ ...sizeForm, name: e.target.value })}
                placeholder="Extra Small"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSizeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveSize}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete grid */}
      <AlertDialog
        open={!!confirmDeleteGrid}
        onOpenChange={(o) => !o && setConfirmDeleteGrid(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete grid?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{confirmDeleteGrid?.name}" and remove all its linked sizes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteGrid}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete size */}
      <AlertDialog
        open={!!confirmDeleteSize}
        onOpenChange={(o) => !o && setConfirmDeleteSize(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete size?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{confirmDeleteSize?.name}" from the size library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSize}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
