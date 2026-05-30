import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, MoreHorizontal, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ListToolbarProps = {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  view?: "grid" | "list";
  onViewChange?: (v: "grid" | "list") => void;
  hideViewToggle?: boolean;
  moreItems?: { label: string; icon?: any; onClick: () => void; className?: string }[];
  children?: React.ReactNode;
};

export function ListToolbar({
  search = "",
  onSearch,
  searchPlaceholder = "Search…",
  view = "list",
  onViewChange,
  hideViewToggle,
  moreItems,
  children,
}: ListToolbarProps) {
  const [expanded, setExpanded] = useState(!!search);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const moreBtn = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (menuRef.current?.contains(t) || moreBtn.current?.contains(t)) return;
      setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const openMore = () => {
    if (!moreBtn.current) return;
    const r = moreBtn.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.right - 200 });
    setMoreOpen(true);
  };

  return (
    <div className="flex items-center gap-2">
      {children}
      <div className="flex-1" />
      {onSearch && (
        <div className="flex items-center">
          {expanded ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-48"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onSearch("");
                  setExpanded(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(true)}>
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {!hideViewToggle && onViewChange && (
        <div className="flex items-center rounded-md border p-0.5">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewChange("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewChange("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      )}
      {moreItems && moreItems.length > 0 && (
        <Button ref={moreBtn} variant="ghost" size="icon" className="h-8 w-8" onClick={openMore}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      )}
      {moreOpen && moreItems &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: 200 }}
            className="bg-popover text-popover-foreground rounded-md border shadow-lg p-1"
          >
            {moreItems.map((it, i) => {
              const Icon = it.icon;
              return (
                <button
                  key={i}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent text-left",
                    it.className,
                  )}
                  onClick={() => {
                    it.onClick();
                    setMoreOpen(false);
                  }}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {it.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
