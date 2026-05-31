import { format } from "date-fns";

const CHANGE_TYPE_LABELS: Record<string, string> = {
  status_transition: "Status change",
  line_added: "Line added",
  line_removed: "Line removed",
  line_modified: "Line modified",
  variant_modified: "Cell updated",
  derived: "Derived",
  routing_synced: "Routing synced",
  routing_changed_upstream: "Routing changed",
  routing_overridden: "Routing changed",
  validity_window_changed: "Validity window updated",
  version_created: "Version created",
};

export default function BOMChangeLogTab({ changeLog }: { changeLog: any[] }) {
  if (!changeLog?.length) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {changeLog.map((entry) => (
        <div key={entry.id} className="flex gap-3 px-4 py-3 bg-card rounded-lg border border-border text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{CHANGE_TYPE_LABELS[entry.change_type] || entry.change_type}</span>
              {entry.payload?.from !== undefined && entry.payload?.to !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {String(entry.payload.from)} → {String(entry.payload.to)}
                </span>
              )}
            </div>
            {entry.payload?.detail && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate" title={entry.payload.detail}>
                {entry.payload.detail}
              </p>
            )}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span>{entry.triggered_by || "System"}</span>
              {entry.triggered_at && <span>{format(new Date(entry.triggered_at), "dd MMM yyyy HH:mm")}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
