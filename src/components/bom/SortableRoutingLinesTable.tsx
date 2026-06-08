import { useMemo } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Column {
  id: string;
  label: string;
  width?: number;
  render: (row: any) => React.ReactNode;
}

interface Props {
  rows: any[];
  columns: Column[];
  onReorder: (rows: any[]) => void;
  disabled?: boolean;
  onRowClick?: (row: any) => void;
}

function SortableRow({ row, columns, onRowClick, disabled }: {
  row: any; columns: Column[]; onRowClick?: (r: any) => void; disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style} className="border-b border-border hover:bg-muted/30">
      <td className="w-8 px-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={`p-1 rounded hover:bg-muted ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
          aria-label="Drag to reorder"
          disabled={disabled}
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </td>
      {columns.map(col => (
        <td
          key={col.id}
          className="px-2 py-1.5 text-sm"
          style={{ width: col.width, maxWidth: col.width }}
          onClick={col.id === "actions" ? undefined : () => onRowClick?.(row)}
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
}

export default function SortableRoutingLinesTable({ rows, columns, onReorder, disabled, onRowClick }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => rows.map(r => r.id), [rows]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = rows.findIndex(r => r.id === active.id);
    const newIdx = rows.findIndex(r => r.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(rows, oldIdx, newIdx).map((r, i) => ({ ...r, position: i + 1 }));
    onReorder(reordered);
    // Persist new positions
    await Promise.all(
      reordered.map(r => supabase.from("bom_lines").update({ position: r.position }).eq("id", r.id))
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-8 px-1"></th>
              {columns.map(c => (
                <th
                  key={c.id}
                  className="px-2 py-2 text-left text-[11px] font-medium text-muted-foreground"
                  style={{ width: c.width, maxWidth: c.width }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {rows.map(r => (
                <SortableRow
                  key={r.id}
                  row={r}
                  columns={columns}
                  disabled={disabled}
                  onRowClick={onRowClick}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}
