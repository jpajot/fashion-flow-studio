import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type InlineColorOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  hex?: string | null;
  meta?: string | null;
};

export default function InlineColorPicker({
  options,
  value,
  onChange,
  placeholder = "Select color…",
  disabled,
}: {
  options: InlineColorOption[];
  value: string | null | undefined;
  onChange: (id: string | null, opt: InlineColorOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = useMemo(() => options.find((o) => o.id === value) || null, [options, value]);

  const filtered = useMemo(() => {
    if (!q.trim()) return options.slice(0, 200);
    const k = q.toLowerCase();
    return options
      .filter((o) =>
        [o.code, o.name, o.meta].filter(Boolean).some((s) => String(s).toLowerCase().includes(k)),
      )
      .slice(0, 200);
  }, [options, q]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 w-full h-10 rounded-md border bg-background px-3 text-sm text-left",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {selected ? (
          <>
            <div
              className="h-5 w-5 rounded border shrink-0"
              style={{ backgroundColor: selected.hex || "#e5e7eb" }}
            />
            <span className="font-mono text-xs">{selected.code}</span>
            <span className="truncate text-muted-foreground">— {selected.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <div className="flex-1" />
        {selected && !disabled && (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null, null);
            }}
          />
        )}
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg p-2 max-h-72 overflow-y-auto">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-8 mb-2"
          />
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground px-2 py-4 text-center">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id, o);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left"
              >
                <div className="h-5 w-5 rounded border shrink-0" style={{ backgroundColor: o.hex || "#e5e7eb" }} />
                <span className="font-mono text-xs">{o.code}</span>
                <span className="truncate text-sm">{o.name}</span>
                {o.meta && <span className="ml-auto text-xs text-muted-foreground">{o.meta}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
