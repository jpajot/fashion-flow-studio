// Routings are now first-class BOMs (bom_type='routing').
// This compact section reuses the shared list component used by the Routings tab.
import ProductBomsTab from "@/components/ProductBomsTab";

interface Props {
  productId?: string;
  // Other legacy props are accepted but ignored for backward compatibility.
  [key: string]: any;
}

export default function RoutingLifecycleSection({ productId }: Props) {
  if (!productId) return null;
  return <ProductBomsTab productId={productId} bomType="routing" compact />;
}
