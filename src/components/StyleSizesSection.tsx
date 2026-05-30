import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function StyleSizesSection({ productId, sizeGridName }: { productId: string; sizeGridName?: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("style_sizes")
      .select("*, sizes(*)")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    setRows((data ?? []) as any[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const toggle = async (row: any, active: boolean) => {
    const { error } = await supabase.from("style_sizes").update({ is_active: active }).eq("id", row.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active: active } : r)));
  };

  return (
    <div className="space-y-3">
      {sizeGridName && (
        <div className="text-sm text-muted-foreground">Size grid: <span className="font-medium text-foreground">{sizeGridName}</span></div>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-24 text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No sizes</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.sizes?.code || "—"}</TableCell>
                  <TableCell>{r.sizes?.name || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Checkbox checked={r.is_active !== false} onCheckedChange={(v) => toggle(r, !!v)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
