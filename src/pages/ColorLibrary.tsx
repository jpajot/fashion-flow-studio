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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { ListToolbar } from "@/components/shared/ListToolbar";
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
  ChevronsUpDown,
} from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { cn } from "@/lib/utils";

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

export function colorToHex(c: any): string {
  if (!c) return "#cccccc";
  if (c.hex) return c.hex;
  if (c.rgb_r != null) {
    const r = Math.round(c.rgb_r).toString(16).padStart(2, "0");
    const g = Math.round(c.rgb_g ?? 0).toString(16).padStart(2, "0");
    const b = Math.round(c.rgb_b ?? 0).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  if (typeof c.rgb === "string") {
    const parts = c.rgb.split(",").map((x: string) => parseInt(x.trim(), 10));
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      return (
        "#" +
        parts
          .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
          .join("")
      );
    }
  }
  return "#cccccc";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHex(s: string): string | null {
  const parts = s.split(",").map((x) => parseInt(x.trim(), 10));
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
  return (
    "#" +
    parts
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export default function ColorLibrary() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const { toast } = useToast();

  const [tab, setTab] = useState("technical");
  const [tech, setTech] = useState<Tech[]>([]);
  const [comm, setComm] = useState<Comm[]>([]);
  const [groups, setGroups] = useState<Lov[]>([]);
  const [subGroups, setSubGroups] = useState<Lov[]>([]);

  const [showTechDialog, setShowTechDialog] = useState(false);
  const [editingTech, setEditingTech] = useState<Tech | null>(null);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [editingComm, setEditingComm] = useState<Comm | null>(null);
  const [deleteTech, setDeleteTech] = useState<Tech | null>(null);
  const [deleteComm, setDeleteComm] = useState<Comm | null>(null);

  const loadData = async () => {
    const [t, c] = await Promise.all([
      supabase.from("technical_colors").select("*").order("code"),
      supabase.from("commercial_colors").select("*").order("code"),
    ]);
    setTech((t.data ?? []) as Tech[]);
    setComm((c.data ?? []) as Comm[]);

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

  // Sub-nav intentionally not registered: Color Studio hub at /color-palettes owns the Color Studio sub-nav.

  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Technical Color", icon: Plus, onClick: () => openTech(null) },
        { label: "Add Commercial Color", icon: Plus, onClick: () => openComm(null) },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: loadData },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTech = (row: Tech | null) => {
    setEditingTech(row);
    setShowTechDialog(true);
  };
  const openComm = (row: Comm | null) => {
    setEditingComm(row);
    setShowCommDialog(true);
  };

  const techById = useMemo(() => {
    const m: Record<string, Tech> = {};
    tech.forEach((t) => (m[t.id] = t));
    return m;
  }, [tech]);

  // commercial codes linked per tech (main or in linked_technical_color_ids)
  const commByTechId = useMemo(() => {
    const m: Record<string, Comm[]> = {};
    comm.forEach((c) => {
      const ids = new Set<string>();
      if (c.main_technical_color_id) ids.add(c.main_technical_color_id);
      (c.linked_technical_color_ids ?? []).forEach((id) => ids.add(id));
      ids.forEach((id) => {
        m[id] = m[id] ?? [];
        m[id].push(c);
      });
    });
    return m;
  }, [comm]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Color Library</h1>
        <p className="text-sm text-muted-foreground">
          Technical and commercial colors used across products.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="technical">Technical Colors ({tech.length})</TabsTrigger>
          <TabsTrigger value="commercial">Commercial Colors ({comm.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="technical" className="mt-4">
          <TechnicalTab
            rows={tech}
            groups={groups}
            commByTechId={commByTechId}
            onAdd={() => openTech(null)}
            onEdit={(r) => openTech(r)}
            onDelete={(r) => setDeleteTech(r)}
          />
        </TabsContent>
        <TabsContent value="commercial" className="mt-4">
          <CommercialTab
            rows={comm}
            techById={techById}
            onAdd={() => openComm(null)}
            onEdit={(r) => openComm(r)}
            onDelete={(r) => setDeleteComm(r)}
          />
        </TabsContent>
      </Tabs>

      {showTechDialog && (
        <TechDialog
          open={showTechDialog}
          onOpenChange={setShowTechDialog}
          editing={editingTech}
          groups={groups}
          subGroups={subGroups}
          onSaved={() => {
            setShowTechDialog(false);
            loadData();
          }}
        />
      )}
      {showCommDialog && (
        <CommDialog
          open={showCommDialog}
          onOpenChange={setShowCommDialog}
          editing={editingComm}
          tech={tech}
          onSaved={() => {
            setShowCommDialog(false);
            loadData();
          }}
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
                const { error } = await supabase
                  .from("technical_colors")
                  .delete()
                  .eq("id", deleteTech.id);
                if (error)
                  toast({ title: "Delete failed", description: error.message, variant: "destructive" });
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
                const { error } = await supabase
                  .from("commercial_colors")
                  .delete()
                  .eq("id", deleteComm.id);
                if (error)
                  toast({ title: "Delete failed", description: error.message, variant: "destructive" });
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

/* ============================== Technical Tab ============================== */

export function TechnicalTab({
  rows,
  groups,
  commByTechId,
  onAdd,
  onEdit,
  onDelete,
}: {
  rows: Tech[];
  groups: Lov[];
  commByTechId: Record<string, Comm[]>;
  onAdd: () => void;
  onEdit: (t: Tech) => void;
  onDelete: (t: Tech) => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const groupName = (id: string | null) =>
    id ? groups.find((g) => g.id === id)?.name ?? id : "";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.code} ${r.name} ${r.hex ?? ""}`.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const columns: DataTableColumn<Tech>[] = [
    {
      id: "swatch",
      label: "",
      width: 48,
      render: (r) => (
        <div
          className="w-8 h-8 rounded border"
          style={{ backgroundColor: colorToHex(r) }}
        />
      ),
    },
    { id: "code", label: "Code", render: (r) => <span className="font-mono">{r.code}</span> },
    { id: "name", label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
    { id: "hex", label: "Hex", render: (r) => <span className="font-mono text-xs text-muted-foreground">{colorToHex(r)}</span> },
    { id: "rgb", label: "RGB", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.rgb ?? "—"}</span> },
    { id: "cmyk", label: "CMYK", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.cmyk ?? "—"}</span> },
    { id: "color_group", label: "Group", render: (r) => <span className="text-muted-foreground">{r.color_group ?? "—"}</span> },
    { id: "color_sub_group", label: "Sub-Group", render: (r) => <span className="text-muted-foreground">{r.color_sub_group ?? "—"}</span> },
    {
      id: "linked",
      label: "Commercial",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {(commByTechId[r.id] ?? []).slice(0, 4).map((c) => (
            <Badge key={c.id} variant="outline" className="font-mono text-xs">
              {c.code}
            </Badge>
          ))}
          {(commByTechId[r.id]?.length ?? 0) > 4 && (
            <Badge variant="outline" className="text-xs">+{commByTechId[r.id].length - 4}</Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      label: "",
      width: 80,
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(r)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search code, name, hex…"
        view={view === "list" ? "list" : "grid"}
        onViewChange={(v) => setView(v)}
      >
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Technical Color
        </Button>
      </ListToolbar>

      {view === "list" ? (
        <DataTable columns={columns} rows={filtered} emptyMessage="No technical colors" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="overflow-hidden cursor-pointer hover:shadow-md" onClick={() => onEdit(c)}>
              <div
                className="aspect-square w-full"
                style={{ backgroundColor: colorToHex(c) }}
              />
              <div className="p-2 space-y-0.5">
                <div className="font-mono text-xs">{c.code}</div>
                <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                <div className="text-xs font-mono text-muted-foreground">{colorToHex(c)}</div>
                {(commByTechId[c.id]?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {commByTechId[c.id].slice(0, 3).map((x) => (
                      <Badge key={x.id} variant="outline" className="text-[10px] font-mono px-1">
                        {x.code}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== Commercial Tab ============================== */

export function CommercialTab({
  rows,
  techById,
  onAdd,
  onEdit,
  onDelete,
}: {
  rows: Comm[];
  techById: Record<string, Tech>;
  onAdd: () => void;
  onEdit: (c: Comm) => void;
  onDelete: (c: Comm) => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.code} ${r.color_name}`.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const swatch = (c: Comm) => {
    const ids =
      c.sub_type?.toLowerCase() === "combined" && c.linked_technical_color_ids?.length
        ? c.linked_technical_color_ids
        : c.main_technical_color_id
        ? [c.main_technical_color_id]
        : [];
    if (ids.length <= 1) {
      return (
        <div
          className="w-8 h-8 rounded border"
          style={{ backgroundColor: colorToHex(ids[0] ? techById[ids[0]] : null) }}
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded border overflow-hidden flex">
        {ids.slice(0, 4).map((id, i) => (
          <div key={i} className="flex-1 h-full" style={{ backgroundColor: colorToHex(techById[id]) }} />
        ))}
      </div>
    );
  };

  const columns: DataTableColumn<Comm>[] = [
    { id: "swatch", label: "", width: 48, render: swatch },
    { id: "code", label: "Code", render: (r) => <span className="font-mono">{r.code}</span> },
    { id: "color_name", label: "Name", render: (r) => <span className="font-medium">{r.color_name}</span> },
    {
      id: "sub_type",
      label: "Sub-type",
      render: (r) => <Badge variant="secondary" className="capitalize">{r.sub_type}</Badge>,
    },
    {
      id: "main",
      label: "Main Technical",
      render: (r) => {
        const t = r.main_technical_color_id ? techById[r.main_technical_color_id] : null;
        return t ? (
          <span className="text-muted-foreground text-sm">
            <span className="font-mono">{t.code}</span> — {t.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "actions",
      label: "",
      width: 80,
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search code, name…"
        view={view === "list" ? "list" : "grid"}
        onViewChange={(v) => setView(v)}
      >
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Commercial Color
        </Button>
      </ListToolbar>

      {view === "list" ? (
        <DataTable columns={columns} rows={filtered} emptyMessage="No commercial colors" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map((c) => {
            const ids =
              c.sub_type?.toLowerCase() === "combined" && c.linked_technical_color_ids?.length
                ? c.linked_technical_color_ids
                : c.main_technical_color_id
                ? [c.main_technical_color_id]
                : [];
            return (
              <Card key={c.id} className="overflow-hidden cursor-pointer hover:shadow-md" onClick={() => onEdit(c)}>
                <div className="aspect-square w-full flex">
                  {ids.length === 0 && <div className="flex-1" style={{ backgroundColor: "#ccc" }} />}
                  {ids.map((id, i) => (
                    <div key={i} className="flex-1 h-full" style={{ backgroundColor: colorToHex(techById[id]) }} />
                  ))}
                </div>
                <div className="p-2 space-y-0.5">
                  <div className="font-mono text-xs">{c.code}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.color_name}</div>
                  <Badge variant="secondary" className="text-[10px] capitalize">{c.sub_type}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== Technical Dialog ============================== */

export function TechDialog({
  open,
  onOpenChange,
  editing,
  groups,
  subGroups,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: Tech | null;
  groups: Lov[];
  subGroups: Lov[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const NONE = "__none__";
  const [form, setForm] = useState({
    code: editing?.code ?? "",
    name: editing?.name ?? "",
    hex: colorToHex(editing) ?? "#cccccc",
    rgb: editing?.rgb ?? "",
    cmyk: editing?.cmyk ?? "",
    color_group: editing?.color_group ?? "",
    color_sub_group: editing?.color_sub_group ?? "",
  });

  // sync rgb from hex if no rgb yet
  useEffect(() => {
    if (!form.rgb) {
      const rgb = hexToRgb(form.hex);
      if (rgb) setForm((f) => ({ ...f, rgb: `${rgb.r},${rgb.g},${rgb.b}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setHex = (hex: string) => {
    const rgb = hexToRgb(hex);
    setForm((f) => ({
      ...f,
      hex,
      rgb: rgb ? `${rgb.r},${rgb.g},${rgb.b}` : f.rgb,
    }));
  };
  const setRgb = (val: string) => {
    const hex = rgbToHex(val);
    setForm((f) => ({ ...f, rgb: val, hex: hex ?? f.hex }));
  };

  const groupId = groups.find((g) => g.name === form.color_group)?.id ?? null;
  const filteredSubs = useMemo(
    () => (groupId ? subGroups.filter((s) => s.depends_on_value_id === groupId) : []),
    [groupId, subGroups],
  );

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "Code and name are required", variant: "destructive" });
      return;
    }
    const rgb = hexToRgb(form.hex);
    const payload: any = {
      code: form.code.trim(),
      name: form.name.trim(),
      hex: form.hex,
      rgb: form.rgb || null,
      cmyk: form.cmyk || null,
      color_group: form.color_group || null,
      color_sub_group: form.color_sub_group || null,
    };
    if (rgb) {
      payload.rgb_r = rgb.r;
      payload.rgb_g = rgb.g;
      payload.rgb_b = rgb.b;
    }
    const res = editing
      ? await supabase.from("technical_colors").update(payload).eq("id", editing.id)
      : await supabase.from("technical_colors").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Technical color updated" : "Technical color created" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Technical Color" : "New Technical Color"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Pantone Code *</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <Label>Color Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>HEX</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.hex}
                onChange={(e) => setHex(e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer bg-transparent"
              />
              <Input
                value={form.hex}
                onChange={(e) => setHex(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <div>
            <Label>RGB</Label>
            <Input
              value={form.rgb}
              onChange={(e) => setRgb(e.target.value)}
              placeholder="255,255,255"
              className="font-mono"
            />
          </div>
          <div>
            <Label>CMYK</Label>
            <Input
              value={form.cmyk}
              onChange={(e) => setForm({ ...form, cmyk: e.target.value })}
              placeholder="0,0,0,0"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Color Group</Label>
              <Select
                value={form.color_group || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, color_group: v === NONE ? "" : v, color_sub_group: "" })
                }
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-Group</Label>
              <Select
                value={form.color_sub_group || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, color_sub_group: v === NONE ? "" : v })
                }
                disabled={!form.color_group}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {filteredSubs.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Commercial Dialog ============================== */

export function CommDialog({
  open,
  onOpenChange,
  editing,
  tech,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: Comm | null;
  tech: Tech[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    sub_type: editing?.sub_type ?? "Solid",
    code: editing?.code ?? "",
    color_name: editing?.color_name ?? "",
    main_technical_color_id: editing?.main_technical_color_id ?? "",
    linked_technical_color_ids: editing?.linked_technical_color_ids ?? [],
  });
  const techMap = useMemo(() => {
    const m: Record<string, Tech> = {};
    tech.forEach((t) => (m[t.id] = t));
    return m;
  }, [tech]);

  const mainTech = form.main_technical_color_id ? techMap[form.main_technical_color_id] : null;

  const onPickMain = (t: Tech) => {
    setForm((f) => {
      const linked = new Set(f.linked_technical_color_ids ?? []);
      linked.add(t.id);
      return {
        ...f,
        main_technical_color_id: t.id,
        color_name: f.color_name || t.name,
        linked_technical_color_ids: Array.from(linked),
      };
    });
  };
  const addLinked = (t: Tech) => {
    setForm((f) => {
      const set = new Set(f.linked_technical_color_ids ?? []);
      set.add(t.id);
      return { ...f, linked_technical_color_ids: Array.from(set) };
    });
  };
  const removeLinked = (id: string) => {
    setForm((f) => ({
      ...f,
      linked_technical_color_ids: (f.linked_technical_color_ids ?? []).filter((x) => x !== id),
    }));
  };

  const save = async () => {
    if (!form.code.trim() || !form.color_name.trim()) {
      toast({ title: "Code and name are required", variant: "destructive" });
      return;
    }
    const linkedIds =
      form.sub_type?.toLowerCase() === "combined"
        ? form.linked_technical_color_ids ?? []
        : form.main_technical_color_id
        ? [form.main_technical_color_id]
        : [];
    const payload: any = {
      sub_type: form.sub_type,
      code: form.code.trim(),
      color_name: form.color_name.trim(),
      main_technical_color_id: form.main_technical_color_id || null,
      linked_technical_color_ids: linkedIds.length ? linkedIds : null,
    };
    const res = editing
      ? await supabase.from("commercial_colors").update(payload).eq("id", editing.id).select().single()
      : await supabase.from("commercial_colors").insert(payload).select().single();
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Commercial color updated" : "Commercial color created" });

    // Back-fill product_colors (best-effort)
    const savedId = (res.data as any)?.id;
    if (savedId && payload.main_technical_color_id) {
      supabase
        .from("product_colors")
        .update({ linked_color_type: "commercial", linked_color_id: savedId })
        .eq("linked_tech_color_id", payload.main_technical_color_id)
        .is("linked_color_id", null)
        .then(() => {});
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Commercial Color" : "New Commercial Color"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Sub-type</Label>
            <Select value={form.sub_type} onValueChange={(v) => setForm({ ...form, sub_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Solid">Solid</SelectItem>
                <SelectItem value="Combined">Combined</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Commercial Code *</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <Label>Main Technical Color</Label>
            <TechPicker
              tech={tech}
              selected={mainTech}
              onPick={onPickMain}
              placeholder="Select technical color"
            />
          </div>
          <div>
            <Label>Color Name *</Label>
            <Input
              value={form.color_name}
              onChange={(e) => setForm({ ...form, color_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Linked Technical Colors</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[44px]">
              {(form.linked_technical_color_ids ?? []).map((id) => {
                const t = techMap[id];
                if (!t) return null;
                const isMain = id === form.main_technical_color_id;
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
                      onClick={() => removeLinked(id)}
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
              {(form.linked_technical_color_ids ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground py-1">No linked colors</span>
              )}
            </div>
            <div className="mt-2">
              <TechPicker
                tech={tech.filter(
                  (t) => !(form.linked_technical_color_ids ?? []).includes(t.id),
                )}
                selected={null}
                onPick={(t) => addLinked(t)}
                placeholder="Add linked technical color"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== TechPicker ============================== */

export function TechPicker({
  tech,
  selected,
  onPick,
  placeholder,
}: {
  tech: Tech[];
  selected: Tech | null;
  onPick: (t: Tech) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? tech.filter((t) => `${t.code} ${t.name}`.toLowerCase().includes(s))
      : tech;
    return list.slice(0, 200);
  }, [tech, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: colorToHex(selected) }} />
              <span className="font-mono">{selected.code}</span>
              <span className="truncate">— {selected.name}</span>
            </span>
          ) : (
            <span>{placeholder ?? "Select"}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start">
        <div className="p-2 border-b">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or name…"
            className="h-8"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground text-center">No matches</div>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onPick(t);
                setOpen(false);
                setQ("");
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left"
            >
              <div className="w-4 h-4 rounded border flex-shrink-0" style={{ backgroundColor: colorToHex(t) }} />
              <span className="font-mono text-xs">{t.code}</span>
              <span className="truncate">— {t.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
