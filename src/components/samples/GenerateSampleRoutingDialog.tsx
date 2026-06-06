// TODO(round 9.3): Rewrite "Generate Sample Routing" on top of unified BOMs.
// The original implementation depended on supplier_routings / supplier_routing_steps
// and the now-removed sample_steps.step_type field. The new flow will:
//   - read reference routings from `boms` where bom_type='routing'
//   - clone bom_lines into a new sample routing (bom_type='routing', bom_phase='sample')
//   - link samples.linked_routing_id to that new BOM
//   - create sample_steps rows pointing at source_bom_line_id

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
  sample: { id: string; code: string; product_id: string; phase?: string | null; requested_quantity?: number | null; linked_routing_id?: string | null };
}

export default function GenerateSampleRoutingDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Sample Routing</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            This action is being rewired to the new unified BOM model and will be
            available in round 9.3.
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
