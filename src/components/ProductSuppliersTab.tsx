import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ProductSuppliersTab({ productId }: { productId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: cws } = await supabase.from("product_colors").select("id").eq("product_id", productId);
      const ids = (cws ?? []).map((c) => c.id);
      if (!ids.length) { setRows([]); return; }
      const { data } = await supabase
        .from("approved_suppliers")
        .select("*, suppliers(name, code)")
        .in("product_color_id", ids);
      setRows(data ?? []);
    })();
  }, [productId]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No approved suppliers</TableCell></TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.suppliers?.name || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.suppliers?.code || "—"}</TableCell>
                <TableCell>{r.status || "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
