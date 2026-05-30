import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil,
  Check,
  X,
  RefreshCw,
  ListChecks,
  Hash,
  SwatchBook,
  Ruler,
  CircleDollarSign,
  Settings,
} from "lucide-react";
import { useRegisterSubNav } from "@/hooks/useRegisterSubNav";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type AppConfig = {
  id: string;
  key: string;
  value: string | null;
  value_type: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string | null;
};
type Currency = { id: string; code: string; name: string; is_active: boolean };

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

const TYPE_COLORS: Record<string, string> = {
  string: "bg-slate-100 text-slate-700 border-slate-200",
  number: "bg-blue-100 text-blue-700 border-blue-200",
  boolean: "bg-amber-100 text-amber-700 border-amber-200",
  currency_id: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString() : "";
}

function ValueEditor({
  row,
  currencies,
  onSave,
}: {
  row: AppConfig;
  currencies: Currency[];
  onSave: (newValue: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(row.value ?? "");

  useEffect(() => {
    setDraft(row.value ?? "");
  }, [row.value]);

  const commit = async () => {
    await onSave(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(row.value ?? "");
    setEditing(false);
  };

  const displayValue = () => {
    if (row.value_type === "currency_id") {
      const c = currencies.find((x) => x.id === row.value);
      return c ? `${c.code} — ${c.name}` : row.value ?? "—";
    }
    return row.value ?? "—";
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-sm">{displayValue()}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {row.value_type === "currency_id" ? (
        <Select value={draft} onValueChange={setDraft}>
          <SelectTrigger className="h-8 w-56">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {currencies
              .filter((c) => c.is_active)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          className="h-8 w-56 font-mono text-sm"
        />
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-emerald-600"
        onClick={commit}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function AppConfiguration() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const { user } = useAuth();

  const [rows, setRows] = useState<AppConfig[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const load = async () => {
    const [c, cur] = await Promise.all([
      supabase.from("app_configs").select("*").order("key"),
      supabase.from("currencies").select("id, code, name, is_active").order("code"),
    ]);
    setRows((c.data ?? []) as AppConfig[]);
    setCurrencies((cur.data ?? []) as Currency[]);
  };

  useEffect(() => {
    load();
  }, []);

  useRegisterSubNav(
    SUB_NAV_ITEMS,
    "config",
    (id) => navigate(SUB_NAV_ROUTES[id] ?? "/config"),
    "Settings",
  );

  useEffect(() => {
    setOptions({
      items: [{ label: "Refresh", icon: RefreshCw, onClick: load }],
    });
    return () => setOptions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveValue = async (row: AppConfig, newValue: string) => {
    const { error } = await supabase
      .from("app_configs")
      .update({
        value: newValue,
        updated_by: user?.email ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    load();
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">App Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Edit application-level configuration values.
          </p>
        </div>

        <Card className="divide-y">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No configuration keys found.
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{r.key}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono uppercase",
                        TYPE_COLORS[r.value_type] ?? "",
                      )}
                    >
                      {r.value_type}
                    </Badge>
                  </div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground mt-1">{r.description}</div>
                  )}
                  {(r.updated_by || r.updated_at) && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Last updated{r.updated_by ? ` by ${r.updated_by}` : ""}
                      {r.updated_at ? ` · ${fmtDate(r.updated_at)}` : ""}
                    </div>
                  )}
                </div>
                <ValueEditor
                  row={r}
                  currencies={currencies}
                  onSave={(v) => saveValue(r, v)}
                />
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
