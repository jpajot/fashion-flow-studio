import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/lib/badges";

export default function ProductBomsTab({ productId }: { productId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("boms").select("*").eq("product_id", productId).then(({ data }) => setRows(data ?? []));
  }, [productId]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No BOMs</TableCell></TableRow>
          ) : (
            rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.code || "—"}</TableCell>
                <TableCell>{b.name || "—"}</TableCell>
                <TableCell><StatusBadge value={b.status} /></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
