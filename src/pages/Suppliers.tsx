import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { Building2, Globe, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  blacklisted: "bg-red-100 text-red-700 border-red-200",
};

export function SupplierStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const cls = STATUS_COLORS[status] ?? "bg-secondary text-secondary-foreground border-border";
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function Suppliers() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [approved, setApproved] = useState<any[]>([]);
  const [lovTypes, setLovTypes] = useState<any[]>([]);
  const [lovValues, setLovValues] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [capability, setCapability] = useState("all");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    (async () => {
      const [s, a, lt, lv] = await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("approved_suppliers").select("product_id, supplier_id"),
        supabase.from("type_of_lov").select("id,code"),
        supabase.from("list_of_values").select("*"),
      ]);
      setSuppliers(s.data ?? []);
      setApproved(a.data ?? []);
      setLovTypes(lt.data ?? []);
      setLovValues(lv.data ?? []);
    })();
  }, []);

  const getLov = (code: string) => {
    const t = lovTypes.find((x) => x.code === code);
    if (!t) return [];
    return lovValues.filter((v) => v.type_of_lov_id === t.id).map((v) => v.name);
  };

  useEffect(() => {
    setOptions({
      items: [
        { label: "New Supplier", icon: Plus, onClick: () => navigate("/suppliers/new"), className: "text-primary hover:bg-primary/10" },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capabilityOpts = getLov("supplier_capability");
  const regionOpts = getLov("supplier_region");
  const statusOpts = getLov("supplier_status");
  const fallbackStatuses = statusOpts.length ? statusOpts : ["active", "on_hold", "inactive", "blacklisted"];

  const productCount = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of approved) {
      if (!map.has(a.supplier_id)) map.set(a.supplier_id, new Set());
      map.get(a.supplier_id)!.add(a.product_id);
    }
    return (sid: string) => map.get(sid)?.size ?? 0;
  }, [approved]);

  const filtered = suppliers.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${s.name || ""} ${s.code || ""} ${s.country || ""}`.toLowerCase().includes(q)) return false;
    }
    if (capability !== "all" && !(s.capabilities || []).includes(capability)) return false;
    if (region !== "all" && s.region !== region) return false;
    if (status !== "all" && s.status !== status) return false;
    return true;
  });

  return (
    <div className="px-3 py-3 sm:px-4 md:px-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage suppliers and sourcing relationships</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search name, code, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={capability} onValueChange={setCapability}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All capabilities</SelectItem>
            {capabilityOpts.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regionOpts.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {fallbackStatuses.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
            <p className="text-sm text-muted-foreground">No suppliers found.</p>
          </div>
        ) : filtered.map((s) => (
          <div
            key={s.id}
            onClick={() => navigate(`/suppliers/${s.id}`)}
            className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{s.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                {s.status && <SupplierStatusBadge status={s.status} />}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {s.country && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {s.country}{s.region ? ` · ${s.region}` : ""}
                  </span>
                )}
                {(s.capabilities || []).slice(0, 4).map((cap: string) => (
                  <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                    {cap.replace(/_/g, " ")}
                  </span>
                ))}
                {(s.capabilities || []).length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{(s.capabilities || []).length - 4}</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold">{productCount(s.id)}</p>
              <p className="text-xs text-muted-foreground">products</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
