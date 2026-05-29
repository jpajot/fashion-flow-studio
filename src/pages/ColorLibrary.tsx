import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/lib/badges";

type Tech = { id: string; code: string; name: string; hex: string; color_group?: string; color_sub_group?: string };
type Commercial = { id: string; sub_type: string; code: string; color_name: string; main_technical_color_id?: string };
type Palette = { id: string; name: string; project_id?: string };
type PaletteColor = { palette_id: string; color_type: string; color_id: string; sort_order: number };

export default function ColorLibrary() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Color Library</h1>
        <p className="text-muted-foreground">Technical, commercial colors and palettes</p>
      </div>
      <Tabs defaultValue="technical">
        <TabsList>
          <TabsTrigger value="technical">Technical Colors</TabsTrigger>
          <TabsTrigger value="commercial">Commercial Colors</TabsTrigger>
          <TabsTrigger value="palettes">Palettes</TabsTrigger>
        </TabsList>
        <TabsContent value="technical"><TechnicalTab /></TabsContent>
        <TabsContent value="commercial"><CommercialTab /></TabsContent>
        <TabsContent value="palettes"><PalettesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TechnicalTab() {
  const [items, setItems] = useState<Tech[]>([]);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("technical_colors").select("*").order("name").limit(500);
      setItems((data as Tech[]) ?? []);
    })();
  }, []);

  const groups = useMemo(
    () => Array.from(new Set(items.map((i) => i.color_group).filter(Boolean))) as string[],
    [items],
  );

  const filtered = items.filter((i) => {
    if (group !== "all" && i.color_group !== group) return false;
    if (search && !`${i.name} ${i.code}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Color group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filtered.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-16 h-16 rounded-full border" style={{ backgroundColor: c.hex || "#ddd" }} />
              <div className="font-medium text-sm truncate w-full">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.code}</div>
              {c.color_group && <Badge variant="secondary" className="text-xs">{c.color_group}</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CommercialTab() {
  const [items, setItems] = useState<(Commercial & { tech?: Tech })[]>([]);
  const [subType, setSubType] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("commercial_colors")
        .select("*, tech:main_technical_color_id(id, code, name, hex)")
        .order("code")
        .limit(500);
      setItems((data as any) ?? []);
    })();
  }, []);

  const filtered = items.filter((i) => subType === "all" || i.sub_type === subType);

  return (
    <div className="space-y-4 mt-4">
      <Select value={subType} onValueChange={setSubType}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Sub-type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sub-types</SelectItem>
          <SelectItem value="solid">Solid</SelectItem>
          <SelectItem value="combined">Combined</SelectItem>
        </SelectContent>
      </Select>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Sub-type</TableHead>
              <TableHead>Technical Color</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell className="font-medium">{c.color_name}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{c.sub_type}</Badge></TableCell>
                <TableCell>
                  {c.tech ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: c.tech.hex }} />
                      <span className="text-sm">{c.tech.name}</span>
                      <span className="text-xs text-muted-foreground">{c.tech.code}</span>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function PalettesTab() {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [colors, setColors] = useState<PaletteColor[]>([]);
  const [tech, setTech] = useState<Record<string, Tech>>({});
  const [comm, setComm] = useState<Record<string, Commercial & { hex?: string }>>({});

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: pc }, { data: t }, { data: c }] = await Promise.all([
        supabase.from("color_palettes").select("*").order("name"),
        supabase.from("color_palette_colors").select("*").order("sort_order"),
        supabase.from("technical_colors").select("id, code, name, hex"),
        supabase.from("commercial_colors").select("id, code, color_name, sub_type, main_technical_color_id"),
      ]);
      setPalettes((p as Palette[]) ?? []);
      setColors((pc as PaletteColor[]) ?? []);
      const tMap: Record<string, Tech> = {};
      (t ?? []).forEach((x: any) => (tMap[x.id] = x));
      setTech(tMap);
      const cMap: Record<string, any> = {};
      (c ?? []).forEach((x: any) => {
        cMap[x.id] = { ...x, hex: tMap[x.main_technical_color_id]?.hex };
      });
      setComm(cMap);
    })();
  }, []);

  const resolve = (cType: string, cId: string): { hex: string; name: string } => {
    if (cType === "technical") {
      const t = tech[cId];
      return { hex: t?.hex || "#ddd", name: t?.name || cId };
    }
    const c = comm[cId];
    return { hex: c?.hex || "#ddd", name: c?.color_name || cId };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {palettes.map((p) => {
        const pcs = colors.filter((c) => c.palette_id === p.id);
        return (
          <Card key={p.id}>
            <CardHeader><CardTitle className="text-base">{p.name}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {pcs.length === 0 && <span className="text-sm text-muted-foreground">No colors</span>}
                {pcs.map((c, idx) => {
                  const r = resolve(c.color_type, c.color_id);
                  return (
                    <div key={idx} title={r.name} className="w-10 h-10 rounded border" style={{ backgroundColor: r.hex }} />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
