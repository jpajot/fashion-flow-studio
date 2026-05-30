import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Layers, Pin, PinOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T = any> = {
  id: string;
  label: string;
  width?: number;
  render?: (row: T) => React.ReactNode;
  sortKey?: (row: T) => any;
  editable?: boolean;
};

export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  rows: T[];
  fixedColumns?: string[];
  filterFields?: Array<{ id: string; getValue: (row: T) => any }>;
  hideColumnToggle?: boolean;
  onPinColumn?: (colId: string) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  groupOptions?: any;
  getGroupKey?: any;
}

// ───────────────────────── ResizeHandle ─────────────────────────
function ResizeHandle({
  colId,
  onResize,
}: {
  colId: string;
  onResize: (id: string, delta: number) => void;
}) {
  const startX = useRef(0);
  const dragging = useRef(false);

  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    const delta = clientX - startX.current;
    startX.current = clientX;
    if (delta !== 0) onResize(colId, delta);
  };

  const start = (clientX: number) => {
    dragging.current = true;
    startX.current = clientX;
    const move = (e: MouseEvent) => onMove(e.clientX);
    const tmove = (e: TouchEvent) => onMove(e.touches[0].clientX);
    const end = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", tmove);
      window.removeEventListener("touchend", end);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", tmove);
    window.addEventListener("touchend", end);
  };

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(e.clientX);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        start(e.touches[0].clientX);
      }}
      className="absolute right-0 top-0 h-full w-3 cursor-col-resize group/resize z-10"
    >
      <div className="absolute right-1 top-0 h-full w-px bg-transparent group-hover/resize:bg-primary/40 transition-colors" />
    </div>
  );
}

// ───────────────────────── ColContextMenu ─────────────────────────
function ColContextMenu({
  x,
  y,
  colLabel,
  isPinned,
  onGroup,
  onPin,
  onClose,
}: {
  x: number;
  y: number;
  colLabel: string;
  isPinned: boolean;
  onGroup: () => void;
  onPin: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-col-ctx-menu]")) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      data-col-ctx-menu
      style={{ left: x, top: y, position: "fixed", zIndex: 9999 }}
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
        <span className="truncate">Group by {colLabel || "column"}</span>
      </button>
      <button
        onClick={() => {
          onPin();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
      >
        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        <span>{isPinned ? "Unpin column" : "Pin column"}</span>
      </button>
    </div>
  );
}

// ───────────────────────── Grouping helpers ─────────────────────────
type GroupNode = {
  key: string;
  label: string;
  depth: number;
  rows: any[];
  children: GroupNode[];
};

function buildNestedGroups(
  rows: any[],
  groupCols: string[],
  columns: DataTableColumn[],
  depth = 0,
): GroupNode[] {
  if (depth >= groupCols.length) return [];
  const colId = groupCols[depth];
  const col = columns.find((c) => c.id === colId);
  const getKey = (r: any) => {
    if (col?.sortKey) return col.sortKey(r) ?? "—";
    return r?.[colId] ?? "—";
  };

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
          ? buildNestedGroups(rs, groupCols, columns, depth + 1)
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

// ───────────────────────── TableContent ─────────────────────────
function TableContent({
  columns,
  rows,
  fixedColumns,
  colWidths,
  onResize,
  onHeaderContextMenu,
  onRowClick,
  sort,
  onSort,
}: {
  columns: DataTableColumn[];
  rows: any[];
  fixedColumns: string[];
  colWidths: Record<string, number>;
  onResize: (id: string, delta: number) => void;
  onHeaderContextMenu: (e: React.MouseEvent, col: DataTableColumn) => void;
  onRowClick?: (row: any) => void;
  sort: { id: string; dir: "asc" | "desc" } | null;
  onSort: (id: string) => void;
}) {
  const widthOf = (c: DataTableColumn) => colWidths[c.id] ?? c.width ?? 120;

  // Order: fixed columns first (in fixedColumns order), then the rest
  const ordered = useMemo(() => {
    const fixed = fixedColumns
      .map((id) => columns.find((c) => c.id === id))
      .filter(Boolean) as DataTableColumn[];
    const fixedIds = new Set(fixed.map((c) => c.id));
    const rest = columns.filter((c) => !fixedIds.has(c.id));
    return [...fixed, ...rest];
  }, [columns, fixedColumns]);

  // Cumulative left offsets for sticky columns
  const leftOffsets = useMemo(() => {
    const m: Record<string, number> = {};
    let acc = 0;
    for (const c of ordered) {
      if (fixedColumns.includes(c.id)) {
        m[c.id] = acc;
        acc += widthOf(c);
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, colWidths, fixedColumns]);

  return (
    <div className="max-h-[calc(100vh-220px)] overflow-x-auto overflow-y-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            {ordered.map((c) => {
              const isFixed = fixedColumns.includes(c.id);
              const w = widthOf(c);
              const sorted = sort?.id === c.id;
              return (
                <th
                  key={c.id}
                  style={{
                    width: w,
                    minWidth: w,
                    ...(isFixed ? { left: leftOffsets[c.id], position: "sticky" } : null),
                  }}
                  onContextMenu={(e) => onHeaderContextMenu(e, c)}
                  className={cn(
                    "sticky top-0 z-20 bg-muted/40 text-left text-xs font-medium text-muted-foreground select-none",
                    "px-3 py-2 border-b border-border/60",
                    isFixed && "z-30 border-r border-border/60",
                  )}
                >
                  <div className="relative pr-3 flex items-center gap-1">
                    <button
                      onClick={() => onSort(c.id)}
                      className="truncate hover:text-foreground transition-colors"
                    >
                      {c.label}
                      {sorted && (
                        <span className="ml-1 text-[10px]">
                          {sort?.dir === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </button>
                    <ResizeHandle colId={c.id} onResize={onResize} />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={ordered.length}
                className="text-center text-muted-foreground py-8"
              >
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  onRowClick && "cursor-pointer",
                )}
              >
                {ordered.map((c) => {
                  const isFixed = fixedColumns.includes(c.id);
                  const w = widthOf(c);
                  return (
                    <td
                      key={c.id}
                      style={{
                        width: w,
                        minWidth: w,
                        ...(isFixed
                          ? { left: leftOffsets[c.id], position: "sticky" }
                          : null),
                      }}
                      className={cn(
                        "px-3 py-2 border-b border-border/40 align-middle",
                        isFixed && "sticky bg-card z-[5] border-r border-border/60",
                      )}
                    >
                      {c.render ? c.render(row) : (row as any)[c.id] ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────── DataTable ─────────────────────────
export default function DataTable<T extends Record<string, any> = any>({
  columns,
  rows,
  fixedColumns: fixedColumnsProp = [],
  onPinColumn,
  onRowClick,
}: DataTableProps<T>) {
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [fixedColumns, setFixedColumns] = useState<string[]>(fixedColumnsProp);
  const [groupCols, setGroupCols] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    colId: string;
    colLabel: string;
  } | null>(null);

  // Sync fixedColumns when prop changes
  useEffect(() => {
    setFixedColumns(fixedColumnsProp);
  }, [fixedColumnsProp.join(",")]);

  const onResize = (id: string, delta: number) => {
    setColWidths((w) => {
      const cur = w[id] ?? columns.find((c) => c.id === id)?.width ?? 120;
      const next = Math.max(48, cur + delta);
      return { ...w, [id]: next };
    });
  };

  const addGroupCol = (id: string) => {
    setGroupCols((g) => (g.includes(id) || g.length >= 3 ? g : [...g, id]));
  };
  const removeGroupCol = (id: string) =>
    setGroupCols((g) => g.filter((x) => x !== id));
  const clearGroups = () => setGroupCols([]);

  const togglePin = (id: string) => {
    setFixedColumns((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
    onPinColumn?.(id);
  };

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return rows;
    const key = col.sortKey ?? ((r: any) => r?.[col.id]);
    return [...rows].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sort, columns]);

  const grouped = useMemo(
    () => (groupCols.length > 0 ? buildNestedGroups(sorted, groupCols, columns) : null),
    [sorted, groupCols, columns],
  );

  // Default to all groups expanded
  useLayoutEffect(() => {
    if (!grouped) return;
    setExpanded(new Set(flattenKeys(grouped)));
  }, [grouped]);

  const expandAll = () => grouped && setExpanded(new Set(flattenKeys(grouped)));
  const collapseAll = () => setExpanded(new Set());
  const toggleExpand = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const onHeaderContextMenu = (e: React.MouseEvent, col: DataTableColumn) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, colId: col.id, colLabel: col.label });
  };

  const renderGroup = (node: GroupNode): React.ReactNode => {
    const isOpen = expanded.has(node.key);
    return (
      <div key={node.key} className="space-y-1">
        <button
          onClick={() => toggleExpand(node.key)}
          style={{ paddingLeft: 8 + node.depth * 16 }}
          className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/50 hover:bg-muted text-xs font-medium rounded-sm text-left"
        >
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className="text-muted-foreground">
            {columns.find((c) => c.id === groupCols[node.depth])?.label}:
          </span>
          <span>{node.label}</span>
          <span className="text-muted-foreground ml-1">
            ({node.children.length > 0
              ? node.children.reduce((acc, c) => acc + (c.rows.length || 0), 0)
              : node.rows.length})
          </span>
        </button>
        {isOpen && (
          <div className="space-y-1">
            {node.children.length > 0
              ? node.children.map(renderGroup)
              : (
                <TableContent
                  columns={columns}
                  rows={node.rows}
                  fixedColumns={fixedColumns}
                  colWidths={colWidths}
                  onResize={onResize}
                  onHeaderContextMenu={onHeaderContextMenu}
                  onRowClick={onRowClick}
                  sort={sort}
                  onSort={(id) =>
                    setSort((s) =>
                      !s || s.id !== id
                        ? { id, dir: "asc" }
                        : s.dir === "asc"
                          ? { id, dir: "desc" }
                          : null,
                    )
                  }
                />
              )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {groupCols.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">Grouped by:</span>
          {groupCols.map((id) => {
            const col = columns.find((c) => c.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5"
              >
                {col?.label ?? id}
                <button onClick={() => removeGroupCol(id)} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <button onClick={clearGroups} className="text-xs text-muted-foreground underline">
            Clear all
          </button>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={expandAll}>
            Expand All
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      )}

      {grouped ? (
        <div className="space-y-1">{grouped.map(renderGroup)}</div>
      ) : (
        <TableContent
          columns={columns}
          rows={sorted}
          fixedColumns={fixedColumns}
          colWidths={colWidths}
          onResize={onResize}
          onHeaderContextMenu={onHeaderContextMenu}
          onRowClick={onRowClick}
          sort={sort}
          onSort={(id) =>
            setSort((s) =>
              !s || s.id !== id
                ? { id, dir: "asc" }
                : s.dir === "asc"
                  ? { id, dir: "desc" }
                  : null,
            )
          }
        />
      )}

      {contextMenu && (
        <ColContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          colLabel={contextMenu.colLabel}
          isPinned={fixedColumns.includes(contextMenu.colId)}
          onGroup={() => addGroupCol(contextMenu.colId)}
          onPin={() => togglePin(contextMenu.colId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export { DataTable };
