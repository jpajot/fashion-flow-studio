import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FieldDiff } from "@/lib/revisions";

export default function RevisionContextModal({
  open,
  onOpenChange,
  fieldDiffs,
  onConfirm,
  onCancel,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fieldDiffs: FieldDiff[];
  onConfirm: (context: string) => void;
  onCancel?: () => void;
  saving?: boolean;
}) {
  const [context, setContext] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setContext("");
          onCancel?.();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tracked Change Detected</DialogTitle>
          <DialogDescription>
            One or more tracked fields changed. Add context so this revision can be reviewed later.
          </DialogDescription>
        </DialogHeader>
        {fieldDiffs.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 text-sm bg-muted/30">
            {fieldDiffs.map((d) => (
              <div key={d.field} className="space-y-0.5">
                <div className="font-medium">{d.label}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="line-through">{String(d.before ?? "—")}</span>{" → "}
                  <span className="text-foreground">{String(d.after ?? "—")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div>
          <Label>Revision context</Label>
          <Textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="What changed and why?" rows={4} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(context)} disabled={saving || !context.trim()}>
            {saving ? "Saving…" : "Save revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
