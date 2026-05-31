import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown, ChevronRight, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THUMB_SIZES = [
  { id: "xs", cols: "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9", height: "h-24" },
  { id: "sm", cols: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7", height: "h-32" },
  { id: "md", cols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", height: "h-44" },
  { id: "lg", cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", height: "h-60" },
  { id: "xl", cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3", height: "h-80" },
];

export interface GalleryField {
  id: string;
  label: string;
  getValue?: (row: any) => any;
  render?: (row: any) => React.ReactNode;
}

export interface GalleryViewProps {
  pageKey: string;
  allFields: GalleryField[];
  filterableFields?: Array<{ id: string; label: string; getValue: (row: any) => any }>;
  rows: any[];
  renderThumbnail: (row: any) => React.ReactNode;
  onClickItem?: (row: any) => void;
  activeViewId?: string;
  onSelectView?: (id: string) => void;
}

// ───────────────────────── FieldContextMenu ─────────────────────────
function FieldContextMenu({
  x,
  y,
  fieldLabel,
  onGroup,
  onClose,
}: {
  x: number;
  y: number;
  fieldLabel: string;
  onGroup: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-field-ctx-menu]")) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div
      data-field-ctx-menu
      style={{ position: "fixed", left: x, top: y, zIndex: 9999 }}
      className="min-w-[200px] rounded-md border border-border bg-popover shadow-md py-1 text-sm"
    >
      <button
        onClick={() => {
          onGroup();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
      >
        <Layers className="h-4 w-4" />
        <span className="truncate">Group by {fieldLabel || "field"}</span>
      </button>
    </div>
  );
}

// ───────────────────────── GalleryCard ─────────────────────────
function GalleryCard({
  row,
  activeFields,
  allFields,
  thumbSize,
  renderThumbnail,
  onClickItem,
  onFieldRightClick,
}: {
  row: any;
  activeFields: string[];
  allFields: GalleryField[];
  thumbSize: string;
  renderThumbnail: (row: any) => React.ReactNode;
  onClickItem?: (row: any) => void;
  onFieldRightClick: (e: React.MouseEvent, field: GalleryField) => void;
}) {
  const ts = THUMB_SIZES.find((s) => s.id === thumbSize) ?? THUMB_SIZES[2];
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
      <div
        className={cn(ts.height, "relative overflow-hidden cursor-pointer")}
        onClick={() => onClickItem?.(row)}
      >
        {renderThumbnail(row)}
      </div>
      {activeFields.length > 0 && (
        <div className="px-2.5 py-2 space-y-0.5">
          {activeFields.map((fieldId) => {
            const field = allFields.find((f) => f.id === fieldId);
            if (!field) return null;
            const content = field.render
              ? field.render(row)
              : field.getValue?.(row) ?? "—";
            return (
              <div
                key={fieldId}
                className="text-xs select-none min-w-0 cursor-default truncate"
                onContextMenu={(e) => {
                  e.preventDefault();
                  onFieldRightClick(e, field);
                }}
              >
                {content || <span className="text-muted-foreground/40">—</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Grouping ─────────────────────────
type GroupNode = {
  key: string;
  label: string;
  depth: number;
  rows: any[];
  children: GroupNode[];
};

function buildGroups(
  rows: any[],
  groupCols: string[],
  fields: GalleryField[],
  depth = 0,
): GroupNode[] {
  if (depth >= groupCols.length) return [];
  const fieldId = groupCols[depth];
  const field = fields.find((f) => f.id === fieldId);
  const getKey = (r: any) =>
    (field?.getValue ? field.getValue(r) : r?.[fieldId]) ?? "—";

  const buckets = new Map<string, any[]>();
  for (const r of rows) {
    const k = String(getKey(r) ?? "—");
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const nodes: GroupNode[] = [];
  for (const [k, rs] of buckets) {
    nodes.push({
      key: `${depth}::${k}`,
      label: k,
      depth,
      rows: depth === groupCols.length - 1 ? rs : [],
      children:
        depth < groupCols.length - 1
          ? buildGroups(rs, groupCols, fields, depth + 1)
          : [],
    });
  }
  nodes.sort((a, b) => a.label.localeCompare(b.label));
  return nodes;
}

function flattenKeys(nodes: GroupNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    acc.push(n.key);
    if (n.children.length) flattenKeys(n.children, acc);
  }
  return acc;
}

// ───────────────────────── GalleryView ─────────────────────────
export default function GalleryView({
  pageKey,
  allFields,
  rows,
  renderThumbnail,
  onClickItem,
  activeViewId = "default",
  onSelectView,
}: GalleryViewProps) {
  const [activeFieldIds, setActiveFieldIds] = useState<string[]>(() =>
    allFields.map((f) => f.id),
  );
  const [thumbSize, setThumbSize] = useState<string>(
    () => localStorage.getItem(`gallery_thumb_${pageKey}`) || "md",
  );
  const [groupCols, setGroupCols] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    field: GalleryField;
  } | null>(null);

  const STORAGE_KEY = `gallery_active_view_${pageKey}`;
  const [persistedViewId, setPersistedViewId] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || activeViewId || "default"; }
    catch { return activeViewId || "default"; }
  });

  // Persist thumb size
  useEffect(() => {
    localStorage.setItem(`gallery_thumb_${pageKey}`, thumbSize);
  }, [thumbSize, pageKey]);

  // Sync from parent when controlled prop changes
  useEffect(() => {
    if (activeViewId && activeViewId !== persistedViewId) {
      setPersistedViewId(activeViewId);
      try { localStorage.setItem(STORAGE_KEY, activeViewId); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViewId]);

  // Notify parent of restored view from localStorage on first mount
  useEffect(() => {
    if (persistedViewId !== activeViewId) {
      onSelectView?.(persistedViewId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply saved view when persistedViewId changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (persistedViewId === "default") {
        setActiveFieldIds(allFields.map((f) => f.id));
        setThumbSize("md");
        return;
      }
      const { data } = await supabase
        .from("list_view_configs")
        .select("*")
        .eq("id", persistedViewId)
        .maybeSingle();
      if (cancelled || !data) return;
      const ids = (data as any).column_ids;
      if (Array.isArray(ids) && ids.length) setActiveFieldIds(ids);
      if ((data as any).thumb_size) setThumbSize((data as any).thumb_size);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedViewId]);

  const ts = THUMB_SIZES.find((s) => s.id === thumbSize) ?? THUMB_SIZES[2];

  const groups = useMemo(
    () => (groupCols.length > 0 ? buildGroups(rows, groupCols, allFields) : null),
    [rows, groupCols, allFields],
  );

  useLayoutEffect(() => {
    if (!groups) return;
    setExpanded(new Set(flattenKeys(groups)));
  }, [groups]);

  const addGroup = (id: string) =>
    setGroupCols((g) => (g.includes(id) || g.length >= 3 ? g : [...g, id]));
  const removeGroup = (id: string) =>
    setGroupCols((g) => g.filter((x) => x !== id));
  const clearGroups = () => setGroupCols([]);
  const toggleExpand = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const onFieldRightClick = (e: React.MouseEvent, field: GalleryField) => {
    setContextMenu({ x: e.clientX, y: e.clientY, field });
  };

  const renderGrid = (list: any[]) => (
    <div className={cn("grid gap-3", ts.cols)}>
      {list.map((row, i) => (
        <GalleryCard
          key={row?.id ?? i}
          row={row}
          activeFields={activeFieldIds}
          allFields={allFields}
          thumbSize={thumbSize}
          renderThumbnail={renderThumbnail}
          onClickItem={onClickItem}
          onFieldRightClick={onFieldRightClick}
        />
      ))}
    </div>
  );

  const renderGroup = (node: GroupNode): React.ReactNode => {
    const isOpen = expanded.has(node.key);
    const field = allFields.find((f) => f.id === groupCols[node.depth]);
    const count =
      node.children.length > 0
        ? node.children.reduce((acc, c) => acc + (c.rows.length || 0), 0)
        : node.rows.length;
    return (
      <div key={node.key} className="space-y-2">
        <button
          onClick={() => toggleExpand(node.key)}
          style={{ paddingLeft: 8 + node.depth * 16 }}
          className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/50 hover:bg-muted text-xs font-medium rounded-sm text-left"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span className="text-muted-foreground">{field?.label}:</span>
          <span>{node.label}</span>
          <span className="text-muted-foreground ml-1">({count})</span>
        </button>
        {isOpen && (
          <div className="space-y-2">
            {node.children.length > 0
              ? node.children.map(renderGroup)
              : renderGrid(node.rows)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {groupCols.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">Grouped by:</span>
          {groupCols.map((id) => {
            const f = allFields.find((x) => x.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5"
              >
                {f?.label ?? id}
                <button onClick={() => removeGroup(id)} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <button onClick={clearGroups} className="text-xs text-muted-foreground underline">
            Clear all
          </button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => groups && setExpanded(new Set(flattenKeys(groups)))}
          >
            Expand All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setExpanded(new Set())}
          >
            Collapse All
          </Button>
        </div>
      )}

      {groups ? <div className="space-y-3">{groups.map(renderGroup)}</div> : renderGrid(rows)}

      {contextMenu && (
        <FieldContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          fieldLabel={contextMenu.field.label}
          onGroup={() => addGroup(contextMenu.field.id)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
