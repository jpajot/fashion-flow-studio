import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Check, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export interface ViewDrawerContentProps {
  pageKey: string;
  activeViewId: string;
  onSelectView: (id: string) => void;
  allFields: Array<{ id: string; label: string }>;
  currentViewType?: "grid" | null;
}

type ViewRow = {
  id: string;
  page_key: string;
  name: string;
  column_ids: string[] | null;
  fixed_column_ids: string[] | null;
  filters_config: any;
  allowed_roles: string[] | null;
  thumb_size: string | null;
  created_by: string | null;
  created_at: string;
};

export default function ViewDrawerContent({
  pageKey,
  activeViewId,
  onSelectView,
  allFields,
  currentViewType,
}: ViewDrawerContentProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const effectivePageKey = currentViewType === "grid" ? `gallery_${pageKey}` : pageKey;

  const [views, setViews] = useState<ViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ViewRow | null>(null);
  const [delTarget, setDelTarget] = useState<ViewRow | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("list_view_configs")
        .select("*")
        .eq("page_key", effectivePageKey)
        .order("created_at");
      if (error) {
        toast({ title: "Failed to load views", description: error.message, variant: "destructive" });
      }
      setViews((data ?? []) as ViewRow[]);
      setLoading(false);
    })();
  }, [effectivePageKey, refresh, toast]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (v: ViewRow) => { setEditing(v); setEditorOpen(true); };

  const doDelete = async () => {
    if (!delTarget) return;
    const { error } = await supabase.from("list_view_configs").delete().eq("id", delTarget.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "View deleted" });
      if (activeViewId === delTarget.id) onSelectView("default");
      setRefresh((r) => r + 1);
    }
    setDelTarget(null);
  };

  return (
    <div className="p-3 border-t space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manage Views</div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New View
        </Button>
      </div>

      <button
        onClick={() => onSelectView("default")}
        className={cn(
          "w-full text-left text-sm rounded px-2 py-1.5 flex items-center gap-2 hover:bg-accent",
          activeViewId === "default" && "bg-accent",
        )}
      >
        {activeViewId === "default" && <Check className="h-3.5 w-3.5" />}
        <span className={activeViewId === "default" ? "font-medium" : ""}>Default</span>
      </button>

      {loading ? (
        <div className="text-xs text-muted-foreground p-2">Loading…</div>
      ) : views.length === 0 ? (
        <div className="text-xs text-muted-foreground p-2">No saved views</div>
      ) : (
        <div className="space-y-1">
          {views.map((v) => (
            <div
              key={v.id}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 hover:bg-accent group",
                activeViewId === v.id && "bg-accent",
              )}
            >
              <button
                onClick={() => onSelectView(v.id)}
                className="flex-1 text-left text-sm flex items-center gap-2 min-w-0"
              >
                {activeViewId === v.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                <span className={cn("truncate", activeViewId === v.id && "font-medium")}>{v.name}</span>
              </button>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 group-hover:opacity-100" onClick={() => openEdit(v)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 group-hover:opacity-100" onClick={() => setDelTarget(v)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <ViewEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          existing={editing}
          allFields={allFields}
          pageKey={effectivePageKey}
          userEmail={user?.email || null}
          onSaved={() => { setEditorOpen(false); setRefresh((r) => r + 1); }}
        />
      )}

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete view?</AlertDialogTitle>
            <AlertDialogDescription>"{delTarget?.name}" will be permanently removed.</AlertDialogDescription>
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

function ViewEditorDialog({
  open,
  onOpenChange,
  existing,
  allFields,
  pageKey,
  userEmail,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: ViewRow | null;
  allFields: Array<{ id: string; label: string }>;
  pageKey: string;
  userEmail: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name || "");
  const [columnIds, setColumnIds] = useState<string[]>(
    existing?.column_ids?.length ? existing.column_ids : allFields.map((f) => f.id),
  );
  const [fixedIds, setFixedIds] = useState<string[]>(existing?.fixed_column_ids || []);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fieldById = useMemo(() => Object.fromEntries(allFields.map((f) => [f.id, f])), [allFields]);

  const toggleField = (id: string) => {
    setColumnIds((cur) =>
      cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
    );
    if (fixedIds.includes(id) && columnIds.includes(id)) {
      setFixedIds((cur) => cur.filter((c) => c !== id));
    }
  };
  const toggleFixed = (id: string) => {
    setFixedIds((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  };

  const onDragStart = (i: number) => setDragIndex(i);
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    setColumnIds((cur) => {
      const next = [...cur];
      const [m] = next.splice(dragIndex, 1);
      next.splice(i, 0, m);
      setDragIndex(i);
      return next;
    });
  };
  const onDragEnd = () => setDragIndex(null);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      page_key: pageKey,
      name: name.trim(),
      column_ids: columnIds,
      fixed_column_ids: fixedIds,
      filters_config: {},
      allowed_roles: [],
      created_by: userEmail,
    };
    const res = isEdit
      ? await supabase.from("list_view_configs").update(payload).eq("id", existing!.id)
      : await supabase.from("list_view_configs").insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: isEdit ? "View updated" : "View created" });
    onSaved();
  };

  // unselected fields (still allow adding)
  const orderedSelected = columnIds.filter((id) => fieldById[id]);
  const unselected = allFields.filter((f) => !columnIds.includes(f.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit View" : "New View"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My view" />
          </div>
          <div>
            <Label className="text-xs">Fields (drag to reorder)</Label>
            <div className="border rounded-md divide-y max-h-64 overflow-y-auto mt-1">
              {orderedSelected.map((id, i) => {
                const f = fieldById[id];
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    className="flex items-center gap-2 px-2 py-1.5 bg-background hover:bg-accent/40 cursor-move"
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <Checkbox checked onCheckedChange={() => toggleField(id)} />
                    <span className="text-sm flex-1">{f.label}</span>
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Checkbox
                        checked={fixedIds.includes(id)}
                        onCheckedChange={() => toggleFixed(id)}
                      />
                      Pin
                    </label>
                  </div>
                );
              })}
              {unselected.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 opacity-60">
                  <span className="w-3.5" />
                  <Checkbox checked={false} onCheckedChange={() => toggleField(f.id)} />
                  <span className="text-sm flex-1">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
