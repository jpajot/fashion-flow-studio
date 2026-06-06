import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Sample { id: string; code: string; linked_routing_id?: string | null; }

interface Props {
  open: boolean;
  sample: Sample | null;
  onClose: () => void;
  onDeleted: () => void;
}

export default function SampleDeleteDialog({ open, sample, onClose, onDeleted }: Props) {
  const [alsoDeleteRouting, setAlsoDeleteRouting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasRouting = !!sample?.linked_routing_id;

  const handleDelete = async () => {
    if (!sample) return;
    setDeleting(true);

    await supabase.from('sample_steps').delete().eq('sample_id', sample.id);

    if (alsoDeleteRouting && sample.linked_routing_id) {
      // TODO(round 9.3): delete the linked routing BOM (bom_type='routing') and its bom_lines.
      // supplier_routings / supplier_routing_steps no longer exist.
    }

    await supabase.from('samples').delete().eq('id', sample.id);

    toast.success(`Sample ${sample.code} deleted`);
    setDeleting(false);
    onClose();
    onDeleted();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v && !deleting) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Sample {sample?.code}?</AlertDialogTitle>
          <AlertDialogDescription>This will delete this sample and all its steps. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>

        {hasRouting && (
          <div className="flex items-start gap-2.5 py-1">
            <Checkbox id="delete-routing" checked={alsoDeleteRouting}
              onCheckedChange={(v) => setAlsoDeleteRouting(Boolean(v))} className="mt-0.5" />
            <Label htmlFor="delete-routing" className="text-sm font-normal leading-snug cursor-pointer">
              Also delete the generated sample routing and its routing steps
            </Label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}Delete Sample
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
