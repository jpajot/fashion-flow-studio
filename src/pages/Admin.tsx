import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/lib/badges";
import { Check, X, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function LovTab() {
  const [types, setTypes] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [values, setValues] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("type_of_lov").select("*").order("name").then(({ data }) => {
      setTypes(data ?? []);
      if (data?.[0]) setSelected(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    supabase.from("list_of_values").select("*").eq("type_of_lov_id", selected).order("name").then(({ data }) => setValues(data ?? []));
  }, [selected]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
      <Card className="p-2 max-h-[600px] overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">LOV TYPES</div>
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm transition",
              selected === t.id ? "bg-secondary font-medium" : "hover:bg-muted"
            )}
          >
            <div>{t.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{t.code}</div>
          </button>
        ))}
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Depends On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {values.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No values</TableCell></TableRow>
            ) : values.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell className="text-muted-foreground">{v.category ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{v.depends_on_value_id ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function SizeGridsTab() {
  const [grids, setGrids] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sizes, setSizes] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("size_grids")
      .select("*, sample:sizes!size_grids_sample_size_id_fkey(size_code,name), base:sizes!size_grids_base_size_id_fkey(size_code,name)")
      .order("code")
      .then(({ data }) => setGrids(data ?? []));
  }, []);

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const { data } = await supabase
      .from("size_grid_sizes")
      .select("*, sizes(size_code,name)")
      .eq("size_grid_id", id)
      .order("position", { ascending: true });
    setSizes(data ?? []);
  };

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Sample Size</TableHead>
            <TableHead>Base Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grids.map((g) => (
            <Fragment key={g.id}>
              <TableRow className="cursor-pointer" onClick={() => toggle(g.id)}>
                <TableCell>{expanded === g.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                <TableCell className="font-mono text-xs">{g.code}</TableCell>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>{g.active ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</TableCell>
                <TableCell>{g.sample?.size_code ?? "—"}</TableCell>
                <TableCell>{g.base?.size_code ?? "—"}</TableCell>
              </TableRow>
              {expanded === g.id && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/30 p-4">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">SIZES IN GRID</div>
                    {sizes.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No sizes</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {sizes.map((s) => (
                          <Badge key={s.id} variant="outline">
                            {s.sizes?.size_code} {s.sizes?.name ? `· ${s.sizes.name}` : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CurrenciesTab() {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("currencies").select("*").order("code").then(({ data }) => setCurrencies(data ?? []));
    supabase
      .from("currency_conversion_rates")
      .select("*, from:currencies!currency_conversion_rates_from_currency_id_fkey(code), to:currencies!currency_conversion_rates_to_currency_id_fkey(code)")
      .order("effective_date", { ascending: false })
      .then(({ data }) => setRates(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Decimals</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currencies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-semibold text-lg">{c.symbol}</TableCell>
                <TableCell className="font-mono">{c.code}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.decimal_places}</TableCell>
                <TableCell><StatusBadge value={c.is_active ? "active" : "inactive"} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-3">Conversion Rates</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.from?.code}</TableCell>
                  <TableCell className="font-mono">{r.to?.code}</TableCell>
                  <TableCell className="font-mono">{r.rate}</TableCell>
                  <TableCell>{fmtDate(r.effective_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.source ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function AppConfigTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("app_config").select("*").order("key").then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Updated By</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.key}</TableCell>
              <TableCell className="font-mono text-sm">{String(r.value ?? "—")}</TableCell>
              <TableCell><Badge variant="outline">{r.value_type}</Badge></TableCell>
              <TableCell className="text-muted-foreground text-sm">{r.description ?? "—"}</TableCell>
              <TableCell className="text-xs font-mono">{r.updated_by ?? "—"}</TableCell>
              <TableCell>{fmtDate(r.updated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function Admin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Configuration and reference data</p>
      </div>
      <Tabs defaultValue="lov">
        <TabsList>
          <TabsTrigger value="lov">List of Values</TabsTrigger>
          <TabsTrigger value="grids">Size Grids</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="config">App Config</TabsTrigger>
        </TabsList>
        <TabsContent value="lov" className="mt-6"><LovTab /></TabsContent>
        <TabsContent value="grids" className="mt-6"><SizeGridsTab /></TabsContent>
        <TabsContent value="currencies" className="mt-6"><CurrenciesTab /></TabsContent>
        <TabsContent value="config" className="mt-6"><AppConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}
