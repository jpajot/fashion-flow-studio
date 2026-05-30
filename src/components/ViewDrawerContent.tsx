import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2, Loader2, X, ShieldCheck, GripVertical, Search, Pin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface Field { id: string; label: string; }
interface ViewConfig {
  id: string; page_key: string; name: string;
  column_ids: string[]; fixed_column_ids: string[];
  filters_config: any; allowed_roles: string[]; thumb_size?: string;
}

interface Props {
  pageKey: string;
  activeViewId: string;
  onSelectView: (id: string) => void;
  allFields?: Field[];
  currentViewType?: "grid" | null;
  onDrawerClose?: () => void;
}

const THUMB_SIZES = [
  { id: "xs", label: "XS" }, { id: "sm", label: "S" }, { id: "md", label: "M" },
  { id: "lg", label: "L" }, { id: "xl", label: "XL" },
];

export default function ViewDrawerContent({ pageKey, activeViewId, onSelectView, allFields = [], currentViewType = null, onDrawerClose }: Props) {
  const { user } = useAuth();
  const [views, setViews] = useState<ViewConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [editingView, setEditingView] = useState<ViewConfig | null>(null);
  const [formName, setFormName] = useState("");
  const [formFieldIds, setFormFieldIds] = useState<string[]>([]);
  const [formFixedFieldIds, setFormFixedFieldIds] = useState<string[]>([]);
  const [formFilters, setFormFilters] = useState<any>({ operator: "and", filters: [] });
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [dialogTab, setDialogTab] = useState("fields");
  const [roleInput, setRoleInput] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formThumbSize, setFormThumbSize] = useState("md");

  const effectivePageKey = currentViewType === "grid"
    ? `gallery_${pageKey.replace(/_grid$|_list$/, "")}`
    : pageKey;

  useEffect(() => {
    setLoading(true);
    supabase.from("list_view_configs").select("*").eq("page_key", effectivePageKey).order("created_at")
      .then(({ data }) => { setViews((data ?? []) as ViewConfig[]); setLoading(false); });
  }, [effectivePageKey]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const openNew = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormName(""); setFormFieldIds([]); setFormFixedFieldIds([]);
    setFormFilters({ operator: "and", filters: [] }); setFormRoles([]);
    setRoleInput(""); setFieldSearch(""); setFormThumbSize("md");
    setEditingView(null); setMode("new"); setDialogTab("fields");
    setShowDialog(true);
  };

  const openEdit = (e: React.MouseEvent, view: ViewConfig) => {
    e.stopPropagation();
    setFormName(view.name); setFormFieldIds(view.column_ids || []);
    setFormFixedFieldIds(view.fixed_column_ids || []);
    setFormFilters(view.filters_config || { operator: "and", filters: [] });
    setFormRoles(view.allowed_roles || []); setRoleInput(""); setFieldSearch("");
    setFormThumbSize(view.thumb_size || "md"); setEditingView(view);
    setMode("edit"); setDialogTab("fields"); setShowDialog(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!formName.trim()) return;
    setSaving(true);
    const data: any = {
      page_key: effectivePageKey, name: formName.trim(),
      column_ids: formFieldIds, fixed_column_ids: currentViewType === "grid" ? [] : formFixedFieldIds,
      filters_config: formFilters, allowed_roles: formRoles,
      created_by: user?.email,
      ...(currentViewType === "grid" && { thumb_size: formThumbSize }),
    };
    if (editingView) {
      await supabase.from("list_view_configs").update(data).eq("id", editingView.id).select().single();
      setViews(views.map(v => v.id === editingView.id ? { ...v, ...data } : v));
      if (activeViewId === editingView.id) {
        onSelectView("default");
        setTimeout(() => onSelectView(editingView.id), 0);
      }
    } else {
      const { data: created } = await supabase.from("list_view_configs").insert(data).select().single();
      if (created) { setViews([...views, created as ViewConfig]); onSelectView(created.id); }
    }
    setSaving(false); setShowDialog(false);
  };

  const handleDelete = async (e: React.MouseEvent, view: ViewConfig) => {
    e.stopPropagation();
    await supabase.from("list_view_configs").delete().eq("id", view.id);
    setViews(views.filter(v => v.id !== view.id));
    if (activeViewId === view.id) onSelectView("default");
  };

  const toggleField = (fieldId: string) => {
    setFormFieldIds(prev => {
      if (prev.includes(fieldId)) {
        setFormFixedFieldIds(p => p.filter(x => x !== fieldId));
        return prev.filter(x => x !== fieldId);
      }
      return [...prev, fieldId];
    });
  };

  const toggleFixedField = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setFormFixedFieldIds(prev => {
      const isPinning = !prev.includes(fieldId);
      const next = isPinning ? [...prev, fieldId] : prev.filter(x => x !== fieldId);
      if (isPinning) {
        setFormFieldIds(fields => fields.includes(fieldId)
          ? [fieldId, ...fields.filter(x => x !== fieldId)]
          : fields
        );
      }
      return next;
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    setFormFieldIds(prev => {
      const next = [...prev];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      return next;
    });
  };

  const addFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormFilters((f: any) => ({ ...f, filters: [...f.filters, { operator: "and", field: "", values: [] }] }));
  };

  const removeFilter = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setFormFilters((f: any) => ({ ...f, filters: f.filters.filter((_: any, i: number) => i !== idx) }));
  };

  return (
    <div className="space-y-3" onClick={stop} onMouseDown={stop}>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select View</p>
        <button type="button" onClick={(e) => { stop(e); onSelectView("default"); }}
          className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${activeViewId === "default" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"}`}>
          Default View
        </button>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : views.map(v => (
          <div key={v.id} className="group flex items-center gap-2">
            <button type="button" onClick={(e) => { stop(e); onSelectView(v.id); }}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${activeViewId === v.id ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"}`}>
              {v.name}
            </button>
            <button type="button" onClick={(e) => openEdit(e, v)}
              className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground transition-all" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={(e) => handleDelete(e, v)}
              className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Button onClick={openNew} variant="outline" size="sm" className="w-full gap-2 text-xs">
        <Plus className="w-3.5 h-3.5" /> New View
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className="max-w-lg"
          onClick={stop} onMouseDown={stop} onKeyDown={stop}
        >
          <DialogHeader>
            <DialogTitle>{mode === "new" ? "Create New View" : "Edit View"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4" onClick={stop}>
            <div className="space-y-1.5" onClick={stop}>
              <Label className="text-xs">View Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Sales View" className="h-8 text-xs" autoFocus onClick={stop} />
            </div>

            <Tabs value={dialogTab} onValueChange={setDialogTab} onClick={stop}>
              <TabsList className="w-full" onClick={stop}>
                <TabsTrigger value="fields" className="flex-1 text-xs" onClick={stop}>Fields</TabsTrigger>
                {currentViewType === "grid" && (
                  <TabsTrigger value="display" className="flex-1 text-xs" onClick={stop}>Display</TabsTrigger>
                )}
                <TabsTrigger value="filters" className="flex-1 text-xs" onClick={stop}>
                  Filters
                  {formFilters.filters.filter((f: any) => f.field && f.values?.length > 0).length > 0 && (
                    <Badge className="ml-1.5 px-1.5 py-0 text-[10px] h-4">
                      {formFilters.filters.filter((f: any) => f.field && f.values?.length > 0).length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="roles" className="flex-1 text-xs" onClick={stop}>
                  Roles {formRoles.length > 0 && <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] h-4">{formRoles.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="mt-3 space-y-3" onClick={stop}>
                <div className="relative" onClick={stop}>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                    placeholder="Search fields…" className="h-7 text-xs pl-8" onClick={stop} />
                </div>
                {(() => {
                  const q = fieldSearch.toLowerCase();
                  const activeFields = formFieldIds.map(id => allFields.find(f => f.id === id)).filter(Boolean) as Field[];
                  const unchecked = allFields.filter(f => !formFieldIds.includes(f.id));
                  const filteredActive = q ? activeFields.filter(f => f.label.toLowerCase().includes(q)) : activeFields;
                  const filteredUnchecked = q ? unchecked.filter(f => f.label.toLowerCase().includes(q)) : unchecked;
                  return (
                    <div className="border border-border rounded-lg overflow-hidden" onClick={stop}>
                      <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        Active Fields <span className="text-[10px] font-normal text-muted-foreground/70 ml-1">· drag to reorder</span>
                      </div>
                      {filteredActive.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No fields selected yet</div>
                      ) : (
                        <DragDropContext onDragEnd={q ? () => {} : handleDragEnd}>
                          <Droppable droppableId="active-fields">
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-border max-h-52 overflow-y-auto">
                                {filteredActive.map((field, index) => {
                                  const isPinned = formFixedFieldIds.includes(field.id);
                                  const trueIndex = formFieldIds.indexOf(field.id);
                                  return (
                                    <Draggable key={field.id} draggableId={field.id} index={q ? index : trueIndex}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef} {...provided.draggableProps}
                                          className={`flex items-center gap-2 px-2 py-2 transition-colors ${snapshot.isDragging ? "bg-accent shadow-md rounded" : "hover:bg-muted/50"}`}
                                          onMouseDown={stop}
                                        >
                                          <div {...provided.dragHandleProps} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing" onMouseDown={stop}>
                                            <GripVertical className="w-3.5 h-3.5" />
                                          </div>
                                          <Checkbox checked={true} onCheckedChange={() => toggleField(field.id)} id={`f-${field.id}`} onClick={stop} />
                                          <label htmlFor={`f-${field.id}`}
                                            className={`flex-1 text-xs cursor-pointer select-none ${isPinned ? "font-medium" : ""}`}
                                            onMouseDown={stop}
                                            onClick={(e) => { stop(e); toggleField(field.id); }}>
                                            {field.label}
                                          </label>
                                          {currentViewType !== "grid" && (
                                            <button type="button" onClick={(e) => toggleFixedField(e, field.id)}
                                              className={`p-0.5 rounded transition-colors ${isPinned ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                                              title={isPinned ? "Unpin column" : "Pin column (sticks to left)"}>
                                              <Pin className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      )}
                      {filteredUnchecked.length > 0 && (
                        <div className="max-h-24 overflow-y-auto divide-y divide-border border-t border-border">
                          <div className="bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground">Available Fields</div>
                          {filteredUnchecked.map(field => (
                            <div key={field.id} className="flex items-center gap-2.5 px-3 py-2 opacity-60 hover:opacity-100 transition-opacity" onMouseDown={stop}>
                              <Checkbox checked={false} onCheckedChange={() => toggleField(field.id)} id={`f-av-${field.id}`} onClick={stop} />
                              <label htmlFor={`f-av-${field.id}`} className="flex-1 text-xs cursor-pointer">{field.label}</label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              {currentViewType === "grid" && (
                <TabsContent value="display" className="mt-3 space-y-3" onClick={stop}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Thumbnail Size</Label>
                    <div className="flex gap-1.5">
                      {THUMB_SIZES.map(s => (
                        <button key={s.id} type="button" onClick={(e) => { stop(e); setFormThumbSize(s.id); }}
                          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors border ${formThumbSize === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="filters" className="mt-3 space-y-3" onClick={stop}>
                <p className="text-xs text-muted-foreground">Filters auto-apply when this view is selected.</p>
                <div className="space-y-2 max-h-64 overflow-y-auto" onClick={stop}>
                  {formFilters.filters.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No filters yet.</p>
                  )}
                  {formFilters.filters.map((fi: any, idx: number) => (
                    <div key={idx} className="border border-border rounded-lg p-2 space-y-2 text-xs" onClick={stop}>
                      <div className="flex items-center gap-1">
                        {idx === 0 ? (
                          <span className="font-medium text-muted-foreground w-12">WHERE</span>
                        ) : (
                          <Select value={fi.operator || "and"} onValueChange={v => setFormFilters((f: any) => ({ ...f, filters: f.filters.map((x: any, i: number) => i === idx ? { ...x, operator: v } : x) }))}>
                            <SelectTrigger className="h-6 text-xs w-16" onClick={stop}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="and">AND</SelectItem><SelectItem value="or">OR</SelectItem></SelectContent>
                          </Select>
                        )}
                        <span className="text-muted-foreground flex-1">{fi.field || "—"}</span>
                        <button type="button" onClick={(e) => removeFilter(e, idx)} className="p-0.5 hover:text-destructive text-muted-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addFilter} className="gap-1 text-xs w-full h-7">
                  <Plus className="w-3 h-3" /> Add Filter
                </Button>
              </TabsContent>

              <TabsContent value="roles" className="mt-3 space-y-3" onClick={stop}>
                <p className="text-xs text-muted-foreground">Restrict to specific roles. Leave empty for all.</p>
                <div className="flex gap-1" onClick={stop}>
                  <Input value={roleInput} onChange={e => setRoleInput(e.target.value)} onClick={stop}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles(p => [...p, r]); setRoleInput(""); } }}
                    placeholder="e.g. admin, manager…" className="h-7 text-xs flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={(e) => { stop(e); const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles(p => [...p, r]); setRoleInput(""); }} className="h-7 text-xs px-2">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                {formRoles.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> Visible to all roles
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {formRoles.map(r => (
                      <div key={r} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/20">
                        {r}
                        <button type="button" onClick={(e) => { stop(e); setFormRoles(p => p.filter(x => x !== r)); }} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter onClick={stop}>
              <Button variant="outline" size="sm" className="text-xs" onClick={(e) => { stop(e); setShowDialog(false); }}>Cancel</Button>
              <Button size="sm" className="text-xs gap-2" disabled={saving || !formName.trim()} onClick={handleSave}>
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
