import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/lib/badges";
import { ChevronRight, ChevronDown } from "lucide-react";

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function SupplierRequestsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("supplier_requests")
        .select("*, projects(name), rfq_rounds(label)")
        .order("due_date", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [status]);

  return (
    <div className="space-y-4">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="submitted">Submitted</SelectItem>
          <SelectItem value="in_collection">In Collection</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Round</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No requests</TableCell></TableRow>
            ) : rows.map((r) => (
              <Fragment key={r.id}>
                <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <TableCell>{expanded === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.projects?.name ?? "—"}</TableCell>
                  <TableCell>{r.rfq_rounds?.label ?? "—"}</TableCell>
                  <TableCell>{fmtDate(r.due_date)}</TableCell>
                  <TableCell><StatusBadge value={r.status} /></TableCell>
                </TableRow>
                {expanded === r.id && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/30">
                      <div className="py-2 space-y-2">
                        <div><span className="text-xs font-semibold text-muted-foreground">DESCRIPTION</span><p>{r.description || "—"}</p></div>
                        <div><span className="text-xs font-semibold text-muted-foreground">SUBMITTED</span><p>{fmtDate(r.submitted_at)}</p></div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RfqLinesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("rfq_lines")
        .select("*, products(name), recipient_supplier:suppliers!rfq_lines_recipient_supplier_id_fkey(name)")
        .order("awarded_at", { ascending: false, nullsFirst: false });
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [status]);

  return (
    <div className="space-y-4">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="answered">Answered</SelectItem>
          <SelectItem value="awarded">Awarded</SelectItem>
          <SelectItem value="declined">Declined</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Awarded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No lines</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.products?.name ?? "—"}</TableCell>
                <TableCell>{r.recipient_supplier?.name ?? "—"}</TableCell>
                <TableCell>{r.forecasted_qty ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.forecasted_qty_uom ?? "—"}</TableCell>
                <TableCell><StatusBadge value={r.status} /></TableCell>
                <TableCell>{fmtDate(r.awarded_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function AwardedCostsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("product_costs")
        .select("*, products(name), suppliers(name), projects(name), supplier_currency:currencies!product_costs_supplier_currency_id_fkey(code), target_currency:currencies!product_costs_target_currency_id_fkey(code)")
        .order("awarded_at", { ascending: false, nullsFirst: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Cost (Supplier)</TableHead>
            <TableHead>Cost (Target)</TableHead>
            <TableHead>Awarded</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No costs</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.products?.name ?? "—"}</TableCell>
              <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
              <TableCell>{r.projects?.name ?? "—"}</TableCell>
              <TableCell className="font-mono text-sm">{r.total_cost_supplier_ccy ?? "—"} {r.supplier_currency?.code ?? ""}</TableCell>
              <TableCell className="font-mono text-sm">{r.total_cost_target_ccy ?? "—"} {r.target_currency?.code ?? ""}</TableCell>
              <TableCell>{fmtDate(r.awarded_at)}</TableCell>
              <TableCell><StatusBadge value={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function Rfqs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">RFQ & Costing</h1>
        <p className="text-muted-foreground">Supplier requests, quotes and awarded costs</p>
      </div>
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Supplier Requests</TabsTrigger>
          <TabsTrigger value="lines">RFQ Lines</TabsTrigger>
          <TabsTrigger value="awarded">Awarded Costs</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-6"><SupplierRequestsTab /></TabsContent>
        <TabsContent value="lines" className="mt-6"><RfqLinesTab /></TabsContent>
        <TabsContent value="awarded" className="mt-6"><AwardedCostsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
