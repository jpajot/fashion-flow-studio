import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Shirt,
  Layers,
  FolderKanban,
  SwatchBook,
  Ruler,
  Building2,
  ClipboardList,
  GitPullRequestArrow,
  Settings,
  Pin,
  PinOff,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubNav } from "@/contexts/SubNavContext";
import { usePageOptions } from "@/contexts/PageOptionsContext";
import { getPinnedItems, setPinnedItems, isPinned, togglePin, PinnedItem } from "@/lib/pinned";
import { supabase } from "@/lib/supabase";

export const DRAWER_ITEMS = [
  { path: "/projects", label: "Projects", icon: FolderKanban },
  { path: "/list-view", label: "Products Lists", icon: Shirt },
  { path: "/materials", label: "Materials Lists", icon: Layers },
  { path: "/color-palettes", label: "Color Studio", icon: SwatchBook },
  { path: "/size-grid-library", label: "Size Studio", icon: Ruler },
  { path: "/suppliers", label: "Suppliers", icon: Building2 },
  { path: "/boms", label: "BOMs", icon: ClipboardList },
  { path: "/change-management/ecos", label: "Change Management", icon: GitPullRequestArrow },
];

function getActiveItem(pathname: string) {
  if (pathname.startsWith("/change-management")) return DRAWER_ITEMS.find((i) => i.path === "/change-management/ecos");
  if (pathname === "/boms" || pathname === "/boms/compare") return DRAWER_ITEMS.find((i) => i.path === "/boms");
  if (pathname.startsWith("/products/")) {
    const ctx = sessionStorage.getItem("productNavContext");
    return DRAWER_ITEMS.find((i) => i.path === (ctx === "materials" ? "/materials" : "/list-view"));
  }
  return DRAWER_ITEMS.find(
    (i) => pathname === i.path || pathname.startsWith(i.path + "/"),
  );
}

type Pos = { top?: number; left?: number; right?: number; bottom?: number };

function usePopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({});
  const desktopBtn = useRef<HTMLButtonElement | null>(null);
  const mobileBtn = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const btn = isMobile ? mobileBtn.current : desktopBtn.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    if (isMobile) {
      setPos({ bottom: window.innerHeight - r.top + 8, left: 16, right: 16 });
    } else {
      const top = Math.max(8, Math.min(window.innerHeight - 400, r.top));
      setPos({ top, left: r.right + 8 });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current?.contains(t)) return;
      if (desktopBtn.current?.contains(t) || mobileBtn.current?.contains(t)) return;
      if (t.closest("[data-radix-popper-content-wrapper]")) return;
      if (t.closest("[role='dialog']")) return;
      if (t.closest("[data-radix-dialog-overlay]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return { open, setOpen, pos, desktopBtn, mobileBtn, panelRef, toggle };
}

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
  buttonRef,
  showDot,
  prefix,
  to,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  showDot?: boolean;
  prefix?: React.ReactNode;
  to?: string;
}) {
  const inner = (
    <button
      ref={buttonRef as any}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {prefix}
      <Icon className="h-5 w-5" />
      {showDot && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
  if (to) return <Link to={to} aria-label={label}>{inner}</Link>;
  return inner;
}

function DrawerPanel({
  title,
  pos,
  panelRef,
  zIndex = 9999,
  children,
  onClose,
}: {
  title: string;
  pos: Pos;
  panelRef: React.RefObject<HTMLDivElement>;
  zIndex?: number;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", zIndex, ...pos, width: pos.right !== undefined ? undefined : 280 }}
      className="bg-popover text-popover-foreground rounded-lg border shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-1">{children}</div>
    </div>,
    document.body,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { subNav } = useSubNav();
  const { options } = usePageOptions();

  const active = useMemo(() => getActiveItem(pathname), [pathname]);

  const [pinned, setPinnedState] = useState<PinnedItem[]>(() => getPinnedItems());
  useEffect(() => {
    const reload = () => setPinnedState(getPinnedItems());
    window.addEventListener("storage", reload);
    window.addEventListener("pinned-items-changed", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("pinned-items-changed", reload);
    };
  }, []);

  // Sync from profile on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data } = await supabase
          .from("profiles")
          .select("pinned_nav_items")
          .eq("id", u.user.id)
          .maybeSingle();
        const arr = (data as any)?.pinned_nav_items;
        if (Array.isArray(arr) && arr.length) {
          localStorage.setItem("pinnedNavItems", JSON.stringify(arr));
          setPinnedState(arr);
        }
      } catch {}
    })();
  }, []);

  const pinnedPop = usePopover();
  const mainPop = usePopover();
  const subPop = usePopover();
  const optsPop = usePopover();

  const hasOptionsDot =
    !!options?.filterBadge || !!options?.items?.some((i) => i.badge);

  const ActiveIcon = active?.icon ?? Menu;

  const onPinnedClick = (item: PinnedItem) => {
    pinnedPop.setOpen(false);
    if (item.subNavId) {
      if (pathname === item.path && subNav) {
        subNav.onChange(item.subNavId);
        return;
      }
      sessionStorage.setItem("pendingSubNavId", item.subNavId);
    }
    navigate(item.path);
  };

  const Rail = (
    <aside className="hidden md:flex w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-2">
      <Link to="/" aria-label="Home" className="mb-2">
        <div className="w-10 h-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
          <Shirt className="h-5 w-5" />
        </div>
      </Link>

      {pinned.length > 0 && (
        <RailButton
          icon={Pin}
          label="Pinned"
          buttonRef={pinnedPop.desktopBtn}
          onClick={pinnedPop.toggle}
        />
      )}

      <RailButton
        icon={ActiveIcon}
        label={active?.label ?? "Navigate"}
        active
        buttonRef={mainPop.desktopBtn}
        onClick={mainPop.toggle}
      />

      {subNav && (
        <RailButton
          icon={subNav.items.find((i) => i.id === subNav.activeId)?.icon ?? ActiveIcon}
          label={subNav.pageTitle ?? "Section"}
          buttonRef={subPop.desktopBtn}
          onClick={subPop.toggle}
          prefix={
            <ChevronDown className="absolute top-0.5 left-1/2 -translate-x-1/2 h-3 w-3 text-sidebar-foreground/50" />
          }
        />
      )}

      {options && (
        <RailButton
          icon={SlidersHorizontal}
          label="Options"
          buttonRef={optsPop.desktopBtn}
          onClick={optsPop.toggle}
          showDot={hasOptionsDot}
        />
      )}

      <div className="flex-1" />

      <Link to="/config" aria-label="Settings">
        <div className="w-10 h-10 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground grid place-items-center">
          <Settings className="h-5 w-5" />
        </div>
      </Link>
    </aside>
  );

  const MobileTabBar = (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t border-sidebar-border bg-sidebar flex items-center justify-around px-2">
      <Link to="/" className="w-10 h-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
        <Shirt className="h-5 w-5" />
      </Link>
      {pinned.length > 0 && (
        <RailButton icon={Pin} label="Pinned" buttonRef={pinnedPop.mobileBtn} onClick={pinnedPop.toggle} />
      )}
      <RailButton
        icon={ActiveIcon}
        label={active?.label ?? "Navigate"}
        active
        buttonRef={mainPop.mobileBtn}
        onClick={mainPop.toggle}
      />
      {subNav && (
        <RailButton
          icon={subNav.items.find((i) => i.id === subNav.activeId)?.icon ?? ChevronRight}
          label={subNav.pageTitle ?? "Section"}
          buttonRef={subPop.mobileBtn}
          onClick={subPop.toggle}
        />
      )}
      {options && (
        <RailButton
          icon={SlidersHorizontal}
          label="Options"
          buttonRef={optsPop.mobileBtn}
          onClick={optsPop.toggle}
          showDot={hasOptionsDot}
        />
      )}
      <Link to="/config" className="w-10 h-10 rounded-lg text-sidebar-foreground/70 grid place-items-center">
        <Settings className="h-5 w-5" />
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {Rail}
      {/*
        PAGE PADDING RULE: All pages must use px-3 py-3 sm:px-4 md:px-6 at their outermost wrapper.
        Never use p-6, px-8, or max-w-*xl mx-auto at the page root — too much padding on mobile.
        Two-panel layouts: use gap-3 sm:gap-4, panel content p-3 sm:p-4.
      */}
      <div className="flex-1 min-w-0 flex flex-col pb-14 md:pb-0 overflow-x-hidden">{children}</div>
      {MobileTabBar}

      {pinnedPop.open && (
        <DrawerPanel
          title="Pinned"
          pos={pinnedPop.pos}
          panelRef={pinnedPop.panelRef}
          onClose={() => pinnedPop.setOpen(false)}
        >
          {pinned.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer"
              onClick={() => onPinnedClick(p)}
            >
              <Pin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm truncate">{p.label}</span>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(p.path, p.label, p.subNavId);
                }}
                aria-label="Unpin"
              >
                <PinOff className="h-4 w-4" />
              </button>
            </div>
          ))}
        </DrawerPanel>
      )}

      {mainPop.open && (
        <DrawerPanel
          title="Navigate to"
          pos={mainPop.pos}
          panelRef={mainPop.panelRef}
          onClose={() => mainPop.setOpen(false)}
        >
          {DRAWER_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active?.path === item.path;
            const pinnedHere = isPinned(pinned, item.path);
            return (
              <div
                key={item.path}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer",
                  isActive ? "bg-accent" : "hover:bg-accent",
                )}
                onClick={() => {
                  mainPop.setOpen(false);
                  navigate(item.path);
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-sm">{item.label}</span>
                <button
                  className={cn("text-muted-foreground hover:text-foreground", pinnedHere && "text-primary")}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(item.path, item.label);
                  }}
                  aria-label="Pin"
                >
                  <Pin className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </DrawerPanel>
      )}

      {subPop.open && subNav && (
        <DrawerPanel
          title={`${subNav.pageTitle ?? "Section"} › Sections`}
          pos={subPop.pos}
          panelRef={subPop.panelRef}
          onClose={() => subPop.setOpen(false)}
        >
          {subNav.items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === subNav.activeId;
            const label = `${subNav.pageTitle ?? ""} › ${item.label}`;
            const pinnedHere = isPinned(pinned, pathname, item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer",
                  isActive ? "bg-accent" : "hover:bg-accent",
                )}
                onClick={() => {
                  subPop.setOpen(false);
                  subNav.onChange(item.id);
                }}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span className="flex-1 text-sm">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <Badge variant={item.countVariant === "red" ? "destructive" : "secondary"}>
                    {item.count}
                  </Badge>
                )}
                <button
                  className={cn("text-muted-foreground hover:text-foreground", pinnedHere && "text-primary")}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(pathname, label, item.id);
                  }}
                  aria-label="Pin"
                >
                  <Pin className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </DrawerPanel>
      )}

      {optsPop.open && options && (
        <DrawerPanel
          title="Options"
          pos={optsPop.pos}
          panelRef={optsPop.panelRef}
          zIndex={options.customContent ? 40 : 10000}
          onClose={() => optsPop.setOpen(false)}
        >
          {options.items?.map((it, i) => {
            if (it.divider) return <div key={i} className="my-1 h-px bg-border" />;
            if (it.custom) return <div key={i}>{it.custom}</div>;
            const Icon = it.icon;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent",
                  it.className,
                )}
                onClick={() => {
                  it.onClick?.();
                  optsPop.setOpen(false);
                }}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span className="flex-1 text-sm">{it.label}</span>
                {it.badge !== undefined && <Badge variant="secondary">{it.badge}</Badge>}
              </div>
            );
          })}
          {options.customContent && <div className="p-2">{options.customContent}</div>}
        </DrawerPanel>
      )}
    </div>
  );
}
