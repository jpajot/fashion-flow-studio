import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/lib/badges";
import { ArrowLeft, Shirt, Check } from "lucide-react";

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function ColorwaysTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("product_colors").select("*").eq("product_id", id).then(({ data }) => setRows(data ?? []));
  }, [id]);
  if (rows.length === 0) return <div className="text-muted-foreground py-8 text-center">No colorways</div>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {rows.map((c) => (
        <Card key={c.id}>
          <div className="aspect-square bg-muted overflow-hidden">
            {c.image_url ? (
              <img src={c.image_url} alt={c.color_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ backgroundColor: c.color_hex ?? "#e5e7eb" }} />
            )}
          </div>
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: c.color_hex ?? "#e5e7eb" }} />
              <div className="font-medium text-sm truncate">{c.color_name}</div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">{c.colorway_code}</div>
            <StatusBadge value={c.colorway_status} className="text-xs" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SizesTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("style_sizes").select("*, sizes(size_code,name)").eq("product_id", id).then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Size Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No sizes</TableCell></TableRow>
          ) : rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono">{s.sizes?.size_code}</TableCell>
              <TableCell>{s.sizes?.name}</TableCell>
              <TableCell>{s.active !== false && <Check className="h-4 w-4 text-emerald-600" />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function BomsTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("boms").select("*").eq("product_id", id).order("version", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Revision</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Released</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No BOMs</TableCell></TableRow>
          ) : rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell><Badge variant="outline">{b.bom_type}</Badge></TableCell>
              <TableCell className="font-mono text-xs">{b.revision_code}</TableCell>
              <TableCell>v{b.version}</TableCell>
              <TableCell><StatusBadge value={b.status} /></TableCell>
              <TableCell>{fmtDate(b.released_at)}</TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{b.notes ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function RoutingTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("supplier_routings").select("*").eq("product_id", id).order("version", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, [id]);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Revision</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Default</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No routings</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell><Badge variant="outline">{r.routing_type}</Badge></TableCell>
              <TableCell className="font-mono text-xs">{r.revision_code}</TableCell>
              <TableCell>v{r.version}</TableCell>
              <TableCell><StatusBadge value={r.status} /></TableCell>
              <TableCell>{r.is_default && <Check className="h-4 w-4 text-emerald-600" />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      setProduct(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!product) return <div>Product not found</div>;

  const firstImage = Array.isArray(product.images) ? product.images[0] : product.image_url;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/styles")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Style Library
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">
        <Card>
          <div className="aspect-square bg-muted grid place-items-center overflow-hidden">
            {firstImage ? (
              <img src={firstImage} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Shirt className="h-20 w-20 text-muted-foreground/40" />
            )}
          </div>
          <CardContent className="p-5 space-y-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
              <p className="text-sm font-mono text-muted-foreground">{product.style_code ?? product.code}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.type && <Badge variant="outline">{product.type}</Badge>}
              {product.sub_type && <Badge variant="secondary">{product.sub_type}</Badge>}
              {product.status && <StatusBadge value={product.status} />}
            </div>
            <div className="space-y-2 text-sm pt-2 border-t">
              {product.category && <div><span className="text-muted-foreground">Category: </span>{product.category}</div>}
              {product.sub_category && <div><span className="text-muted-foreground">Sub-category: </span>{product.sub_category}</div>}
              {product.customer_need && <div><span className="text-muted-foreground">Customer need: </span>{product.customer_need}</div>}
              {product.bom_workflow_pattern && (
                <div className="pt-2"><Badge variant="outline">BOM: {product.bom_workflow_pattern}</Badge></div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="colorways">
          <TabsList>
            <TabsTrigger value="colorways">Colorways</TabsTrigger>
            <TabsTrigger value="sizes">Sizes</TabsTrigger>
            <TabsTrigger value="boms">BOMs</TabsTrigger>
            <TabsTrigger value="routing">Routing</TabsTrigger>
          </TabsList>
          <TabsContent value="colorways" className="mt-6"><ColorwaysTab id={id!} /></TabsContent>
          <TabsContent value="sizes" className="mt-6"><SizesTab id={id!} /></TabsContent>
          <TabsContent value="boms" className="mt-6"><BomsTab id={id!} /></TabsContent>
          <TabsContent value="routing" className="mt-6"><RoutingTab id={id!} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
