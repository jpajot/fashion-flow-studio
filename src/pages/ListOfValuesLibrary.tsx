import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";

type LovType = {
  id: string;
  code: string;
  name: string | null;
  depends_on_id: string | null;
};
type LovValue = {
  id: string;
  type_of_lov_id: string;
  name: string;
  depends_on_value_id: string | null;
  category: string | null;
};

const NONE = "__none__";

const SUB_NAV_ITEMS = [
  { id: "lov", label: "List of Values", icon: ListChecks },
  { id: "codegen", label: "Code Generators", icon: Hash },
  { id: "colors", label: "Color Studio", icon: SwatchBook },
  { id: "sizes", label: "Size Studio", icon: Ruler },
  { id: "currencies", label: "Currencies", icon: CircleDollarSign },
  { id: "config", label: "App Config", icon: Settings },
];

export default function ListOfValuesLibrary() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [types, setTypes] = useState<LovType[]>([]);
  const [values, setValues] = useState<LovValue[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState("");

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LovType | null>(null);
  const [typeForm, setTypeForm] = useState({ code: "", name: "", depends_on_id: NONE });

  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<LovValue | null>(null);
  const [valueForm, setValueForm] = useState({ name: "", depends_on_value_id: NONE });

  const [deleteValue, setDeleteValue] = useState<LovValue | null>(null);

  const loadData = async () => {
    const [t, v] = await Promise.all([
      supabase.from("type_of_lov").select("*").order("code"),
      supabase.from("list_of_values").select("*").order("name"),
    ]);
    const ts = (t.data ?? []) as LovType[];
    setTypes(ts);
    setValues((v.data ?? []) as LovValue[]);
    if (!selectedType && ts.length) setSelectedType(ts[0].id);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRegisterSubNav(
    SUB_NAV_ITEMS,
    "lov",
    (id) => {
      const routes: Record<string, string> = {
        lov: "/list-of-values",
        codegen: "/code-generators",
      };
      navigate(routes[id] ?? "/config");
    },
    "Settings",
  );

  const selectedTypeObj = useMemo(
    () => types.find((t) => t.id === selectedType) ?? null,
    [types, selectedType],
  );
  const parentTypeId = selectedTypeObj?.depends_on_id ?? null;
  const parentType = useMemo(
    () => (parentTypeId ? types.find((t) => t.id === parentTypeId) ?? null : null),
    [types, parentTypeId],
  );
  const parentTypeValues = useMemo(
    () => (parentType ? values.filter((v) => v.type_of_lov_id === parentType.id) : []),
    [values, parentType],
  );

  const filteredTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return types;
    return types.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        (t.name ?? "").toLowerCase().includes(q),
    );
  }, [types, typeSearch]);

  const currentValues = useMemo(
    () => (selectedType ? values.filter((v) => v.type_of_lov_id === selectedType) : []),
    [values, selectedType],
  );

  // ---------- Type CRUD ----------
  const openNewType = () => {
    setEditingType(null);
    setTypeForm({ code: "", name: "", depends_on_id: NONE });
    setTypeDialogOpen(true);
  };
  const openEditType = (t: LovType) => {
    setEditingType(t);
    setTypeForm({
      code: t.code,
      name: t.name ?? "",
      depends_on_id: t.depends_on_id ?? NONE,
    });
    setTypeDialogOpen(true);
  };
  const saveType = async () => {
    if (!typeForm.code.trim()) {
      toast({ title: "Code is required", variant: "destructive" });
      return;
    }
    const payload = {
      code: typeForm.code.trim(),
      name: typeForm.name.trim() || typeForm.code.trim(),
      depends_on_id: typeForm.depends_on_id === NONE ? null : typeForm.depends_on_id,
    };
    const res = editingType
      ? await supabase.from("type_of_lov").update(payload).eq("id", editingType.id)
      : await supabase.from("type_of_lov").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingType ? "Type updated" : "Type created" });
    setTypeDialogOpen(false);
    loadData();
  };
  const deleteType = async (t: LovType) => {
    const count = values.filter((v) => v.type_of_lov_id === t.id).length;
    if (count > 0) {
      toast({
        title: "Cannot delete",
        description: `Cannot delete "${t.name || t.code}". It has ${count} value(s).`,
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`Delete type "${t.name || t.code}"?`)) return;
    const { error } = await supabase.from("type_of_lov").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    if (selectedType === t.id) setSelectedType(null);
    toast({ title: "Type deleted" });
    loadData();
  };

  // ---------- Value CRUD ----------
  const openNewValue = () => {
    if (!selectedType) return;
    setEditingValue(null);
    setValueForm({ name: "", depends_on_value_id: NONE });
    setValueDialogOpen(true);
  };
  const openEditValue = (v: LovValue) => {
    setEditingValue(v);
    setValueForm({
      name: v.name,
      depends_on_value_id: v.depends_on_value_id ?? NONE,
    });
    setValueDialogOpen(true);
  };
  const saveValue = async () => {
    if (!selectedType) return;
    if (!valueForm.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload: any = {
      type_of_lov_id: selectedType,
      name: valueForm.name.trim(),
      depends_on_value_id:
        parentTypeId && valueForm.depends_on_value_id !== NONE
          ? valueForm.depends_on_value_id
          : null,
    };
    const res = editingValue
      ? await supabase.from("list_of_values").update(payload).eq("id", editingValue.id)
      : await supabase.from("list_of_values").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingValue ? "Value updated" : "Value created" });
    setValueDialogOpen(false);
    loadData();
  };
  const confirmDeleteValue = async () => {
    if (!deleteValue) return;
    const { error } = await supabase.from("list_of_values").delete().eq("id", deleteValue.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Value deleted" });
      loadData();
    }
    setDeleteValue(null);
  };

  // ---------- Page Options ----------
  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Type", icon: Plus, onClick: openNewType },
        {
          label: "Add Value",
          icon: Plus,
          onClick: openNewValue,
          className: !selectedType ? "opacity-50 pointer-events-none" : "",
        },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: loadData },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  // ---------- Values table columns ----------
  const valueColumns: DataTableColumn<LovValue & { __parentName?: string }>[] = useMemo(() => {
    const cols: DataTableColumn<any>[] = [
      {
        id: "name",
        label: "Name",
        width: 200,
        render: (r) => <span className="font-semibold">{r.name}</span>,
        sortKey: (r) => r.name,
      },
    ];
    if (parentTypeId) {
      cols.push({
        id: "__parentName",
        label: "Depends On",
        width: 200,
        render: (r) =>
          r.__parentName ? (
            <span>
              <span className="text-muted-foreground">{parentType?.name || parentType?.code}:</span>{" "}
              {r.__parentName}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      });
    }
    cols.push({
      id: "__actions",
      label: "Actions",
      width: 80,
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditValue(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={() => setDeleteValue(r)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentTypeId, parentType]);

  const valueRows = useMemo(() => {
    return currentValues.map((v) => {
      const parentVal = v.depends_on_value_id
        ? parentTypeValues.find((p) => p.id === v.depends_on_value_id)
        : null;
      return {
        ...v,
        __parentName: parentVal ? parentVal.name : parentTypeId ? "No dependency" : "",
      };
    });
  }, [currentValues, parentTypeValues, parentTypeId]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">List of Values</h1>
        <p className="text-sm text-muted-foreground">
          Manage reference data: types and their values, including dependency relationships.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Types */}
        <Card className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Types ({types.length})</h2>
            <Button size="sm" variant="outline" onClick={openNewType}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <Input
            placeholder="Search types…"
            value={typeSearch}
            onChange={(e) => setTypeSearch(e.target.value)}
            className="h-8"
          />
          <div className="max-h-96 overflow-y-auto space-y-1">
            {filteredTypes.map((t) => {
              const parent = t.depends_on_id
                ? types.find((p) => p.id === t.depends_on_id)
                : null;
              const isSel = selectedType === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "border rounded-md px-3 py-2 cursor-pointer transition",
                    isSel
                      ? "bg-primary/10 border-primary text-primary"
                      : "hover:bg-muted border-transparent",
                  )}
                  onClick={() => setSelectedType(t.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.name || t.code}</div>
                      {parent && (
                        <div className="text-xs text-muted-foreground truncate">
                          depends on: {parent.name || parent.code}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditType(t);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteType(t);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTypes.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">No types</div>
            )}
          </div>
        </Card>

        {/* RIGHT: Values */}
        <Card className="lg:col-span-2 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Values{selectedTypeObj ? ` — ${selectedTypeObj.name || selectedTypeObj.code}` : ""}
            </h2>
            {selectedType && (
              <Button size="sm" variant="outline" onClick={openNewValue}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            )}
          </div>
          {!selectedType ? (
            <div className="text-sm text-muted-foreground text-center py-10">
              Select a type to manage its values
            </div>
          ) : (
            <DataTable
              columns={valueColumns}
              rows={valueRows}
              filterFields={["name", "__parentName"]}
              emptyMessage="No values"
            />
          )}
        </Card>
      </div>

      {/* Type Dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Type" : "New Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={typeForm.code}
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                placeholder="Defaults to code"
              />
            </div>
            <div>
              <Label>Depends On</Label>
              <Select
                value={typeForm.depends_on_id}
                onValueChange={(v) => setTypeForm({ ...typeForm, depends_on_id: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {types
                    .filter((t) => t.id !== editingType?.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name || t.code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveType}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Value Dialog */}
      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingValue ? "Edit Value" : "New Value"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={valueForm.name}
                onChange={(e) => setValueForm({ ...valueForm, name: e.target.value })}
              />
            </div>
            {parentTypeId && (
              <div>
                <Label>Depends On ({parentType?.name || parentType?.code})</Label>
                <Select
                  value={valueForm.depends_on_value_id}
                  onValueChange={(v) =>
                    setValueForm({ ...valueForm, depends_on_value_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {parentTypeValues.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValueDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveValue}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Value confirmation */}
      <AlertDialog open={!!deleteValue} onOpenChange={(o) => !o && setDeleteValue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete value?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteValue?.name}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteValue}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
