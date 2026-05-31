import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export default function BOMCreateVersionDialog({ open, onClose, bom, bomLines, bomLineVariants, user, viewStateId }: any) {
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();
  const nextVersion = (bom?.version || 1) + 1;

  const handleCreate = async () => {
    setWorking(true);
    const { id: _id, created_at: _ca, updated_at: _ua, ...bomBase } = bom;
    const { data: newBom } = await supabase.from("boms").insert({
      ...bomBase, version: nextVersion, status: "draft",
      superseded_by_version_id: null, superseded_by_id: null,
    }).select().single();
    if (!newBom) { setWorking(false); return; }

    const lineIdMap: Record<string, string> = {};
    for (const line of bomLines) {
      const { id: lid, bom_id: _bid, created_at: _lca, updated_at: _lua, ...lineBase } = line;
      const { data: newLine } = await supabase.from("bom_lines").insert({ ...lineBase, bom_id: newBom.id }).select().single();
      if (newLine) lineIdMap[lid] = newLine.id;
    }
    for (const v of bomLineVariants) {
      const newLineId = lineIdMap[v.bom_line_id];
      if (!newLineId) continue;
      const { id: _vid, created_at: _vca, updated_at: _vua, ...vBase } = v;
      await supabase.from("bom_line_variants").insert({ ...vBase, bom_line_id: newLineId });
    }

    if (viewStateId) {
      const { data: vsRows } = await supabase.from("bom_matrix_view_states").select("*").eq("id", viewStateId);
      if (vsRows?.[0]) {
        const { id: _vsid, bom_id: _vsbid, created_at: _vsca, updated_at: _vsua, ...vsBase } = vsRows[0];
        await supabase.from("bom_matrix_view_states").insert({ ...vsBase, bom_id: newBom.id, last_used_at: new Date().toISOString() });
      }
    }

    await supabase.from("boms").update({ superseded_by_version_id: newBom.id }).eq("id", bom.id);
    await supabase.from("bom_change_logs").insert({
      bom_id: newBom.id, change_type: "version_created",
      payload: { from_bom_id: bom.id, from_version: bom.version, to_version: nextVersion, revision_code: bom.revision_code },
      triggered_by: user?.email || "", triggered_at: new Date().toISOString(),
    });
    // Domain 8: populateBomLineVariantRevisionSnapshots deferred
    console.log("// Domain 8: ECO propagation deferred");
    setWorking(false);
    onClose();
    navigate(`/boms/${newBom.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-sm">Create version {nextVersion}</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p>This will snapshot the current draft <strong>(Rev {bom?.revision_code} · v{bom?.version})</strong> and start version {nextVersion}.</p>
          <p className="text-xs text-muted-foreground">The new version is editable; v{bom?.version} is preserved as a read-only historical snapshot.</p>
          <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-0.5">
            <li>All {bomLines?.length || 0} component line{(bomLines?.length || 0) !== 1 ? "s" : ""} and variants will be cloned to v{nextVersion}</li>
            <li>v{bom?.version} stays in history but is no longer editable</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={working}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={working}>
            {working && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Create version {nextVersion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
