// TODO(round 9.3): Rebuild the Routing editor on top of unified BOMs
// (bom_type='routing', bom_lines, bom_line_role='cutting|assembly|…').
// The original implementation depended on supplier_routings / supplier_routing_steps,
// which were dropped from the schema.

import { GitBranch } from "lucide-react";

export default function RoutingLifecycleSection(_props: any) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 flex flex-col items-center gap-2 text-center">
      <GitBranch className="w-5 h-5 text-muted-foreground" />
      <p className="text-sm font-medium">Routing editor — coming in round 9.3</p>
      <p className="text-xs text-muted-foreground max-w-md">
        Routings now live inside the unified BOM model
        (<code className="text-[11px]">bom_type=&apos;routing&apos;</code>). The new builder will be
        wired up in the next round.
      </p>
    </div>
  );
}
