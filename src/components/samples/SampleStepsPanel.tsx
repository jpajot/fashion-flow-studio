import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SampleStepsBulkToolbar from './SampleStepsBulkToolbar';
import { WORKFLOW_STATUS_OPTIONS, getWorkflowStatusStyle, computeParentWorkflowStatus } from '@/lib/sampleStepUtils';
import { CONFORMITY_OPTIONS } from '@/lib/sampleUtils';

interface SampleStep {
  id: string;
  sequence: number;
  // step_type was removed; operation identity is now sample_steps.operation_product_id (FK products).
  // TODO(round 9.3): render the operation product's name here.
  operation_product_id?: string | null;
  supplier_id?: string | null;
  unit_cost?: number | null;
  currency_id?: string | null;
  lead_time_days?: number | null;
  due_date?: string | null;
  requested_quantity?: number | null;
  workflow_status?: string | null;
  workflow_status_changed_at?: string | null;
  workflow_status_changed_by?: string | null;
  conformity_status?: string | null;
  conformity_assessed_at?: string | null;
  conformity_assessed_by?: string | null;
  notes?: string | null;
}

interface Supplier { id: string; code?: string | null; name: string; }
interface SampleLike { id: string; product_id?: string | null; linked_routing_id?: string | null; }
interface CurrentUser { email?: string | null; }

interface Props {
  sample: SampleLike;
  suppliersArray: Supplier[];
  stepsCache: Record<string, SampleStep[] | 'loading' | undefined>;
  onFetchSteps: (sampleId: string) => void;
  onStepUpdate: (stepId: string, updates: Partial<SampleStep>) => Promise<void>;
  onBulkStepUpdate?: (stepIds: string[], updates: Partial<SampleStep>) => Promise<void>;
  currentUser?: CurrentUser | null;
}

function StepInlineDropdown({ value, options, placeholder = '—', onCommit }: {
  value?: string | null;
  options: { value: string; label: string; render?: () => React.ReactNode; renderSelected?: () => React.ReactNode }[];
  placeholder?: string;
  onCommit: (v: string | null) => void;
}) {
  const found = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button"
          className="text-left text-xs flex items-center gap-1 hover:text-primary transition-colors group min-w-0"
          onClick={(e) => e.stopPropagation()}>
          <span className="truncate">
            {value ? (found?.renderSelected?.() ?? found?.label ?? value) : <span className="text-muted-foreground/40">{placeholder}</span>}
          </span>
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-64 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onCommit(null)}>
          <span className="text-muted-foreground italic text-xs">— Clear —</span>
        </DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onCommit(o.value)}
            className={value === o.value ? 'bg-primary/10' : ''}>
            {o.render ? o.render() : <span className="text-xs">{o.label}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StepNumberInput({ value, min, onCommit }: { value?: number | null; min?: number; onCommit: (v: number | null) => void }) {
  const [local, setLocal] = useState(value != null ? String(value) : '');
  const initialRef = useRef<number | null>(value ?? null);
  useEffect(() => { setLocal(value != null ? String(value) : ''); initialRef.current = value ?? null; }, [value]);
  const commit = () => {
    const parsed = local.trim() === '' ? null : Number(local);
    const numeric = parsed !== null && isNaN(parsed) ? null : parsed;
    if (numeric !== initialRef.current) { onCommit(numeric); initialRef.current = numeric; }
  };
  return (
    <Input type="number" min={min} value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className="h-6 w-20 text-xs px-1.5" onClick={(e) => e.stopPropagation()} />
  );
}

function StepDatePicker({ value, onCommit }: { value?: string | null; onCommit: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const display = value ? format(new Date(value + 'T00:00:00'), 'yyyy-MM-dd') : '—';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className="text-xs text-left hover:text-primary transition-colors group flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}>
          <span className={value ? '' : 'text-muted-foreground/40'}>{display}</span>
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value ? new Date(value + 'T00:00:00') : undefined}
          onSelect={(d) => { onCommit(d ? format(d, 'yyyy-MM-dd') : null); setOpen(false); }} initialFocus />
        {value && (
          <div className="p-2 border-t">
            <button type="button" className="text-xs text-destructive hover:underline"
              onClick={() => { onCommit(null); setOpen(false); }}>Clear date</button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StepNotesCell({ value, onCommit }: { value?: string | null; onCommit: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value ?? '');
  const initialRef = useRef<string>(value ?? '');
  useEffect(() => { setLocal(value ?? ''); initialRef.current = value ?? ''; }, [value]);
  const commit = () => {
    setEditing(false);
    if (local !== initialRef.current) { onCommit(local || null); initialRef.current = local; }
  };
  if (editing) {
    return (
      <textarea autoFocus value={local} onChange={(e) => setLocal(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.blur(); }}
        rows={2} className="text-xs border border-input rounded p-1 w-36 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        onClick={(e) => e.stopPropagation()} />
    );
  }
  const display = local ? (local.length > 30 ? local.slice(0, 30) + '…' : local) : null;
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-xs text-left text-muted-foreground hover:text-foreground transition-colors max-w-[130px] truncate"
      title={local || 'Click to add notes'}>
      {display || <span className="text-muted-foreground/30 italic">Add…</span>}
    </button>
  );
}

const conformityOptions = CONFORMITY_OPTIONS.map((o) => ({
  value: o.value, label: o.label,
  render: () => <span className={`text-[10px] px-1.5 py-0.5 rounded border ${o.style}`}>{o.label}</span>,
  renderSelected: () => <span className={`text-[10px] px-1.5 py-0.5 rounded border ${o.style}`}>{o.label}</span>,
}));

const workflowOptions = WORKFLOW_STATUS_OPTIONS.map((o) => {
  const style = getWorkflowStatusStyle(o.value);
  return {
    value: o.value, label: o.label,
    render: () => (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
        style={{ backgroundColor: style.background, color: style.color }}>{o.label}</span>
    ),
    renderSelected: () => (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
        style={{ backgroundColor: style.background, color: style.color }}>{o.label}</span>
    ),
  };
});

export default function SampleStepsPanel({ sample, suppliersArray, stepsCache, onFetchSteps, onStepUpdate, onBulkStepUpdate, currentUser }: Props) {
  const navigate = useNavigate();
  const sampleId = sample.id;

  const rawSteps = stepsCache[sampleId];
  const isLoading = rawSteps === 'loading' || rawSteps === undefined;
  const steps = Array.isArray(rawSteps) ? rawSteps : [];

  const [localSteps, setLocalSteps] = useState<SampleStep[]>(steps);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // computeParentWorkflowStatus reference kept available for parent table consumers
  void computeParentWorkflowStatus;

  useEffect(() => { setLocalSteps(steps); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rawSteps]);
  useEffect(() => { setSelectedIds(new Set()); }, [sampleId]);

  const toggleRow = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds(
    selectedIds.size === steps.length && steps.length > 0 ? new Set() : new Set(steps.map((s) => s.id))
  );

  const handleStepUpdate = useCallback(async (stepId: string, updates: Partial<SampleStep>) => {
    const prev = localSteps.find((s) => s.id === stepId);
    setLocalSteps((curr) => curr.map((s) => s.id === stepId ? { ...s, ...updates } : s));
    try { await onStepUpdate(stepId, updates); }
    catch { setLocalSteps((curr) => curr.map((s) => s.id === stepId ? (prev ?? s) : s)); toast.error('Failed to update step.'); }
  }, [localSteps, onStepUpdate]);

  const handleBulkAction = useCallback(async (updatesFactory: (now: string) => Partial<SampleStep>) => {
    const ids = [...selectedIds];
    const now = new Date().toISOString();
    const updates = updatesFactory(now);
    const prevMap: Record<string, SampleStep | undefined> = {};
    ids.forEach((id) => { prevMap[id] = localSteps.find((s) => s.id === id); });
    setLocalSteps((curr) => curr.map((s) => ids.includes(s.id) ? { ...s, ...updates } : s));
    setSelectedIds(new Set());
    try {
      if (onBulkStepUpdate) await onBulkStepUpdate(ids, updates);
      else await Promise.all(ids.map((id) => onStepUpdate(id, updates)));
      toast.success(`${ids.length} step${ids.length !== 1 ? 's' : ''} updated`);
      onFetchSteps(sampleId);
    } catch {
      setLocalSteps((curr) => curr.map((s) => prevMap[s.id] ?? s));
      toast.error('Bulk update failed. Please retry.');
    }
  }, [selectedIds, localSteps, onStepUpdate, onBulkStepUpdate, onFetchSteps, sampleId]);

  const supplierOptions = suppliersArray.map((s) => ({
    value: s.id,
    label: `${s.code ?? ''} ${s.name}`.trim(),
    render: () => <span className="text-xs flex gap-1.5"><span className="font-mono text-muted-foreground">{s.code}</span>{s.name}</span>,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-6 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading steps…
      </div>
    );
  }

  if (localSteps.length === 0) {
    return (
      <div className="py-4 px-6 text-xs text-muted-foreground flex items-center gap-3">
        <span>No steps defined yet. Steps can be added from the Sample Routing in Product → Suppliers → Section B.</span>
        <button type="button" onClick={() => navigate(`/products/${sample.product_id}`)}
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline whitespace-nowrap">
          Open Sample Routing <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const allSelected = selectedIds.size === localSteps.length && localSteps.length > 0;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="pl-8 pr-2 pb-3 space-y-2">
      <div className="flex items-center justify-between pt-1 pb-0.5">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {localSteps.length} step{localSteps.length !== 1 ? 's' : ''}
        </span>
        <button type="button" onClick={() => onFetchSteps(sampleId)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Refresh steps">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <SampleStepsBulkToolbar
        selectedCount={selectedIds.size}
        suppliersArray={suppliersArray}
        onChangeSupplier={(id) => handleBulkAction(() => ({ supplier_id: id }))}
        onChangeDueDate={(d) => handleBulkAction(() => ({ due_date: d }))}
        onChangeStatus={(status) => handleBulkAction((now) => ({
          workflow_status: status,
          workflow_status_changed_at: now,
          workflow_status_changed_by: currentUser?.email ?? null,
        }))}
      />

      <div className="border border-border rounded-lg overflow-hidden border-l-2 border-l-muted-foreground/20">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-8 px-2 py-1.5 text-left">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-3 w-3"
                  data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'} />
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-10">Seq</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-32">Step Type</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-44">Supplier</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-24">Lead Time</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-28">Due Date</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-20">Req. Qty</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-32">Workflow</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-32">Conformity</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {localSteps.map((step) => {
              const isSelected = selectedIds.has(step.id);
              return (
                <tr key={step.id} className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                  <td className="px-2 py-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(step.id)} className="h-3 w-3" />
                  </td>
                  <td className="px-2 py-2 font-mono text-muted-foreground">{step.sequence}</td>
                  <td className="px-2 py-2 text-foreground">
                    {step.step_type
                      ? step.step_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                      : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-2 py-2">
                    <StepInlineDropdown value={step.supplier_id} options={supplierOptions} placeholder="—"
                      onCommit={(v) => handleStepUpdate(step.id, { supplier_id: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <StepNumberInput value={step.lead_time_days} min={0}
                      onCommit={(v) => handleStepUpdate(step.id, { lead_time_days: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <StepDatePicker value={step.due_date} onCommit={(v) => handleStepUpdate(step.id, { due_date: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <StepNumberInput value={step.requested_quantity} min={1}
                      onCommit={(v) => handleStepUpdate(step.id, { requested_quantity: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <StepInlineDropdown value={step.workflow_status} options={workflowOptions} placeholder="—"
                      onCommit={(v) => {
                        if (!v) return;
                        const now = new Date().toISOString();
                        handleStepUpdate(step.id, { workflow_status: v, workflow_status_changed_at: now, workflow_status_changed_by: currentUser?.email ?? null });
                      }} />
                  </td>
                  <td className="px-2 py-2">
                    <StepInlineDropdown value={step.conformity_status} options={conformityOptions} placeholder="—"
                      onCommit={(v) => {
                        if (!v) return;
                        const now = new Date().toISOString();
                        handleStepUpdate(step.id, { conformity_status: v, conformity_assessed_at: now, conformity_assessed_by: currentUser?.email ?? null });
                      }} />
                  </td>
                  <td className="px-2 py-2">
                    <StepNotesCell value={step.notes} onCommit={(v) => handleStepUpdate(step.id, { notes: v })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
