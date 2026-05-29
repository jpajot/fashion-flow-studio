import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/lib/badges";

type ECO = {
  id: string;
  eco_number: string;
  title: string;
  reason_category?: string;
  priority?: string;
  status?: string;
  origin?: string;
  flow_type?: string;
  requested_by?: string;
  requested_at?: string;
};

type ECR = {
  id: string;
  ecr_number: string;
  title: string;
  reason_category?: string;
  priority?: string;
  status?: string;
  requested_by?: string;
  requested_at?: string;
};

export default function Ecos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Change Management</h1>
        <p className="text-muted-foreground">Engineering change orders and requests</p>
      </div>
      <Tabs defaultValue="ecos">
        <TabsList>
          <TabsTrigger value="ecos">ECOs</TabsTrigger>
          <TabsTrigger value="ecrs">ECRs</TabsTrigger>
        </TabsList>
        <TabsContent value="ecos"><EcosTab /></TabsContent>
        <TabsContent value="ecrs"><EcrsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function EcosTab() {
  const [items, setItems] = useState<ECO[]>([]);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  useEffect(() => {
    (async () => {
      let q = supabase.from("ecos").select("*").order("requested_at", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("status", status);
      if (priority !== "all") q = q.eq("priority", priority);
      const { data } = await q;
      setItems((data as ECO[]) ?? []);
    })();
  }, [status, priority]);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {["all", "proposed", "under_review", "approved", "rejected", "applied", "cancelled", "closed"].map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            {["all", "critical", "high", "normal", "low"].map((p) => (
              <SelectItem key={p} value={p}>{p === "all" ? "All priorities" : p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ECO #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.eco_number}</TableCell>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell className="capitalize text-sm">{e.reason_category?.replace(/_/g, " ") ?? "—"}</TableCell>
                <TableCell><StatusBadge value={e.priority} /></TableCell>
                <TableCell><StatusBadge value={e.status} /></TableCell>
                <TableCell className="text-sm capitalize">{e.origin ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_by?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_at ? new Date(e.requested_at).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function EcrsTab() {
  const [items, setItems] = useState<ECR[]>([]);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  useEffect(() => {
    (async () => {
      let q = supabase.from("ecrs").select("*").order("requested_at", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("status", status);
      if (priority !== "all") q = q.eq("priority", priority);
      const { data } = await q;
      setItems((data as ECR[]) ?? []);
    })();
  }, [status, priority]);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {["all", "open", "under_investigation", "converted", "closed_no_action", "rejected"].map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            {["all", "critical", "high", "normal", "low"].map((p) => (
              <SelectItem key={p} value={p}>{p === "all" ? "All priorities" : p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ECR #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.ecr_number}</TableCell>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell className="capitalize text-sm">{e.reason_category?.replace(/_/g, " ") ?? "—"}</TableCell>
                <TableCell><StatusBadge value={e.priority} /></TableCell>
                <TableCell><StatusBadge value={e.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_by?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.requested_at ? new Date(e.requested_at).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
