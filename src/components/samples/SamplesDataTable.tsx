import { useState, useCallback, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronDown, MoreVertical, Wand2, X, ChevronsDown, ChevronsUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SampleStepsPanel from './SampleStepsPanel';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import GenerateSampleRoutingDialog from './GenerateSampleRoutingDialog';
import { SAMPLE_TYPE_LABELS, CONFORMITY_LABEL_MAP, CONFORMITY_STYLE_MAP } from '@/lib/sampleUtils';
import { computeParentWorkflowStatus } from '@/lib/sampleStepUtils';

export interface Sample {
  id: string;
  code: string;
  product_id?: string | null;
  project_id?: string | null;
  supplier_request_id?: string | null;
  product_color_id?: string | null;
  product_color_and_more_id?: string | null;
  size_id?: string | null;
  sample_type?: string | null;
  phase?: string | null;
  requested_quantity?: number | null;
  linked_routing_id?: string | null;
  conformity_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface SampleFilters {
  search: string;
  sampleTypes: string[];
  phases: string[];
  conformities: string[];
  suppliers: string[];
  routing: 'all' | 'with' | 'without';
  dueWindow: 'all' | 'overdue' | 'due_today' | 'due_2d' | 'due_7d';
}

export const DEFAULT_SAMPLE_FILTERS: SampleFilters = {
  search: '', sampleTypes: [], phases: [], conformities: [],
  suppliers: [], routing: 'all', dueWindow: 'all',
};

interface Supplier { id: string; code?: string | null; name: string; }
interface ProductColor { id: string; color_name: string; colorway_code?: string | null; color_hex?: string | null; product_id?: string | null; }
interface Pcam { id: string; name?: string | null; product_color_id: string; }
interface Size { id: string; name: string; size_code?: string | null; }
interface Project { id: string; name: string; }
interface SupplierRequest { id: string; code?: string | null; }
interface Product { id: string; code?: string | null; name: string; images?: string[] | null; }

interface SampleStep {
  id: string;
  sequence: number;
  supplier_id?: string | null;
  due_date?: string | null;
  workflow_status?: string | null;
  [k: string]: unknown;
}

interface Props {
  samples: Sample[];
  columnSet: 'product_context' | 'project_context' | 'rfq_context';
  onRowUpdate: (sampleId: string, updates: Partial<Sample>) => Promise<void>;
  onRoutingGenerated: () => void;
  onStepUpdate: (stepId: string, updates: Record<string, unknown>) => Promise<void>;
  suppliersArray?: Supplier[];
  currentUser?: { email?: string | null } | null;
  emptyState?: { icon?: React.ComponentType<{ className?: string }>; title?: string; body?: string; ctaLabel?: string; ctaOnClick?: () => void };
  colorsMap?: Record<string, ProductColor>;
  pcamsMap?: Record<string, Pcam>;
  sizesMap?: Record<string, Size>;
  projectsMap?: Record<string, Project>;
  rfqsMap?: Record<string, SupplierRequest>;
  productsMap?: Record<string, Product>;
  colorsByProduct?: Record<string, ProductColor[]>;
  pcamsByColor?: Record<string, Pcam[]>;
  sizesByProduct?: Record<string, Size[]>;
  filters?: SampleFilters;
  onFiltersChange?: (f: SampleFilters) => void;
  activeViewId?: string;
}

function isDefaultFilters(f: SampleFilters): boolean {
  return !f.search && f.sampleTypes.length === 0 && f.phases.length === 0 && f.conformities.length === 0
    && f.suppliers.length === 0 && f.routing === 'all' && f.dueWindow === 'all';
}

export default function SamplesDataTable({
  samples, columnSet, onRowUpdate, onRoutingGenerated, onStepUpdate,
  suppliersArray = [], currentUser, emptyState,
  colorsMap = {}, pcamsMap = {}, sizesMap = {}, projectsMap = {}, rfqsMap = {}, productsMap = {},
  colorsByProduct = {}, pcamsByColor = {}, sizesByProduct = {},
  filters: filtersProp, onFiltersChange, activeViewId,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stepsCache, setStepsCache] = useState<Record<string, SampleStep[] | 'loading' | undefined>>({});
  const [internalFilters, setInternalFilters] = useState<SampleFilters>(DEFAULT_SAMPLE_FILTERS);
  const [routingDialog, setRoutingDialog] = useState<Sample | null>(null);

  const filters = filtersProp ?? internalFilters;
  const setFilters = (next: SampleFilters) => {
    if (onFiltersChange) onFiltersChange(next);
    else setInternalFilters(next);
  };

  const fetchSteps = useCallback(async (sampleId: string) => {
    setStepsCache((prev) => ({ ...prev, [sampleId]: 'loading' }));
    const { data } = await supabase.from('sample_steps').select('*').eq('sample_id', sampleId).order('sequence');
    setStepsCache((prev) => ({ ...prev, [sampleId]: (data ?? []) as SampleStep[] }));
  }, []);

  const toggleExpand = (sample: Sample) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sample.id)) { next.delete(sample.id); }
      else { next.add(sample.id); if (!stepsCache[sample.id]) fetchSteps(sample.id); }
      return next;
    });
  };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const datePlus = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const isInDueWindow = (steps: SampleStep[], window: SampleFilters['dueWindow']) => {
    if (window === 'all') return true;
    const todayStr = today;
    return steps.some((st) => {
      if (!st.due_date) return false;
      const dd = st.due_date.slice(0, 10);
      if (window === 'overdue') {
        const ws = st.workflow_status ?? '';
        if (ws === 'received' || ws === 'partially_received') return false;
        return dd < todayStr;
      }
      if (window === 'due_today') return dd === todayStr;
      if (window === 'due_2d') return dd >= todayStr && dd <= datePlus(2);
      if (window === 'due_7d') return dd >= todayStr && dd <= datePlus(7);
      return false;
    });
  };

  const filtered = samples.filter((s) => {
    if (filters.sampleTypes.length && !filters.sampleTypes.includes(s.sample_type ?? '')) return false;
    if (filters.phases.length && !filters.phases.includes(s.phase ?? '')) return false;
    if (filters.conformities.length && !filters.conformities.includes(s.conformity_status ?? '')) return false;
    if (filters.routing === 'with' && !s.linked_routing_id) return false;
    if (filters.routing === 'without' && s.linked_routing_id) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!s.code.toLowerCase().includes(q) && !(s.notes ?? '').toLowerCase().includes(q)) return false;
    }
    if (filters.suppliers.length) {
      const cached = stepsCache[s.id];
      if (Array.isArray(cached)) {
        if (!cached.some((st) => st.supplier_id && filters.suppliers.includes(st.supplier_id))) return false;
      }
    }
    if (filters.dueWindow !== 'all') {
      const cached = stepsCache[s.id];
      if (Array.isArray(cached)) {
        if (!isInDueWindow(cached, filters.dueWindow)) return false;
      }
    }
    return true;
  });

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.search) chips.push({ key: 'search', label: `Search: ${filters.search}`, clear: () => setFilters({ ...filters, search: '' }) });
  filters.sampleTypes.forEach((t) => chips.push({ key: `t-${t}`, label: `Type: ${SAMPLE_TYPE_LABELS[t] ?? t}`, clear: () => setFilters({ ...filters, sampleTypes: filters.sampleTypes.filter((x) => x !== t) }) }));
  filters.phases.forEach((p) => chips.push({ key: `p-${p}`, label: `Phase: ${p}`, clear: () => setFilters({ ...filters, phases: filters.phases.filter((x) => x !== p) }) }));
  filters.conformities.forEach((c) => chips.push({ key: `c-${c}`, label: `Conformity: ${CONFORMITY_LABEL_MAP[c] ?? c}`, clear: () => setFilters({ ...filters, conformities: filters.conformities.filter((x) => x !== c) }) }));
  filters.suppliers.forEach((sid) => {
    const sup = suppliersArray.find((x) => x.id === sid);
    chips.push({ key: `s-${sid}`, label: `Supplier: ${sup?.name ?? sid}`, clear: () => setFilters({ ...filters, suppliers: filters.suppliers.filter((x) => x !== sid) }) });
  });
  if (filters.routing !== 'all') chips.push({ key: 'r', label: `Routing: ${filters.routing}`, clear: () => setFilters({ ...filters, routing: 'all' }) });
  if (filters.dueWindow !== 'all') chips.push({ key: 'd', label: `Due: ${filters.dueWindow.replace('_', ' ')}`, clear: () => setFilters({ ...filters, dueWindow: 'all' }) });

  void pcamsMap; void rfqsMap; void colorsByProduct; void pcamsByColor; void sizesByProduct; void activeViewId;

  return (
    <div className="space-y-3">
      {!isDefaultFilters(filters) && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border">
              {c.label}
              <button type="button" onClick={c.clear} className="hover:text-destructive"><X className="w-3 h-3" /></button>
            </span>
          ))}
          <button type="button" onClick={() => setFilters(DEFAULT_SAMPLE_FILTERS)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1">Clear all</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
          {emptyState?.icon && <emptyState.icon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />}
          <p className="text-sm font-medium">{emptyState?.title ?? 'No samples'}</p>
          {emptyState?.body && <p className="text-xs text-muted-foreground mt-1">{emptyState.body}</p>}
          {emptyState?.ctaLabel && emptyState.ctaOnClick && (
            <Button size="sm" className="mt-3" onClick={emptyState.ctaOnClick}>{emptyState.ctaLabel}</Button>
          )}
        </div>
      ) : (
        <>
        {(() => {
          const expandableIds = filtered.filter((r) => !!r.linked_routing_id).map((r) => r.id);
          const allExpanded = expandableIds.length > 0 && expandableIds.every((id) => expandedIds.has(id));
          const toggleExpandAll = () => {
            if (allExpanded) {
              setExpandedIds(new Set());
            } else {
              const next = new Set(expandedIds);
              expandableIds.forEach((id) => {
                next.add(id);
                if (!stepsCache[id]) fetchSteps(id);
              });
              setExpandedIds(next);
            }
          };
          if (expandableIds.length === 0) return null;
          return (
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">{filtered.length} sample{filtered.length !== 1 ? 's' : ''}</span>
              <button type="button" onClick={toggleExpandAll}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                {allExpanded
                  ? <><ChevronsUp className="w-3 h-3" />Collapse all</>
                  : <><ChevronsDown className="w-3 h-3" />Expand all</>}
              </button>
            </div>
          );
        })()}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Code</th>
                  {columnSet === 'product_context' && <>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Color</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Size</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Project</th>
                  </>}
                  {columnSet === 'project_context' && <>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Product</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Color</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Size</th>
                  </>}
                  {columnSet === 'rfq_context' && <>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Product</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Color</th>
                  </>}
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Qty</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Workflow</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Conformity</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const expanded = expandedIds.has(r.id);
                  const steps = stepsCache[r.id];
                  const stepArray = Array.isArray(steps) ? steps : [];
                  const parentStatus = computeParentWorkflowStatus(stepArray);
                  const color = r.product_color_id ? colorsMap[r.product_color_id] : null;
                  const size = r.size_id ? sizesMap[r.size_id] : null;
                  const product = r.product_id ? productsMap[r.product_id] : null;
                  const project = r.project_id ? projectsMap[r.project_id] : null;
                  const conf = r.conformity_status ?? 'not_assessed';
                  return (
                    <Fragment key={r.id}>
                      <tr className="hover:bg-muted/30">
                        <td className="px-2 py-2">
                          {r.linked_routing_id && (
                            <button type="button" onClick={() => toggleExpand(r)} className="p-0.5 hover:bg-muted rounded">
                              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2 font-mono"><Link to={`/samples/${r.id}`} className="text-primary hover:underline">{r.code}</Link></td>
                        {columnSet === 'product_context' && <>
                          <td className="px-2 py-2">{color?.color_name ?? '—'}</td>
                          <td className="px-2 py-2">{size?.size_code ?? size?.name ?? '—'}</td>
                          <td className="px-2 py-2">{project?.name ?? '—'}</td>
                        </>}
                        {columnSet === 'project_context' && <>
                          <td className="px-2 py-2">{product?.name ?? '—'}</td>
                          <td className="px-2 py-2">{color?.color_name ?? '—'}</td>
                          <td className="px-2 py-2">{size?.size_code ?? size?.name ?? '—'}</td>
                        </>}
                        {columnSet === 'rfq_context' && <>
                          <td className="px-2 py-2">{product?.name ?? '—'}</td>
                          <td className="px-2 py-2">{color?.color_name ?? '—'}</td>
                        </>}
                        <td className="px-2 py-2">{r.sample_type ? SAMPLE_TYPE_LABELS[r.sample_type] ?? r.sample_type : '—'}</td>
                        <td className="px-2 py-2">{r.requested_quantity ?? '—'}</td>
                        <td className="px-2 py-2"><WorkflowStatusBadge status={parentStatus} /></td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border ${CONFORMITY_STYLE_MAP[conf]}`}>{CONFORMITY_LABEL_MAP[conf] ?? conf}</span>
                        </td>
                        <td className="px-2 py-2">
                          {!r.linked_routing_id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 hover:bg-muted rounded"><MoreVertical className="w-3.5 h-3.5" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setRoutingDialog(r)} className="text-xs gap-2">
                                  <Wand2 className="w-3.5 h-3.5" />Generate Sample Routing
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                      {expanded && r.linked_routing_id && (
                        <tr>
                          <td colSpan={20} className="bg-muted/10">
                            <SampleStepsPanel
                              sample={r}
                              suppliersArray={suppliersArray}
                              stepsCache={stepsCache}
                              onFetchSteps={fetchSteps}
                              onStepUpdate={onStepUpdate}
                              currentUser={currentUser}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {routingDialog && (
        <GenerateSampleRoutingDialog
          open={!!routingDialog}
          sample={routingDialog as { id: string; code: string; product_id: string }}
          onClose={() => setRoutingDialog(null)}
          onGenerated={() => { setRoutingDialog(null); onRoutingGenerated(); }}
        />
      )}

      {false && onRowUpdate && <span />}
    </div>
  );
}
