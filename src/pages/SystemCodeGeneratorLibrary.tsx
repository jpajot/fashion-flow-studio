import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Hash,
  Play,
  ListChecks,
  SwatchBook,
  Ruler,
  CircleDollarSign,
  Settings,
} from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";

type Generator = {
  id: string;
  entity_name: string;
  entity_type: string;
  prefix: string;
  padding: number;
  last_sequence: number;
  excluded_codes: string | null;
  format_type: "sequential" | "hash";
  hash_length: number;
  hash_separator: string;
  description: string | null;
};

type Lov = { id: string; name: string; type_of_lov_id: string; depends_on_value_id: string | null };

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
};

function nextCodePreview(g: {
  format_type: string;
  prefix: string;
  padding: number;
  last_sequence: number;
  hash_length: number;
  hash_separator: string;
}) {
  if (g.format_type === "hash") {
    return `${g.prefix}${g.hash_separator ?? ""}${"X".repeat(g.hash_length || 6)}`;
  }
  const n = (g.last_sequence ?? 0) + 1;
  return `${g.prefix}${String(n).padStart(g.padding || 5, "0")}`;
}

const EMPTY_FORM = {
  entity_name: "",
  entity_type: "",
  prefix: "",
  padding: 5,
  excluded_codes: "",
  format_type: "sequential" as "sequential" | "hash",
  hash_length: 6,
  hash_separator: "-",
  description: "",
};

export default function SystemCodeGeneratorLibrary() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [rows, setRows] = useState<Generator[]>([]);
  const [entityTypeRow, setEntityTypeRow] = useState<{ entities?: string; entityTypes?: string }>(
    {},
  );
  const [entityOptions, setEntityOptions] = useState<Lov[]>([]);
  const [entityTypeOptions, setEntityTypeOptions] = useState<Lov[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Generator | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [confirmDelete, setConfirmDelete] = useState<Generator | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("system_code_generators")
      .select("*")
      .order("entity_name");
    setRows((data ?? []) as Generator[]);
  };

  const loadLovs = async () => {
    const { data: typeRows } = await supabase
      .from("type_of_lov")
      .select("id, code")
      .or("code.eq.Entities,code.eq.EntityTypes");
    const entitiesId = (typeRows ?? []).find((t: any) => t.code === "Entities")?.id;
    const entityTypesId = (typeRows ?? []).find((t: any) => t.code === "EntityTypes")?.id;
    setEntityTypeRow({ entities: entitiesId, entityTypes: entityTypesId });
    if (entitiesId) {
      const { data } = await supabase
        .from("list_of_values")
        .select("id,name,type_of_lov_id,depends_on_value_id")
        .eq("type_of_lov_id", entitiesId)
        .order("name");
      setEntityOptions((data ?? []) as Lov[]);
    }
    if (entityTypesId) {
      const { data } = await supabase
        .from("list_of_values")
        .select("id,name,type_of_lov_id,depends_on_value_id")
        .eq("type_of_lov_id", entityTypesId)
        .order("name");
      setEntityTypeOptions((data ?? []) as Lov[]);
    }
  };

  useEffect(() => {
    load();
    loadLovs();
  }, []);

  useRegisterSubNav(
    SUB_NAV_ITEMS,
    "codegen",
    (id) => {
      const r = SUB_NAV_ROUTES[id];
      navigate(r ?? "/config");
    },
    "Settings",
  );

  const hasEntitiesLov = !!entityTypeRow.entities;
  const hasEntityTypesLov = !!entityTypeRow.entityTypes;

  const filteredTypeOptions = useMemo(() => {
    if (!hasEntityTypesLov) return [];
    const ent = entityOptions.find((e) => e.name === form.entity_name);
    if (!ent) return entityTypeOptions; // not yet selected
    return entityTypeOptions.filter((t) => t.depends_on_value_id === ent.id);
  }, [entityOptions, entityTypeOptions, form.entity_name, hasEntityTypesLov]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };
  const openEdit = (g: Generator) => {
    setEditing(g);
    setForm({
      entity_name: g.entity_name ?? "",
      entity_type: g.entity_type ?? "",
      prefix: g.prefix ?? "",
      padding: g.padding ?? 5,
      excluded_codes: g.excluded_codes ?? "",
      format_type: (g.format_type as any) ?? "sequential",
      hash_length: g.hash_length ?? 6,
      hash_separator: g.hash_separator ?? "-",
      description: g.description ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.entity_name.trim() || !form.entity_type.trim() || !form.prefix.trim()) {
      toast({ title: "Entity, Type and Prefix are required", variant: "destructive" });
      return;
    }
    const payload: any = {
      entity_name: form.entity_name.trim(),
      entity_type: form.entity_type.trim(),
      prefix: form.prefix.trim(),
      format_type: form.format_type,
      description: form.description || null,
    };
    if (form.format_type === "sequential") {
      payload.padding = Number(form.padding) || 5;
      payload.excluded_codes = form.excluded_codes || null;
    } else {
      payload.hash_length = Number(form.hash_length) || 6;
      payload.hash_separator = form.hash_separator ?? "";
    }
    const res = editing
      ? await supabase.from("system_code_generators").update(payload).eq("id", editing.id)
      : await supabase.from("system_code_generators").insert({ ...payload, last_sequence: 0 });
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Generator updated" : "Generator created" });
    setDialogOpen(false);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase
      .from("system_code_generators")
      .delete()
      .eq("id", confirmDelete.id);
    if (error)
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else toast({ title: "Generator deleted" });
    setConfirmDelete(null);
    load();
  };

  const testGenerate = async (g: Generator) => {
    const { data, error } = await supabase.rpc("generate_code", {
      p_entity_name: g.entity_name,
      p_entity_type: g.entity_type,
    });
    if (error) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Generated", description: String(data) });
    load();
  };

  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Generator", icon: Plus, onClick: openAdd },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: load },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Code Generators</h1>
          <p className="text-sm text-muted-foreground">
            Configure automatic sequential or hash codes per entity and type.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Generator
        </Button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Hash className="h-10 w-10 mb-2 opacity-50" />
            <div>No code generators yet. Add one to get started.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Padding</TableHead>
                <TableHead>Last Seq.</TableHead>
                <TableHead>Next Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.entity_name}</TableCell>
                  <TableCell>{g.entity_type}</TableCell>
                  <TableCell>
                    <Badge variant={g.format_type === "hash" ? "secondary" : "outline"}>
                      {g.format_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{g.prefix}</TableCell>
                  <TableCell>{g.format_type === "sequential" ? g.padding : "—"}</TableCell>
                  <TableCell>{g.format_type === "sequential" ? g.last_sequence : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{nextCodePreview(g)}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {g.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Generate test code"
                        onClick={() => testGenerate(g)}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(g)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setConfirmDelete(g)}
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Generator" : "New Generator"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Entity *</Label>
              {hasEntitiesLov ? (
                <Select
                  value={form.entity_name}
                  onValueChange={(v) => setForm({ ...form, entity_name: v, entity_type: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((e) => (
                      <SelectItem key={e.id} value={e.name}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.entity_name}
                  onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                  placeholder="e.g. Product"
                />
              )}
            </div>

            <div>
              <Label>Type *</Label>
              {hasEntityTypesLov ? (
                <Select
                  value={form.entity_type}
                  onValueChange={(v) => setForm({ ...form, entity_type: v })}
                  disabled={!form.entity_name}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTypeOptions.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.entity_type}
                  onChange={(e) => setForm({ ...form, entity_type: e.target.value })}
                  placeholder="e.g. Style"
                />
              )}
            </div>

            <div>
              <Label>Prefix *</Label>
              <Input
                value={form.prefix}
                onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                placeholder="STY"
              />
            </div>

            <div>
              <Label>Format Type</Label>
              <Select
                value={form.format_type}
                onValueChange={(v: any) => setForm({ ...form, format_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">sequential</SelectItem>
                  <SelectItem value="hash">hash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.format_type === "sequential" ? (
              <>
                <div>
                  <Label>Padding</Label>
                  <Input
                    type="number"
                    value={form.padding}
                    onChange={(e) => setForm({ ...form, padding: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Excluded Codes</Label>
                  <Input
                    value={form.excluded_codes}
                    onChange={(e) => setForm({ ...form, excluded_codes: e.target.value })}
                    placeholder="STY00010,STY00013"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Codes to skip during generation
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Hash Length</Label>
                  <Input
                    type="number"
                    value={form.hash_length}
                    onChange={(e) => setForm({ ...form, hash_length: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Hash Separator</Label>
                  <Input
                    value={form.hash_separator}
                    onChange={(e) => setForm({ ...form, hash_separator: e.target.value })}
                    placeholder="-"
                  />
                </div>
              </>
            )}

            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Next code preview: </span>
              <span className="font-mono font-semibold">
                {nextCodePreview({
                  format_type: form.format_type,
                  prefix: form.prefix || "PFX",
                  padding: form.padding,
                  last_sequence: editing?.last_sequence ?? 0,
                  hash_length: form.hash_length,
                  hash_separator: form.hash_separator,
                })}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete generator?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the generator for {confirmDelete?.entity_name} / {confirmDelete?.entity_type}?
              This cannot be undone.
            </AlertDialogDescription>
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
