import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, List, Shirt } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = Record<string, any> & { id: string };

const PAGE = 24;

export default function StyleLibrary() {
  const navigate = useNavigate();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("products")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (search) q = q.ilike("name", `%${search}%`);
      if (status !== "all") q = q.eq("status", status);
      const { data, count, error } = await q;
      if (!error) {
        setItems((data as Product[]) ?? []);
        setTotal(count ?? 0);
      }
      setLoading(false);
    })();
  }, [page, search, status]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE)), [total]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Style Library</h1>
          <p className="text-muted-foreground">{total} products</p>
        </div>
        <div className="flex gap-1 border rounded-md p-1">
          <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search styles…"
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
          className="max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(0);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No products found</CardContent></Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((p) => (
            <Card key={p.id} onClick={() => navigate(`/styles/${p.id}`)} className="overflow-hidden hover:shadow-md transition cursor-pointer">
              <div className="aspect-square bg-muted grid place-items-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Shirt className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>
              <CardContent className="p-3">
                <div className="font-medium truncate text-sm">{p.name ?? p.style_code ?? p.id}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{p.style_code ?? p.sku ?? ""}</span>
                  {p.status && <Badge variant="secondary" className="text-xs">{p.status}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} onClick={() => navigate(`/styles/${p.id}`)} className="cursor-pointer">
                  <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.style_code ?? p.sku ?? "—"}</TableCell>
                  <TableCell>{p.category ?? "—"}</TableCell>
                  <TableCell>{p.status && <Badge variant="secondary">{p.status}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {page + 1} of {pages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
