import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { LayoutGrid, List as ListIcon, Plus, Shirt, Palette, Layers, RefreshCw, Filter, Pin, PinOff, Pencil } from "lucide-react";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { PAGE_WRAPPER } from "@/lib/utils";
import { getPinnedItems, togglePin as togglePinItem, isPinned as checkPinned } from "@/lib/pinned";
import QuickFiltersPanel, { applyQuickFilters, QFField, QuickFilter } from "@/components/QuickFiltersPanel";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import DataTable from "@/components/shared/DataTable";
import GalleryView from "@/components/GalleryView";

type Props = {
  type: "Product" | "Material";
  title: string;
  newButtonLabel: string;
  pagePath: string; // "/list-view" or "/materials"
};

function renderColorwaySwatch(
  cv: any,
  product: any,
  techColors: any[],
  commColors: any[],
  size: "sm" | "md" = "sm"
) {
  const dim = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const commColor = commColors.find((c: any) => c.id === cv.linked_color_id);
  const useProductImage = !cv.image_url && product?.images?.[0];
  const displayImage = cv.image_url || product?.images?.[0] || null;

  const linkedHexes = (() => {
    if (!commColor || commColor.sub_type?.toLowerCase() !== "combined") return null;
    const ids: string[] = commColor.linked_technical_color_ids ?? [];
    const hexes = ids.map((id: string) => techColors.find((t: any) => t.id === id)?.hex).filter(Boolean);
    return hexes.length > 1 ? hexes : null;
  })();

  return (
    <div className={`${dim} rounded border border-border shrink-0 relative overflow-hidden`}>
      {displayImage ? (
        <img src={displayImage} alt={cv.color_name} className="w-full h-full object-contain" />
      ) : linkedHexes ? (
        <div className="w-full h-full flex">
          {linkedHexes.map((h: string, i: number) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
        </div>
      ) : (
        <div className="w-full h-full" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
      )}
      {useProductImage && cv.color_hex && (
        <div className="absolute bottom-0.5 left-0.5 w-3 h-3 rounded-sm" style={{ backgroundColor: cv.color_hex }} />
      )}
    </div>
  );
}




async function applyViewConfig(
  viewId: string,
  setColumnIds: (ids: string[] | null) => void,
  setViewFilters: (f: any[]) => void,
  setThumbSize?: (s: string) => void,
) {
  if (viewId === "default") {
    setColumnIds(null);
    setViewFilters([]);
    setThumbSize?.("md");
    return;
  }
  const { data } = await supabase
    .from("list_view_configs")
    .select("*")
    .eq("id", viewId)
    .maybeSingle();
  if (data) {
    const ids = (data as any).column_ids;
    setColumnIds(Array.isArray(ids) && ids.length > 0 ? ids : null);
    setViewFilters((data as any).filters_config?.filters ?? []);
    if (setThumbSize && (data as any).thumb_size) setThumbSize((data as any).thumb_size);
  }
}

export default function ProductsListPage({ type, title, newButtonLabel, pagePath }: Props) {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const storageKey = type === "Product" ? "products" : "materials";
  const [activeSection, setActiveSection] = useState<"styles" | "colorways" | "variations">("styles");

  const [products, setProducts] = useState<any[]>([]);
  const [colorways, setColorways] = useState<any[]>([]);
  const [variations, setVariations] = useState<any[]>([]);
  const [techColors, setTechColors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [stylesView, setStylesView] = useState<"grid" | "list">(
    () => (localStorage.getItem(`${storageKey}_styles_view`) as any) || "grid",
  );
  const [colorwaysView, setColorwaysView] = useState<"grid" | "list">(
    () => (localStorage.getItem(`${storageKey}_colorways_view`) as any) || "list",
  );
  useEffect(() => { localStorage.setItem(`${storageKey}_styles_view`, stylesView); }, [storageKey, stylesView]);
  useEffect(() => { localStorage.setItem(`${storageKey}_colorways_view`, colorwaysView); }, [storageKey, colorwaysView]);

  const [styleQF, setStyleQF] = useState<QuickFilter[]>([]);
  const [colorwayQF, setColorwayQF] = useState<QuickFilter[]>([]);
  const [variationQF, setVariationQF] = useState<QuickFilter[]>([]);
  const [showQF, setShowQF] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [stylesActiveViewId, setStylesActiveViewId] = useState("default");
  const [colorwaysActiveViewId, setColorwaysActiveViewId] = useState("default");
  const [variationsActiveViewId, setVariationsActiveViewId] = useState("default");

  const [stylesVisibleColumnIds, setStylesVisibleColumnIds] = useState<string[] | null>(null);
  const [colorwaysVisibleColumnIds, setColorwaysVisibleColumnIds] = useState<string[] | null>(null);
  const [variationsVisibleColumnIds, setVariationsVisibleColumnIds] = useState<string[] | null>(null);
  const [stylesViewFilters, setStylesViewFilters] = useState<any[]>([]);
  const [colorwaysViewFilters, setColorwaysViewFilters] = useState<any[]>([]);
  const [variationsViewFilters, setVariationsViewFilters] = useState<any[]>([]);
  const [stylesThumbSize, setStylesThumbSize] = useState("md");

  useEffect(() => {
    applyViewConfig(stylesActiveViewId, setStylesVisibleColumnIds, setStylesViewFilters, setStylesThumbSize);
  }, [stylesActiveViewId]);
  useEffect(() => {
    applyViewConfig(colorwaysActiveViewId, setColorwaysVisibleColumnIds, setColorwaysViewFilters);
  }, [colorwaysActiveViewId]);
  useEffect(() => {
    applyViewConfig(variationsActiveViewId, setVariationsVisibleColumnIds, setVariationsViewFilters);
  }, [variationsActiveViewId]);

  const styleTableColumns = useMemo(() => [
    { id: "image", label: "Image" },
    { id: "name", label: "Name" },
    { id: "category", label: "Category" },
    { id: "sub_category", label: "Sub-Category" },
    { id: "customer_need", label: "Customer Need" },
    { id: "colorways", label: "Colorways" },
    { id: "count", label: "# Colorways" },
  ], []);
  const colorwayTableColumns = useMemo(() => [
    { id: "product_image", label: "Product Image" },
    { id: "product_name", label: "Product" },
    { id: "category", label: "Category" },
    { id: "swatch", label: "Swatch" },
    { id: "color_name", label: "Colorway" },
    { id: "colorway_code", label: "Code" },
    { id: "commercial", label: "Commercial" },
    { id: "technical", label: "Technical" },
    { id: "project", label: "Project" },
  ], []);
  const variationTableColumns = useMemo(() => [
    { id: "product_image", label: "Product Image" },
    { id: "product_name", label: "Product" },
    { id: "category", label: "Category" },
    { id: "swatch", label: "Swatch" },
    { id: "colorway_name", label: "Colorway" },
    { id: "colorway_code", label: "Code" },
    { id: "sequence", label: "Sequence" },
    { id: "name", label: "Variation" },
    { id: "pack_code", label: "Pack Code" },
    { id: "variant", label: "Variant" },
    { id: "project", label: "Project" },
  ], []);

  // pin state
  const [pinned, setPinned] = useState(checkPinned(getPinnedItems(), pagePath));
  useEffect(() => {
    const handler = () => setPinned(checkPinned(getPinnedItems(), pagePath));
    window.addEventListener("pinned-items-changed", handler);
    return () => window.removeEventListener("pinned-items-changed", handler);
  }, [pagePath]);

  useEffect(() => {
    (async () => {
      const [p, cw, mv, tc, pr] = await Promise.all([
        supabase.from("products").select("*").eq("type", type).order("code"),
        supabase.from("product_colors").select("*").order("created_at", { ascending: false }),
        supabase.from("product_color_and_more").select("*").order("created_at", { ascending: false }),
        supabase.from("technical_colors").select("id,code,name,hex").order("code"),
        supabase.from("projects").select("id,name").order("name"),
      ]);
      setProducts((p.data ?? []) as any[]);
      setColorways((cw.data ?? []) as any[]);
      setVariations((mv.data ?? []) as any[]);
      setTechColors((tc.data ?? []) as any[]);
      setProjects((pr.data ?? []) as any[]);
    })();
  }, [type, refresh]);

  // sub-nav registration
  const productIdSet = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const colorwaysForType = useMemo(() => colorways.filter((c) => productIdSet.has(c.product_id)), [colorways, productIdSet]);
  const variationsForType = useMemo(() => {
    const cwIds = new Set(colorwaysForType.map((c) => c.id));
    return variations.filter((v) => cwIds.has(v.product_color_id));
  }, [variations, colorwaysForType]);

  useRegisterSubNav(
    [
      { id: "styles", label: type === "Material" ? "Materials" : "Styles", count: products.length, icon: Shirt },
      { id: "colorways", label: "Colorways", count: colorwaysForType.length, icon: Palette },
      { id: "variations", label: "More Variations", count: variationsForType.length, icon: Layers },
    ],
    activeSection,
    (id) => setActiveSection(id as any),
    title,
  );

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const cwById = useMemo(() => Object.fromEntries(colorwaysForType.map((c) => [c.id, c])), [colorwaysForType]);
  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const initials = (name: string) => (name || "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  // ── filtering ──
  const stylesFields: QFField[] = useMemo(() => [
    { id: "name", label: "Name", getValue: (p) => p.name },
    { id: "category", label: "Category", getValue: (p) => p.category },
    { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category },
    { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need },
  ], []);

  const colorwayFields: QFField[] = useMemo(() => [
    { id: "color_name", label: "Name", getValue: (c) => c.color_name },
    { id: "colorway_code", label: "Code", getValue: (c) => c.colorway_code },
    { id: "product_name", label: "Product", getValue: (c) => productById[c.product_id]?.name },
    { id: "category", label: "Category", getValue: (c) => productById[c.product_id]?.category },
  ], [productById]);

  const variationFields: QFField[] = useMemo(() => [
    { id: "name", label: "Name", getValue: (v) => v.name },
    { id: "sequence", label: "Sequence", getValue: (v) => v.sequence },
    { id: "pack_code", label: "Pack Code", getValue: (v) => v.pack_code },
    { id: "variant", label: "Variant", getValue: (v) => v.variant },
    { id: "product_name", label: "Product", getValue: (v) => productById[cwById[v.product_color_id]?.product_id]?.name },
    { id: "colorway_name", label: "Colorway", getValue: (v) => cwById[v.product_color_id]?.color_name },
  ], [productById, cwById]);

  const filteredStyles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (q) list = list.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q));
    list = applyQuickFilters(list, stylesFields, styleQF);
    if (stylesViewFilters.length > 0) list = applyQuickFilters(list, stylesFields, stylesViewFilters as any);
    return list;
  }, [products, search, styleQF, stylesFields, stylesViewFilters]);

  const filteredColorways = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = colorwaysForType;
    if (q) list = list.filter((c) => (c.color_name || "").toLowerCase().includes(q) || (c.colorway_code || "").toLowerCase().includes(q));
    list = applyQuickFilters(list, colorwayFields, colorwayQF);
    if (colorwaysViewFilters.length > 0) list = applyQuickFilters(list, colorwayFields, colorwaysViewFilters as any);
    return list;
  }, [colorwaysForType, search, colorwayQF, colorwayFields, colorwaysViewFilters]);

  const filteredVariations = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = variationsForType;
    if (q) list = list.filter((v) => (v.name || "").toLowerCase().includes(q) || (v.sequence || "").toLowerCase().includes(q));
    list = applyQuickFilters(list, variationFields, variationQF);
    if (variationsViewFilters.length > 0) list = applyQuickFilters(list, variationFields, variationsViewFilters as any);
    return list;
  }, [variationsForType, search, variationQF, variationFields, variationsViewFilters]);

  const cwByProduct = useMemo(() => {
    const m: Record<string, any[]> = {};
    colorwaysForType.forEach((c) => { (m[c.product_id] = m[c.product_id] || []).push(c); });
    return m;
  }, [colorwaysForType]);

  // ── column specs (drive both view-visibility and rendering) ──
  type ColSpec = { id: string; label: string; className?: string; render: (row: any) => ReactNode };

  const allStyleColumns: ColSpec[] = useMemo(() => [
    { id: "image", label: "", className: "w-12", render: (p) => {
      const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
      return img ? <img src={img} className="h-10 w-10 object-cover rounded" alt="" />
        : <div className="h-10 w-10 bg-muted rounded grid place-items-center text-xs">{initials(p.name)}</div>;
    }},
    { id: "name", label: "Name", render: (p) => (
      <><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground font-mono">{p.code}</div></>
    )},
    { id: "category", label: "Category", render: (p) => p.category || "—" },
    { id: "sub_category", label: "Sub-Category", render: (p) => p.sub_category || "—" },
    { id: "customer_need", label: "Customer Need", render: (p) => p.customer_need || "—" },
    { id: "colorways", label: "Colorways", render: (p) => {
      const cws = (cwByProduct[p.id] || []).slice(0, 4);
      return <div className="flex gap-1">{cws.map((c) => (
        <div key={c.id} className="h-5 w-5 rounded border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} title={c.color_name} />
      ))}</div>;
    }},
    { id: "count", label: "#", className: "text-right", render: (p) => (
      <span className="text-muted-foreground text-xs">{cwByProduct[p.id]?.length || 0}</span>
    )},
  ], [cwByProduct]);

  const allColorwayColumns: ColSpec[] = useMemo(() => [
    { id: "product_image", label: "", className: "w-12", render: (c) => {
      const prod = productById[c.product_id];
      const prodImg = Array.isArray(prod?.images) && prod.images[0];
      return prodImg ? <img src={prodImg} className="h-10 w-10 object-cover rounded" alt="" />
        : <div className="h-10 w-10 bg-muted rounded" />;
    }},
    { id: "product_name", label: "Product", render: (c) => <span className="font-medium">{productById[c.product_id]?.name || "—"}</span> },
    { id: "category", label: "Category", render: (c) => <span className="text-xs">{productById[c.product_id]?.category || "—"}</span> },
    { id: "swatch", label: "", className: "w-12", render: (c) => (
      c.image_url ? <img src={c.image_url} className="h-7 w-7 rounded border object-cover" alt="" />
        : <div className="h-7 w-7 rounded border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
    )},
    { id: "color_name", label: "Colorway", render: (c) => c.color_name },
    { id: "colorway_code", label: "Code", render: (c) => <span className="font-mono text-xs">{c.colorway_code || "—"}</span> },
    { id: "commercial", label: "Commercial", render: (c) => (
      c.linked_color_id ? <span className="text-xs">linked</span>
        : <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">⚠ none</Badge>
    )},
    { id: "technical", label: "Technical", render: (c) => <span className="text-xs">{c.linked_tech_color_id ? "linked" : "—"}</span> },
    { id: "project", label: "Project", render: (c) => {
      const proj = c.creation_project_id ? projectById[c.creation_project_id] : null;
      return <span className="text-xs">{proj?.name || "—"}</span>;
    }},
  ], [productById, projectById]);

  const allVariationColumns: ColSpec[] = useMemo(() => [
    { id: "product_image", label: "", className: "w-12", render: (v) => {
      const cw = cwById[v.product_color_id];
      const prod = cw ? productById[cw.product_id] : null;
      const prodImg = Array.isArray(prod?.images) && prod.images[0];
      return prodImg ? <img src={prodImg} className="h-10 w-10 object-cover rounded" alt="" />
        : <div className="h-10 w-10 bg-muted rounded" />;
    }},
    { id: "product_name", label: "Product", render: (v) => {
      const cw = cwById[v.product_color_id];
      const prod = cw ? productById[cw.product_id] : null;
      return <span className="font-medium">{prod?.name || "—"}</span>;
    }},
    { id: "category", label: "Category", render: (v) => {
      const cw = cwById[v.product_color_id];
      const prod = cw ? productById[cw.product_id] : null;
      return <span className="text-xs">{prod?.category || "—"}</span>;
    }},
    { id: "swatch", label: "", className: "w-12", render: (v) => {
      const cw = cwById[v.product_color_id];
      return <div className="h-7 w-7 rounded border" style={{ backgroundColor: cw?.color_hex || "#e5e7eb" }} />;
    }},
    { id: "colorway_name", label: "Colorway", render: (v) => cwById[v.product_color_id]?.color_name || "—" },
    { id: "colorway_code", label: "Code", render: (v) => <span className="font-mono text-xs">{cwById[v.product_color_id]?.colorway_code || "—"}</span> },
    { id: "sequence", label: "Sequence", render: (v) => <span className="font-mono text-xs">{v.sequence || "—"}</span> },
    { id: "name", label: "Variation", render: (v) => v.name || "—" },
    { id: "pack_code", label: "Pack Code", render: (v) => <span className="font-mono text-xs">{v.pack_code || "—"}</span> },
    { id: "variant", label: "Variant", render: (v) => v.variant || "—" },
    { id: "project", label: "Project", render: (v) => {
      const cw = cwById[v.product_color_id];
      const proj = cw?.creation_project_id ? projectById[cw.creation_project_id] : null;
      return <span className="text-xs">{proj?.name || "—"}</span>;
    }},
  ], [cwById, productById, projectById]);

  const visibleStyleColumns = useMemo(
    () => stylesVisibleColumnIds ? allStyleColumns.filter(c => stylesVisibleColumnIds.includes(c.id)) : allStyleColumns,
    [allStyleColumns, stylesVisibleColumnIds],
  );
  const visibleColorwayColumns = useMemo(
    () => colorwaysVisibleColumnIds ? allColorwayColumns.filter(c => colorwaysVisibleColumnIds.includes(c.id)) : allColorwayColumns,
    [allColorwayColumns, colorwaysVisibleColumnIds],
  );
  const visibleVariationColumns = useMemo(
    () => variationsVisibleColumnIds ? allVariationColumns.filter(c => variationsVisibleColumnIds.includes(c.id)) : allVariationColumns,
    [allVariationColumns, variationsVisibleColumnIds],
  );

  


  // ── options drawer ──
  const handleTogglePin = () => {
    togglePinItem(pagePath, title);
    setPinned(checkPinned(getPinnedItems(), pagePath));
  };

  useEffect(() => {
    const activeQF = activeSection === "styles" ? styleQF : activeSection === "colorways" ? colorwayQF : variationQF;
    const view = activeSection === "styles" ? stylesView : colorwaysView;
    const toggleView = () => {
      if (activeSection === "styles") setStylesView(stylesView === "grid" ? "list" : "grid");
      else if (activeSection === "colorways") setColorwaysView(colorwaysView === "grid" ? "list" : "grid");
    };

    const items: any[] = [];

    if (activeSection === "styles") {
      items.push({
        label: newButtonLabel,
        icon: Plus,
        onClick: () => navigate(`/products/new?type=${type}`),
        className: "text-primary hover:bg-primary/10",
      });
      items.push({ divider: true });
    }

    items.push({
      label: "Quick Filters",
      icon: Filter,
      onClick: () => { setShowQF((v) => !v); setShowViewMenu(false); },
      badge: activeQF.length > 0 ? activeQF.length : undefined,
    });

    items.push({
      label: "Manage Views",
      icon: Pencil,
      onClick: () => { setShowViewMenu((v) => !v); setShowQF(false); },
    });

    if (activeSection !== "variations") {
      items.push({
        label: view === "grid" ? "View: List" : "View: Grid",
        icon: view === "grid" ? ListIcon : LayoutGrid,
        onClick: toggleView,
      });
    }

    items.push({ divider: true });
    items.push({
      label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
      icon: pinned ? PinOff : Pin,
      onClick: handleTogglePin,
    });
    items.push({ divider: true });
    items.push({ label: "Refresh", icon: RefreshCw, onClick: () => setRefresh((r) => r + 1) });

    const viewPageKey =
      activeSection === "styles" ? "styles_list"
        : activeSection === "colorways" ? "styles_colorways_list"
        : "styles_variations_list";
    const viewAllFields =
      activeSection === "styles" ? styleTableColumns
        : activeSection === "colorways" ? colorwayTableColumns
        : variationTableColumns;
    const viewActiveId =
      activeSection === "styles" ? stylesActiveViewId
        : activeSection === "colorways" ? colorwaysActiveViewId
        : variationsActiveViewId;
    const setViewActiveId =
      activeSection === "styles" ? setStylesActiveViewId
        : activeSection === "colorways" ? setColorwaysActiveViewId
        : setVariationsActiveViewId;
    const currentViewType: "grid" | null =
      activeSection === "styles" ? (stylesView === "grid" ? "grid" : null)
        : activeSection === "colorways" ? (colorwaysView === "grid" ? "grid" : null)
        : null;

    const customContent = showQF ? (
      <div className="p-3 border-t">
        <QuickFiltersPanel
          fields={activeSection === "styles" ? stylesFields : activeSection === "colorways" ? colorwayFields : variationFields}
          rows={activeSection === "styles" ? products : activeSection === "colorways" ? colorwaysForType : variationsForType}
          activeFilters={activeQF}
          onApply={(f) => {
            if (activeSection === "styles") setStyleQF(f);
            else if (activeSection === "colorways") setColorwayQF(f);
            else setVariationQF(f);
          }}
        />
      </div>
    ) : showViewMenu ? (
      <ViewDrawerContent
        pageKey={viewPageKey}
        activeViewId={viewActiveId}
        onSelectView={setViewActiveId}
        allFields={viewAllFields}
        currentViewType={currentViewType}
      />
    ) : null;

    setOptions({ items, customContent });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, styleQF, colorwayQF, variationQF, stylesView, colorwaysView, pinned, showQF, showViewMenu, stylesActiveViewId, colorwaysActiveViewId, variationsActiveViewId, products, colorwaysForType, variationsForType]);

  // close panels when section changes
  useEffect(() => { setShowQF(false); setShowViewMenu(false); }, [activeSection]);

  return (
    <div className={`${PAGE_WRAPPER} space-y-4`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {activeSection === "styles" && `${filteredStyles.length} ${type === "Product" ? "products" : "materials"}`}
            {activeSection === "colorways" && `${filteredColorways.length} colorways`}
            {activeSection === "variations" && `${filteredVariations.length} variations`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56"
          />
          {activeSection === "styles" && (
            <Button size="sm" onClick={() => navigate(`/products/new?type=${type}`)}>
              <Plus className="h-4 w-4 mr-2" /> {newButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {/* STYLES SECTION */}
      {activeSection === "styles" && (
        filteredStyles.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Nothing here yet</CardContent></Card>
        ) : stylesView === "grid" ? (
          <GalleryView
            pageKey="styles_list"
            allFields={[
              { id: "name", label: "Name", getValue: (p) => p.name, render: (p) => <span className="font-medium text-sm">{p.name || "—"}</span> },
              { id: "code", label: "Code", getValue: (p) => p.code, render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code || "—"}</span> },
              { id: "category", label: "Category", getValue: (p) => p.category, render: (p) => p.category || "—" },
              { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category, render: (p) => p.sub_category || "—" },
              { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need, render: (p) => p.customer_need || "—" },
              { id: "colorways", label: "Colorways", getValue: (p) => cwByProduct[p.id]?.length, render: (p) => {
                const cws = (cwByProduct[p.id] || []).slice(0, 4);
                return <div className="flex gap-1">{cws.map((c) => (
                  <div key={c.id} className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                ))}</div>;
              }},
            ]}
            filterableFields={stylesFields as any}
            rows={filteredStyles}
            renderThumbnail={(p) => {
              const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
              return img
                ? <img src={img} alt={p.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-muted flex items-center justify-center text-2xl font-semibold text-muted-foreground/50">{initials(p.name)}</div>;
            }}
            onClickItem={(p) => navigate(`/products/${p.id}`)}
            activeViewId={stylesActiveViewId}
          />
        ) : (
          <DataTable
            columns={visibleStyleColumns.map((c) => ({
              ...c,
              width: ({ image: 60, name: 200, category: 140, sub_category: 150, customer_need: 160, colorways: 160, count: 60 } as Record<string, number>)[c.id] ?? 140,
            }))}
            rows={filteredStyles}
            fixedColumns={["image"]}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
          />
        )
      )}

      {/* COLORWAYS SECTION */}
      {activeSection === "colorways" && (
        filteredColorways.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No colorways</CardContent></Card>
        ) : colorwaysView === "grid" ? (
          <GalleryView
            pageKey="styles_colorways_list"
            allFields={[
              { id: "color_name", label: "Colorway", getValue: (c) => c.color_name, render: (c) => <span className="font-medium text-sm">{c.color_name || "—"}</span> },
              { id: "colorway_code", label: "Code", getValue: (c) => c.colorway_code, render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.colorway_code || "—"}</span> },
              { id: "product_name", label: "Product", getValue: (c) => productById[c.product_id]?.name, render: (c) => <span className="text-xs text-muted-foreground">{productById[c.product_id]?.name || "—"}</span> },
              { id: "category", label: "Category", getValue: (c) => productById[c.product_id]?.category, render: (c) => <span className="text-xs">{productById[c.product_id]?.category || "—"}</span> },
            ]}
            filterableFields={colorwayFields as any}
            rows={filteredColorways}
            renderThumbnail={(c) => {
              const prod = productById[c.product_id];
              const prodImg = Array.isArray(prod?.images) && prod.images[0];
              if (c.image_url) return <img src={c.image_url} className="w-full h-full object-cover" alt={c.color_name} />;
              if (prodImg) return (
                <>
                  <img src={prodImg} className="w-full h-full object-cover" alt="" />
                  <div className="absolute bottom-1 left-1 h-6 w-6 rounded border-2 border-white shadow" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                </>
              );
              return <div className="w-full h-full" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />;
            }}
            onClickItem={(c) => navigate(`/products/${c.product_id}`)}
            activeViewId={colorwaysActiveViewId}
          />
        ) : (
          <DataTable
            columns={visibleColorwayColumns.map((c) => ({
              ...c,
              width: ({ product_image: 60, product_name: 180, category: 140, swatch: 60, color_name: 160, colorway_code: 120, commercial: 140, technical: 120, project: 140 } as Record<string, number>)[c.id] ?? 140,
            }))}
            rows={filteredColorways}
            fixedColumns={["product_image"]}
            onRowClick={(c) => navigate(`/products/${c.product_id}`)}
          />
        )
      )}

      {/* VARIATIONS SECTION */}
      {activeSection === "variations" && (
        filteredVariations.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No variations</CardContent></Card>
        ) : (
          <DataTable
            columns={visibleVariationColumns.map((c) => ({
              ...c,
              width: ({ product_image: 60, product_name: 180, category: 140, swatch: 60, colorway_name: 150, colorway_code: 120, sequence: 100, name: 160, pack_code: 120, variant: 120, project: 140 } as Record<string, number>)[c.id] ?? 140,
            }))}
            rows={filteredVariations}
            fixedColumns={["product_image"]}
            onRowClick={(v) => {
              const cw = cwById[v.product_color_id];
              const prod = cw ? productById[cw.product_id] : null;
              if (prod) navigate(`/products/${prod.id}`);
            }}
          />
        )
      )}
    </div>
  );
}
