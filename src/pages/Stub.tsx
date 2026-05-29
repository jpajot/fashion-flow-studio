import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function Stub({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">Coming soon</p>
      </div>
      <Card>
        <CardContent className="py-16 grid place-items-center text-center text-muted-foreground">
          <Construction className="h-10 w-10 mb-2 opacity-40" />
          This section is scaffolded and will be implemented next.
        </CardContent>
      </Card>
    </div>
  );
}
