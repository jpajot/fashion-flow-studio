import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  RefreshCw,
  Coins,
  ListChecks,
  Hash,
  SwatchBook,
  Ruler,
  CircleDollarSign,
  Settings,
} from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { cn } from "@/lib/utils";

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
  notes: string | null;
};

const SUB_NAV_ITEMS = [
  { id: "lov", label: "List of Values", icon: ListChecks },
  { id: "codegen", label: "Code Generators", icon: Hash },
  { id: "colors", label: "Color Studio", icon: SwatchBook },
  { id: "sizes", label: "Size Studio", icon: Ruler },
  { id: "currencies", label: "Currencies", icon: CircleDollarSign },
  { id: "config", label: "App Config", icon: Settings },
];
const SUB_NAV_ROUTES: Record<string, string> = {
  lov: "/list-of-values",
  codegen: "/code-generators",
  colors: "/color-palettes",
  sizes: "/size-studio",
  currencies: "/currencies",
  config: "/app-config",
};

const EMPTY: any = {
  code: "",
  name: "",
  symbol: "",
  decimal_places: 2,
  is_active: true,
  notes: "",
};

export default function Currencies() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [rows, setRows] = useState<Currency[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY });

  const load = async () => {
    const { data } = await supabase.from("currencies").select("*").order("code");
    setRows((data ?? []) as Currency[]);
  };

  useEffect(() => {
    load();
  }, []);

  useRegisterSubNav(
    SUB_NAV_ITEMS,
    "currencies",
    (id) => navigate(SUB_NAV_ROUTES[id] ?? "/config"),
    "Settings",
  );

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setDialogOpen(true);
  };
  const openEdit = (c: Currency) => {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      decimal_places: c.decimal_places,
      is_active: c.is_active,
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.symbol.trim()) {
      toast({ title: "Code, Name and Symbol are required", variant: "destructive" });
      return;
    }
    const payload = {
      code: form.code.trim().toUpperCase().slice(0, 3),
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      decimal_places: Number(form.decimal_places) || 0,
      is_active: form.is_active,
      notes: form.notes?.trim() || null,
    };
    const res = editing
      ? await supabase.from("currencies").update(payload).eq("id", editing.id)
      : await supabase.from("currencies").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Currency updated" : "Currency created" });
    setDialogOpen(false);
    load();
  };

  const toggleActive = async (c: Currency) => {
    const { error } = await supabase
      .from("currencies")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Currency", icon: Plus, onClick: openNew },
        { divider: true },
        { label: "Refresh", icon: RefreshCw, onClick: load },
      ],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-3 py-3 sm:px-4 md:px-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Currencies</h1>
          <p className="text-sm text-muted-foreground">
            Currencies used across pricing, costing, and payments.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Currency
        </Button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Coins className="h-10 w-10 mb-2 opacity-50" />
            <div>No currencies added yet.</div>
            <Button className="mt-3" size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Currency
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Decimals</TableHead>
                <TableHead className="w-24">Active</TableHead>
                <TableHead className="text-right w-16">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className={cn(!c.is_active && "opacity-50")}>
                  <TableCell className="font-mono font-bold uppercase">{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-lg">{c.symbol}</TableCell>
                  <TableCell>{c.decimal_places}</TableCell>
                  <TableCell>
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Currency" : "New Currency"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  maxLength={3}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 3) })
                  }
                  className="font-mono uppercase"
                  placeholder="EUR"
                />
              </div>
              <div>
                <Label>Symbol *</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  placeholder="€"
                />
              </div>
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Euro"
              />
            </div>
            <div>
              <Label>Decimal Places</Label>
              <Input
                type="number"
                min={0}
                max={8}
                value={form.decimal_places}
                onChange={(e) => setForm({ ...form, decimal_places: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label className="m-0">Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
