import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/lib/badges";

type Sample = {
  id: string;
  code: string;
  project_id?: string;
  product_id?: string;
  product_color_id?: string;
  sample_type?: string;
  phase?: string;
  conformity_status?: string;
  requested_quantity?: number;
  created_at?: string;
  project?: { name: string };
  product?: { name: string };
};

type Step = {
  id: string;
  sequence: number;
  step_type: string;
  supplier_id?: string;
  workflow_status?: string;
  due_date?: string;
  conformity_status?: string;
};

export default function Samples() {
  const [items, setItems] = useState<Sample[]>([]);
  const [sampleType, setSampleType] = useState("all");
  const [phase, setPhase] = useState("all");
  const [conformity, setConformity] = useState("all");
  const [selected, setSelected] = useState<Sample | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("samples")
        .select("*, project:project_id(name), product:product_id(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (sampleType !== "all") q = q.eq("sample_type", sampleType);
      if (phase !== "all") q = q.eq("phase", phase);
      if (conformity !== "all") q = q.eq("conformity_status", conformity);
      const { data } = await q;
      setItems((data as any) ?? []);
    })();
  }, [sampleType, phase, conformity]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const { data } = await supabase
        .from("sample_steps")
        .select("*")
        .eq("sample_id", selected.id)
        .order("sequence");
      setSteps((data as Step[]) ?? []);
    })();
  }, [selected]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sampling</h1>
        <p className="text-muted-foreground">Track sample requests and conformity</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={sampleType} onValueChange={setSampleType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            {["all", "proto", "sms", "gold_seal", "pps"].map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All types" : s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={phase} onValueChange={setPhase}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>
            {["all", "development", "production"].map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All phases" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={conformity} onValueChange={setConformity}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Conformity" /></SelectTrigger>
          <SelectContent>
            {["all", "not_assessed", "pass", "fail_minor", "fail_major", "pending_review"].map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All conformity" : s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Conformity</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                <TableCell className="font-mono text-xs">{s.code}</TableCell>
                <TableCell className="font-medium">{s.product?.name ?? "—"}</TableCell>
                <TableCell>{s.project?.name ?? "—"}</TableCell>
                <TableCell><StatusBadge value={s.sample_type} /></TableCell>
                <TableCell><StatusBadge value={s.phase} /></TableCell>
                <TableCell><StatusBadge value={s.conformity_status} /></TableCell>
                <TableCell>{s.requested_quantity ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.code}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Product</div><div>{selected.product?.name ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Project</div><div>{selected.project?.name ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Type</div><StatusBadge value={selected.sample_type} /></div>
                <div><div className="text-xs text-muted-foreground">Phase</div><StatusBadge value={selected.phase} /></div>
                <div><div className="text-xs text-muted-foreground">Conformity</div><StatusBadge value={selected.conformity_status} /></div>
                <div><div className="text-xs text-muted-foreground">Quantity</div><div>{selected.requested_quantity ?? "—"}</div></div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Sample Steps</h3>
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No steps recorded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Step</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Conformity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {steps.map((st) => (
                        <TableRow key={st.id}>
                          <TableCell>{st.sequence}</TableCell>
                          <TableCell className="capitalize">{st.step_type?.replace(/_/g, " ")}</TableCell>
                          <TableCell><StatusBadge value={st.workflow_status} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{st.due_date ? new Date(st.due_date).toLocaleDateString() : "—"}</TableCell>
                          <TableCell><StatusBadge value={st.conformity_status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
