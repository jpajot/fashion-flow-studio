import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Check, X, Minus } from "lucide-react";
import { toast } from "sonner";

const ROW_STATUS = { READY: "ready", SKIP: "skip", INVALID: "invalid" } as const;
type RowStatus = typeof ROW_STATUS[keyof typeof ROW_STATUS];
const STATUS_CONFIG: Record<RowStatus, { icon: any; color: string }> = {
  ready: { icon: Check, color: "bg-green-50 border-green-200 text-green-700" },
  skip:  { icon: Minus, color: "bg-gray-50 border-gray-200 text-gray-600" },
  invalid: { icon: X,  color: "bg-red-50 border-red-200 text-red-700" },
};

interface ParsedRow {
  rowIdx: number; lineId: string; validFrom: string; validUntil: string;
  minQty: number|null; maxQty: number|null; leadTimeDays: number|null;
  supplierCcy: string; totalCost: number|null; supplierNotes: string;
  status: RowStatus; reason: string; currencyId: string;
}

interface Props {
  sr: any; rfqLines: any[]; currencies: any[];
  onClose: () => void; onImportSuccess: () => void;
}

export default function ImportResponsesDialog({ sr, rfqLines, currencies, onClose, onImportSuccess }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"picker"|"preview">("picker");
  const [filename, setFilename] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lineMap: Record<string, any> = Object.fromEntries(rfqLines.map(l => [l.id, l]));

  const handleFilePicked = async (file: File) => {
    if (!file.name.endsWith(".xlsx")) { toast.error("Only .xlsx files supported."); return; }
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets["Lines"];
      if (!ws) { toast.error("No 'Lines' sheet found."); return; }
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (data.length < 2) { toast.error("Need header + at least one row."); return; }
      const rows: ParsedRow[] = data.slice(1).map((row, idx) => {
        const lineId = row[0] ? String(row[0]).trim() : "";
        const supplierCcy = row[14] ? String(row[14]).trim().toUpperCase() : "";
        const totalCost = row[15] != null && row[15] !== "" ? Number(row[15]) : null;
        let status: RowStatus = ROW_STATUS.READY; let reason = ""; let currencyId = "";
        if (!lineId) { status = ROW_STATUS.INVALID; reason = "Line ID required (col A)."; }
        else if (!lineMap[lineId]) { status = ROW_STATUS.INVALID; reason = "Line not in this SR."; }
        if (status === ROW_STATUS.READY && !supplierCcy && totalCost == null) status = ROW_STATUS.SKIP;
        if (status === ROW_STATUS.READY && (supplierCcy || totalCost != null)) {
          if (!supplierCcy || totalCost == null) { status = ROW_STATUS.INVALID; reason = "Both currency & cost required."; }
        }
        if (status === ROW_STATUS.READY && supplierCcy) {
          const curr = currencies.find((c: any) => c.code.toUpperCase() === supplierCcy);
          if (!curr) { status = ROW_STATUS.INVALID; reason = `Unknown currency: ${supplierCcy}`; }
          else currencyId = curr.id;
        }
        return {
          rowIdx: idx+2, lineId, validFrom: row[9]?String(row[9]):"", validUntil: row[10]?String(row[10]):"",
          minQty: row[11]!=null?Number(row[11]):null, maxQty: row[12]!=null?Number(row[12]):null,
          leadTimeDays: row[13]!=null?Number(row[13]):null,
          supplierCcy, totalCost, supplierNotes: row[16]?String(row[16]):"",
          status, reason, currencyId,
        };
      });
      setFilename(file.name); setParsedRows(rows); setStep("preview");
    } catch (err: any) { toast.error("Parse error: " + err.message); }
  };

  const handleImport = async () => {
    setImporting(true);
    const now = new Date().toISOString(); const today = now.split("T")[0]; let imported = 0;
    for (const row of parsedRows.filter(r => r.status === ROW_STATUS.READY)) {
      const line = lineMap[row.lineId];
      const supCurr = currencies.find((c: any) => c.id === row.currencyId);
      let totalTarget = row.totalCost!; let rateUsed = 1; let rateId: string|null = null; let rateDate: string|null = null;
      if (supCurr && supCurr.id !== sr.target_currency_id) {
        const { data: rates } = await supabase.from("currency_conversion_rates").select("id,rate,effective_date")
          .eq("from_currency_id", supCurr.id).eq("to_currency_id", sr.target_currency_id)
          .lte("effective_date", today).order("effective_date", { ascending: false }).limit(1);
        if (!rates?.length) { toast.error(`No rate for ${supCurr.code}. Skipping row ${row.rowIdx}.`); continue; }
        rateUsed = rates[0].rate; rateId = rates[0].id; rateDate = rates[0].effective_date;
        totalTarget = row.totalCost! * rates[0].rate;
      }
      await supabase.from("rfq_responses").insert({
        rfq_line_id: row.lineId, valid_from: row.validFrom||null, valid_until: row.validUntil||null,
        min_qty: row.minQty, max_qty: row.maxQty, leadtime_days: row.leadTimeDays,
        supplier_currency_id: row.currencyId, total_cost_supplier_ccy: row.totalCost,
        total_cost_target_ccy: totalTarget, conversion_rate_used: rateUsed,
        conversion_rate_id: rateId, conversion_rate_date: rateDate,
        status: "submitted", submitted_at: now, submitted_by: user?.email||"", is_awarded: false,
        supplier_notes: row.supplierNotes||null,
        reviewer_notes: `Imported from ${filename} on ${new Date().toLocaleDateString()}`,
      });
      if (line.status === "pending") await supabase.from("rfq_lines").update({ status: "answered" }).eq("id", row.lineId);
      imported++;
    }
    setImporting(false);
    toast.success(`Imported ${imported} response${imported!==1?"s":""}`);
    onImportSuccess(); onClose();
  };

  const readyCount = parsedRows.filter(r => r.status===ROW_STATUS.READY).length;
  const skipCount  = parsedRows.filter(r => r.status===ROW_STATUS.SKIP).length;
  const invalidCount = parsedRows.filter(r => r.status===ROW_STATUS.INVALID).length;

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Responses</DialogTitle></DialogHeader>
        {step === "picker" && (
          <div className="py-4">
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onDrop={e => { e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFilePicked(f); }}
              onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".xlsx" onChange={e => { const f=e.target.files?.[0]; if(f) handleFilePicked(f); }} className="hidden" />
              <p className="text-sm font-medium">Drop your filled .xlsx here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse — use Export ToDo as template</p>
            </div>
          </div>
        )}
        {step === "preview" && (
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 p-3 rounded text-xs">
              <strong>{readyCount}</strong> ready · <strong>{skipCount}</strong> skipped · <strong>{invalidCount}</strong> invalid
            </div>
            <div className="max-h-72 overflow-y-auto border border-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr><th className="px-2 py-2 w-6"/><th className="px-2 py-2 text-left">Row</th><th className="px-2 py-2 text-left">Line ID</th><th className="px-2 py-2 text-left">Ccy</th><th className="px-2 py-2 text-left">Cost</th><th className="px-2 py-2 text-left">Note</th></tr>
                </thead>
                <tbody>
                  {parsedRows.map(row => {
                    const { icon: Icon, color } = STATUS_CONFIG[row.status];
                    return (
                      <tr key={row.rowIdx} className={`border-t border-border ${color}`}>
                        <td className="px-2 py-1.5"><Icon className="w-3.5 h-3.5"/></td>
                        <td className="px-2 py-1.5">{row.rowIdx}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{row.lineId?row.lineId.slice(0,8)+"…":""}</td>
                        <td className="px-2 py-1.5">{row.supplierCcy}</td>
                        <td className="px-2 py-1.5">{row.totalCost}</td>
                        <td className="px-2 py-1.5 text-[10px]">{row.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {invalidCount > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-2 flex gap-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/><p>Fix invalid rows and re-upload to proceed.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("picker")} disabled={importing}>Pick different file</Button>
              <Button onClick={handleImport} disabled={importing||readyCount===0||invalidCount>0} className="gap-2">
                {importing && <Loader2 className="w-4 h-4 animate-spin"/>}
                {importing?"Importing…":`Import ${readyCount} response${readyCount!==1?"s":""}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
