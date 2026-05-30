import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import InlineColorPicker, { InlineColorOption } from "@/components/InlineColorPicker";
import RevisionContextModal from "@/components/RevisionContextModal";
import { detectTrackedFieldChanges, createProductRevision } from "@/lib/revisions";
import { useAuth } from "@/contexts/AuthContext";

const NONE = "__none__";

export type ColorwayFormProps = {
  productId: string;
  existing?: any;
  siblings: any[];
  techColors: any[];
  commColors: any[];
  projects: any[];
  styleSizes: any[];
  onSaved: (saved: any) => void;
  onCancel: () => void;
};

export default function ColorwayForm({
  productId,
  existing,
  siblings,
  techColors,
  commColors,
  projects,
  styleSizes,
  onSaved,
  onCancel,
}: ColorwayFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEdit = !!existing?.id;

  const [form, setForm] = useState<any>(
    existing ?? {
      color_name: "",
      colorway_code: "",
      color_hex: "#000000",
      colorway_status: "",
      linked_tech_color_id: null,
      linked_color_type: null,
      linked_color_id: null,
      creation_project_id: null,
      linked_project_ids: [],
      image_url: "",
    },
  );
  const [saving, setSaving] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [revDiffs, setRevDiffs] = useState<any[]>([]);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  const techOptions: InlineColorOption[] = useMemo(
    () => techColors.map((t) => {
      const linkedComm = commColors.find((c) => c.main_technical_color_id === t.id);
      return { id: t.id, code: t.code, name: t.name, hex: t.hex, meta: linkedComm?.code || null };
    }),
    [techColors, commColors],
  );
  const commOptions: InlineColorOption[] = useMemo(
    () =>
      commColors.map((c) => {
        const main = techColors.find((t) => t.id === c.main_technical_color_id);
        return {
          id: c.id,
          code: c.code,
          name: c.color_name,
          hex: main?.hex || null,
          meta: main?.code || null,
        };
      }),
    [commColors, techColors],
  );

  const onPickTech = (id: string | null) => {
    if (!id) {
      setForm((f: any) => ({ ...f, linked_tech_color_id: null }));
      return;
    }
    const tech = techColors.find((t) => t.id === id);
    if (!tech) return;
    setForm((f: any) => {
      const next: any = {
        ...f,
        linked_tech_color_id: tech.id,
        color_hex: tech.hex || f.color_hex,
        color_name: f.color_name || tech.name,
      };
      if (!f.linked_color_id) {
        const comm = commColors.find((c) => c.main_technical_color_id === tech.id);
        if (comm) {
          next.linked_color_type = "commercial";
          next.linked_color_id = comm.id;
          next.colorway_code = comm.code;
        }
      }
      return next;
    });
  };

  const onPickComm = (id: string | null) => {
    if (!id) {
      setForm((f: any) => ({ ...f, linked_color_type: null, linked_color_id: null }));
      return;
    }
    const comm = commColors.find((c) => c.id === id);
    if (!comm) return;
    const main = techColors.find((t) => t.id === comm.main_technical_color_id);
    setForm((f: any) => ({
      ...f,
      linked_color_type: "commercial",
      linked_color_id: comm.id,
      colorway_code: comm.code,
      color_hex: main?.hex || f.color_hex,
      color_name: f.color_name || comm.color_name,
    }));
  };

  const validate = (): string | null => {
    if (!form.color_name?.trim()) return "Colorway name is required";
    if (form.colorway_code) {
      const dup = siblings.find(
        (s) =>
          s.id !== existing?.id &&
          (s.colorway_code || "").toLowerCase() === String(form.colorway_code).toLowerCase(),
      );
      if (dup) return `Colorway code "${form.colorway_code}" already exists on this product`;
    }
    return null;
  };

  const buildPayload = () => {
    const p: any = {
      product_id: productId,
      color_name: form.color_name,
      colorway_code: form.colorway_code || null,
      color_hex: form.color_hex || null,
      colorway_status: form.colorway_status || null,
      linked_tech_color_id: form.linked_tech_color_id || null,
      linked_color_type: form.linked_color_type || null,
      linked_color_id: form.linked_color_id || null,
      creation_project_id: form.creation_project_id || null,
      linked_project_ids: form.linked_project_ids?.length ? form.linked_project_ids : null,
      image_url: form.image_url || null,
    };
    return p;
  };

  const persist = async (payload: any) => {
    if (isEdit) {
      const { data, error } = await supabase
        .from("product_colors")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from("product_colors").insert(payload).select().single();
    if (error) throw error;

    if (payload.linked_tech_color_id) {
      const maxSeq = siblings.reduce((m, s) => Math.max(m, Number(s.sequence || 0)), 0);
      const seq = String(maxSeq + 1).padStart(4, "0");
      const sizeIds = styleSizes.filter((s) => s.is_active !== false).map((s) => s.size_id || s.id);
      await supabase.from("product_color_and_more").insert({
        product_color_id: data.id,
        name: payload.color_name || "Default",
        sequence: seq,
        size_ids: sizeIds,
      });
    }
    return data;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Cannot save", description: err, variant: "destructive" });
      return;
    }
    const payload = buildPayload();
    setSaving(true);
    try {
      if (isEdit) {
        const detect = await detectTrackedFieldChanges("product_color", existing, { ...existing, ...payload });
        if (detect.has_tracked_changes) {
          setRevDiffs(detect.field_diffs);
          setPendingPayload({ payload, detect });
          setRevOpen(true);
          setSaving(false);
          return;
        }
      }
      const saved = await persist(payload);
      toast({ title: isEdit ? "Colorway updated" : "Colorway created" });
      onSaved(saved);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevisionConfirm = async (ctx: string) => {
    if (!pendingPayload) return;
    setSaving(true);
    try {
      const saved = await persist(pendingPayload.payload);
      await createProductRevision({
        product_id: productId,
        target_type: "product_color",
        target_id: existing.id,
        revision_context: ctx,
        before_snapshot: pendingPayload.detect.before_snapshot,
        after_snapshot: pendingPayload.detect.after_snapshot,
        field_diffs: pendingPayload.detect.field_diffs,
        triggered_by: user?.email || "system",
      });
      toast({ title: "Revision recorded" });
      setRevOpen(false);
      setPendingPayload(null);
      onSaved(saved);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Colorway Name *</Label>
          <Input value={form.color_name} onChange={(e) => setForm({ ...form, color_name: e.target.value })} />
        </div>
        <div>
          <Label>Colorway Code</Label>
          <Input value={form.colorway_code || ""} onChange={(e) => setForm({ ...form, colorway_code: e.target.value })} />
        </div>
        <div>
          <Label>Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={form.color_hex || "#000000"}
              onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
              className="w-16 p-1 h-10"
            />
            <Input value={form.color_hex || ""} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>Link to Technical Color</Label>
          <InlineColorPicker options={techOptions} value={form.linked_tech_color_id} onChange={(id) => onPickTech(id)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Link to Commercial Color</Label>
          <InlineColorPicker options={commOptions} value={form.linked_color_id} onChange={(id) => onPickComm(id)} />
        </div>
        <div>
          <Label>Creation Project</Label>
          <Select
            value={form.creation_project_id || NONE}
            onValueChange={(v) => setForm({ ...form, creation_project_id: v === NONE ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Image URL</Label>
          <Input value={form.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Linked Projects</Label>
          <div className="flex flex-wrap gap-1 mb-2">
            {(form.linked_project_ids || []).map((pid: string) => {
              const p = projects.find((x) => x.id === pid);
              return (
                <Badge key={pid} variant="secondary" className="gap-1">
                  {p?.name || pid}
                  <button
                    onClick={() =>
                      setForm({ ...form, linked_project_ids: form.linked_project_ids.filter((x: string) => x !== pid) })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
          <Select
            value=""
            onValueChange={(v) => {
              if (!v) return;
              const cur = form.linked_project_ids || [];
              if (!cur.includes(v)) setForm({ ...form, linked_project_ids: [...cur, v] });
            }}
          >
            <SelectTrigger><SelectValue placeholder="+ Add project" /></SelectTrigger>
            <SelectContent>
              {projects
                .filter((p) => !(form.linked_project_ids || []).includes(p.id))
                .map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save" : "Create"}</Button>
      </div>
      <RevisionContextModal
        open={revOpen}
        onOpenChange={setRevOpen}
        fieldDiffs={revDiffs}
        onConfirm={handleRevisionConfirm}
        saving={saving}
      />
    </div>
  );
}
