import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  product: any;
  onSizesChange?: (hasSizes: boolean) => void;
}

export default function StyleSizesSection({ product, onSizesChange }: Props) {
  const { toast } = useToast();
  const [styleSizes, setStyleSizes] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const prevGridId = useRef<string | null>(null);
  const onSizesChangeRef = useRef(onSizesChange);
  useEffect(() => { onSizesChangeRef.current = onSizesChange; });

  const load = useCallback(async () => {
    if (!product?.id) return;
    setLoading(true);
    const [ss, sz] = await Promise.all([
      supabase.from("style_sizes").select("*").eq("product_id", product.id).order("created_at"),
      supabase.from("sizes").select("*").order("size_code"),
    ]);
    setSizes(sz.data ?? []);

    if (product.size_grid_id && (ss.data ?? []).length === 0) {
      const { data: gridSizes } = await supabase
        .from("size_grid_sizes")
        .select("*")
        .eq("size_grid_id", product.size_grid_id);
      if (gridSizes?.length) {
        const inserts = gridSizes.map((gs: any) => ({
          product_id: product.id,
          size_id: gs.size_id,
          active: gs.active !== false,
        }));
        const { data: created } = await supabase.from("style_sizes").insert(inserts).select();
        setStyleSizes(created ?? []);
        onSizesChangeRef.current?.((created ?? []).length > 0);
        setLoading(false);
        return;
      }
    }
    setStyleSizes(ss.data ?? []);
    onSizesChangeRef.current?.((ss.data ?? []).length > 0);
    setLoading(false);
  }, [product?.id, product?.size_grid_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Detect size_grid_id changes and sync
  useEffect(() => {
    if (!product?.id) return;
    if (prevGridId.current === product.size_grid_id) return;
    const first = prevGridId.current === null;
    prevGridId.current = product.size_grid_id ?? null;
    if (first) return; // initial render is handled by load()
    if (!product.size_grid_id) return;
    (async () => {
      const { data: gridSizes } = await supabase
        .from("size_grid_sizes")
        .select("*")
        .eq("size_grid_id", product.size_grid_id);
      const { data: current } = await supabase
        .from("style_sizes")
        .select("*")
        .eq("product_id", product.id);

      const gridSizeIds = new Set((gridSizes ?? []).map((gs: any) => gs.size_id));
      const currentSizeIds = new Set((current ?? []).map((ss: any) => ss.size_id));

      const toAdd = (gridSizes ?? []).filter((gs: any) => !currentSizeIds.has(gs.size_id));
      if (toAdd.length) {
        await supabase.from("style_sizes").insert(
          toAdd.map((gs: any) => ({
            product_id: product.id,
            size_id: gs.size_id,
            active: gs.active !== false,
          })),
        );
      }
      const toRemove = (current ?? []).filter((ss: any) => !gridSizeIds.has(ss.size_id));
      for (const ss of toRemove) {
        await supabase.from("style_sizes").delete().eq("id", ss.id);
      }
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.size_grid_id]);

  const handleToggle = async (ss: any) => {
    const updated = { is_active: !ss.is_active };
    const { error } = await supabase.from("style_sizes").update(updated).eq("id", ss.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setStyleSizes((prev) => prev.map((x) => (x.id === ss.id ? { ...x, ...updated } : x)));
  };

  const handleDelete = async (ss: any) => {
    const { data: cws } = await supabase
      .from("product_colors")
      .select("id")
      .eq("product_id", product.id);
    const cwIds = (cws ?? []).map((c: any) => c.id);
    if (cwIds.length) {
      const { data: vars } = await supabase
        .from("product_color_and_more")
        .select("size_ids")
        .in("product_color_id", cwIds);
      const isReferenced = (vars ?? []).some((v: any) => (v.size_ids ?? []).includes(ss.size_id));
      if (isReferenced) {
        toast({
          title: "Cannot delete",
          description:
            "This size is used in one or more variations. Remove it from all variations first.",
          variant: "destructive",
        });
        return;
      }
    }
    const { error } = await supabase.from("style_sizes").delete().eq("id", ss.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    const updated = styleSizes.filter((x) => x.id !== ss.id);
    setStyleSizes(updated);
    onSizesChangeRef.current?.(updated.length > 0);
  };

  if (!product?.size_grid_id) {
    return (
      <div className="border-2 border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
        No size grid selected. Set a Size Grid in Style Details to link sizes.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (styleSizes.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
        No active sizes in the selected grid.
      </div>
    );
  }

  const sizeById = (id: string) => sizes.find((s) => s.id === id);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Sizes ({styleSizes.length})</h3>
        <p className="text-xs text-muted-foreground">
          Synced from size grid — toggle to deactivate for this style
        </p>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Active</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-20 text-right">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {styleSizes.map((ss) => {
              const s = sizeById(ss.size_id);
              return (
                <TableRow key={ss.id}>
                  <TableCell>
                    <Checkbox checked={ss.is_active !== false} onCheckedChange={() => handleToggle(ss)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s?.size_code ?? "—"}</TableCell>
                  <TableCell>{s?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(ss)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
