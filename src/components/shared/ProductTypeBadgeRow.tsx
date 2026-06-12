interface Props {
  product: any;
}

export function ProductTypeBadge({ product }: Props) {
  if (!product) return null;
  const isStyle = product.type === "Product";
  const badgeClass = isStyle
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-amber-100 text-amber-700 border-amber-200";
  const label = isStyle ? "STYLE" : "MATERIAL";
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeClass}`}>{label}</span>
  );
}

export default function ProductTypeBadgeRow({ product }: Props) {
  if (!product) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <ProductTypeBadge product={product} />
      <span className="font-mono text-[10px] text-muted-foreground">{product.code}</span>
      <span className="text-muted-foreground">—</span>
      <span className="text-xs font-semibold">{product.name}</span>
    </span>
  );
}
