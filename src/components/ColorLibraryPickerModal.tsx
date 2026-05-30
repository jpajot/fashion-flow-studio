import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export type PickerItem = {
  key: string; // "tech--id" or "comm--id"
  type: "technical" | "commercial";
  id: string;
  code: string;
  name: string;
  hex: string | null;
  mainTechId?: string | null;
  paletteNames: string[];
};

export default function ColorLibraryPickerModal({
  open,
  onOpenChange,
  techColors,
  commColors,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  techColors: any[];
  commColors: any[];
  onConfirm: (items: PickerItem[]) => void;
}) {
  const [tab, setTab] = useState<"all" | "technical" | "commercial">("all");
  const [q, setQ] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [paletteRows, setPaletteRows] = useState<any[]>([]);
  const [palettes, setPalettes] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelectedKeys(new Set());
    setQ("");
    (async () => {
      const [pcRes, pRes] = await Promise.all([
        supabase.from("color_palette_colors").select("palette_id, color_type, color_id"),
        supabase.from("color_palettes").select("id, name"),
      ]);
      setPaletteRows(pcRes.data ?? []);
      setPalettes(pRes.data ?? []);
    })();
  }, [open]);

  const paletteNameById = useMemo(
    () => Object.fromEntries(palettes.map((p) => [p.id, p.name])),
    [palettes],
  );

  const palettesForColor = useMemo(() => {
    const map: Record<string, string[]> = {};
    paletteRows.forEach((r) => {
      const k = `${r.color_type}--${r.color_id}`;
      const name = paletteNameById[r.palette_id];
      if (!name) return;
      (map[k] = map[k] || []).push(name);
    });
    return map;
  }, [paletteRows, paletteNameById]);

  const items: PickerItem[] = useMemo(() => {
    const list: PickerItem[] = [];
    if (tab !== "commercial") {
      techColors.forEach((t) => {
        list.push({
          key: `tech--${t.id}`,
          type: "technical",
          id: t.id,
          code: t.code,
          name: t.name || "",
          hex: t.hex || null,
          paletteNames: palettesForColor[`technical--${t.id}`] || [],
        });
      });
    }
    if (tab !== "technical") {
      commColors.forEach((c) => {
        const main = techColors.find((t) => t.id === c.main_technical_color_id);
        list.push({
          key: `comm--${c.id}`,
          type: "commercial",
          id: c.id,
          code: c.code,
          name: c.color_name || "",
          hex: main?.hex || null,
          mainTechId: c.main_technical_color_id || null,
          paletteNames: palettesForColor[`commercial--${c.id}`] || [],
        });
      });
    }
    if (!q.trim()) return list;
    const k = q.toLowerCase();
    return list.filter(
      (i) =>
        i.code?.toLowerCase().includes(k) ||
        i.name?.toLowerCase().includes(k) ||
        i.paletteNames.some((n) => n.toLowerCase().includes(k)),
    );
  }, [tab, q, techColors, commColors, palettesForColor]);

  const toggle = (key: string) => {
    const next = new Set(selectedKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelectedKeys(next);
  };

  const handleAdd = () => {
    const picks = items.filter((i) => selectedKeys.has(i.key));
    onConfirm(picks);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add from Color Library</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1 border-b">
          {(["all", "technical", "commercial"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t === "all" ? "All" : t === "technical" ? "Technical" : "Commercial"}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search colors or palettes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9"
        />
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.length === 0 ? (
              <div className="col-span-2 text-center text-sm text-muted-foreground py-8">No colors</div>
            ) : (
              items.map((i) => {
                const sel = selectedKeys.has(i.key);
                return (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => toggle(i.key)}
                    className={`relative flex items-center gap-2 border rounded-md p-2 text-left ${sel ? "ring-2 ring-primary border-primary" : ""}`}
                  >
                    <div
                      className="h-10 w-10 rounded border shrink-0"
                      style={{ backgroundColor: i.hex || "#e5e7eb" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-muted-foreground">{i.code}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1">
                          {i.type === "technical" ? "TCX" : "COM"}
                        </Badge>
                      </div>
                      <div className="text-sm truncate">{i.name}</div>
                      {i.paletteNames.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {i.paletteNames.slice(0, 3).map((n) => (
                            <Badge key={n} variant="secondary" className="text-[9px] py-0 px-1">{n}</Badge>
                          ))}
                          {i.paletteNames.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{i.paletteNames.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {sel && (
                      <div className="h-5 w-5 rounded-full bg-primary grid place-items-center shrink-0">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selectedKeys.size === 0}>
            Add {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
