import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Trophy, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const RESPONSE_STATUS_COLORS: Record<string, string> = {
  draft:        "bg-gray-100 text-gray-600 border-gray-200",
  submitted:    "bg-blue-100 text-blue-700 border-blue-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-200",
  awarded:      "bg-green-100 text-green-700 border-green-200",
  rejected:     "bg-red-100 text-red-700 border-red-200",
  superseded:   "bg-gray-100 text-gray-400 border-gray-200",
};

function fmt(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
}
function fmtDT(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString();
}

interface Props {
  response: any;
  currencyMap: Record<string, any>;
  line: any;
  onEdit: (r: any) => void;
  onDeleted: () => void;
  onAward: (r: any) => void;
}

export default function ResponseCard({ response, currencyMap, line, onEdit, onDeleted, onAward }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const supplierCurrency = currencyMap[response.supplier_currency_id];
  const targetCurrency   = currencyMap[line._targetCurrencyId];
  const isSameCurrency   = response.supplier_currency_id === line._targetCurrencyId;

  const canEdit   = response.status === "draft";
  const canDelete = !response.is_awarded && response.status !== "awarded";
  const canAward  = !line.awarded_response_id || line.awarded_response_id !== response.id;
  const hasNotes  = response.supplier_notes || response.reviewer_notes;

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from("rfq_responses").delete().eq("id", response.id);
    const { count } = await supabase.from("rfq_responses").select("id", { count: "exact", head: true }).eq("rfq_line_id", line.id);
    if ((count ?? 0) === 0 && line.status === "answered") {
      await supabase.from("rfq_lines").update({ status: "pending" }).eq("id", line.id);
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
    onDeleted();
  };

  return (
    <div className="border border-border rounded-xl bg-card px-4 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <span className="text-base font-semibold font-mono">
            {response.total_cost_supplier_ccy?.toFixed(supplierCurrency?.decimal_places ?? 2) ?? "—"}{" "}
            <span className="text-sm font-medium">{supplierCurrency?.code || "?"}</span>
          </span>
          {!isSameCurrency && targetCurrency && response.total_cost_target_ccy != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              = {response.total_cost_target_ccy?.toFixed(targetCurrency?.decimal_places ?? 2)} {targetCurrency.code}
              {" @ "}<span className="font-mono">{response.conversion_rate_used}</span>
              {response.conversion_rate_date && ` (${response.conversion_rate_date})`}
            </p>
          )}
        </div>
        {response.is_awarded && (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-semibold">
            <Trophy className="w-3 h-3" /> Awarded
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium capitalize ${RESPONSE_STATUS_COLORS[response.status] || "bg-muted text-muted-foreground border-border"}`}>
          {(response.status || "").replace(/_/g, " ")}
        </span>
        <span>{(response.valid_from || response.valid_until) ? `${fmt(response.valid_from) || "∞"} → ${fmt(response.valid_until) || "∞"}` : "—"}</span>
        <span>{(response.min_qty != null || response.max_qty != null) ? `${response.min_qty ?? "—"}–${response.max_qty ?? "—"} units` : "—"}</span>
        {response.leadtime_days != null && <span>{response.leadtime_days} days</span>}
        <span className="text-[10px]">
          {(!response.submitted_at) ? "Draft" : `Submitted ${fmtDT(response.submitted_at)}${response.submitted_by ? " by " + response.submitted_by : ""}`}
        </span>
      </div>

      {hasNotes && (
        <div>
          <button type="button" onClick={() => setNotesExpanded(v => !v)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            {notesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Notes
          </button>
          {notesExpanded && (
            <div className="mt-1.5 space-y-1.5 text-xs text-muted-foreground">
              {response.supplier_notes && <div><span className="font-medium text-foreground">Supplier:</span> {response.supplier_notes}</div>}
              {response.reviewer_notes && <div><span className="font-medium text-foreground">Reviewer:</span> {response.reviewer_notes}</div>}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={!canEdit} onClick={() => onEdit(response)}>
          <Pencil className="w-3 h-3" /> Edit
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={!canDelete} onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
        {canAward && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => onAward(response)}>
            <Trophy className="w-3 h-3" /> Award
          </Button>
        )}
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={o => !o && setShowDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this response?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
