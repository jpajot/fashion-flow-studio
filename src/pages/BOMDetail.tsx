import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, LayoutGrid, List, Factory, History, Plus, Layers, Package, Pencil } from "lucide-react";
import { PAGE_WRAPPER } from "@/lib/utils";
import NewBOMDialog from "@/components/bom/NewBOMDialog";
import BOMHeaderCard from "@/components/bom/BOMHeaderCard";
import BOMLineAddDialog from "@/components/bom/BOMLineAddDialog";
import BOMLineEditPanel from "@/components/bom/BOMLineEditPanel";
import DataTable from "@/components/shared/DataTable";

const EDITABLE_STATUSES = ["draft", "in_review"];
const isBomEditable = (bom: any) => bom && EDITABLE_STATUSES.includes(bom.status);

const getLovValues = (lovTypes: any[], lovValues: any[], code: string) => {
  const t = lovTypes.find(x => x.code === code);
  if (!t) return [];
  return lovValues.filter(v => v.type_of_lov_id === t.id).map(v => v.name).sort();
};

export default function BOMDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === "new" || location.pathname === "/boms/new" || !id;

  const [bom, setBom] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [bomLines, setBomLines] = useState<any[]>([]);
  const [bomVariants, setBomVariants] = useState<any[]>([]);
  const [routings, setRoutings] = useState<any[]>([]);
  const [colorways, setColorways] = useState<any[]>([]);
  const [approvedSuppliers, setApprovedSuppliers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [lovTypes, setLovTypes] = useState<any[]>([]);
  const [lovValues, setLovValues] = useState<any[]>([]);
  const [derivedFromBom, setDerivedFromBom] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState("matrix");
  const [showAddLine, setShowAddLine] = useState(false);
  const [editLine, setEditLine] = useState<any | null>(null);
  const [lineSearch, setLineSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    const { data: b } = await supabase.from("boms").select("*").eq("id", id).single();
    if (!b) { setLoading(false); return; }
    setBom(b);

    const [prod, lines, rts, cws, apps, sups, currs, lt, lv, ap] = await Promise.all([
      supabase.from("products").select("*").eq("id", b.product_id).single(),
      supabase.from("bom_lines").select("*").eq("bom_id", b.id).order("position"),
      supabase.from("supplier_routings").select("*").eq("product_id", b.product_id),
      supabase.from("product_colors").select("*").eq("product_id", b.product_id),
      supabase.from("approved_suppliers").select("*").eq("product_id", b.product_id).order("rank"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("currencies").select("id,code,name").eq("is_active", true).order("code"),
      supabase.from("type_of_lov").select("id,code"),
      supabase.from("list_of_values").select("*"),
      supabase.from("products").select("id,name,type,images,default_uom,default_uom_for_purchasing").order("name"),
    ]);

    setProduct(prod.data);
    setBomLines(lines.data ?? []);
    setRoutings(rts.data ?? []);
    setColorways(cws.data ?? []);
    setApprovedSuppliers(apps.data ?? []);
    setSuppliers(sups.data ?? []);
    setCurrencies(currs.data ?? []);
    setLovTypes(lt.data ?? []);
    setLovValues(lv.data ?? []);
    setAllProducts(ap.data ?? []);

    if (lines.data?.length) {
      const { data: vars } = await supabase.from("bom_line_variants").select("*").in("bom_line_id", lines.data.map(l => l.id));
      setBomVariants(vars ?? []);
    } else {
      setBomVariants([]);
    }

    if (b.derived_from_bom_id) {
      const { data: df } = await supabase.from("boms").select("id,bom_type,revision_code,version").eq("id", b.derived_from_bom_id).maybeSingle();
      setDerivedFromBom(df);
    }

    setLoading(false);
  };

  useEffect(() => { if (!isNew && id) loadAll(); /* eslint-disable-next-line */ }, [id, isNew]);

  const bomTitle = useMemo(() => {
    if (!bom) return "BOM";
    return `${product?.name || "—"} · ${bom.bom_type === "production" ? "PROD" : "DEV"} · Rev ${bom.revision_code} v${bom.version}`;
  }, [bom, product]);

  const subNavItems = useMemo(() => ([
    { id: "matrix",    label: "Matrix",        count: bomVariants.length, icon: LayoutGrid },
    { id: "lines",     label: "Lines",         count: bomLines.length,    icon: List },
    { id: "mfgops",    label: "Manufacturing", icon: Factory },
    { id: "changelog", label: "Change Log",    icon: History },
  ]), [bomLines.length, bomVariants.length]);

  useRegisterSubNav(isNew ? [] : subNavItems, activeTab, setActiveTab, bomTitle);

  const selectedRouting = routings.find(r => r.id === bom?.selected_routing_id);
  const factorySupplierId = bom?.order_context?.factory_supplier_id;
  const factorySupplier = factorySupplierId ? suppliers.find(s => s.id === factorySupplierId) : undefined;

  const handleDelete = async () => {
    if (!bom) return;
    const { error } = await supabase.from("boms").delete().eq("id", bom.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "BOM deleted" });
    navigate("/boms");
  };

  if (isNew) {
    return (
      <div className={PAGE_WRAPPER}>
        <NewBOMDialog
          open={true}
          onClose={() => navigate("/boms")}
          onCreated={(newBom) => setTimeout(() => navigate(`/boms/${newBom.id}`), 300)}
        />
      </div>
    );
  }

  if (loading) {
    return <div className={`${PAGE_WRAPPER} text-sm text-muted-foreground`}>Loading…</div>;
  }

  if (!bom) {
    return <div className={`${PAGE_WRAPPER} text-sm text-muted-foreground`}>BOM not found.</div>;
  }

  return (
    <div className={PAGE_WRAPPER}>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/boms")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-semibold truncate">{bomTitle}</h1>
          {bom.notes && <p className="text-xs text-muted-foreground truncate">{bom.notes}</p>}
        </div>
        {bom.status === "draft" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this BOM?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the BOM and all its lines. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <BOMHeaderCard
        bom={bom}
        product={product}
        selectedRouting={selectedRouting}
        factorySupplier={factorySupplier}
        bomLineCount={bomLines.length}
        bomVariantCount={bomVariants.length}
        currencies={currencies}
        derivedFromBom={derivedFromBom}
      />

      <div className="mt-4">
        {activeTab === "matrix" && (
          <div className="text-center py-16 text-muted-foreground">Matrix view — coming in Phase 3</div>
        )}
        {activeTab === "lines" && (
          <div className="text-center py-16 text-muted-foreground">Lines view — coming in Phase 2</div>
        )}
        {activeTab === "mfgops" && (
          <div className="text-center py-16 text-muted-foreground">Manufacturing Operations — coming in Phase 5</div>
        )}
        {activeTab === "changelog" && (
          <div className="text-center py-16 text-muted-foreground">Change Log — coming in Phase 5</div>
        )}
      </div>

      {/* Silence unused LOV warnings; will be consumed in later phases */}
      <span className="hidden">{lovTypes.length}{lovValues.length}{colorways.length}{approvedSuppliers.length}</span>
    </div>
  );
}
