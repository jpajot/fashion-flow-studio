import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, GitCommit, Info, Trash2, Upload, X, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { PAGE_WRAPPER } from "@/lib/utils";
import RevisionContextModal from "@/components/RevisionContextModal";
import { detectTrackedFieldChanges, createProductRevision } from "@/lib/revisions";
import ColorwaySection from "@/components/ColorwaySection";
import StyleSizesSection from "@/components/StyleSizesSection";
import MoreVariationsSection from "@/components/MoreVariationsSection";
import ProductSuppliersTab from "@/components/ProductSuppliersTab";
import ProductBomsTab from "@/components/ProductBomsTab";
import ProductSamplesTab from "@/components/ProductSamplesTab";

const NONE = "__none__";

type LovType = { id: string; code: string; name: string | null };
type LovValue = { id: string; type_of_lov_id: string; name: string; depends_on_value_id: string | null };

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = id === "new";
  const qsType = new URLSearchParams(location.search).get("type") || "Product";

  const [product, setProduct] = useState<any>(isNew ? { type: qsType, name: "", description: "" } : null);
  const [loading, setLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState("details");
  const [colorwayCount, setColorwayCount] = useState(0);
  const [bomCount, setBomCount] = useState(0);

  const [sizeGrids, setSizeGrids] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [lovTypes, setLovTypes] = useState<LovType[]>([]);
  const [lovValues, setLovValues] = useState<LovValue[]>([]);
  const [styleSizes, setStyleSizes] = useState<any[]>([]);

  const [delOpen, setDelOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [revDiffs, setRevDiffs] = useState<any[]>([]);
  const [pendingSave, setPendingSave] = useState<any | null>(null);
  const [manualRevOpen, setManualRevOpen] = useState(false);
  const [revHistoryOpen, setRevHistoryOpen] = useState(false);
  const [revHistory, setRevHistory] = useState<any[]>([]);

  const productBeforeRef = useRef<any | null>(null);
  const saveTimer = useRef<any>(null);

  // ── data loading ──
  const loadProduct = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    const [p, cw, bm, ss] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).single(),
      supabase.from("product_colors").select("id").eq("product_id", id),
      supabase.from("boms").select("id").eq("product_id", id),
      supabase.from("style_sizes").select("*").eq("product_id", id),
    ]);
    setProduct(p.data ?? null);
    setColorwayCount((cw.data ?? []).length);
    setBomCount((bm.data ?? []).length);
    setStyleSizes(ss.data ?? []);
    setLoading(false);
  }, [id, isNew]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  useEffect(() => {
    (async () => {
      const [sg, prj, lt, lv] = await Promise.all([
        supabase.from("size_grids").select("id, name").order("name"),
        supabase.from("projects").select("id, name").order("name"),
        supabase.from("type_of_lov").select("*"),
        supabase.from("list_of_values").select("*").order("name"),
      ]);
      setSizeGrids(sg.data ?? []);
      setProjects(prj.data ?? []);
      setLovTypes((lt.data ?? []) as LovType[]);
      setLovValues((lv.data ?? []) as LovValue[]);
    })();
  }, []);

  // ── sub-nav ──
  const subNavItems = useMemo(
    () => [
      { id: "details", label: "Details" },
      { id: "colorways", label: "Colorways", count: colorwayCount },
      { id: "sizes", label: "Sizes" },
      { id: "more", label: "More Variations" },
      { id: "suppliers", label: "Suppliers" },
      { id: "boms", label: "BOMs", count: bomCount },
      { id: "samples", label: "Samples" },
    ],
    [colorwayCount, bomCount],
  );
  const pageTitle = isNew
    ? `New ${qsType}`
    : product ? `${product.code || ""} ${product.name || ""}`.trim() : "Product";
  useRegisterSubNav(isNew ? [] : subNavItems, activeTab, setActiveTab, pageTitle);

  // ── LOV helpers ──
  const lovTypeByCode = useMemo(() => Object.fromEntries(lovTypes.map((t) => [t.code, t])), [lovTypes]);
  const lovValuesByTypeCode = useCallback(
    (typeCode: string, dependsOnValueId?: string | null): LovValue[] => {
      const t = lovTypeByCode[typeCode];
      if (!t) return [];
      return lovValues.filter(
        (v) => v.type_of_lov_id === t.id && (dependsOnValueId == null || v.depends_on_value_id === dependsOnValueId),
      );
    },
    [lovTypeByCode, lovValues],
  );
  // Resolve an LOV value by code+name (used to chain Category → SubCategory by value name)
  const lovValueByName = useCallback(
    (typeCode: string, name: string | null | undefined) => {
      if (!name) return null;
      const t = lovTypeByCode[typeCode];
      if (!t) return null;
      return lovValues.find((v) => v.type_of_lov_id === t.id && v.name === name) || null;
    },
    [lovTypeByCode, lovValues],
  );

  const entityValue = useMemo(
    () => lovValueByName("Entities", product?.type),
    [lovValueByName, product?.type],
  );
  const typeOptions = useMemo(
    () => lovValuesByTypeCode("EntityTypes", entityValue?.id),
    [lovValuesByTypeCode, entityValue?.id],
  );
  const subTypeOptions = useMemo(() => lovValuesByTypeCode("Entity Sub-Types"), [lovValuesByTypeCode]);
  const categoryOptions = useMemo(() => {
    const dep = lovValueByName("EntityTypes", product?.type);
    return lovValuesByTypeCode("Category", dep?.id);
  }, [lovValuesByTypeCode, lovValueByName, product?.type]);
  const subCategoryOptions = useMemo(() => {
    const dep = lovValueByName("Category", product?.category);
    return lovValuesByTypeCode("Sub-Category", dep?.id);
  }, [lovValuesByTypeCode, lovValueByName, product?.category]);
  const customerNeedOptions = useMemo(() => lovValuesByTypeCode("Customer Need"), [lovValuesByTypeCode]);

  // ── auto-save with revision detection (existing only) ──
  const autoSave = useCallback(
    async (data: any) => {
      if (!data?.id) return;
      const before = productBeforeRef.current ?? data;
      const detect = await detectTrackedFieldChanges("product", before, data);
      if (detect.has_tracked_changes) {
        setRevDiffs(detect.field_diffs);
        setPendingSave({ data, detect });
        setRevOpen(true);
        return;
      }
      const { id: pid, ...fields } = data;
      const { error } = await supabase.from("products").update(fields).eq("id", pid);
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      productBeforeRef.current = null;
    },
    [toast],
  );

  const updateField = useCallback(
    (field: string, value: any) => {
      setProduct((prev: any) => {
        if (!prev) return prev;
        if (productBeforeRef.current == null && !isNew) productBeforeRef.current = { ...prev };
        const next = { ...prev, [field]: value };
        // category change resets sub_category + customer_need
        if (field === "category") {
          next.sub_category = null;
        }
        if (field === "type") {
          next.category = null;
          next.sub_category = null;
        }

        if (!isNew) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => autoSave(next), 800);
        }
        return next;
      });
    },
    [autoSave, isNew],
  );

  // ── size grid change handler (rebuild style_sizes) ──
  const handleSizeGridChange = async (newGridId: string | null) => {
    const oldGridId = product?.size_grid_id;
    updateField("size_grid_id", newGridId);
    if (isNew || oldGridId === newGridId) return;
    if (styleSizes.length > 0) {
      await supabase.from("style_sizes").delete().eq("product_id", id);
    }
    if (newGridId) {
      const { data: gridSizes } = await supabase
        .from("size_grid_sizes")
        .select("size_id, sort_order")
        .eq("size_grid_id", newGridId)
        .order("sort_order");
      if (gridSizes?.length) {
        await supabase.from("style_sizes").insert(
          gridSizes.map((g) => ({
            product_id: id,
            size_id: g.size_id,
            sort_order: g.sort_order,
            is_active: true,
          })),
        );
      }
    }
    const { data: ss } = await supabase.from("style_sizes").select("*").eq("product_id", id);
    setStyleSizes(ss ?? []);
  };

  // ── revision confirm ──
  const handleRevConfirm = async (ctx: string) => {
    if (!pendingSave) return;
    const { data, detect } = pendingSave;
    const { id: pid, ...fields } = data;
    const { error } = await supabase.from("products").update(fields).eq("id", pid);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    await createProductRevision({
      product_id: pid,
      target_type: "product",
      target_id: pid,
      revision_context: ctx,
      before_snapshot: detect.before_snapshot,
      after_snapshot: detect.after_snapshot,
      field_diffs: detect.field_diffs,
      triggered_by: user?.email || "system",
    });
    productBeforeRef.current = null;
    setPendingSave(null);
    setRevOpen(false);
    toast({ title: "Revision recorded" });
  };

  // ── manual "New Revision" ──
  const handleManualRevConfirm = async (ctx: string) => {
    if (!product?.id) return;
    await createProductRevision({
      product_id: product.id,
      target_type: "product",
      target_id: product.id,
      revision_context: ctx,
      before_snapshot: product,
      after_snapshot: product,
      field_diffs: [],
      triggered_by: user?.email || "system",
    });
    setManualRevOpen(false);
    toast({ title: "Revision created" });
  };

  // ── revision history ──
  const openRevHistory = async () => {
    if (!product?.id) return;
    const { data } = await supabase
      .from("product_revisions")
      .select("*")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false });
    setRevHistory(data ?? []);
    setRevHistoryOpen(true);
  };

  // ── create flow ──
  const handleCreate = async () => {
    if (!product?.name?.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const { data: codeData, error: codeErr } = await supabase.rpc("generate_code", {
      p_entity_name: "Product",
      p_entity_type: product.type || "Product",
    });
    if (codeErr) toast({ title: "Code generation failed", description: codeErr.message });
    const payload: any = { ...product, code: product.code || codeData || null, created_by: user?.email };
    delete payload.id;
    const { data, error } = await supabase.from("products").insert(payload).select("id").single();
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Created" });
    await new Promise((r) => setTimeout(r, 100));
    navigate(`/products/${data.id}`);
  };

  // ── delete ──
  const handleDelete = async () => {
    if (!product?.id) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    navigate(product.type === "Material" ? "/materials" : "/list-view");
  };

  // ── image management ──
  const updateImages = (next: string[]) => updateField("images", next);
  const removeImage = (i: number) => updateImages(((product?.images || []) as string[]).filter((_: any, idx: number) => idx !== i));
  const setMain = (i: number) => {
    const imgs = [...((product?.images || []) as string[])];
    const [chosen] = imgs.splice(i, 1);
    imgs.unshift(chosen);
    updateImages(imgs);
  };
  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !product?.id) return;
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${product.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        continue;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    if (urls.length) updateImages([...((product?.images || []) as string[]), ...urls]);
  };

  if (loading) return <div className={PAGE_WRAPPER}>Loading…</div>;
  if (!isNew && !product) return <div className={PAGE_WRAPPER}>Not found</div>;

  return (
    <div className={`${PAGE_WRAPPER} space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mt-1"
            onClick={() => navigate(product?.type === "Material" ? "/materials" : "/list-view")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{pageTitle || "Untitled"}</h1>
            {!isNew && product?.type && <Badge variant="outline" className="mt-1">{product.type}</Badge>}
          </div>
        </div>
        {!isNew && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setManualRevOpen(true)}>
              <GitCommit className="h-4 w-4 mr-2" /> New Revision
            </Button>
            <Button variant="outline" size="sm" onClick={openRevHistory}>
              <Info className="h-4 w-4 mr-2" /> History
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDelOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4">
          {/* Image panel */}
          <div className="space-y-2 lg:sticky lg:top-4 self-start">
            <Card className="overflow-hidden relative aspect-square">
              {(product?.images?.[0]) ? (
                <>
                  <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                  <Badge className="absolute top-2 left-2">Main</Badge>
                </>
              ) : (
                <div className="w-full h-full bg-muted grid place-items-center text-muted-foreground text-sm">
                  No image
                </div>
              )}
            </Card>
            {Array.isArray(product?.images) && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-1">
                {product.images.slice(1).map((src: string, idx: number) => (
                  <div key={idx} className="relative aspect-square group">
                    <img src={src} alt="" className="w-full h-full object-cover rounded" />
                    <button
                      onClick={() => setMain(idx + 1)}
                      className="absolute inset-0 bg-black/0 hover:bg-black/40 grid place-items-center opacity-0 hover:opacity-100 transition rounded"
                      title="Set as main"
                    >
                      <Star className="h-4 w-4 text-white" />
                    </button>
                    <button
                      onClick={() => removeImage(idx + 1)}
                      className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {product?.images?.length > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => removeImage(0)}
              >
                Remove main
              </button>
            )}
            {!isNew && (
              <label className="flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed rounded-md py-3 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4" /> Upload images
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
              </label>
            )}
          </div>

          {/* Fields panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Code</Label>
              <Input
                value={product?.code || ""}
                onChange={(e) => updateField("code", e.target.value)}
                placeholder={isNew ? "Auto-generated on creation" : ""}
              />
            </div>
            {typeOptions.length > 0 && (
              <div>
                <Label>Type</Label>
                <Select value={product?.sub_entity_type_id || NONE} onValueChange={(v) => updateField("sub_entity_type_id", v === NONE ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {typeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Name *</Label>
              <Input value={product?.name || ""} onChange={(e) => updateField("name", e.target.value)} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={product?.category || NONE} onValueChange={(v) => updateField("category", v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {categoryOptions.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-Category</Label>
              <Select
                value={product?.sub_category || NONE}
                onValueChange={(v) => updateField("sub_category", v === NONE ? null : v)}
                disabled={!product?.category}
              >
                <SelectTrigger><SelectValue placeholder={product?.category ? "Select" : "Pick a category first"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {subCategoryOptions.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {subTypeOptions.length > 0 && (
              <div>
                <Label>Sub-type</Label>
                <Select value={product?.sub_type || NONE} onValueChange={(v) => updateField("sub_type", v === NONE ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {subTypeOptions.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {product?.type === "Product" && (
              <div>
                <Label>Customer Need</Label>
                <Select value={product?.customer_need || NONE} onValueChange={(v) => updateField("customer_need", v === NONE ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {customerNeedOptions.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Size Grid</Label>
              <Select
                value={product?.size_grid_id || NONE}
                onValueChange={(v) => handleSizeGridChange(v === NONE ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {sizeGrids.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Creation Project</Label>
              <Select value={product?.creation_project_id || NONE} onValueChange={(v) => updateField("creation_project_id", v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Linked Projects</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {((product?.linked_project_ids || []) as string[]).map((pid) => {
                  const p = projects.find((x) => x.id === pid);
                  return (
                    <Badge key={pid} variant="secondary" className="gap-1">
                      {p?.name || pid}
                      <button
                        onClick={() =>
                          updateField("linked_project_ids", (product.linked_project_ids || []).filter((x: string) => x !== pid))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <Select
                value=""
                onValueChange={(v) => {
                  if (!v) return;
                  const cur = (product?.linked_project_ids || []) as string[];
                  if (!cur.includes(v)) updateField("linked_project_ids", [...cur, v]);
                }}
              >
                <SelectTrigger><SelectValue placeholder="+ Add project" /></SelectTrigger>
                <SelectContent>
                  {projects.filter((p) => !(product?.linked_project_ids || []).includes(p.id)).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={product?.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                rows={4}
              />
            </div>
            {isNew && (
              <div className="sm:col-span-2 flex justify-end pt-2">
                <Button onClick={handleCreate}>Create {qsType}</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {!isNew && activeTab === "colorways" && (
        <ColorwaySection
          productId={product.id}
          product={product}
          styleSizes={styleSizes}
          projects={projects}
          onCountChange={setColorwayCount}
        />
      )}
      {!isNew && activeTab === "sizes" && (
        <StyleSizesSection productId={product.id} sizeGridName={sizeGrids.find((g) => g.id === product?.size_grid_id)?.name} />
      )}
      {!isNew && activeTab === "more" && <MoreVariationsSection productId={product.id} />}
      {!isNew && activeTab === "suppliers" && <ProductSuppliersTab productId={product.id} />}
      {!isNew && activeTab === "boms" && <ProductBomsTab productId={product.id} />}
      {!isNew && activeTab === "samples" && <ProductSamplesTab productId={product.id} />}

      {/* Modals */}
      <RevisionContextModal
        open={revOpen}
        onOpenChange={setRevOpen}
        fieldDiffs={revDiffs}
        onConfirm={handleRevConfirm}
        onCancel={() => {
          setPendingSave(null);
          loadProduct();
        }}
      />
      <RevisionContextModal
        open={manualRevOpen}
        onOpenChange={setManualRevOpen}
        fieldDiffs={[]}
        onConfirm={handleManualRevConfirm}
      />

      <Dialog open={revHistoryOpen} onOpenChange={setRevHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Revision History</DialogTitle></DialogHeader>
          {revHistory.length === 0 ? (
            <div className="text-muted-foreground text-sm py-4 text-center">No revisions yet</div>
          ) : (
            <div className="space-y-2">
              {revHistory.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge>{r.revision_code}</Badge>
                      {r.is_current && <Badge variant="outline">current</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(r.created_at).toLocaleString()} · {r.created_by}
                      </span>
                    </div>
                    <div className="text-sm">{r.revision_context || <span className="text-muted-foreground">No context</span>}</div>
                    {Array.isArray(r.field_diffs) && r.field_diffs.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {r.field_diffs.map((d: any) => d.label).join(", ")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {product?.type?.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
