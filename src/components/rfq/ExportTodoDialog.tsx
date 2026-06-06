import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  sr: any; lines: any[];
  productMap: Record<string, any>; colorMap: Record<string, any>;
  pcamMap: Record<string, any>; stepMap: Record<string, any>; supplierMap: Record<string, any>;
  onClose: () => void;
}

export default function ExportTodoDialog({ sr, lines, productMap, colorMap, pcamMap, stepMap, supplierMap, onClose }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportLines = lines.filter(l => ["pending", "answered"].includes(l.status));
      const data = exportLines.map(line => {
        const prod = productMap[line.product_id];
        const sup = supplierMap[line.recipient_supplier_id];
        const step = stepMap[line.bom_line_id];
        let granLabel = "Product";
        if (line.product_color_and_more_id) {
          const c = colorMap[line.product_color_id]; const pc = pcamMap[line.product_color_and_more_id];
          granLabel = c && pc ? `PCAM: ${c.color_name} › ${pc.name || pc.sequence}` : "PCAM";
        } else if (line.product_color_id) {
          const c = colorMap[line.product_color_id];
          granLabel = c ? `Color: ${c.color_name}` : "Color";
        }
        return {
          "Line ID": line.id, "Product Code": prod?.code || "", "Product Name": prod?.name || "",
          "Granularity": granLabel, "Routing Step": step ? `Step ${step.position}: ${step.bom_line_role}` : "—",
          "Recipient Supplier": sup?.name || "", "Forecasted Qty": line.forecasted_qty ?? "",
          "UOM": line.forecasted_qty_uom || "", "Buyer Notes": line.buyer_notes || "",
          "Valid From": "", "Valid Until": "", "Min Qty": "", "Max Qty": "",
          "Lead Time (days)": "", "Supplier Currency Code": "", "Total Cost (supplier ccy)": "", "Supplier Notes": "",
        };
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [
        {wch:36},{wch:12},{wch:20},{wch:24},{wch:20},{wch:18},{wch:14},{wch:8},{wch:20},
        {wch:12},{wch:12},{wch:10},{wch:10},{wch:14},{wch:18},{wch:16},{wch:20},
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Lines");
      XLSX.writeFile(wb, `${sr.code}_ToDo_${new Date().toISOString().split("T")[0].replace(/-/g,"")}.xlsx`);
      onClose();
    } finally { setExporting(false); }
  };

  const openCount = lines.filter(l => ["pending","answered"].includes(l.status)).length;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Export RFQ Lines</DialogTitle></DialogHeader>
        <div className="py-4 text-sm text-muted-foreground space-y-2">
          <p>Exporting <strong>{openCount}</strong> open lines from <strong>{sr.code}</strong>.</p>
          <p>Columns A–I are read-only. Fill J–Q with cost data and re-upload via Import.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exporting}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting || openCount === 0} className="gap-2">
            {exporting && <Loader2 className="w-4 h-4 animate-spin" />}{exporting ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
