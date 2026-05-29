import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Project = Record<string, any> & { id: string };

const statusVariant = (s?: string) => {
  switch ((s ?? "").toLowerCase()) {
    case "active":
    case "in_progress":
      return "default";
    case "completed":
    case "done":
      return "secondary";
    case "on_hold":
    case "paused":
      return "outline";
    default:
      return "secondary";
  }
};

export default function Projects() {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(100);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data } = await q;
      setItems((data as Project[]) ?? []);
      setLoading(false);
    })();
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">{items.length} projects</p>
      </div>
      <Input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Season</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Target Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No projects</TableCell></TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                  <TableCell>{p.season ?? "—"}</TableCell>
                  <TableCell>{p.status && <Badge variant={statusVariant(p.status) as any}>{p.status}</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.target_date ? new Date(p.target_date).toLocaleDateString() : p.due_date ? new Date(p.due_date).toLocaleDateString() : "—"}
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
