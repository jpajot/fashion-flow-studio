import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

export type GalleryItem = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  badge?: React.ReactNode;
};

export type GalleryViewProps = {
  items: GalleryItem[];
  onItemClick?: (item: GalleryItem) => void;
  emptyMessage?: string;
  className?: string;
};

export function GalleryView({ items, onItemClick, emptyMessage = "No items", className }: GalleryViewProps) {
  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12 border rounded-md">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        className,
      )}
    >
      {items.map((item) => (
        <Card
          key={item.id}
          className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => onItemClick?.(item)}
        >
          <div className="aspect-square bg-muted relative">
            {item.image ? (
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted-foreground/40">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
            {item.badge && <div className="absolute top-2 right-2">{item.badge}</div>}
          </div>
          <div className="p-3">
            <div className="text-sm font-medium truncate">{item.title}</div>
            {item.subtitle && (
              <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
