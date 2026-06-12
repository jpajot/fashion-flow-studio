import { useState, useEffect, useMemo, useCallback } from "react";
import RFQSamplesTab from "@/components/samples/RFQSamplesTab";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { PAGE_WRAPPER } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import DataTable from "@/components/shared/DataTable";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, FileSearch, MoreVertical, Pencil, Trash2,
  Plus, Search, X, AlertTriangle, FlaskConical, MessageSquarePlus,
  Download, Upload, Filter,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ResponsesPanel from "@/components/rfq/ResponsesPanel";
import AddResponseDialog from "@/components/rfq/AddResponseDialog";
import ExportTodoDialog from "@/components/rfq/ExportTodoDialog";
import ImportResponsesDialog from "@/components/rfq/ImportResponsesDialog";

// ── Status config ────────────────────────────────────────────────────────────
const SR_STATUS_COLORS: Record<string, string> = {
  draft:         "bg-gray-100 text-gray-600 border-gray-200",
  submitted:     "bg-blue-100 text-blue-700 border-blue-200",
  in_collection: "bg-amber-100 text-amber-700 border-amber-200",
  closed:        "bg-green-100 text-green-700 border-green-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
};

const LINE_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-600 border-gray-200",
  answered:  "bg-blue-100 text-blue-700 border-blue-200",
  awarded:   "bg-green-100 text-green-700 border-green-200",
  declined:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

// ── lineKey dedup helper ─────────────────────────────────────────────────────
const lineKey = (row: any) =>
  [row.recipient_supplier_id, row.bom_line_id, row.product_id, row.product_color_id ?? null, row.product_color_and_more_id ?? null].join("|");

// ── Section header for line builder ─────────────────────────────────────────
function SectionHeader({ number, title, done }: { number: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{number}</span>
      <span className="text-sm font-semibold">{title}</span>
      {done && <span className="text-[10px] text-primary ml-1">✓</span>}
    </div>
  );
}

// ── Product type badge row (shared) ──────────────────────────────────────────
function ProductTypeBadgeRow({ product }: { product: any }) {
  if (!product) return null;
  const isStyle = product.type === "Product";
  const badgeClass = isStyle
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-amber-100 text-amber-700 border-amber-200";
  const label = isStyle ? "STYLE" : "MATERIAL";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeClass}`}>{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{product.code}</span>
      <span className="text-muted-foreground">—</span>
      <span className="text-xs font-semibold">{product.name}</span>
    </span>
  );
}

// ── Product picker (step 1) ──────────────────────────────────────────────────
function ProductPicker({ styles, materials, selected, onToggle }: {
  styles: any[];
  materials: any[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"styles" | "materials">("styles");
  const [search, setSearch] = useState("");
  useEffect(() => { setSearch(""); }, [activeTab]);

  const source = activeTab === "styles" ? styles : materials;
  const filtered = useMemo(() => {
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter(p => (p.code || "").toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [source, search]);

  const stylesSelectedCount = selected.filter(id => styles.some(s => s.id === id)).length;
  const materialsSelectedCount = selected.filter(id => materials.some(m => m.id === id)).length;
  const total = selected.length;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("styles")}
          className={`flex-1 text-xs px-3 py-1.5 rounded-md border transition-colors ${activeTab === "styles" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
        >
          Products in this project <span className="opacity-70">({styles.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("materials")}
          className={`flex-1 text-xs px-3 py-1.5 rounded-md border transition-colors ${activeTab === "materials" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
        >
          All materials <span className="opacity-70">({materials.length})</span>
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={activeTab === "styles" ? "Search products…" : "Search materials…"} className="pl-8 h-8 text-xs" />
      </div>
      <div className="max-h-44 overflow-y-auto border border-border rounded-md divide-y divide-border">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground p-3">No {activeTab === "styles" ? "products" : "materials"} found.</p>}
        {filtered.map(p => {
          const isSel = selected.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => onToggle(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${isSel ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              <div className="w-7 h-7 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt="" className="w-full h-full object-contain" />
                  : <span className="text-[9px] text-muted-foreground font-mono">{(p.code || "?").slice(0, 4)}</span>}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">{p.code}</span>
              <span className="truncate">{p.name}</span>
              {isSel && <span className="ml-auto shrink-0 text-primary font-bold">✓</span>}
            </button>
          );
        })}
      </div>
      {total > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {total} selected — {stylesSelectedCount} style{stylesSelectedCount === 1 ? "" : "s"}, {materialsSelectedCount} material{materialsSelectedCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

// ── Granularity picker (step 2) ──────────────────────────────────────────────
function GranularityPicker({ selectedProducts, allProducts, colorsByProduct, pcamsByColor, granularity, onGranularityChange }: {
  selectedProducts: string[]; allProducts: any[];
  colorsByProduct: Record<string, any[]>; pcamsByColor: Record<string, any[]>;
  granularity: Record<string, { level: string; colorIds: string[]; pcamIds: string[] }>;
  onGranularityChange: (pid: string, val: any) => void;
}) {
  return (
    <div className="space-y-3">
      {selectedProducts.map(pid => {
        const prod = allProducts.find(p => p.id === pid);
        const g = granularity[pid] || { level: "product", colorIds: [], pcamIds: [] };
        const colors = colorsByProduct[pid] || [];
        const pcams = colors.flatMap(c => (pcamsByColor[c.id] || []).map((pc: any) => ({ ...pc, _colorName: c.color_name })));

        return (
          <div key={pid} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {prod?.images?.[0]
                  ? <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
                  : <span className="text-[8px] font-mono text-muted-foreground">{(prod?.code || "").slice(0, 3)}</span>}
              </div>
              <span className="text-xs font-medium truncate">{prod?.name}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{prod?.code}</span>
            </div>
            <div className="flex gap-1">
              {(["product", "color", "pcam"] as const).map(level => (
                <button key={level} type="button"
                  onClick={() => onGranularityChange(pid, { level, colorIds: [], pcamIds: [] })}
                  className={`text-[10px] px-2 py-1 rounded border font-medium transition-colors ${g.level === level ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                  {level === "product" ? "Product" : level === "color" ? "By Colorway" : "By Variation"}
                </button>
              ))}
            </div>
            {g.level === "color" && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">Select colorways:</p>
                <div className="max-h-32 overflow-y-auto border border-border rounded divide-y divide-border">
                  {colors.length === 0 && <p className="text-[10px] text-muted-foreground p-2">No colorways found.</p>}
                  {colors.map((c: any) => {
                    const sel = g.colorIds.includes(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => onGranularityChange(pid, { ...g, colorIds: sel ? g.colorIds.filter(x => x !== c.id) : [...g.colorIds, c.id] })}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                        {c.color_hex && <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{ backgroundColor: c.color_hex }} />}
                        <span className="truncate">{c.color_name}</span>
                        {c.colorway_code && <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">{c.colorway_code}</span>}
                        {sel && <span className="text-primary font-bold ml-1 shrink-0">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {g.level === "pcam" && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">Select variations:</p>
                <div className="max-h-32 overflow-y-auto border border-border rounded divide-y divide-border">
                  {pcams.length === 0 && <p className="text-[10px] text-muted-foreground p-2">No variations found.</p>}
                  {pcams.map((pc: any) => {
                    const sel = g.pcamIds.includes(pc.id);
                    return (
                      <button key={pc.id} type="button"
                        onClick={() => onGranularityChange(pid, { ...g, pcamIds: sel ? g.pcamIds.filter(x => x !== pc.id) : [...g.pcamIds, pc.id] })}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                        <span className="truncate text-muted-foreground">{pc._colorName} ›</span>
                        <span className="truncate">{pc.name || pc.sequence}</span>
                        {sel && <span className="text-primary font-bold ml-auto shrink-0">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Line Builder Dialog (4-step wizard) ──────────────────────────────────────
function LineBuilderDialog({ srId, projectId, existingLines, onSaved, onClose }: {
  srId: string; projectId: string; existingLines: any[];
  onSaved: () => void; onClose: () => void;
}) {
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [colorsByProduct, setColorsByProduct] = useState<Record<string, any[]>>({});
  const [pcamsByColor, setPcamsByColor] = useState<Record<string, any[]>>({});
  const [allRoutings, setAllRoutings] = useState<any[]>([]);
  const [allSteps, setAllSteps] = useState<any[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [approvedSuppliers, setApprovedSuppliers] = useState<any[]>([]);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [granularity, setGranularity] = useState<Record<string, { level: string; colorIds: string[]; pcamIds: string[] }>>({});
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
              const [stylesRes, materialsRes, suppliers, routings, steps, colors, pcams, approvedSuppliersRes] = await Promise.all([
        supabase.from("products").select("id,code,name,images,default_uom,project_ids,type").eq("type", "Product").contains("project_ids", [projectId]).order("code"),
        supabase.from("products").select("id,code,name,images,default_uom,project_ids,type").eq("type", "Material").order("code"),
        supabase.from("suppliers").select("id,name").eq("status", "active").order("name"),
        supabase.from("boms").select("id,product_id,revision_code,version,status,bom_phase").eq("bom_type", "routing"),
        supabase.from("bom_lines").select("id,bom_id,position,component_role,component_product_id,line_level_approved_supplier_id").order("position"),
        supabase.from("product_colors").select("id,product_id,color_name,colorway_code,color_hex").order("color_name"),
        supabase.from("product_color_and_more").select("id,product_color_id,name,sequence,pack_code,variant").order("sequence"),
        supabase.from("approved_suppliers").select("id, product_id, supplier_id, is_primary, status, rank").eq("status", "active"),
      ]);
      const stylesData = stylesRes.data ?? [];
      const materialsData = materialsRes.data ?? [];
      setAllProducts([...stylesData, ...materialsData]);
      setAllSuppliers(suppliers.data ?? []);
      setAllRoutings(routings.data ?? []);
      setAllSteps(steps.data ?? []);
      setApprovedSuppliers(approvedSuppliersRes.data ?? []);


      const cbp: Record<string, any[]> = {};
      (colors.data ?? []).forEach((c: any) => { if (!cbp[c.product_id]) cbp[c.product_id] = []; cbp[c.product_id].push(c); });
      setColorsByProduct(cbp);

      const pbc: Record<string, any[]> = {};
      (pcams.data ?? []).forEach((pc: any) => { if (!pbc[pc.product_color_id]) pbc[pc.product_color_id] = []; pbc[pc.product_color_id].push(pc); });
      setPcamsByColor(pbc);

      setLoadingData(false);
    })();
  }, [projectId]);

  const toggleProduct = (pid: string) => {
    setSelectedProductIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
    setGranularity(prev => {
      if (prev[pid]) { const next = { ...prev }; delete next[pid]; return next; }
      return { ...prev, [pid]: { level: "product", colorIds: [], pcamIds: [] } };
    });
    setPreviewRows(null);
  };

  const updateGranularity = (pid: string, val: any) => {
    setGranularity(prev => ({ ...prev, [pid]: val }));
    setPreviewRows(null);
  };

  const toggleStep = (sid: string) => {
    setSelectedStepIds(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
    setPreviewRows(null);
  };

  const relevantSteps = useMemo(() => {
    const selPids = new Set(selectedProductIds);
    const relRoutingIds = new Set(allRoutings.filter(r => selPids.has(r.product_id)).map(r => r.id));
    return allSteps.filter(s => relRoutingIds.has(s.bom_id)).sort((a, b) => (a.position || 0) - (b.position || 0));
  }, [allRoutings, allSteps, selectedProductIds]);

  const stepsByProduct = useMemo(() => {
    const result: Record<string, any[]> = {};
    selectedProductIds.forEach(pid => {
      const routingIds = new Set(allRoutings.filter(r => r.product_id === pid).map(r => r.id));
      result[pid] = relevantSteps.filter(s => routingIds.has(s.bom_id));
    });
    return result;
  }, [relevantSteps, allRoutings, selectedProductIds]);

  const s1Done = selectedProductIds.length > 0;
  const s2Done = s1Done && selectedProductIds.every(pid => {
    const g = granularity[pid];
    if (!g) return false;
    if (g.level === "product") return true;
    if (g.level === "color") return g.colorIds.length > 0;
    if (g.level === "pcam") return g.pcamIds.length > 0;
    return false;
  });
  const s3Done = s2Done && selectedStepIds.length > 0;

  const resolveDefaultRecipientSupplierId = (step: any): string => {
    if (step.line_level_approved_supplier_id) {
      const as = approvedSuppliers.find(a => a.id === step.line_level_approved_supplier_id);
      if (as?.supplier_id) return as.supplier_id;
    }
    const primary = approvedSuppliers.find(
      a => a.product_id === step.component_product_id && a.is_primary
    );
    return primary?.supplier_id || "";
  };

  const buildPreview = () => {
    const rows: any[] = [];
    const selectedSteps = allSteps.filter(s => selectedStepIds.includes(s.id));
    selectedProductIds.forEach(pid => {
      const g = granularity[pid] || { level: "product", colorIds: [], pcamIds: [] };
      const prod = allProducts.find(p => p.id === pid);
      let granEntries: { product_color_id: string | null; product_color_and_more_id: string | null }[] = [];
      if (g.level === "product") {
        granEntries = [{ product_color_id: null, product_color_and_more_id: null }];
      } else if (g.level === "color") {
        granEntries = g.colorIds.map(cid => ({ product_color_id: cid, product_color_and_more_id: null }));
      } else if (g.level === "pcam") {
        granEntries = g.pcamIds.map(pcid => {
          const allColors = colorsByProduct[pid] || [];
          const parentColor = allColors.find(c => (pcamsByColor[c.id] || []).some((pc: any) => pc.id === pcid));
          return { product_color_id: parentColor?.id || null, product_color_and_more_id: pcid };
        });
      }
      const routingIds = new Set(allRoutings.filter(r => r.product_id === pid).map(r => r.id));
      const productSteps = selectedSteps.filter(s => routingIds.has(s.bom_id));
      granEntries.forEach(gran => {
        productSteps.forEach(step => {
          rows.push({
            _id: Math.random().toString(36).slice(2),
            product_id: pid,
            product_color_id: gran.product_color_id,
            product_color_and_more_id: gran.product_color_and_more_id,
            bom_line_id: step.id,
            recipient_supplier_id: resolveDefaultRecipientSupplierId(step),
            forecasted_qty: 0,
            forecasted_qty_uom: prod?.default_uom || "",
            _product: prod,
            _step: step,
            _gran_level: g.level,
          });
        });
      });
    });

    const existingKeys = new Set(existingLines.map(lineKey));
    const keyCount: Record<string, number> = {};
    rows.forEach(r => { const k = lineKey(r); keyCount[k] = (keyCount[k] || 0) + 1; });
    return rows.map(r => {
      const k = lineKey(r);
      return { ...r, _dupExisting: existingKeys.has(k), _dupBatch: keyCount[k] > 1 };
    });
  };

  const handleBuildPreview = () => setPreviewRows(buildPreview());

  const removePreviewRow = (id: string) => {
    setPreviewRows(prev => {
      const next = (prev ?? []).filter(r => r._id !== id);
      const keyCount: Record<string, number> = {};
      next.forEach(r => { const k = lineKey(r); keyCount[k] = (keyCount[k] || 0) + 1; });
      return next.map(r => ({ ...r, _dupBatch: keyCount[lineKey(r)] > 1 }));
    });
  };

  const removeDuplicates = () => {
    setPreviewRows(prev => {
      const seen = new Set<string>();
      const existingKeys = new Set(existingLines.map(lineKey));
      return (prev ?? []).filter(r => {
        const k = lineKey(r);
        if (existingKeys.has(k) || seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map(r => ({ ...r, _dupExisting: false, _dupBatch: false }));
    });
  };

  const updatePreviewRow = (id: string, field: string, value: any) => {
    setPreviewRows(prev => {
      const next = (prev ?? []).map(r => r._id === id ? { ...r, [field]: value } : r);
      const existingKeys = new Set(existingLines.map(lineKey));
      const keyCount: Record<string, number> = {};
      next.forEach(r => { const k = lineKey(r); keyCount[k] = (keyCount[k] || 0) + 1; });
      return next.map(r => ({ ...r, _dupExisting: existingKeys.has(lineKey(r)), _dupBatch: keyCount[lineKey(r)] > 1 }));
    });
  };

  const getGranLabel = (row: any) => {
    if (row._gran_level === "product") return "Product";
    if (row._gran_level === "color") {
      const c = (colorsByProduct[row.product_id] || []).find((c: any) => c.id === row.product_color_id);
      return c ? `Color: ${c.color_name}` : "Color";
    }
    if (row._gran_level === "pcam") {
      const c = (colorsByProduct[row.product_id] || []).find((c: any) => c.id === row.product_color_id);
      const pcs = c ? (pcamsByColor[c.id] || []) : [];
      const pc = pcs.find((p: any) => p.id === row.product_color_and_more_id);
      return c && pc ? `${c.color_name} › ${pc.name || pc.sequence}` : "Variation";
    }
    return "—";
  };

  const hasDuplicates = previewRows?.some(r => r._dupExisting || r._dupBatch);
  const validRows = previewRows?.filter(r => !r._dupExisting && !r._dupBatch) ?? [];

  const handleSave = async () => {
    if (!previewRows || validRows.length === 0) return;
    setSaving(true);
    const toCreate = validRows.map(r => ({
      supplier_request_id: srId,
      product_id: r.product_id,
      product_color_id: r.product_color_id || null,
      product_color_and_more_id: r.product_color_and_more_id || null,
      bom_line_id: r.bom_line_id,
      recipient_supplier_id: r.recipient_supplier_id || null,
      forecasted_qty: Number(r.forecasted_qty) || null,
      forecasted_qty_uom: r.forecasted_qty_uom || null,
      status: "pending",
    }));
    const { error } = await supabase.from("rfq_lines").insert(toCreate);
    setSaving(false);
    if (error) { toast.error("Failed to add lines: " + error.message); return; }
    toast.success(`${toCreate.length} line${toCreate.length !== 1 ? "s" : ""} added`);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Lines to Supplier Request</DialogTitle>
        </DialogHeader>
        {loadingData ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Step 1 */}
            <div>
              <SectionHeader number={1} title="Pick Products" done={s1Done} />
              <ProductPicker products={allProducts} selected={selectedProductIds} onToggle={toggleProduct} />
            </div>

            {/* Step 2 */}
            <div className={s1Done ? "" : "opacity-40 pointer-events-none"}>
              <SectionHeader number={2} title="Pick Granularity" done={s2Done} />
              {s1Done
                ? <GranularityPicker selectedProducts={selectedProductIds} allProducts={allProducts} colorsByProduct={colorsByProduct} pcamsByColor={pcamsByColor} granularity={granularity} onGranularityChange={updateGranularity} />
                : <p className="text-xs text-muted-foreground">Select at least one product first.</p>}
            </div>

            {/* Step 3 */}
            <div className={s2Done ? "" : "opacity-40 pointer-events-none"}>
              <SectionHeader number={3} title="Pick Routing Steps" done={s3Done} />
              {s2Done ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-muted-foreground">The supplier on the routing step becomes the default recipient. You can override per line below.</p>
                  {selectedProductIds.map(pid => {
                    const prod = allProducts.find(p => p.id === pid);
                    const steps = stepsByProduct[pid] || [];
                    return (
                      <div key={pid}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{prod?.name}</p>
                        {steps.length === 0 && <p className="text-xs text-muted-foreground pl-2">No routing steps found for this product.</p>}
                        <div className="border border-border rounded-md divide-y divide-border">
                          {steps.map(s => {
                            const supplier = allSuppliers.find(sup => sup.id === resolveDefaultRecipientSupplierId(s));
                            const sel = selectedStepIds.includes(s.id);
                            return (
                              <button key={s.id} type="button" onClick={() => toggleStep(s.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${sel ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{s.position}</span>
                                <span className="flex-1 truncate">{(s.component_role || "—").replace(/_/g, " ")}</span>
                                {supplier && <span className="text-[10px] text-muted-foreground shrink-0">{supplier.name}</span>}
                                {sel && <span className="text-primary font-bold shrink-0">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-xs text-muted-foreground">Complete granularity selection first.</p>}
            </div>

            {/* Step 4 */}
            <div className={s3Done ? "" : "opacity-40 pointer-events-none"}>
              <SectionHeader number={4} title="Confirm Lines" done={s3Done && previewRows !== null && previewRows.length > 0} />
              {s3Done && previewRows === null && (
                <Button size="sm" variant="outline" className="gap-2" onClick={handleBuildPreview}>
                  Generate Preview
                </Button>
              )}
              {s3Done && previewRows !== null && (
                <div className="space-y-2">
                  {hasDuplicates && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1">Some rows are duplicates (highlighted).</span>
                      <button type="button" onClick={removeDuplicates} className="underline font-medium hover:text-amber-900">Remove duplicates</button>
                    </div>
                  )}
                  {previewRows.length === 0 && <p className="text-xs text-muted-foreground">No rows to add. Change your selections above.</p>}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {previewRows.map(row => {
                      const isDup = row._dupExisting || row._dupBatch;
                      return (
                        <div key={row._id} className={`rounded-lg border p-3 space-y-2 ${isDup ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
                          {isDup && <p className="text-[10px] text-destructive font-medium">{row._dupExisting ? "Already in this Supplier Request" : "Duplicate in this batch"}</p>}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <div><span className="text-muted-foreground">Product: </span><span className="font-medium">{row._product?.name}</span><span className="text-muted-foreground font-mono ml-1">{row._product?.code}</span></div>
                            <div><span className="text-muted-foreground">Scope: </span><span>{getGranLabel(row)}</span></div>
                            <div className="col-span-2"><span className="text-muted-foreground">Step: </span><span>Step {row._step?.position}: {(row._step?.component_role || "—").replace(/_/g, " ")}</span></div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">Recipient Supplier</p>
                              <Select value={row.recipient_supplier_id || "__none"} onValueChange={v => updatePreviewRow(row._id, "recipient_supplier_id", v === "__none" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none" disabled>Select supplier…</SelectItem>
                                  {allSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">Forecasted Qty</p>
                              <div className="flex items-center gap-1.5">
                                <Input type="number" min={0} value={row.forecasted_qty} onChange={e => updatePreviewRow(row._id, "forecasted_qty", e.target.value)} className="h-7 text-xs" />
                                <span className="text-[10px] text-muted-foreground shrink-0">{row.forecasted_qty_uom || "—"}</span>
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={() => removePreviewRow(row._id)} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                            <Trash2 className="w-3 h-3" />Remove from batch
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!s3Done && <p className="text-xs text-muted-foreground">Select routing steps first.</p>}
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !previewRows || validRows.length === 0 || !!hasDuplicates} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Add {validRows.length > 0 ? validRows.length : ""} line{validRows.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Header Dialog ────────────────────────────────────────────────────────
function EditHeaderDialog({ sr, onSaved, onClose }: { sr: any; onSaved: (updated: any) => void; onClose: () => void }) {
  const isDraft = sr.status === "draft";
  const [rounds, setRounds] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: sr.name || "",
    round_id: sr.round_id || "",
    due_date: sr.due_date || "",
    target_currency_id: sr.target_currency_id || "",
    description: sr.description || "",
    notes: sr.notes || "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("rfq_rounds").select("id,code,label,sequence").eq("is_active", true).order("sequence"),
      supabase.from("currencies").select("id,code,name").eq("is_active", true).order("code"),
    ]).then(([rRes, cRes]) => {
      setRounds(rRes.data ?? []);
      setCurrencies(cRes.data ?? []);
      setLoading(false);
    });
  }, []);

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (isDraft && !form.round_id) errs.round_id = "Round is required.";
    if (isDraft && !form.target_currency_id) errs.target_currency_id = "Target currency is required.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      due_date: form.due_date || null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (isDraft) { payload.round_id = form.round_id; payload.target_currency_id = form.target_currency_id; }
    const { data, error } = await supabase.from("supplier_requests").update(payload).eq("id", sr.id).select().single();
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("Header updated");
    onSaved({ ...sr, ...data });
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Header</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Round {isDraft && <span className="text-destructive">*</span>}</Label>
              {isDraft ? (
                <Select value={form.round_id || "__none"} onValueChange={v => set("round_id", v === "__none" ? "" : v)}>
                  <SelectTrigger className={errors.round_id ? "border-destructive" : ""}><SelectValue placeholder="Select round…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" disabled>Select round…</SelectItem>
                    {rounds.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground px-1">{rounds.find(r => r.id === form.round_id)?.label || "—"} <span className="text-xs text-muted-foreground/60">(locked after submission)</span></p>
              )}
              {errors.round_id && <p className="text-xs text-destructive">{errors.round_id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target Currency {isDraft && <span className="text-destructive">*</span>}</Label>
              {isDraft ? (
                <Select value={form.target_currency_id || "__none"} onValueChange={v => set("target_currency_id", v === "__none" ? "" : v)}>
                  <SelectTrigger className={errors.target_currency_id ? "border-destructive" : ""}><SelectValue placeholder="Select currency…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" disabled>Select currency…</SelectItem>
                    {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground px-1">{currencies.find(c => c.id === form.target_currency_id)?.code || "—"} <span className="text-xs text-muted-foreground/60">(locked after submission)</span></p>
              )}
              {errors.target_currency_id && <p className="text-xs text-destructive">{errors.target_currency_id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Visible to suppliers." rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Internal — not shared with suppliers." rows={2} />
              <p className="text-[10px] text-muted-foreground">Internal — suppliers will not see this.</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── RFQ Lines Tab ─────────────────────────────────────────────────────────────
function RFQLinesTab({ sr, lines, refData, locked, onLinesRefresh, setOptions, currencies }: {
  sr: any; lines: any[];
  refData: { products: any[]; colors: any[]; pcams: any[]; steps: any[]; suppliers: any[] };
  locked: boolean; onLinesRefresh: () => void; setOptions: any; currencies: any[];
}) {
  const { products, colors, pcams, steps, suppliers } = refData;
  const [showBuilder, setShowBuilder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showQF, setShowQF] = useState(false);
  const [pinnedCols, setPinnedCols] = useState<string[]>(["product", "status"]);
  const [responses, setResponses] = useState<any[]>([]);
  const [panelLine, setPanelLine] = useState<any>(null);
  const [responseTarget, setResponseTarget] = useState<any>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const productMap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);
  const colorMap = useMemo(() => Object.fromEntries(colors.map(c => [c.id, c])), [colors]);
  const pcamMap = useMemo(() => Object.fromEntries(pcams.map(p => [p.id, p])), [pcams]);
  const stepMap = useMemo(() => Object.fromEntries(steps.map(s => [s.id, s])), [steps]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);

  useEffect(() => {
    if (lines.length === 0) { setResponses([]); return; }
    supabase.from("rfq_responses").select("*")
      .in("rfq_line_id", lines.map(l => l.id))
      .order("created_at", { ascending: false })
      .then(({ data }) => setResponses(data ?? []));
  }, [lines]);

  const filtered = useMemo(() => lines.filter(l => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const prod = productMap[l.product_id];
      if (!`${prod?.name || ""} ${prod?.code || ""} ${supplierMap[l.recipient_supplier_id]?.name || ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [lines, filterStatus, search, productMap, supplierMap]);

  const getGranLabel = (l: any) => {
    if (l.product_color_and_more_id) {
      const pc = pcamMap[l.product_color_and_more_id];
      const c = pc ? colorMap[pc.product_color_id] : null;
      return c ? `${c.color_name} › ${pc?.name || pc?.sequence || "—"}` : "Variation";
    }
    if (l.product_color_id) {
      const c = colorMap[l.product_color_id];
      return c ? c.color_name : "Colorway";
    }
    return "Product";
  };

  const tableColumns = useMemo(() => [
    {
      id: "select", label: "", width: 40,
      render: (l: any) => (
        <Checkbox
          checked={selectedLineIds.has(l.id)}
          onCheckedChange={(checked) => {
            setSelectedLineIds(prev => {
              const next = new Set(prev);
              if (checked) next.add(l.id); else next.delete(l.id);
              return next;
            });
          }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />
      ),
    },
    {
      id: "product", label: "Product", width: 200,
      sortKey: (l: any) => productMap[l.product_id]?.name || "",
      render: (l: any) => {
        const p = productMap[l.product_id];
        return (
          <div className="flex items-center gap-2">
            {p?.images?.[0] && <img src={p.images[0]} className="w-6 h-6 object-contain rounded shrink-0" alt="" />}
            <div>
              <p className="text-xs font-medium">{p?.name || "—"}</p>
              {p?.code && <p className="text-[10px] font-mono text-muted-foreground">{p.code}</p>}
            </div>
          </div>
        );
      },
    },
    {
      id: "scope", label: "Scope", width: 170,
      sortKey: (l: any) => getGranLabel(l),
      render: (l: any) => <span className="text-xs text-muted-foreground">{getGranLabel(l)}</span>,
    },
    {
      id: "step", label: "Routing Step", width: 160,
      sortKey: (l: any) => stepMap[l.bom_line_id]?.component_role || "",
      render: (l: any) => {
        const s = stepMap[l.bom_line_id];
        return s
          ? <span className="text-xs text-muted-foreground">Step {s.position}: {(s.component_role || "").replace(/_/g, " ")}</span>
          : <span className="text-muted-foreground/40">—</span>;
      },
    },
    {
      id: "supplier", label: "Recipient Supplier", width: 180,
      sortKey: (l: any) => supplierMap[l.recipient_supplier_id]?.name || "",
      render: (l: any) => {
        const s = supplierMap[l.recipient_supplier_id];
        return s ? <span className="text-xs">{s.name}</span> : <span className="text-muted-foreground/40">—</span>;
      },
    },
    {
      id: "status", label: "Status", width: 120,
      sortKey: (l: any) => l.status || "",
      render: (l: any) => (
        <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium capitalize ${LINE_STATUS_COLORS[l.status] ?? "bg-muted text-muted-foreground border-border"}`}>
          {(l.status || "pending").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "forecasted_qty", label: "Fcst. Qty", width: 100,
      sortKey: (l: any) => l.forecasted_qty ?? -1,
      render: (l: any) => (
        <span className="text-xs text-muted-foreground">
          {l.forecasted_qty != null ? `${l.forecasted_qty} ${l.forecasted_qty_uom || ""}`.trim() : "—"}
        </span>
      ),
    },
    {
      id: "awarded_at", label: "Awarded", width: 110,
      sortKey: (l: any) => l.awarded_at || "",
      render: (l: any) => l.awarded_at
        ? <span className="text-xs text-green-600">{new Date(l.awarded_at).toLocaleDateString()}</span>
        : <span className="text-muted-foreground/40">—</span>,
    },
    {
      id: "responses", label: "Responses", width: 100,
      sortKey: (l: any) => responses.filter(r => r.rfq_line_id === l.id).length,
      render: (l: any) => {
        const count = responses.filter(r => r.rfq_line_id === l.id).length;
        const isOpen = panelLine?.id === l.id;
        return (
          <button type="button"
            onClick={e => { e.stopPropagation(); setPanelLine(isOpen ? null : l); }}
            className={`flex items-center gap-1.5 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold border ${count > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border"}`}>
              {count}
            </span>
            <span className="text-[10px] underline underline-offset-2">View</span>
          </button>
        );
      },
    },
    {
      id: "add_response", label: "", width: 44,
      render: (l: any) => (
        <button type="button"
          onClick={e => { e.stopPropagation(); setResponseTarget(l); }}
          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Add response">
          <MessageSquarePlus className="w-3.5 h-3.5" />
        </button>
      ),
    },
    ...(!locked ? [{
      id: "_delete", label: "", width: 40,
      render: (l: any) => (
        <button type="button" onClick={e => { e.stopPropagation(); setDeleteTarget(l); }}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [productMap, colorMap, pcamMap, stepMap, supplierMap, locked, responses, panelLine, selectedLineIds]);

  useEffect(() => {
    setOptions({
      items: [
        ...(!locked ? [{ label: "Add Lines", icon: Plus, onClick: () => setShowBuilder(true), className: "text-primary hover:bg-primary/10" }, { divider: true }] : []),
        { label: "Quick Filters", icon: Filter, onClick: () => { setShowQF(v => !v); setShowViewMenu(false); }, keepOpen: true },
        { label: "Manage Views", icon: Pencil, onClick: () => { setShowViewMenu(v => !v); setShowQF(false); }, keepOpen: true },
      ],
      customContent: showQF ? (
        <div className="p-3 space-y-3 border-t">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Search</label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Product, supplier, step…" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["pending","answered","awarded","declined","cancelled"].map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(search || filterStatus !== 'all') && (
            <button type="button" onClick={() => { setSearch(''); setFilterStatus('all'); }}
              className="text-xs text-muted-foreground hover:text-foreground w-full text-left underline">
              Clear filters
            </button>
          )}
        </div>
      ) : showViewMenu ? (
        <ViewDrawerContent
          pageKey="supplier_request_rfq_lines"
          activeViewId={activeViewId}
          onSelectView={id => { setActiveViewId(id); setShowViewMenu(false); }}
          allFields={tableColumns.filter(c => c.id !== "_delete" && c.id !== "select").map(c => ({ id: c.id, label: c.label }))}
          currentViewType={null}
        />
      ) : null,
    });
    return () => setOptions(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, showViewMenu, showQF, activeViewId, tableColumns, setOptions, search, filterStatus]);

  const handleDeleteLine = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("rfq_responses").delete().eq("rfq_line_id", deleteTarget.id);
    await supabase.from("rfq_lines").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    onLinesRefresh();
    toast.success("Line removed");
  };

  return (
    <div className="space-y-4">
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        {!locked && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowBuilder(true)}>
            <Plus className="w-3.5 h-3.5" />Add Lines
          </Button>
        )}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lines…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["pending", "answered", "awarded", "declined", "cancelled"].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterStatus !== "all" && (
          <button type="button" onClick={() => setFilterStatus("all")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center gap-2 py-1.5 border-b border-border mb-1 flex-wrap">
          <Checkbox
            checked={selectedLineIds.size === filtered.length && filtered.length > 0}
            onCheckedChange={(checked) => {
              setSelectedLineIds(checked ? new Set(filtered.map((l: any) => l.id)) : new Set());
            }}
            className="h-3.5 w-3.5 ml-1"
          />
          <span className="text-[11px] text-muted-foreground">
            {selectedLineIds.size > 0
              ? <span className="text-primary font-medium">{selectedLineIds.size} of {filtered.length} selected</span>
              : `${filtered.length} line${filtered.length !== 1 ? 's' : ''}`}
          </span>
          {selectedLineIds.size > 0 && (
            <button type="button" onClick={() => setSelectedLineIds(new Set())}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-1">
              <X className="w-3 h-3" />Clear
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
              onClick={() => setShowExportDialog(true)}>
              <Download className="w-3 h-3" />
              Export ToDo{selectedLineIds.size > 0 ? ` (${selectedLineIds.size})` : ''}
            </Button>
            {!locked && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => setShowImportDialog(true)}>
                <Upload className="w-3 h-3" />Import Responses
              </Button>
            )}
            {selectedLineIds.size === 1 && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => {
                  const line = filtered.find((l: any) => selectedLineIds.has(l.id));
                  if (line) setResponseTarget(line);
                }}>
                <MessageSquarePlus className="w-3 h-3" />Add Response
              </Button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
          <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {lines.length === 0 ? "No RFQ lines yet" : "No matches"}
          </p>
          {lines.length === 0 && !locked && (
            <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setShowBuilder(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Lines
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          fixedColumns={pinnedCols}
          onPinColumn={id => setPinnedCols(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          {...({ activeViewId } as any)}
        />
      )}

      {showBuilder && (
        <LineBuilderDialog
          srId={sr.id}
          projectId={sr.project_id}
          existingLines={lines}
          onSaved={() => { setShowBuilder(false); onLinesRefresh(); }}
          onClose={() => setShowBuilder(false)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this line?</AlertDialogTitle>
            <AlertDialogDescription>Responses linked to this line will also be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLine} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Remove
            </AlertDialogAction>
          </AlertFooter>
        </AlertDialogContent>
      </AlertDialog>

      {panelLine && (
        <ResponsesPanel
          line={panelLine}
          rfq={sr}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onClose={() => setPanelLine(null)}
          onLineChanged={() => {
            onLinesRefresh();
            if (lines.length > 0) {
              supabase.from("rfq_responses").select("*").in("rfq_line_id", lines.map(l => l.id)).then(({ data }) => setResponses(data ?? []));
            }
          }}
        />
      )}

      {responseTarget && (
        <AddResponseDialog
          line={responseTarget}
          rfq={sr}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onSaved={() => { setResponseTarget(null); onLinesRefresh(); }}
          onClose={() => setResponseTarget(null)}
        />
      )}

      {showExportDialog && (
        <ExportTodoDialog
          sr={sr}
          lines={selectedLineIds.size > 0 ? lines.filter((l: any) => selectedLineIds.has(l.id)) : lines}
          productMap={productMap}
          colorMap={colorMap}
          pcamMap={pcamMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {showImportDialog && (
        <ImportResponsesDialog
          sr={sr}
          rfqLines={lines}
          currencies={currencies}
          onClose={() => setShowImportDialog(false)}
          onImportSuccess={onLinesRefresh}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SupplierRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setOptions } = usePageOptions();

  const [sr, setSr] = useState<any>(null);
  const [round, setRound] = useState<any>(null);
  const [currency, setCurrency] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [refData, setRefData] = useState<{ products: any[]; colors: any[]; pcams: any[]; steps: any[]; suppliers: any[] }>({ products: [], colors: [], pcams: [], steps: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("lines");

  const [showEditHeader, setShowEditHeader] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("currencies").select("id,code,decimal_places").eq("is_active", true).order("code")
      .then(({ data }) => setCurrencies(data ?? []));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: srData } = await supabase.from("supplier_requests").select("*").eq("id", id).single();
    if (!srData) { setLoading(false); return; }
    setSr(srData);

    const [rnd, cur, proj, linesRes, products, colors, pcams, steps, suppliers] = await Promise.all([
      srData.round_id ? supabase.from("rfq_rounds").select("id,code,label").eq("id", srData.round_id).single() : Promise.resolve({ data: null }),
      srData.target_currency_id ? supabase.from("currencies").select("id,code,name").eq("id", srData.target_currency_id).single() : Promise.resolve({ data: null }),
      srData.project_id ? supabase.from("projects").select("id,name").eq("id", srData.project_id).single() : Promise.resolve({ data: null }),
      supabase.from("rfq_lines").select("*").eq("supplier_request_id", id).order("created_at"),
      supabase.from("products").select("id,code,name,images,default_uom,project_ids"),
      supabase.from("product_colors").select("id,product_id,color_name,colorway_code,color_hex"),
      supabase.from("product_color_and_more").select("id,product_color_id,name,sequence,pack_code"),
      supabase.from("bom_lines").select("id,bom_id,position,component_role,component_product_id"),
      supabase.from("suppliers").select("id,name"),
    ]);

    setRound(rnd.data);
    setCurrency(cur.data);
    setProject(proj.data);
    setLines(linesRes.data ?? []);
    setRefData({
      products: products.data ?? [],
      colors: colors.data ?? [],
      pcams: pcams.data ?? [],
      steps: steps.data ?? [],
      suppliers: suppliers.data ?? [],
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const subNavItems = useMemo(() => [
    { id: "lines", label: "RFQ Lines", count: lines.length, icon: FileSearch },
    { id: "samples", label: "Samples", icon: FlaskConical },
  ], [lines.length]);

  useRegisterSubNav(subNavItems, activeTab, setActiveTab, sr?.code ?? "Supplier Request");

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.from("supplier_requests").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: user?.email || "",
    }).eq("id", id!).select().single();
    setSubmitting(false);
    if (error) { toast.error("Submit failed: " + error.message); return; }
    setSr((prev: any) => ({ ...prev, ...data }));
    setShowSubmitConfirm(false);
    toast.success("Supplier Request submitted");
  };

  const handleDelete = async () => {
    setDeleting(true);
    const lineIds = lines.map(l => l.id);
    if (lineIds.length > 0) {
      await supabase.from("rfq_responses").delete().in("rfq_line_id", lineIds);
      await supabase.from("rfq_lines").delete().in("id", lineIds);
    }
    await supabase.from("supplier_requests").delete().eq("id", id!);
    setDeleting(false);
    navigate(project ? `/projects/${project.id}` : "/rfqs");
    toast.success("Supplier Request deleted");
  };

  if (loading) return <div className={`${PAGE_WRAPPER} flex justify-center py-20`}><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!sr) return (
    <div className={`${PAGE_WRAPPER} text-center py-20`}>
      <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Supplier Request not found.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}><ArrowLeft className="w-3.5 h-3.5 mr-1" />Go back</Button>
    </div>
  );

  const sc = SR_STATUS_COLORS[sr.status] ?? "bg-muted text-muted-foreground border-border";
  const isDraft = sr.status === "draft";

  return (
    <div className={PAGE_WRAPPER}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 flex-wrap">
        <button type="button" onClick={() => navigate("/rfqs")} className="hover:text-foreground transition-colors">Supplier Requests</button>
        {project && (
          <>
            <span>/</span>
            <button type="button" onClick={() => navigate(`/projects/${project.id}`)} className="hover:text-foreground transition-colors">{project.name}</button>
          </>
        )}
        <span>/</span>
        <span className="text-foreground font-medium font-mono">{sr.code || "—"}</span>
      </div>

      {/* Header card */}
      <div className="bg-card rounded-xl border border-border px-5 py-4 space-y-2 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold tracking-tight">{sr.code || "—"}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium capitalize ${sc}`}>
                {(sr.status ?? "draft").replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-base font-normal text-muted-foreground mt-0.5 truncate">{sr.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDraft && (
              <Button size="sm" className="gap-1.5" disabled={lines.length === 0}
                title={lines.length === 0 ? "Add at least one line first" : undefined}
                onClick={() => setShowSubmitConfirm(true)}>
                Submit
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditHeader(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />Edit Header
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowExport(true)}>
                  <Download className="w-3.5 h-3.5 mr-2" />Export ToDo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImport(true)}>
                  <Upload className="w-3.5 h-3.5 mr-2" />Import Responses
                </DropdownMenuItem>
                {isDraft && (
                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
          {round && <span>Round: <span className="text-foreground">{round.label}</span></span>}
          <span>Due: <span className="text-foreground">{sr.due_date ? new Date(sr.due_date).toLocaleDateString() : "—"}</span></span>
          {currency && <span>Currency: <span className="font-mono text-foreground">{currency.code}</span></span>}
          <span>Created by <span className="text-foreground">{sr.created_by || "—"}</span></span>
          {sr.submitted_at && <span>Submitted: <span className="text-foreground">{new Date(sr.submitted_at).toLocaleDateString()}</span></span>}
        </p>
        {sr.description && <p className="text-sm text-muted-foreground border-t border-border pt-2">{sr.description}</p>}
      </div>

      {/* Tab content */}
      <div className="mt-2">
        {activeTab === "lines" && (
          <RFQLinesTab
            sr={sr}
            lines={lines}
            refData={refData}
            locked={!isDraft}
            onLinesRefresh={load}
            setOptions={setOptions}
            currencies={currencies}
          />
        )}
        {activeTab === "samples" && <RFQSamplesTab rfq={sr} />}
      </div>

      {/* Edit Header */}
      {showEditHeader && (
        <EditHeaderDialog sr={sr} onSaved={updated => { setSr(updated); setShowEditHeader(false); }} onClose={() => setShowEditHeader(false)} />
      )}

      {showExport && sr && (
        <ExportTodoDialog
          sr={sr}
          lines={lines}
          productMap={Object.fromEntries(refData.products.map(p => [p.id, p]))}
          colorMap={Object.fromEntries(refData.colors.map(c => [c.id, c]))}
          pcamMap={Object.fromEntries(refData.pcams.map(p => [p.id, p]))}
          stepMap={Object.fromEntries(refData.steps.map(s => [s.id, s]))}
          supplierMap={Object.fromEntries(refData.suppliers.map(s => [s.id, s]))}
          onClose={() => setShowExport(false)}
        />
      )}
      {showImport && sr && (
        <ImportResponsesDialog
          sr={sr}
          rfqLines={lines}
          currencies={currencies}
          onClose={() => setShowImport(false)}
          onImportSuccess={load}
        />
      )}

      {/* Submit confirm */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit {sr.code}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>This will be sent to <strong className="text-foreground">{new Set(lines.map(l => l.recipient_supplier_id)).size} supplier(s)</strong> across <strong className="text-foreground">{lines.length} line(s)</strong>.</p>
                <p>Once submitted, lines can no longer be added or removed.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}Submit
            </AlertDialogAction>
          </AlertFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Supplier Request?</AlertDialogTitle>
            <AlertDialogDescription>Lines and responses will be deleted too. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}Delete
            </AlertDialogAction>
          </AlertFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
