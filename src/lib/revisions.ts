import { supabase } from "@/lib/supabase";

export type FieldDiff = { field: string; label: string; before: any; after: any };

export async function detectTrackedFieldChanges(
  targetType: "product" | "product_color",
  before: Record<string, any>,
  after: Record<string, any>,
) {
  const { data: trackedFields } = await supabase
    .from("revision_tracked_fields")
    .select("field_name, display_label")
    .eq("target_type", targetType)
    .eq("is_active", true);

  const beforeSnapshot: Record<string, any> = {};
  const afterSnapshot: Record<string, any> = {};
  const fieldDiffs: FieldDiff[] = [];

  for (const tf of trackedFields ?? []) {
    const bv = before?.[tf.field_name] ?? null;
    const av = after?.[tf.field_name] ?? null;
    beforeSnapshot[tf.field_name] = bv;
    afterSnapshot[tf.field_name] = av;
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      fieldDiffs.push({ field: tf.field_name, label: tf.display_label ?? tf.field_name, before: bv, after: av });
    }
  }
  return {
    has_tracked_changes: fieldDiffs.length > 0,
    before_snapshot: beforeSnapshot,
    after_snapshot: afterSnapshot,
    field_diffs: fieldDiffs,
  };
}

export function nextRevisionCode(existingCodes: string[]): string {
  function codeToNum(code: string): number {
    let n = 0;
    for (let i = 0; i < code.length; i++) n = n * 26 + (code.charCodeAt(i) - 64);
    return n;
  }
  function numToCode(n: number): string {
    let result = "";
    while (n > 0) {
      n -= 1;
      result = String.fromCharCode((n % 26) + 65) + result;
      n = Math.floor(n / 26);
    }
    return result;
  }
  const cleaned = existingCodes.filter(Boolean);
  if (!cleaned.length) return "A";
  const sorted = [...cleaned].sort((a, b) => (a.length !== b.length ? a.length - b.length : a.localeCompare(b)));
  return numToCode(codeToNum(sorted[sorted.length - 1]) + 1);
}

export async function createProductRevision(params: {
  product_id: string;
  target_type: string;
  target_id: string;
  revision_context: string;
  before_snapshot: object;
  after_snapshot: object;
  field_diffs: any[];
  triggered_by: string;
}) {
  const { data: existing } = await supabase
    .from("product_revisions")
    .select("revision_code")
    .eq("target_id", params.target_id)
    .eq("target_type", params.target_type);

  const revision_code = nextRevisionCode(((existing ?? []) as any[]).map((r) => r.revision_code).filter(Boolean));

  await supabase
    .from("product_revisions")
    .update({ is_current: false })
    .eq("target_id", params.target_id)
    .eq("target_type", params.target_type)
    .eq("is_current", true);

  const { error } = await supabase.from("product_revisions").insert({
    product_id: params.product_id,
    target_type: params.target_type,
    target_id: params.target_id,
    revision_code,
    revision_context: params.revision_context,
    before_snapshot: params.before_snapshot as any,
    after_snapshot: params.after_snapshot as any,
    field_diffs: params.field_diffs as any,
    created_by: params.triggered_by,
    is_current: true,
  });
  return { revision_code, error };
}
