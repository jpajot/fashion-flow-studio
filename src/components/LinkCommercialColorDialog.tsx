import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link as LinkIcon, Plus, RefreshCw, ArrowLeft, Search, X } from "lucide-react";
import { colorToHex, TechPicker } from "@/pages/ColorLibrary";

type Tech = {
  id: string;
  code: string;
  name: string;
  hex: string | null;
  rgb?: string | null;
  cmyk?: string | null;
};
type Comm = {
  id: string;
  code: string;
  color_name: string;
  main_technical_color_id: string | null;
  linked_technical_color_ids: string[] | null;
  sub_type?: string;
};
type PaletteColor = {
  id: string;
  palette_id: string;
  color_type: "technical" | "commercial";
  color_id: string;
  sort_order: number;
};

export default function LinkCommercialColorDialog({
  techColor,
  commColors,
  setCommColors,
  onClose,
  paletteId,
  setPaletteColors,
  tech = [],
}: {
  techColor: Tech;
  commColors: Comm[];
  setCommColors: (next: Comm[]) => void;
  onClose: () => void;
  paletteId?: string | null;
  setPaletteColors?: (updater: (prev: PaletteColor[]) => PaletteColor[]) => void;
  tech?: Tech[];
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"choose" | "link" | "create">("choose");
  const [q, setQ] = useState("");

  // create-mode form
  const [code, setCode] = useState("");
  const [name, setName] = useState(techColor.name);
  const [subType, setSubType] = useState("Solid");
  const [linkedIds, setLinkedIds] = useState<string[]>([techColor.id]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const techMap = useMemo(() => Object.fromEntries(tech.map((t) => [t.id, t])), [tech]);

  const regenerateCode = async () => {
    const { data, error } = await supabase.rpc("generate_code", {
      p_entity_name: "CommercialColor",
      p_entity_type: "",
    });
    if (error) {
      toast({ title: "Code generation failed", description: error.message, variant: "destructive" });
      return;
    }
    if (data) setCode(String(data));
  };

  useEffect(() => {
    if (mode === "create" && !code) regenerateCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filteredComm = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? commColors.filter((c) =>
          `${c.code} ${c.color_name}`.toLowerCase().includes(s),
        )
      : commColors;
  }, [commColors, q]);

  const addCommToPalette = async (commId: string) => {
    if (!paletteId || !setPaletteColors) return;
    const { data, error } = await supabase
      .from("color_palette_colors")
      .insert({
        palette_id: paletteId,
        color_type: "commercial",
        color_id: commId,
        sort_order: 9999,
      })
      .select()
      .single();
    if (!error && data) setPaletteColors((prev) => [...prev, data as PaletteColor]);
  };

  const doLink = async (target: Comm) => {
    const already = target.linked_technical_color_ids ?? [];
    if (already.includes(techColor.id) || target.main_technical_color_id === techColor.id) {
      toast({ title: "Already linked" });
      return;
    }
    const next = [...already, techColor.id];
    const { error } = await supabase
      .from("commercial_colors")
      .update({ linked_technical_color_ids: next })
      .eq("id", target.id);
    if (error) {
      toast({ title: "Link failed", description: error.message, variant: "destructive" });
      return;
    }
    setCommColors(
      commColors.map((c) =>
        c.id === target.id ? { ...c, linked_technical_color_ids: next } : c,
      ),
    );
    await addCommToPalette(target.id);
    toast({ title: `Linked to ${target.color_name}` });
    onClose();
  };

  const doCreate = async () => {
    setCodeError(null);
    if (!code.trim() || !name.trim()) {
      toast({ title: "Code and name required", variant: "destructive" });
      return;
    }
    const dup = commColors.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
    if (dup) {
      setCodeError(
        `Code "${code.trim()}" is already used by "${dup.color_name}". Please use a different code.`,
      );
      return;
    }
    setSaving(true);
    const finalLinkedIds =
      subType === "Combined" ? linkedIds : [techColor.id];
    const payload = {
      sub_type: subType,
      code: code.trim(),
      color_name: name.trim(),
      main_technical_color_id: techColor.id,
      linked_technical_color_ids: finalLinkedIds,
    };
    const { data, error } = await supabase
      .from("commercial_colors")
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    setCommColors([...commColors, data as Comm]);
    await addCommToPalette((data as Comm).id);
    toast({ title: "Commercial color created" });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose" && "Link Technical Color"}
            {mode === "link" && "Link to existing Commercial Color"}
            {mode === "create" && "Create Commercial Color"}
          </DialogTitle>
        </DialogHeader>

        {/* Source preview */}
        <div className="flex items-center gap-3 p-2 rounded border bg-muted/30">
          <div
            className="w-10 h-10 rounded border"
            style={{ backgroundColor: colorToHex(techColor) }}
          />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{techColor.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{techColor.code}</div>
          </div>
        </div>

        {mode === "choose" && (
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={() => setMode("link")}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Link to an existing commercial color
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={() => setMode("create")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create a new commercial color from this technical color
            </Button>
          </div>
        )}

        {mode === "link" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search commercial colors…"
                className="h-8 pl-7"
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto border rounded divide-y">
              {filteredComm.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground text-center">No matches</div>
              )}
              {filteredComm.map((c) => {
                const linked =
                  c.main_technical_color_id === techColor.id ||
                  (c.linked_technical_color_ids ?? []).includes(techColor.id);
                return (
                  <button
                    key={c.id}
                    disabled={linked}
                    onClick={() => doLink(c)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div
                      className="w-5 h-5 rounded border flex-shrink-0"
                      style={{ backgroundColor: colorToHex(techColor) }}
                    />
                    <span className="font-mono text-xs">{c.code}</span>
                    <span className="truncate flex-1">— {c.color_name}</span>
                    {linked && (
                      <Badge variant="secondary" className="text-[10px]">
                        already linked
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-3">
            <div>
              <Label>Sub-type</Label>
              <Select
                value={subType}
                onValueChange={(v) => {
                  setSubType(v);
                  if (v === "Combined" && !linkedIds.includes(techColor.id)) {
                    setLinkedIds([techColor.id]);
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solid">Solid</SelectItem>
                  <SelectItem value="Combined">Combined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Code *</Label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeError(null);
                  }}
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={regenerateCode} title="Regenerate">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {codeError && (
                <p className="text-xs text-destructive mt-1">{codeError}</p>
              )}
            </div>
            <div>
              <Label>Color Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground">
              Main technical color will be set to{" "}
              <span className="font-mono">{techColor.code}</span> — {techColor.name}
            </div>

            {subType === "Combined" && tech.length > 0 && (
              <div>
                <Label>Linked Technical Colors</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[44px]">
                  {linkedIds.map((id) => {
                    const t = techMap[id] ?? (id === techColor.id ? techColor : null);
                    if (!t) return null;
                    const isMain = id === techColor.id;
                    return (
                      <div
                        key={id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs"
                      >
                        <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: colorToHex(t) }} />
                        <span className="font-mono">{t.code}</span>
                        <span className="truncate max-w-[120px]">{t.name}</span>
                        {isMain && <Badge variant="outline" className="text-[10px] py-0 px-1">main</Badge>}
                        <button
                          onClick={() => setLinkedIds(linkedIds.filter((x) => x !== id))}
                          disabled={isMain}
                          className="ml-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          type="button"
                          title={isMain ? "Main color cannot be removed" : "Remove"}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <TechPicker
                    tech={tech.filter((t) => !linkedIds.includes(t.id)) as any}
                    selected={null}
                    onPick={(t: any) => setLinkedIds([...linkedIds, t.id])}
                    placeholder="Add linked technical color"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {mode !== "choose" ? (
            <Button variant="ghost" onClick={() => setMode("choose")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {mode === "create" && (
              <Button onClick={doCreate} disabled={saving}>
                {saving ? "Creating…" : "Create & Link"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
