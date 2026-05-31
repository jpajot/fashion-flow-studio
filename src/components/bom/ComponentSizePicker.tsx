import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Check, X, Loader2 } from "lucide-react";

interface Props {
  componentProductId: string;
  currentSizeId?: string | null;
  baseSizeId?: string | null;
  allSizes: any[];
  onSelect: (sizeId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function ComponentSizePicker({
  componentProductId, currentSizeId, baseSizeId, allSizes,
  onSelect, onClear, onClose,
}: Props) {
  const [compSizes, setCompSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("style_sizes").select("*").eq("product_id", componentProductId);
      if (!cancelled) {
        setCompSizes((data ?? []).filter((s: any) => s.active !== false));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [componentProductId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const getSizeName = (sizeId: string) => {
    const s = allSizes.find((sz) => sz.id === sizeId);
    return s ? (s.name || s.size_code || sizeId) : sizeId;
  };
  const getSizeCode = (sizeId: string) => {
    const s = allSizes.find((sz) => sz.id === sizeId);
    return s?.size_code || "";
  };

  return (
    <div ref={ref} className="bg-popover border border-border rounded-lg shadow-xl w-52 overflow-hidden" style={{ maxHeight: 280 }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-semibold text-foreground">Pick component size</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : compSizes.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No sizes found for this component.</p>
        ) : (
          compSizes.map((ss) => {
            const isActive = ss.size_id === currentSizeId;
            const isBase = ss.size_id === baseSizeId;
            return (
              <button key={ss.size_id} type="button" onClick={() => onSelect(ss.size_id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left
                  ${isActive ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}>
                <span className="flex items-center gap-1.5">
                  <span className="font-medium">{getSizeName(ss.size_id)}</span>
                  {getSizeCode(ss.size_id) && (
                    <span className="text-muted-foreground text-[10px]">{getSizeCode(ss.size_id)}</span>
                  )}
                  {isBase && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">base</span>
                  )}
                </span>
                {isActive && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      {!loading && (
        <div className="border-t border-border">
          <button type="button" onClick={onClear}
            className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left">
            Reset to base size
          </button>
        </div>
      )}
    </div>
  );
}
