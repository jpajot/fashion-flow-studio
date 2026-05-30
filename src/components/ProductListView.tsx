import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List as ListIcon, Plus, Shirt, RefreshCw } from "lucide-react";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { PAGE_WRAPPER } from "@/lib/utils";

export default function ProductListView({ type, title, newButtonLabel }: { type: "Product" | "Material"; title: string; newButtonLabel: string }) {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const storageKey = type === "Product" ? "products_view" : "materials_view";
  const [view, setView] = useState<"gallery" | "table">(() => {
    try { return (localStorage.getItem(storageKey) as any) || "gallery"; } catch { return "gallery"; }
  });
  const [products, setProducts] = useState<any[]>([]);
  const [colorways, setColorways] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("__all__");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([
        supabase.from("products").select("*").eq("type", type).order("code"),
        supabase.from("product_colors").select("*").order("created_at", { ascending: false }),
      ]);
      setProducts((p.data ?? []) as any[]);
      setColorways((c.data ?? []) as any[]);
    })();
  }, [type, refresh]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, view); } catch {}
  }, [view, storageKey]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "__all__" || p.category === category) &&
        (!q || (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const cwByProduct = useMemo(() => {
    const m: Record<string, any[]> = {};
    colorways.forEach((c) => {
      (m[c.product_id] = m[c.product_id] || []).push(c);
    });
    return m;
  }, [colorways]);

  useEffect(() => {
    setOptions({
      items: [
        { label: `View: ${view === "gallery" ? "Gallery" : "Table"}`, icon: view === "gallery" ? LayoutGrid : ListIcon, onClick: () => setView(view === "gallery" ? "table" : "gallery") },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: () => setRefresh((r) => r + 1) },
      ],
    });
    return () => setOptions(null);
  }, [view, setOptions]);

  const initials = (name: string) => (name || "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className={`${PAGE_WRAPPER} space-y-4`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} {type === "Product" ? "products" : "materials"}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border p-0.5">
            <Button variant={view === "gallery" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("gallery")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("table")}><ListIcon className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" onClick={() => navigate(`/products/new?type=${type}`)}>
            <Plus className="h-4 w-4 mr-2" /> {newButtonLabel}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Nothing here yet</CardContent></Card>
      ) : view === "gallery" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((p) => {
            const cws = (cwByProduct[p.id] || []).slice(0, 4);
            const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
            return (
              <Card key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="overflow-hidden cursor-pointer hover:shadow-md transition">
                <div className="aspect-square bg-muted grid place-items-center">
                  {img ? (
                    <img src={img} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-semibold text-muted-foreground/50">{initials(p.name)}</span>
                  )}
                </div>
                <CardContent className="p-3 space-y-1">
                  <div className="font-semibold text-sm truncate">{p.name || "—"}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{p.code || "—"}</div>
                  {p.category && <div className="text-xs text-muted-foreground truncate">{p.category}</div>}
                  {cws.length > 0 && (
                    <div className="pt-1 space-y-0.5">
                      {cws.map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5 text-xs">
                          {c.image_url ? (
                            <img src={c.image_url} className="h-3.5 w-3.5 rounded-sm object-cover border" alt="" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                          )}
                          <span className="truncate">{c.color_name}</span>
                          <span className="text-muted-foreground font-mono ml-auto shrink-0">{c.colorway_code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub-Category</TableHead>
                <TableHead>Customer Need</TableHead>
                <TableHead>Colorways</TableHead>
                <TableHead className="text-right">#</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const cws = cwByProduct[p.id] || [];
                const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                    <TableCell>
                      {img ? (
                        <img src={img} className="h-10 w-10 object-cover rounded" alt="" />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded grid place-items-center text-xs">{initials(p.name)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                    </TableCell>
                    <TableCell>{p.category || "—"}</TableCell>
                    <TableCell>{p.sub_category || "—"}</TableCell>
                    <TableCell>{p.customer_need || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {cws.slice(0, 4).map((c) => (
                          <div key={c.id} className="h-5 w-5 rounded border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} title={c.color_name} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">{cws.length}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
