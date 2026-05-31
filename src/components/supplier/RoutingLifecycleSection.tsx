import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ROUTING_TYPE_CHIP: Record<string, { label: string; bg: string; text: string }> = {
  development: { label: "DEV", bg: "#6B7280", text: "#fff" },
  production: { label: "PROD", bg: "#10B981", text: "#fff" },
  sample: { label: "SAMPLE", bg: "#F59E0B", text: "#fff" },
};
const ROUTING_TYPE_ORDER: Record<string, number> = { development: 0, production: 1, sample: 2 };
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  in_review: "bg-blue-100 text-blue-700 border-blue-200",
  released: "bg-green-100 text-green-700 border-green-200",
  superseded: "bg-gray-100 text-gray-400 border-gray-200",
  obsolete: "bg-red-100 text-red-700 border-red-200",
};
const READONLY = (s?: string) => ["released", "superseded", "obsolete"].includes(s || "");

function sortRoutings(rs: any[]) {
  return [...rs].sort((a, b) => {
    const ta = ROUTING_TYPE_ORDER[a.routing_type] ?? 9;
    const tb = ROUTING_TYPE_ORDER[b.routing_type] ?? 9;
    if (ta !== tb) return ta - tb;
    const na = (a.name || "").localeCompare(b.name || "");
    if (na !== 0) return na;
    const ra = a.revision_code || "";
    const rb = b.revision_code || "";
    if (rb !== ra) return rb.localeCompare(ra);
    return (b.version || 0) - (a.version || 0);
  });
}

function computeNextRevisionCode(existing: string[]): string {
  if (!existing?.length) return "A";
  const codes = existing.filter(Boolean).map((c) => c.toUpperCase())
    .sort((a, b) => (a.length !== b.length ? a.length - b.length : a.localeCompare(b)));
  const last = codes[codes.length - 1];
  const chars = last.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] < "Z") { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); break; }
    chars[i] = "A";
    i--;
  }
  if (i < 0) chars.unshift("A");
  return chars.join("");
}

function RoutingTypeChip({ type }: { type: string }) {
  const cfg = ROUTING_TYPE_CHIP[type];
  if (!cfg) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-wide"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", confirmVariant = "default", onConfirm, onClose }: any) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{body}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step modal ───
function RoutingStepModal({ open, onClose, onSave, onDelete, editing, allSuppliers, currencies, lovValues, lovTypes }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (open) {
      setForm(editing ? { ...editing } : {
        step_type: "", supplier_id: "", description: "", unit_cost: "", currency_id: "",
        lead_time_days: "", ships_to_next: true, input_description: "", output_description: "", notes: "",
      });
    }
  }, [open, editing]);

  const stepTypes = useMemo(() => {
    const t = lovTypes?.find((x: any) => x.code === "routing_step_type");
    if (!t) return [];
    return (lovValues || []).filter((v: any) => v.type_of_lov_id === t.id).map((v: any) => v.name);
  }, [lovTypes, lovValues]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit Step" : "Add Step"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label className="text-xs">Step Type *</Label>
            <Select value={form.step_type || ""} onValueChange={(v) => setForm({ ...form, step_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select step type…" /></SelectTrigger>
              <SelectContent>
                {stepTypes.map((s: string) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Lead Time (days)</Label>
            <Input type="number" value={form.lead_time_days ?? ""} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Supplier</Label>
            <Select value={form.supplier_id || ""} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select supplier…" /></SelectTrigger>
              <SelectContent>
                {(allSuppliers || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Description</Label>
            <Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Unit Cost</Label>
            <Input type="number" value={form.unit_cost ?? ""} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Currency</Label>
            <Select value={form.currency_id || ""} onValueChange={(v) => setForm({ ...form, currency_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(currencies || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Input description</Label>
            <Input value={form.input_description || ""} onChange={(e) => setForm({ ...form, input_description: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Output description</Label>
            <Input value={form.output_description || ""} onChange={(e) => setForm({ ...form, output_description: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={form.ships_to_next ?? true} onCheckedChange={(v) => setForm({ ...form, ships_to_next: v })} />
            <Label className="text-xs">Ships to next step</Label>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {editing ? (
            <Button variant="destructive" onClick={() => { onDelete(editing); onClose(); }}>
              <Trash2 className="w-4 h-4 mr-1" />Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!form.step_type} onClick={() => { onSave(form); onClose(); }}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step cards strip ───
function StepCards({ steps, routing, allSuppliers, currencies, onAddStep, onEditStep }: any) {
  const isReadOnly = READONLY(routing?.status);
  const sortedSteps = [...steps].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-2 items-stretch">
        {sortedSteps.map((step: any, idx: number) => {
          const sup = (allSuppliers || []).find((s: any) => s.id === step.supplier_id);
          const curr = (currencies || []).find((c: any) => c.id === step.currency_id);
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                title={isReadOnly ? `Routing is ${routing.status}. Create new version to edit.` : undefined}
                className={cn(
                  "w-44 rounded-lg border border-border bg-muted/30 p-3 transition-all",
                  isReadOnly ? "cursor-default opacity-75" : "cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                )}
                onClick={() => !isReadOnly && onEditStep(step)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{step.sequence}</span>
                  <span className="text-xs font-semibold capitalize">{step.step_type?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{sup?.name || "No supplier"}</p>
                <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  {step.lead_time_days && <span>{step.lead_time_days}d</span>}
                  {step.unit_cost && (<><span>·</span><span>{step.unit_cost} {curr?.code || "—"}</span></>)}
                </div>
                {step.ships_to_next && idx < sortedSteps.length - 1 && (
                  <p className="text-[9px] text-primary mt-1">ships to next ↘</p>
                )}
              </div>
              {idx < sortedSteps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
        {!isReadOnly && (
          <Button variant="outline" size="sm" className="h-auto min-h-[88px] w-36 text-xs border-dashed flex-col gap-1" onClick={onAddStep}>
            <Plus className="w-4 h-4" />Add step
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Create dialogs ───
function CreateVersionDialog({ open, routing, onClose, onCreated }: any) {
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!routing) return;
    setSaving(true);
    const { data: newR, error } = await supabase.from("supplier_routings").insert({
      product_id: routing.product_id,
      name: routing.name,
      routing_type: routing.routing_type,
      revision_code: routing.revision_code,
      version: (routing.version || 1) + 1,
      status: "draft",
      derived_from_routing_id: routing.id,
      derived_from_revision_code: routing.revision_code,
      is_default: false,
    }).select().single();
    if (!error && newR) {
      const { data: srcSteps } = await supabase.from("supplier_routing_steps").select("*").eq("supplier_routing_id", routing.id);
      if (srcSteps?.length) {
        const newSteps = srcSteps.map(({ id: _id, created_at: _c, updated_at: _u, ...rest }: any) => ({
          ...rest, supplier_routing_id: newR.id,
        }));
        await supabase.from("supplier_routing_steps").insert(newSteps);
      }
      onCreated(newR);
    }
    setSaving(false);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create New Version</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Creates Rev {routing?.revision_code} · v{(routing?.version || 1) + 1} (draft). All steps will be copied.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Version"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateRevisionDialog({ open, routing, allRoutings, onClose, onCreated }: any) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);
  const siblingCodes = (allRoutings || [])
    .filter((r: any) => r.product_id === routing?.product_id && r.routing_type === routing?.routing_type)
    .map((r: any) => r.revision_code).filter(Boolean);
  const nextCode = computeNextRevisionCode(siblingCodes);
  const save = async () => {
    if (!routing || !reason.trim()) return;
    setSaving(true);
    const { data: newR } = await supabase.from("supplier_routings").insert({
      product_id: routing.product_id,
      name: routing.name,
      routing_type: routing.routing_type,
      revision_code: nextCode,
      version: 1,
      status: "draft",
      derived_from_routing_id: routing.id,
      derived_from_revision_code: routing.revision_code,
      notes: reason,
      is_default: false,
    }).select().single();
    if (newR) {
      const { data: srcSteps } = await supabase.from("supplier_routing_steps").select("*").eq("supplier_routing_id", routing.id);
      if (srcSteps?.length) {
        const newSteps = srcSteps.map(({ id: _id, created_at: _c, updated_at: _u, ...rest }: any) => ({
          ...rest, supplier_routing_id: newR.id,
        }));
        await supabase.from("supplier_routing_steps").insert(newSteps);
      }
      onCreated(newR);
    }
    setSaving(false);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create New Revision (Rev {nextCode})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">All steps from current revision will be copied.</p>
          <div>
            <Label className="text-xs">Reason for revision *</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !reason.trim()}>{saving ? "Creating…" : "Create Revision"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeriveProductionDialog({ open, routing, onClose, onCreated }: any) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(routing?.name ? `${routing.name} (Production)` : "Production"); setNotes(""); } }, [open, routing]);
  const save = async () => {
    if (!routing || !name.trim()) return;
    setSaving(true);
    const { data: newR } = await supabase.from("supplier_routings").insert({
      product_id: routing.product_id,
      name,
      routing_type: "production",
      revision_code: "A",
      version: 1,
      status: "draft",
      derived_from_routing_id: routing.id,
      derived_from_revision_code: routing.revision_code,
      notes,
      is_default: false,
    }).select().single();
    if (newR) {
      const { data: srcSteps } = await supabase.from("supplier_routing_steps").select("*").eq("supplier_routing_id", routing.id);
      if (srcSteps?.length) {
        const newSteps = srcSteps.map(({ id: _id, created_at: _c, updated_at: _u, ...rest }: any) => ({
          ...rest, supplier_routing_id: newR.id,
        }));
        await supabase.from("supplier_routing_steps").insert(newSteps);
      }
      onCreated(newR);
    }
    setSaving(false);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Derive Production Routing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRoutingModal({ open, productId, onClose, onCreated }: any) {
  const [name, setName] = useState("");
  const [routingType, setRoutingType] = useState("production");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(""); setRoutingType("production"); setIsDefault(false); } }, [open]);
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (isDefault) {
      await supabase.from("supplier_routings").update({ is_default: false })
        .eq("product_id", productId).eq("routing_type", routingType);
    }
    const { data: newR, error } = await supabase.from("supplier_routings").insert({
      product_id: productId,
      name,
      routing_type: routingType,
      is_default: isDefault,
      revision_code: "A",
      version: 1,
      status: "draft",
    }).select().single();
    setSaving(false);
    if (!error && newR) { onCreated(newR); onClose(); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Routing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Routing Type</Label>
            <Select value={routingType} onValueChange={setRoutingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Sample routings are created by deriving from a production routing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <Label className="text-xs">Set as default for this type</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>{saving ? "Creating…" : "Add Routing"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Routing Header ───
function RoutingHeader({ routing, steps, allRoutings, onToggleDefault, onStatusChange, onNewVersion, onNewRevision, onDeriveProduction, onDelete }: any) {
  const { user } = useAuth();
  const [confirm, setConfirm] = useState<any>(null);
  const totalLT = steps.reduce((sum: number, s: any) => sum + (Number(s.lead_time_days) || 0), 0);
  const isReadOnly = READONLY(routing.status);
  const derivedFrom = allRoutings.find((r: any) => r.id === routing.derived_from_routing_id);
  const supersededBy = allRoutings.find((r: any) => r.id === routing.superseded_by_id);

  const release = () => onStatusChange(routing.id, "released", { released_at: new Date().toISOString(), released_by: user?.email || null });
  const obsolete = () => onStatusChange(routing.id, "obsolete");
  const restoreDraft = () => onStatusChange(routing.id, "draft", { released_at: null, released_by: null });

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{routing.name}</span>
          <div className="flex items-center gap-1.5">
            <Switch checked={!!routing.is_default} disabled={isReadOnly} onCheckedChange={() => onToggleDefault(routing)} />
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Default</Label>
          </div>
          <RoutingTypeChip type={routing.routing_type} />
          <span className="text-xs text-muted-foreground">Rev {routing.revision_code || "A"} · v{routing.version || 1}</span>
          <StatusBadge status={routing.status || "draft"} />
          {totalLT > 0 && <span className="text-xs text-muted-foreground">· {totalLT}d total lead time</span>}
          {routing.pending_eco_review_count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {routing.pending_eco_review_count} ECO pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
          {routing.released_at && <span>Released {new Date(routing.released_at).toLocaleDateString()}{routing.released_by ? ` by ${routing.released_by}` : ""}</span>}
          {derivedFrom && <span>Derived from "{derivedFrom.name}" Rev {derivedFrom.revision_code}</span>}
          {supersededBy && <span>Superseded by "{supersededBy.name}"</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {routing.status === "draft" && (
            <>
              <Button size="sm" variant="outline" onClick={() => onStatusChange(routing.id, "in_review")}>Submit for Review</Button>
              <MoreMenu>
                {routing.routing_type !== "sample" && (
                  <DropdownMenuItem onClick={onDeriveProduction}>Derive Production</DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={() => setConfirm({ title: "Delete routing?", body: "This cannot be undone.", action: onDelete, label: "Delete", variant: "destructive" })}>
                  Delete Routing
                </DropdownMenuItem>
              </MoreMenu>
            </>
          )}
          {routing.status === "in_review" && (
            <>
              <Button size="sm" variant="outline" onClick={() => onStatusChange(routing.id, "draft")}>Back to Draft</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setConfirm({ title: "Release routing?", body: "Once released, the routing becomes read-only.", action: release, label: "Release" })}>
                Release
              </Button>
              <MoreMenu>
                {routing.routing_type !== "sample" && (
                  <DropdownMenuItem onClick={onDeriveProduction}>Derive Production</DropdownMenuItem>
                )}
              </MoreMenu>
            </>
          )}
          {routing.status === "released" && (
            <MoreMenu>
              <DropdownMenuItem onClick={onNewVersion}>New Version</DropdownMenuItem>
              <DropdownMenuItem onClick={onNewRevision}>New Revision</DropdownMenuItem>
              {routing.routing_type !== "sample" && (
                <DropdownMenuItem onClick={onDeriveProduction}>Derive Production</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setConfirm({ title: "Mark as obsolete?", body: "Obsolete routings cannot be edited.", action: obsolete, label: "Mark Obsolete", variant: "destructive" })}>
                Mark Obsolete
              </DropdownMenuItem>
            </MoreMenu>
          )}
          {routing.status === "obsolete" && (
            <Button size="sm" variant="outline" onClick={restoreDraft}>Restore to Draft</Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        body={confirm?.body}
        confirmLabel={confirm?.label}
        confirmVariant={confirm?.variant}
        onConfirm={() => confirm?.action()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function MoreMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="px-2"><MoreHorizontal className="w-4 h-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Routing Body ───
function RoutingBody({ routing, steps, allRoutings, allSuppliers, currencies, lovValues, lovTypes, onToggleDefault, onStatusChange, onAddStep, onEditStep, onNewRoutingAdded, onDelete }: any) {
  const [verOpen, setVerOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [derOpen, setDerOpen] = useState(false);
  const routingSteps = steps.filter((s: any) => s.supplier_routing_id === routing.id);

  return (
    <div className="space-y-3 p-3 bg-card rounded-xl border border-border">
      <RoutingHeader
        routing={routing}
        steps={routingSteps}
        allRoutings={allRoutings}
        onToggleDefault={onToggleDefault}
        onStatusChange={onStatusChange}
        onNewVersion={() => setVerOpen(true)}
        onNewRevision={() => setRevOpen(true)}
        onDeriveProduction={() => setDerOpen(true)}
        onDelete={() => onDelete(routing)}
      />
      <StepCards
        steps={routingSteps}
        routing={routing}
        allSuppliers={allSuppliers}
        currencies={currencies}
        onAddStep={() => onAddStep(routing)}
        onEditStep={(step: any) => onEditStep(routing, step)}
      />
      <CreateVersionDialog open={verOpen} routing={routing} onClose={() => setVerOpen(false)} onCreated={onNewRoutingAdded} />
      <CreateRevisionDialog open={revOpen} routing={routing} allRoutings={allRoutings} onClose={() => setRevOpen(false)} onCreated={onNewRoutingAdded} />
      <DeriveProductionDialog open={derOpen} routing={routing} onClose={() => setDerOpen(false)} onCreated={onNewRoutingAdded} />
    </div>
  );
}

// ─── MultiModeSection ───
function MultiModeSection(props: any) {
  const {
    routings, routingSteps, selectedRoutingId, setSelectedRoutingId,
    allSuppliers, currencies, lovValues, lovTypes,
    onToggleDefault, onStatusChange, onAddStep, onEditStep, onDeleteRouting,
    onNewRoutingAdded, productId,
  } = props;
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showObsolete, setShowObsolete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [stepModal, setStepModal] = useState<any>(null);

  const filtered = sortRoutings(
    (routings || []).filter((r: any) => {
      if (typeFilter !== "all" && r.routing_type !== typeFilter) return false;
      if (!showObsolete && (r.status === "obsolete" || r.status === "superseded")) return false;
      return true;
    })
  );
  const selected = filtered.find((r: any) => r.id === selectedRoutingId) || filtered[0];

  useEffect(() => {
    if (selected && selected.id !== selectedRoutingId) setSelectedRoutingId(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const handleAddStep = (routing: any) => setStepModal({ routing, step: null });
  const handleEditStep = (routing: any, step: any) => setStepModal({ routing, step });

  const saveStep = async (form: any) => {
    if (!stepModal) return;
    const { routing, step } = stepModal;
    const payload: any = {
      step_type: form.step_type,
      supplier_id: form.supplier_id || null,
      description: form.description || null,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      currency_id: form.currency_id || null,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      ships_to_next: form.ships_to_next ?? true,
      input_description: form.input_description || null,
      output_description: form.output_description || null,
      notes: form.notes || null,
    };
    if (step) {
      await supabase.from("supplier_routing_steps").update(payload).eq("id", step.id);
    } else {
      const existing = routingSteps.filter((s: any) => s.supplier_routing_id === routing.id);
      await supabase.from("supplier_routing_steps").insert({
        ...payload, supplier_routing_id: routing.id, sequence: existing.length + 1,
      });
    }
    onAddStep?.();
    onEditStep?.();
  };

  const deleteStep = async (step: any) => {
    await supabase.from("supplier_routing_steps").delete().eq("id", step.id);
    const remaining = routingSteps
      .filter((s: any) => s.supplier_routing_id === step.supplier_routing_id && s.id !== step.id)
      .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sequence !== i + 1) {
        await supabase.from("supplier_routing_steps").update({ sequence: i + 1 }).eq("id", remaining[i].id);
      }
    }
    onAddStep?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { v: "all", l: "All" },
          { v: "development", l: "Development" },
          { v: "production", l: "Production" },
          { v: "sample", l: "Sample" },
        ].map((b) => (
          <button
            key={b.v}
            type="button"
            onClick={() => setTypeFilter(b.v)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              typeFilter === b.v
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {b.l}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
          <input type="checkbox" checked={showObsolete} onChange={(e) => setShowObsolete(e.target.checked)} />
          Include obsolete/superseded
        </label>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="w-3.5 h-3.5" />Add Routing
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">No routings yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((r: any) => {
              const isSel = r.id === selected?.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoutingId(r.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors",
                    isSel ? "bg-primary/10 border-primary text-foreground" : "bg-background border-border hover:border-primary/40"
                  )}
                >
                  {r.is_default && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                  <span>{r.name}</span>
                  <RoutingTypeChip type={r.routing_type} />
                  <span className="text-[10px] text-muted-foreground">Rev {r.revision_code || "A"} · v{r.version || 1}</span>
                </button>
              );
            })}
          </div>
          {selected && (
            <RoutingBody
              routing={selected}
              steps={routingSteps}
              allRoutings={routings}
              allSuppliers={allSuppliers}
              currencies={currencies}
              lovValues={lovValues}
              lovTypes={lovTypes}
              onToggleDefault={onToggleDefault}
              onStatusChange={onStatusChange}
              onAddStep={handleAddStep}
              onEditStep={handleEditStep}
              onNewRoutingAdded={onNewRoutingAdded}
              onDelete={onDeleteRouting}
            />
          )}
        </>
      )}

      <AddRoutingModal
        open={addOpen}
        productId={productId}
        onClose={() => setAddOpen(false)}
        onCreated={onNewRoutingAdded}
      />
      <RoutingStepModal
        open={!!stepModal}
        editing={stepModal?.step}
        allSuppliers={allSuppliers}
        currencies={currencies}
        lovValues={lovValues}
        lovTypes={lovTypes}
        onClose={() => setStepModal(null)}
        onSave={saveStep}
        onDelete={deleteStep}
      />
    </div>
  );
}

function SingleModeSection({ routingId, onRoutingCreated }: { routingId: string; onRoutingCreated?: (r: any) => void }) {
  const [routing, setRouting] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [lovValues, setLovValues] = useState<any[]>([]);
  const [lovTypes, setLovTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepModal, setStepModal] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const [rRes, supRes, curRes, lovRes, lovTypeRes] = await Promise.all([
      supabase.from("supplier_routings").select("*").eq("id", routingId),
      supabase.from("suppliers").select("id,name,code").order("name"),
      supabase.from("currencies").select("*").eq("is_active", true),
      supabase.from("list_of_values").select("*"),
      supabase.from("type_of_lov").select("id,code"),
    ]);
    const r = rRes.data?.[0] || null;
    setRouting(r);
    if (r) {
      const { data: stepsData } = await supabase.from("supplier_routing_steps").select("*").eq("supplier_routing_id", routingId);
      setSteps((stepsData || []).sort((a: any, b: any) => a.sequence - b.sequence));
    }
    setAllSuppliers(supRes.data ?? []);
    setCurrencies(curRes.data ?? []);
    setLovValues(lovRes.data ?? []);
    setLovTypes(lovTypeRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (routingId) load(); /* eslint-disable-next-line */ }, [routingId]);

  const handleStatusChange = async (rId: string, newStatus: string, extra?: any) => {
    await supabase.from("supplier_routings").update({ status: newStatus, ...extra }).eq("id", rId);
    await load();
  };

  const handleToggleDefault = async (r: any) => {
    const newVal = !r.is_default;
    if (newVal) {
      const { data: siblings } = await supabase.from("supplier_routings").select("id").eq("product_id", r.product_id).eq("routing_type", r.routing_type).eq("is_default", true);
      await Promise.all((siblings || []).filter((s: any) => s.id !== r.id).map((s: any) => supabase.from("supplier_routings").update({ is_default: false }).eq("id", s.id)));
    }
    await supabase.from("supplier_routings").update({ is_default: newVal }).eq("id", r.id);
    await load();
  };

  const saveStep = async (form: any) => {
    if (!stepModal) return;
    const { routing: r, step } = stepModal;
    const payload = {
      step_type: form.step_type, supplier_id: form.supplier_id || null, description: form.description || null,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null, currency_id: form.currency_id || null,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null, ships_to_next: form.ships_to_next ?? true,
      input_description: form.input_description || null, output_description: form.output_description || null, notes: form.notes || null,
    };
    if (step) {
      await supabase.from("supplier_routing_steps").update(payload).eq("id", step.id);
    } else {
      const existing = steps.filter((s) => s.supplier_routing_id === r.id);
      await supabase.from("supplier_routing_steps").insert({ ...payload, supplier_routing_id: r.id, sequence: existing.length + 1 });
    }
    setStepModal(null);
    await load();
  };

  const deleteStep = async (step: any) => {
    await supabase.from("supplier_routing_steps").delete().eq("id", step.id);
    const remaining = steps.filter((s) => s.supplier_routing_id === step.supplier_routing_id && s.id !== step.id).sort((a: any, b: any) => a.sequence - b.sequence);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sequence !== i + 1) await supabase.from("supplier_routing_steps").update({ sequence: i + 1 }).eq("id", remaining[i].id);
    }
    setStepModal(null);
    await load();
  };

  const handleNewRoutingAdded = async (newR: any) => {
    await load();
    if (onRoutingCreated) onRoutingCreated(newR);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-5 h-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!routing) return <div className="text-center py-16 text-muted-foreground text-sm">Routing not found.</div>;

  return (
    <>
      <RoutingBody
        routing={routing}
        steps={steps}
        allRoutings={[routing]}
        allSuppliers={allSuppliers}
        currencies={currencies}
        lovValues={lovValues}
        lovTypes={lovTypes}
        onToggleDefault={handleToggleDefault}
        onStatusChange={handleStatusChange}
        onAddStep={(r: any) => setStepModal({ routing: r, step: null })}
        onEditStep={(r: any, step: any) => setStepModal({ routing: r, step })}
        onNewRoutingAdded={handleNewRoutingAdded}
        onDelete={null}
      />
      <RoutingStepModal
        open={!!stepModal}
        editing={stepModal?.step}
        allSuppliers={allSuppliers}
        currencies={currencies}
        lovValues={lovValues}
        lovTypes={lovTypes}
        onClose={() => setStepModal(null)}
        onSave={saveStep}
        onDelete={deleteStep}
      />
    </>
  );
}

export default function RoutingLifecycleSection(props: any) {
  if (props.mode === "single") {
    return <SingleModeSection routingId={props.routingId} onRoutingCreated={props.onRoutingCreated} />;
  }
  return <MultiModeSection {...props} />;
}

