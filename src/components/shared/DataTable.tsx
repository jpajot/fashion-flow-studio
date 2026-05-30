import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Columns3,
  Pin,
  PinOff,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T = any> = {
  id: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortKey?: (row: T) => any;
  width?: number | string;
};

export type DataTableProps<T = any> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  fixedColumns?: string[];
  filterFields?: (keyof T | string)[];
  onEdit?: (row: T, columnId: string, value: any) => void;
  hideColumnToggle?: boolean;
  onPinColumn?: (columnId: string, pinned: boolean) => void;
  emptyMessage?: string;
};

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  fixedColumns = [],
  filterFields,
  hideColumnToggle,
  emptyMessage = "No data",
}: DataTableProps<T>) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<Set<string>>(new Set(fixedColumns));
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visibleCols = useMemo(() => {
    const ordered = [...columns].sort((a, b) => {
      const ap = pinned.has(a.id) ? 0 : 1;
      const bp = pinned.has(b.id) ? 0 : 1;
      return ap - bp;
    });
    return ordered.filter((c) => !hidden.has(c.id));
  }, [columns, hidden, pinned]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    const fields = filterFields ?? columns.map((c) => c.id);
    return rows.filter((r) =>
      fields.some((f) => String((r as any)[f] ?? "").toLowerCase().includes(q)),
    );
  }, [rows, filter, filterFields, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return filtered;
    const key = col.sortKey ?? ((r: T) => (r as any)[col.id]);
    return [...filtered].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sort, columns]);

  const grouped = useMemo(() => {
    if (groupBy.length === 0) return null;
    const tree: any = {};
    for (const row of sorted) {
      let node = tree;
      for (const g of groupBy) {
        const key = String((row as any)[g] ?? "—");
        node[key] = node[key] ?? { __rows: [], __children: {} };
        node = node[key].__children;
      }
      // attach row at last group
      let cur = tree;
      for (let i = 0; i < groupBy.length; i++) {
        const key = String((row as any)[groupBy[i]] ?? "—");
        if (i === groupBy.length - 1) cur[key].__rows.push(row);
        cur = cur[key].__children;
      }
    }
    return tree;
  }, [sorted, groupBy]);

  const toggleSort = (id: string) => {
    setSort((s) => {
      if (!s || s.id !== id) return { id, dir: "asc" };
      if (s.dir === "asc") return { id, dir: "desc" };
      return null;
    });
  };

  const addGroup = (id: string) => {
    if (groupBy.includes(id) || groupBy.length >= 3) return;
    setGroupBy([...groupBy, id]);
  };
  const removeGroup = (id: string) => setGroupBy(groupBy.filter((g) => g !== id));

  const togglePin = (id: string) => {
    const next = new Set(pinned);
    next.has(id) ? next.delete(id) : next.add(id);
    setPinned(next);
  };

  const renderRows = (list: T[]) =>
    list.map((row, i) => (
      <TableRow key={i}>
        {visibleCols.map((c) => (
          <TableCell key={c.id} style={c.width ? { width: c.width } : undefined}>
            {c.render ? c.render(row) : String((row as any)[c.id] ?? "")}
          </TableCell>
        ))}
      </TableRow>
    ));

  const renderGroup = (node: any, path: string[], depth: number): React.ReactNode => {
    return Object.keys(node).map((key) => {
      const sub = node[key];
      const pathKey = [...path, key].join("/");
      const isCollapsed = collapsed.has(pathKey);
      const count = countRows(sub);
      return [
        <TableRow key={`g-${pathKey}`} className="bg-muted/50">
          <TableCell colSpan={visibleCols.length} style={{ paddingLeft: 12 + depth * 16 }}>
            <button
              className="inline-flex items-center gap-1 font-medium"
              onClick={() => {
                const next = new Set(collapsed);
                next.has(pathKey) ? next.delete(pathKey) : next.add(pathKey);
                setCollapsed(next);
              }}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>{groupBy[depth]}: {key}</span>
              <span className="text-muted-foreground text-xs ml-2">({count})</span>
            </button>
          </TableCell>
        </TableRow>,
        !isCollapsed && (
          <React.Fragment key={`c-${pathKey}`}>
            {depth + 1 < groupBy.length
              ? renderGroup(sub.__children, [...path, key], depth + 1)
              : renderRows(sub.__rows)}
          </React.Fragment>
        ),
      ];
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs h-8"
        />
        {groupBy.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Grouped by:</span>
            {groupBy.map((g) => (
              <Button key={g} size="sm" variant="secondary" className="h-6 px-2" onClick={() => removeGroup(g)}>
                {g} ✕
              </Button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {!hideColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4 mr-1" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!hidden.has(c.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(hidden);
                    v ? next.delete(c.id) : next.add(c.id);
                    setHidden(next);
                  }}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleCols.map((c) => (
                <TableHead key={c.id} style={c.width ? { width: c.width } : undefined}>
                  <div className="flex items-center gap-1">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(c.id)}
                    >
                      {c.label}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-popover">
                        <DropdownMenuItem onClick={() => addGroup(c.id)}>
                          Group by {c.label}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePin(c.id)}>
                          {pinned.has(c.id) ? (
                            <><PinOff className="h-4 w-4 mr-2" /> Unpin column</>
                          ) : (
                            <><Pin className="h-4 w-4 mr-2" /> Pin column</>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCols.length} className="text-center text-muted-foreground py-8">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : grouped ? (
              renderGroup(grouped, [], 0)
            ) : (
              renderRows(sorted)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function countRows(node: any): number {
  let n = node.__rows?.length ?? 0;
  for (const k of Object.keys(node.__children ?? {})) n += countRows(node.__children[k]);
  return n;
}
