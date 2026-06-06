import { StatusBadge } from "@/lib/badges";
import { useNavigate } from "react-router-dom";

interface Props {
  bom: any;
  product: any;
  selectedRouting?: any;
  factorySupplier?: any;
  bomLineCount: number;
  bomVariantCount: number;
  currencies: any[];
  derivedFromBom?: any;
}

export default function BOMHeaderCard({
  bom, product, selectedRouting, factorySupplier,
  bomLineCount, bomVariantCount, derivedFromBom,
}: Props) {
  const navigate = useNavigate();
  if (!bom) return null;

  const isProd = bom.bom_phase === "production";
  const ctx = bom.order_context || {};

  return (
    <div className="rounded-xl border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Column 1 — Identity */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: isProd ? "#10B981" : "#6B7280", color: "#fff" }}>
            {isProd ? "PROD" : "DEV"}
          </span>
          <StatusBadge value={bom.status} />
          <span className="font-mono text-xs text-muted-foreground">Rev {bom.revision_code || "—"} · v{bom.version || "—"}</span>
        </div>
        {(bom.valid_from || bom.valid_until) && (
          <p className="text-xs text-muted-foreground">
            {bom.valid_from ? `Valid from ${bom.valid_from}` : ""}
            {bom.valid_until ? ` · until ${bom.valid_until}` : ""}
          </p>
        )}
        {bom.status === "released" && (bom.released_at || bom.released_by) && (
          <p className="text-xs text-muted-foreground">
            Released {bom.released_by ? `by ${bom.released_by}` : ""}
            {bom.released_at ? ` on ${new Date(bom.released_at).toLocaleDateString()}` : ""}
          </p>
        )}
        {bom.derived_from_bom_id && (
          <button
            onClick={() => navigate(`/boms/${bom.derived_from_bom_id}`)}
            className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
          >
            Derived from {derivedFromBom?.bom_type === "production" ? "PROD" : "DEV"} Rev {bom.derived_from_revision_code || "—"}
          </button>
        )}
        {bom.pending_eco_review_count > 0 && (
          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
            {bom.pending_eco_review_count} ECO pending
          </span>
        )}
      </div>

      {/* Column 2 — Sourcing context */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sourcing</h4>
        {!isProd ? (
          <p className="text-xs text-muted-foreground italic">Development BOM — no order context</p>
        ) : (
          <>
            {selectedRouting ? (
              <button
                onClick={() => { sessionStorage.setItem("productNavContext", "suppliers"); navigate(`/products/${product?.id}`); }}
                className="block w-full text-left text-xs px-2 py-1.5 rounded-md border bg-background hover:bg-accent"
              >
                <span className="font-medium">{selectedRouting.name || "Routing"}</span>
                <span className="text-muted-foreground"> · Rev {selectedRouting.revision_code} v{selectedRouting.version}</span>
                {selectedRouting.status && <span className="ml-1"><StatusBadge value={selectedRouting.status} /></span>}
              </button>
            ) : (
              <p className="text-xs text-amber-600">No routing selected</p>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {ctx.customer_ref && (<><span className="text-muted-foreground">Customer</span><span className="truncate">{ctx.customer_ref}</span></>)}
              {ctx.season_variant && (<><span className="text-muted-foreground">Season</span><span className="truncate">{ctx.season_variant}</span></>)}
              {ctx.target_quantity !== undefined && (<><span className="text-muted-foreground">Target</span><span>{ctx.target_quantity} units</span></>)}
              {ctx.region && (<><span className="text-muted-foreground">Region</span><span className="truncate">{ctx.region}</span></>)}
              {factorySupplier && (<><span className="text-muted-foreground">Factory</span><span className="truncate">{factorySupplier.name}</span></>)}
            </div>
          </>
        )}
      </div>

      {/* Column 3 — Stats */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stats</h4>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-2xl font-semibold">{bomLineCount}</p>
            <p className="text-[11px] text-muted-foreground">Lines</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{bomVariantCount}</p>
            <p className="text-[11px] text-muted-foreground">Variants</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-muted-foreground">$ —</p>
            <p className="text-[11px] text-muted-foreground">computed in Phase 3+</p>
          </div>
        </div>
      </div>
    </div>
  );
}
