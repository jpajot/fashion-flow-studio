import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SupplierStatusBadge } from "./Suppliers";
import { ArrowLeft, Trash2, Info, Package, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import ProductTypeBadgeRow from "@/components/shared/ProductTypeBadgeRow";

export default function SupplierDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = id === "new" || location.pathname === "/suppliers/new" || !id;

  const [supplier, setSupplier] = useState<any>(isNew ? {
    name: "", code: "", legal_name: "", country: "", region: "", city: "",
    primary_contact_name: "", primary_contact_email: "", primary_contact_phone: "",
    capabilities: [], certifications: [],
    lead_time_default_days: null, payment_terms_default: "", currency_default_id: null,
    moq_policy: "", notes: "", status: "active",
  } : null);
  const [approvedLinks, setApprovedLinks] = useState<any[]>([]);
  const [routingBomLines, setRoutingBomLines] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [routings, setRoutings] = useState<any[]>([]);
  const [lovTypes, setLovTypes] = useState<any[]>([]);
  const [lovValues, setLovValues] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("profile");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const baseLoaders: any[] = [
        supabase.from("type_of_lov").select("id,code"),
        supabase.from("list_of_values").select("*"),
        supabase.from("currencies").select("id,code,name").eq("is_active", true).order("code"),
      ];
      if (!isNew) {
        const [sup, apps, prods, lt, lv, curs] = await Promise.all([
          supabase.from("suppliers").select("*").eq("id", id!).single(),
          supabase.from("approved_suppliers").select("*").eq("supplier_id", id!),
          supabase.from("products").select("id,name,code,type,category,images").order("name"),
          ...baseLoaders,
        ]);
        setSupplier(sup.data ?? null);
        const appsData = apps.data ?? [];
        setApprovedLinks(appsData);
        setProducts(prods.data ?? []);
        setLovTypes(lt.data ?? []);
        setLovValues(lv.data ?? []);
        setCurrencies(curs.data ?? []);

        const productIds = [...new Set(appsData.map((a: any) => a.product_id))];
        let participationRoutings: any[] = [];
        let participationBomLines: any[] = [];
        if (productIds.length > 0) {
          const { data: rRoutings } = await supabase.from("boms")
            .select("id, product_id, bom_phase, status, version, revision_code, name")
            .eq("bom_type", "routing")
            .in("product_id", productIds);
          participationRoutings = rRoutings ?? [];
          const routingIds = participationRoutings.map((r: any) => r.id);
          if (routingIds.length > 0) {
            const { data: rLines } = await supabase.from("bom_lines")
              .select("id, bom_id, position, component_role, component_product_id, line_level_approved_supplier_id")
              .in("bom_id", routingIds)
              .order("position");
            participationBomLines = rLines ?? [];
          }
        }
        setRoutings(participationRoutings);
        setRoutingBomLines(participationBomLines);
      } else {
        const [lt, lv, curs] = await Promise.all(baseLoaders);
        setLovTypes(lt.data ?? []);
        setLovValues(lv.data ?? []);
        setCurrencies(curs.data ?? []);
      }
    })();
  }, [id, isNew]);

  const getLov = (code: string) => {
    const t = lovTypes.find((x) => x.code === code);
    if (!t) return [];
    return lovValues.filter((v) => v.type_of_lov_id === t.id).map((v) => v.name);
  };

  const uniqueProductIds = useMemo(
    () => [...new Set(approvedLinks.map((a) => a.product_id))],
    [approvedLinks]
  );

  const subNavItems = isNew ? [{ id: "profile", label: "Profile", icon: Info }] : [
    { id: "profile", label: "Profile", icon: Info },
    { id: "products", label: "Sourced Products", count: uniqueProductIds.length, icon: Package },
    { id: "routing", label: "Routing Participation", count: routings.length, icon: GitBranch },
  ];
  useRegisterSubNav(subNavItems, activeTab, setActiveTab, (supplier?.name as string) || "New Supplier");

  // Auto-save
  const debounceRef = useRef<Record<string, any>>({});
  const updateField = (field: string, value: any) => {
    setSupplier((prev: any) => ({ ...prev, [field]: value }));
    if (isNew || !supplier?.id) return;
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field]);
    debounceRef.current[field] = setTimeout(async () => {
      await supabase.from("suppliers").update({ [field]: value }).eq("id", supplier.id);
    }, 800);
  };
  const toggleArrayValue = (field: string, val: string) => {
    const arr: string[] = supplier?.[field] || [];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    updateField(field, next);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id!);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Supplier deleted" });
    navigate("/suppliers");
  };

  const handleCreate = async () => {
    if (!supplier?.name?.trim()) {
      toast({ title: "Trading Name is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data: codeData } = await supabase.rpc("generate_code", {
      p_entity_name: "Supplier",
      p_entity_type: "Supplier",
    });
    const payload: any = { ...supplier, code: supplier.code || codeData || null, created_by: user?.email };
    delete payload.id;
    const { data, error } = await supabase.from("suppliers").insert(payload).select("id").single();
    setCreating(false);
    if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
    toast({ title: "Supplier created" });
    await new Promise((r) => setTimeout(r, 300));
    navigate(`/suppliers/${data.id}`);
  };

  if (!supplier) {
    return <div className="px-3 py-3 sm:px-4 md:px-6"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  }

  const capabilityOpts = getLov("supplier_capability");
  const certificationOpts = getLov("supplier_certification");
  const regionOpts = getLov("supplier_region");
  const statusOpts = getLov("supplier_status");
  const paymentTermsOpts = getLov("payment_terms");
  const fallbackStatuses = statusOpts.length ? statusOpts : ["active", "on_hold", "inactive", "blacklisted"];

  return (
    <div className="px-3 py-3 sm:px-4 md:px-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/suppliers")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold">{isNew ? "New Supplier" : supplier.name}</h1>
          {supplier.code && <p className="text-xs text-muted-foreground font-mono">{supplier.code}</p>}
        </div>
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {activeTab === "profile" && (
        <Card className="p-4 space-y-6">
          <Section title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Trading Name *">
                <Input value={supplier.name || ""} onChange={(e) => updateField("name", e.target.value)} />
              </Field>
              <Field label="Legal Name">
                <Input value={supplier.legal_name || ""} onChange={(e) => updateField("legal_name", e.target.value)} />
              </Field>
              <Field label="Country">
                <Input value={supplier.country || ""} onChange={(e) => updateField("country", e.target.value)} />
              </Field>
              <Field label="Region">
                <Select value={supplier.region || ""} onValueChange={(v) => updateField("region", v)}>
                  <SelectTrigger><SelectValue placeholder="Select region…" /></SelectTrigger>
                  <SelectContent>
                    {regionOpts.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="City">
                <Input value={supplier.city || ""} onChange={(e) => updateField("city", e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={supplier.status || ""} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger><SelectValue placeholder="Select status…" /></SelectTrigger>
                  <SelectContent>
                    {fallbackStatuses.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          <Section title="Primary Contact">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Name">
                <Input value={supplier.primary_contact_name || ""} onChange={(e) => updateField("primary_contact_name", e.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" value={supplier.primary_contact_email || ""} onChange={(e) => updateField("primary_contact_email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={supplier.primary_contact_phone || ""} onChange={(e) => updateField("primary_contact_phone", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Capabilities">
            <div className="flex flex-wrap gap-1.5">
              {capabilityOpts.map((cap) => {
                const active = (supplier.capabilities || []).includes(cap);
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleArrayValue("capabilities", cap)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {cap.replace(/_/g, " ")}
                  </button>
                );
              })}
              {capabilityOpts.length === 0 && <p className="text-xs text-muted-foreground">No capabilities defined in LOV.</p>}
            </div>
          </Section>

          <Section title="Certifications">
            <div className="flex flex-wrap gap-1.5">
              {certificationOpts.map((cert) => {
                const active = (supplier.certifications || []).includes(cert);
                return (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleArrayValue("certifications", cert)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border font-medium uppercase tracking-wide transition-colors",
                      active
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-background text-muted-foreground border-border hover:border-green-400"
                    )}
                  >
                    {cert.toUpperCase()}
                  </button>
                );
              })}
              {certificationOpts.length === 0 && <p className="text-xs text-muted-foreground">No certifications defined in LOV.</p>}
            </div>
          </Section>

          <Section title="Default Commercial Terms">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Lead Time (days)">
                <Input
                  type="number"
                  value={supplier.lead_time_default_days ?? ""}
                  onChange={(e) => updateField("lead_time_default_days", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="Default Currency">
                <Select value={supplier.currency_default_id || ""} onValueChange={(v) => updateField("currency_default_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select currency…" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Payment Terms">
                <Select value={supplier.payment_terms_default || ""} onValueChange={(v) => updateField("payment_terms_default", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {paymentTermsOpts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="md:col-span-3">
                <Field label="MOQ Policy">
                  <Textarea rows={2} value={supplier.moq_policy || ""} onChange={(e) => updateField("moq_policy", e.target.value)} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <Textarea rows={3} value={supplier.notes || ""} onChange={(e) => updateField("notes", e.target.value)} />
          </Section>

          {isNew && (
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create Supplier"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {!isNew && activeTab === "products" && (
        <div className="space-y-2">
          {uniqueProductIds.length === 0 ? (
            <EmptyState message="No products sourced from this supplier yet." />
          ) : uniqueProductIds.map((pid) => {
            const prod = products.find((p) => p.id === pid);
            const link = approvedLinks.find((a) => a.product_id === pid);
            if (!prod) return null;
            
            return (
              <div
                key={pid}
                onClick={() => navigate(`/products/${pid}`)}
                className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-all"
              >
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {prod.images?.[0] ? (
                    <img src={prod.images[0]} alt={prod.name} className="w-full h-full object-contain rounded-md" />
                  ) : (
                    <Package className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{prod.name}</p>
                  <p className="text-xs text-muted-foreground">{prod.type}{prod.category ? ` · ${prod.category}` : ""}</p>
                </div>
                {link?.is_primary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">Primary</span>
                )}
                {link?.rank && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Rank {link.rank}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isNew && activeTab === "routing" && (
        <div className="space-y-3">
          {routings.length === 0 ? (
            <EmptyState message="This supplier is not approved for any product with a routing." />
          ) : (
            routings.map((routing) => {
              const parentProduct = products.find((p) => p.id === routing.product_id);
              const lines = routingBomLines.filter((bl) => bl.bom_id === routing.id);
              return (
                <div key={routing.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                    <button type="button" onClick={() => parentProduct && navigate(`/products/${parentProduct.id}`)}
                      className="hover:opacity-80 transition-opacity">
                      <ProductTypeBadgeRow product={parentProduct} />
                    </button>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded border bg-background capitalize">{routing.bom_phase}</span>
                      <span className="px-1.5 py-0.5 rounded border bg-background capitalize">{routing.status}</span>
                      <span className="font-mono">v{routing.version}</span>
                      {routing.name && <span className="italic">"{routing.name}"</span>}
                    </div>
                  </div>
                  {lines.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">No operations defined.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {lines.map((bl) => {
                        const comp = products.find((p) => p.id === bl.component_product_id);
                        const isPinnedToThisSupplier = bl.line_level_approved_supplier_id
                          && approvedLinks.some((a: any) => a.id === bl.line_level_approved_supplier_id);
                        return (
                          <li key={bl.id} className="px-4 py-2 flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {bl.position}
                            </span>
                            <span className="font-medium capitalize">{(bl.component_role || "—").replace(/_/g, " ")}</span>
                            {comp && (
                              <span className="text-muted-foreground">
                                · {comp.name} <span className="font-mono text-[10px]">{comp.code}</span>
                              </span>
                            )}
                            {isPinnedToThisSupplier && (
                              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-semibold uppercase tracking-wider">
                                Pinned to this supplier
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
