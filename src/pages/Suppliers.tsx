import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/lib/badges";
import { Check, X, ChevronDown, ChevronRight } from "lucide-react";

type Supplier = {
  id: string;
  code: string;
  name: string;
  country?: string;
  region?: string;
  status?: string;
  capabilities?: string[];
  certifications?: string[];
  portal_access_enabled?: boolean;
  primary_contact_name?: string;
  primary_contact_email?: string;
};

type Invite = {
  id: string;
  supplier_id: string;
  invited_email: string;
  invited_name?: string;
  status: string;
  invited_at: string;
  expires_at?: string;
  accepted_at?: string;
};

export default function Suppliers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground">Manage suppliers and portal access</p>
      </div>
      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Supplier Directory</TabsTrigger>
          <TabsTrigger value="invites">Portal Invites</TabsTrigger>
        </TabsList>
        <TabsContent value="directory"><Directory /></TabsContent>
        <TabsContent value="invites"><Invites /></TabsContent>
      </Tabs>
    </div>
  );
}

function Directory() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("suppliers").select("*").order("name").limit(500);
      setItems((data as Supplier[]) ?? []);
    })();
  }, []);

  const filtered = items.filter((s) =>
    !search || `${s.name} ${s.code} ${s.country ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4 mt-4">
      <Input placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Portal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <>
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  <TableCell>{expanded === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.country ?? "—"}</TableCell>
                  <TableCell>{s.region ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(s.capabilities ?? []).slice(0, 3).map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                      {(s.capabilities ?? []).length > 3 && <span className="text-xs text-muted-foreground">+{s.capabilities!.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge value={s.status} /></TableCell>
                  <TableCell>{s.portal_access_enabled ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</TableCell>
                </TableRow>
                {expanded === s.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2 text-sm">
                        <div><div className="text-xs text-muted-foreground">Primary Contact</div><div>{s.primary_contact_name ?? "—"}</div></div>
                        <div><div className="text-xs text-muted-foreground">Email</div><div>{s.primary_contact_email ?? "—"}</div></div>
                        <div><div className="text-xs text-muted-foreground">Country</div><div>{s.country ?? "—"}</div></div>
                        <div className="col-span-full">
                          <div className="text-xs text-muted-foreground mb-1">Capabilities</div>
                          <div className="flex flex-wrap gap-1">{(s.capabilities ?? []).map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
                        </div>
                        <div className="col-span-full">
                          <div className="text-xs text-muted-foreground mb-1">Certifications</div>
                          <div className="flex flex-wrap gap-1">{(s.certifications ?? []).map((c) => <Badge key={c} variant="outline">{c}</Badge>)}</div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Invites() {
  const [items, setItems] = useState<(Invite & { supplier?: { name: string } })[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("supplier_portal_invites")
        .select("*, supplier:supplier_id(name)")
        .order("invited_at", { ascending: false })
        .limit(500);
      setItems((data as any) ?? []);
    })();
  }, []);

  return (
    <Card className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invited</TableHead>
            <TableHead>Expires</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.invited_email}</TableCell>
              <TableCell>{i.invited_name ?? "—"}</TableCell>
              <TableCell>{i.supplier?.name ?? "—"}</TableCell>
              <TableCell><StatusBadge value={i.status} /></TableCell>
              <TableCell className="text-muted-foreground text-sm">{i.invited_at ? new Date(i.invited_at).toLocaleDateString() : "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{i.expires_at ? new Date(i.expires_at).toLocaleDateString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
