import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List as ListIcon, Plus, Shirt, Palette, Layers, RefreshCw, Filter, Pin, PinOff, Pencil } from "lucide-react";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { PAGE_WRAPPER } from "@/lib/utils";
import { getPinnedItems, togglePin as togglePinItem, isPinned as checkPinned } from "@/lib/pinned";
import QuickFiltersPanel, { applyQuickFilters, QFField, QuickFilter } from "@/components/QuickFiltersPanel";
import ViewDrawerContent from "@/components/ViewDrawerContent";

type Props = {
  type: "Product" | "Material";
  title: string;
  newButtonLabel: string;
  pagePath: string; // "/list-view" or "/materials"
};

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
    return applyQuickFilters(list, stylesFields, styleQF);
  }, [products, search, styleQF, stylesFields]);

  const filteredColorways = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = colorwaysForType;
    if (q) list = list.filter((c) => (c.color_name || "").toLowerCase().includes(q) || (c.colorway_code || "").toLowerCase().includes(q));
    return applyQuickFilters(list, colorwayFields, colorwayQF);
  }, [colorwaysForType, search, colorwayQF, colorwayFields]);

  const filteredVariations = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = variationsForType;
    if (q) list = list.filter((v) => (v.name || "").toLowerCase().includes(q) || (v.sequence || "").toLowerCase().includes(q));
    return applyQuickFilters(list, variationFields, variationQF);
  }, [variationsForType, search, variationQF, variationFields]);

  const cwByProduct = useMemo(() => {
    const m: Record<string, any[]> = {};
    colorwaysForType.forEach((c) => { (m[c.product_id] = m[c.product_id] || []).push(c); });
    return m;
  }, [colorwaysForType]);

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
      onClick: () => setShowQF((v) => !v),
      badge: activeQF.length > 0 ? activeQF.length : undefined,
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
    ) : null;

    setOptions({ items, customContent });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, styleQF, colorwayQF, variationQF, stylesView, colorwaysView, pinned, showQF, products, colorwaysForType, variationsForType]);

  // close QF when section changes
  useEffect(() => { setShowQF(false); }, [activeSection]);

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredStyles.map((p) => {
              const cws = (cwByProduct[p.id] || []).slice(0, 4);
              const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
              return (
                <Card key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="overflow-hidden cursor-pointer hover:shadow-md transition">
                  <div className="aspect-square bg-muted grid place-items-center">
                    {img ? <img src={img} alt={p.name} className="w-full h-full object-cover" />
                      : <span className="text-3xl font-semibold text-muted-foreground/50">{initials(p.name)}</span>}
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <div className="font-semibold text-sm truncate">{p.name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{p.code || "—"}</div>
                    {p.category && <div className="text-xs text-muted-foreground truncate">{p.category}</div>}
                    {cws.length > 0 && (
                      <div className="flex gap-1 pt-1">
                        {cws.map((c) => (
                          <div key={c.id} className="h-4 w-4 rounded border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} title={c.color_name} />
                        ))}
                        {(cwByProduct[p.id]?.length || 0) > 4 && <span className="text-xs text-muted-foreground">+{(cwByProduct[p.id]?.length || 0) - 4}</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub-Category</TableHead>
                <TableHead>Customer Need</TableHead>
                <TableHead>Colorways</TableHead>
                <TableHead className="text-right">#</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredStyles.map((p) => {
                  const cws = cwByProduct[p.id] || [];
                  const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
                  return (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                      <TableCell>
                        {img ? <img src={img} className="h-10 w-10 object-cover rounded" alt="" />
                          : <div className="h-10 w-10 bg-muted rounded grid place-items-center text-xs">{initials(p.name)}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                      </TableCell>
                      <TableCell>{p.category || "—"}</TableCell>
                      <TableCell>{p.sub_category || "—"}</TableCell>
                      <TableCell>{p.customer_need || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {cws.slice(0, 4).map((c) => (
                            <div key={c.id} className="h-5 w-5 rounded border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} title={c.color_name} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">{cws.length}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )
      )}

      {/* COLORWAYS SECTION */}
      {activeSection === "colorways" && (
        filteredColorways.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No colorways</CardContent></Card>
        ) : colorwaysView === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredColorways.map((c) => {
              const prod = productById[c.product_id];
              const prodImg = Array.isArray(prod?.images) && prod.images[0];
              return (
                <Card
                  key={c.id}
                  onClick={() => navigate(`/products/${c.product_id}`)}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition"
                >
                  <div className="aspect-square bg-muted relative">
                    {c.image_url ? (
                      <img src={c.image_url} className="w-full h-full object-cover" alt={c.color_name} />
                    ) : prodImg ? (
                      <>
                        <img src={prodImg} className="w-full h-full object-cover" alt="" />
                        <div className="absolute bottom-1 left-1 h-6 w-6 rounded border-2 border-white shadow" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                      </>
                    ) : (
                      <div className="w-full h-full" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />
                    )}
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <div className="text-sm font-medium truncate">{c.color_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.colorway_code || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{prod?.name || "—"}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead>Colorway</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Commercial</TableHead>
                <TableHead>Technical</TableHead>
                <TableHead>Project</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredColorways.map((c) => {
                  const prod = productById[c.product_id];
                  const prodImg = Array.isArray(prod?.images) && prod.images[0];
                  const proj = c.creation_project_id ? projectById[c.creation_project_id] : null;
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/products/${c.product_id}`)}
                    >
                      <TableCell>
                        {prodImg ? <img src={prodImg} className="h-10 w-10 object-cover rounded" alt="" />
                          : <div className="h-10 w-10 bg-muted rounded" />}
                      </TableCell>
                      <TableCell className="font-medium">{prod?.name || "—"}</TableCell>
                      <TableCell className="text-xs">{prod?.category || "—"}</TableCell>
                      <TableCell>
                        {c.image_url ? <img src={c.image_url} className="h-7 w-7 rounded border object-cover" alt="" />
                          : <div className="h-7 w-7 rounded border" style={{ backgroundColor: c.color_hex || "#e5e7eb" }} />}
                      </TableCell>
                      <TableCell>{c.color_name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.colorway_code || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {c.linked_color_id ? "linked" : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">⚠ none</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{c.linked_tech_color_id ? "linked" : "—"}</TableCell>
                      <TableCell className="text-xs">{proj?.name || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )
      )}

      {/* VARIATIONS SECTION */}
      {activeSection === "variations" && (
        filteredVariations.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No variations</CardContent></Card>
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead>Colorway</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Sequence</TableHead>
                <TableHead>Variation</TableHead>
                <TableHead>Pack Code</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Project</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredVariations.map((v) => {
                  const cw = cwById[v.product_color_id];
                  const prod = cw ? productById[cw.product_id] : null;
                  const prodImg = Array.isArray(prod?.images) && prod.images[0];
                  const proj = cw?.creation_project_id ? projectById[cw.creation_project_id] : null;
                  return (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer"
                      onClick={() => prod && navigate(`/products/${prod.id}`)}
                    >
                      <TableCell>
                        {prodImg ? <img src={prodImg} className="h-10 w-10 object-cover rounded" alt="" />
                          : <div className="h-10 w-10 bg-muted rounded" />}
                      </TableCell>
                      <TableCell className="font-medium">{prod?.name || "—"}</TableCell>
                      <TableCell className="text-xs">{prod?.category || "—"}</TableCell>
                      <TableCell>
                        <div className="h-7 w-7 rounded border" style={{ backgroundColor: cw?.color_hex || "#e5e7eb" }} />
                      </TableCell>
                      <TableCell>{cw?.color_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{cw?.colorway_code || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{v.sequence || "—"}</TableCell>
                      <TableCell>{v.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{v.pack_code || "—"}</TableCell>
                      <TableCell>{v.variant || "—"}</TableCell>
                      <TableCell className="text-xs">{proj?.name || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )
      )}
    </div>
  );
}
