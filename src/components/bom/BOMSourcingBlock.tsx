import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

const requestCache = new Map<string, { data: any; expiry: number }>();
const requestPending = new Map<string, Promise<any>>();

const cachedQuery = async (key: string, fn: () => Promise<any>, ttl = 60000): Promise<any> => {
  if (requestCache.has(key)) {
    const { data, expiry } = requestCache.get(key)!;
    if (Date.now() < expiry) return data;
    requestCache.delete(key);
  }
  if (requestPending.has(key)) return requestPending.get(key);
  const promise = fn().then((data) => {
    requestCache.set(key, { data, expiry: Date.now() + ttl });
    requestPending.delete(key);
    return data;
  }).catch((err) => {
    requestPending.delete(key);
    throw err;
  });
  requestPending.set(key, promise);
  return promise;
};

interface Props {
  line: any;
  comp?: any;
}

export default function BOMSourcingBlock({ line }: Props) {
  const navigate = useNavigate();
  const [primarySupplier, setPrimarySupplier] = useState<any>(null);
  const [noSuppliers, setNoSuppliers] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!line.component_product_id) return;
    let cancelled = false;
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, Math.random() * 200));
        if (cancelled) return;

        let asRecord: any = null;
        if (line.line_level_approved_supplier_id) {
          const key = `as:${line.line_level_approved_supplier_id}`;
          const overrides = await cachedQuery(key, async () =>
            (await supabase.from("approved_suppliers").select("*").eq("id", line.line_level_approved_supplier_id)).data ?? []
          );
          if (!cancelled && overrides[0]) asRecord = overrides[0];
        }
        if (!asRecord) {
          const key = `primary:${line.component_product_id}`;
          const approved = await cachedQuery(key, async () =>
            (await supabase.from("approved_suppliers").select("*").match({
              product_id: line.component_product_id, is_primary: true, status: "active",
            })).data ?? []
          );
          if (cancelled) return;
          if (approved.length === 0) {
            const allKey = `all:${line.component_product_id}`;
            const all = await cachedQuery(allKey, async () =>
              (await supabase.from("approved_suppliers").select("*").eq("product_id", line.component_product_id)).data ?? []
            );
            if (cancelled) return;
            setNoSuppliers(all.length === 0);
            setLoaded(true);
            return;
          }
          asRecord = approved[0];
        }
        if (cancelled) return;

        const supplierKey = `supplier:${asRecord.supplier_id}`;
        const suppliers = await cachedQuery(supplierKey, async () =>
          (await supabase.from("suppliers").select("*").eq("id", asRecord.supplier_id)).data ?? []
        );
        if (cancelled) return;
        setPrimarySupplier({
          as: asRecord,
          supplier: suppliers[0] || null,
          isOverride: !!line.line_level_approved_supplier_id,
        });
        setLoaded(true);
      } catch (err) {
        console.error("[BOMSourcingBlock] Failed to load supplier data:", err);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [line.component_product_id, line.line_level_approved_supplier_id]);

  if (!loaded) return null;

  const openSourcing = () => navigate(`/products/${line.component_product_id}?tab=suppliers`);

  if (noSuppliers) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-1">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>No awarded supplier</span>
        <button type="button" onClick={openSourcing} className="ml-0.5 underline hover:text-amber-800 transition-colors" title="Open component sourcing">
          <ExternalLink className="w-2.5 h-2.5 inline" />
        </button>
      </div>
    );
  }

  if (!primarySupplier) return null;

  const { as, supplier, isOverride } = primarySupplier;

  return (
    <div className="flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground mt-1 cursor-pointer hover:text-foreground transition-colors"
      onClick={openSourcing} title="Open component sourcing">
      {as.supplier_reference && <span className="font-mono text-foreground/70">{as.supplier_reference}</span>}
      {as.supplier_reference && supplier?.name && <span>@</span>}
      {supplier?.name && <span className="font-medium">{supplier.name}</span>}
      {isOverride && (
        <span className="px-1 py-0 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-medium">line override</span>
      )}
      <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-40" />
    </div>
  );
}
