import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';

interface Sample {
  id: string;
  code: string;
  product_id: string;
  phase?: string | null;
  requested_quantity?: number | null;
  linked_routing_id?: string | null;
}

interface SupplierRouting {
  id: string;
  name: string;
  routing_type: string;
  revision_code?: string | null;
  version?: number | null;
  status?: string | null;
}

interface RoutingStep {
  id: string;
  supplier_routing_id: string;
  sequence: number;
  step_type?: string | null;
  supplier_id?: string | null;
  unit_cost?: number | null;
  currency_id?: string | null;
  lead_time_days?: number | null;
  ships_to_next?: boolean | null;
  input_description?: string | null;
  output_description?: string | null;
  description?: string | null;
  notes?: string | null;
}

interface Currency { id: string; code: string; }
interface Supplier { id: string; name: string; }

function sortRoutings(routings: SupplierRouting[], samplePhase?: string | null): SupplierRouting[] {
  const phaseMatch = (r: SupplierRouting) => {
    if (samplePhase === 'development') return r.routing_type === 'development';
    if (samplePhase === 'production') return r.routing_type === 'production';
    return false;
  };
  return [...routings].sort((a, b) => {
    const diff = (phaseMatch(a) ? 0 : 1) - (phaseMatch(b) ? 0 : 1);
    if (diff !== 0) return diff;
    const revCmp = (b.revision_code ?? '').localeCompare(a.revision_code ?? '');
    if (revCmp !== 0) return revCmp;
    return (b.version ?? 1) - (a.version ?? 1);
  });
}

function routingLabel(r: SupplierRouting) {
  return `${r.name} · [${r.routing_type === 'development' ? 'DEV' : 'PROD'}] · Rev ${r.revision_code ?? '?'} v${r.version ?? 1} · [${(r.status ?? '').toUpperCase()}]`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
  sample: Sample;
}

export default function GenerateSampleRoutingDialog({ open, onClose, onGenerated, sample }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routings, setRoutings] = useState<SupplierRouting[]>([]);
  const [stepsMap, setStepsMap] = useState<Record<string, RoutingStep[]>>({});
  const [suppliersMap, setSuppliersMap] = useState<Record<string, Supplier>>({});
  const [currenciesMap, setCurrenciesMap] = useState<Record<string, Currency>>({});
  const [name, setName] = useState('');
  const [selectedRoutingId, setSelectedRoutingId] = useState<string | null>(null);

  const sortedRoutings = useMemo(() => sortRoutings(routings, sample?.phase), [routings, sample?.phase]);
  const hasReferenceRoutings = sortedRoutings.length > 0;
  const selectedRouting = sortedRoutings.find((r) => r.id === selectedRoutingId) ?? null;
  const previewSteps = selectedRoutingId ? (stepsMap[selectedRoutingId] ?? []) : [];

  useEffect(() => {
    if (!open || !sample) return;
    setName(sample.code ?? '');
    setLoading(true);

    (async () => {
      const [{ data: allRoutings }, { data: allCurrencies }] = await Promise.all([
        supabase.from('supplier_routings').select('*').eq('product_id', sample.product_id),
        supabase.from('currencies').select('id, code'),
      ]);

      const refRoutings = ((allRoutings ?? []) as SupplierRouting[]).filter((r) => r.routing_type === 'development' || r.routing_type === 'production');
      const sorted = sortRoutings(refRoutings, sample.phase);
      setRoutings(sorted);

      const cMap: Record<string, Currency> = {};
      ((allCurrencies ?? []) as Currency[]).forEach((c) => { cMap[c.id] = c; });
      setCurrenciesMap(cMap);

      if (sorted.length > 0) {
        setSelectedRoutingId(sorted[0].id);
        const stepResults = await Promise.all(
          sorted.map((r) =>
            supabase.from('supplier_routing_steps').select('*').eq('supplier_routing_id', r.id).order('sequence')
              .then(({ data }) => ({ routingId: r.id, steps: (data ?? []) as RoutingStep[] }))
          )
        );
        const sMap: Record<string, RoutingStep[]> = {};
        const supplierIds = new Set<string>();
        stepResults.forEach(({ routingId, steps }) => {
          sMap[routingId] = steps;
          steps.forEach((s) => { if (s.supplier_id) supplierIds.add(s.supplier_id); });
        });
        setStepsMap(sMap);

        if (supplierIds.size > 0) {
          const { data: allSuppliers } = await supabase.from('suppliers').select('id, name').in('id', [...supplierIds]);
          const supMap: Record<string, Supplier> = {};
          ((allSuppliers ?? []) as Supplier[]).forEach((s) => { supMap[s.id] = s; });
          setSuppliersMap(supMap);
        }
      } else {
        setSelectedRoutingId(null);
      }
      setLoading(false);
    })();
  }, [open, sample?.id]);

  const handleConfirm = async () => {
    if (!name.trim()) { toast.error('Please enter a name for the sample routing.'); return; }
    if (sample.linked_routing_id) { toast.error('This sample already has a routing linked.'); return; }
    setSaving(true);

    const { data: newRouting, error: routingErr } = await supabase.from('supplier_routings').insert({
      product_id: sample.product_id,
      name: name.trim(),
      routing_type: 'sample',
      revision_code: 'A',
      version: 1,
      status: 'draft',
      is_default: false,
      derived_from_routing_id: selectedRouting?.id ?? null,
      derived_from_revision_code: selectedRouting?.revision_code ?? null,
      notes: `Generated from sample ${sample.code}`,
      pending_eco_review_count: 0,
    }).select().single();

    if (routingErr || !newRouting) {
      toast.error('Failed to create sample routing. Please retry.');
      setSaving(false);
      return;
    }

    const newRoutingId = newRouting.id;

    if (hasReferenceRoutings && selectedRouting) {
      const sourceSteps = stepsMap[selectedRouting.id] ?? [];
      if (sourceSteps.length > 0) {
        const { data: newSteps, error: stepsErr } = await supabase.from('supplier_routing_steps').insert(
          sourceSteps.map((src) => ({
            supplier_routing_id: newRoutingId,
            sequence: src.sequence,
            step_type: src.step_type ?? null,
            supplier_id: src.supplier_id ?? null,
            unit_cost: src.unit_cost ?? null,
            currency_id: src.currency_id ?? null,
            lead_time_days: src.lead_time_days ?? null,
            ships_to_next: src.ships_to_next ?? null,
            input_description: src.input_description ?? null,
            output_description: src.output_description ?? null,
            description: src.description ?? null,
            notes: src.notes ?? null,
          }))
        ).select();

        if (stepsErr || !newSteps) {
          toast.error('Failed to clone routing steps. Sample routing created but empty — add steps manually.');
          await supabase.from('samples').update({ linked_routing_id: newRoutingId }).eq('id', sample.id);
          onGenerated();
          setSaving(false);
          onClose();
          return;
        }

        const { error: sampleStepsErr } = await supabase.from('sample_steps').insert(
          (newSteps as RoutingStep[]).map((newStep) => ({
            sample_id: sample.id,
            source_routing_step_id: newStep.id,
            sequence: newStep.sequence,
            step_type: newStep.step_type ?? null,
            supplier_id: newStep.supplier_id ?? null,
            unit_cost: newStep.unit_cost ?? null,
            currency_id: newStep.currency_id ?? null,
            lead_time_days: newStep.lead_time_days ?? null,
            due_date: null,
            requested_quantity: sample.requested_quantity ?? null,
            workflow_status: 'created',
            workflow_status_changed_at: null,
            workflow_status_changed_by: null,
            conformity_status: 'not_assessed',
            conformity_assessed_at: null,
            conformity_assessed_by: null,
            notes: null,
          }))
        );

        if (sampleStepsErr) {
          toast.error('Failed to create sample steps. The routing was created — retry or contact support.');
          await supabase.from('samples').update({ linked_routing_id: newRoutingId }).eq('id', sample.id);
          onGenerated();
          setSaving(false);
          onClose();
          return;
        }
      }
    }

    await supabase.from('samples').update({ linked_routing_id: newRoutingId }).eq('id', sample.id);

    toast.success(`Sample routing generated for ${sample.code}`, {
      action: { label: 'Open routing', onClick: () => navigate(`/products/${sample.product_id}?tab=suppliers`) },
    });

    setSaving(false);
    onGenerated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Generate Sample Routing</DialogTitle></DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-1">
            {!hasReferenceRoutings && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>No existing routing for this product — a blank sample routing will be created. Add steps after generation.</span>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="sr-name">Name</Label>
              <Input id="sr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Routing name…" />
              <p className="text-[11px] text-muted-foreground">
                {hasReferenceRoutings ? "This becomes the new sample routing's name. Edit if you want a more descriptive name." : "This becomes the new sample routing's name."}
              </p>
            </div>

            {hasReferenceRoutings && (
              <div className="space-y-1">
                <Label>Source Routing</Label>
                <Select value={selectedRoutingId ?? ''} onValueChange={setSelectedRoutingId}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Select a reference routing…" /></SelectTrigger>
                  <SelectContent>
                    {sortedRoutings.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">{routingLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">The new sample routing will be cloned from this source. You can edit steps after generation.</p>
              </div>
            )}

            {hasReferenceRoutings && selectedRoutingId && (
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Steps to clone</p>
                {previewSteps.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Source routing has no steps. Generation will produce a blank sample routing.</p>
                ) : (
                  previewSteps.map((step) => {
                    const sup = suppliersMap[step.supplier_id ?? ''];
                    const cur = currenciesMap[step.currency_id ?? ''];
                    return (
                      <div key={step.id} className="text-xs text-foreground flex items-center gap-1.5">
                        <span className="font-mono text-muted-foreground w-4 shrink-0">{step.sequence}.</span>
                        <span className="font-medium">{step.step_type}</span>
                        {sup && <><span className="text-muted-foreground">·</span><span>{sup.name}</span></>}
                        {step.lead_time_days != null && <><span className="text-muted-foreground">·</span><span>{step.lead_time_days}d</span></>}
                        {step.unit_cost != null && <><span className="text-muted-foreground">·</span><span>{step.unit_cost} {cur?.code ?? ''}</span></>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading || saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            {hasReferenceRoutings ? 'Generate Sample Routing' : 'Generate Blank Sample Routing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
