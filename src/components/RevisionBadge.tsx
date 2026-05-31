import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  target_type: "product" | "product_color" | string;
  target_id: string;
  size?: "xs" | "sm" | "md";
  onOpenPanel?: (targetType: string, targetId: string) => void;
}

const SIZE = { xs: "w-5 h-5 text-[10px]", sm: "w-6 h-6 text-[11px]", md: "w-8 h-8 text-xs" };

export default function RevisionBadge({ target_type, target_id, size = "sm", onOpenPanel }: Props) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!target_id) return;
    supabase.from("product_revisions").select("revision_code").eq("target_id", target_id).eq("is_current", true).limit(1).single()
      .then(({ data }) => setCode((data as any)?.revision_code ?? null));
  }, [target_id]);
  if (!code) return null;
  return (
    <button type="button" onClick={() => onOpenPanel?.(target_type, target_id)}
      title={`Revision ${code}`}
      className={`inline-flex items-center justify-center rounded border-2 border-green-400 bg-green-50 text-green-700 font-mono font-bold hover:bg-green-100 transition-colors shrink-0 ${SIZE[size]}`}>
      {code}
    </button>
  );
}
