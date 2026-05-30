import { supabase } from "@/lib/supabase";

export type PinnedItem = { path: string; label: string; subNavId?: string };

const KEY = "pinnedNavItems";
export const MAX_PINNED = 6;

export function getPinnedItems(): PinnedItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function setPinnedItems(items: PinnedItem[]) {
  const trimmed = items.slice(0, MAX_PINNED);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
  window.dispatchEvent(new Event("pinned-items-changed"));
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").update({ pinned_nav_items: trimmed }).eq("id", data.user.id);
    }
  } catch {}
}

export function isPinned(items: PinnedItem[], path: string, subNavId?: string) {
  return items.some((p) => p.path === path && (p.subNavId ?? null) === (subNavId ?? null));
}

export function togglePin(path: string, label: string, subNavId?: string) {
  const items = getPinnedItems();
  const idx = items.findIndex(
    (p) => p.path === path && (p.subNavId ?? null) === (subNavId ?? null),
  );
  if (idx >= 0) {
    items.splice(idx, 1);
  } else {
    if (items.length >= MAX_PINNED) return false;
    items.push({ path, label, subNavId });
  }
  setPinnedItems(items);
  return true;
}
