import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronDown, MoreVertical, Wand2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SampleStepsPanel from './SampleStepsPanel';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import GenerateSampleRoutingDialog from './GenerateSampleRoutingDialog';
import { SAMPLE_TYPE_OPTIONS, SAMPLE_TYPE_LABELS, CONFORMITY_OPTIONS, CONFORMITY_LABEL_MAP, CONFORMITY_STYLE_MAP } from '@/lib/sampleUtils';
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

interface Supplier { id: string; code?: string | null; name: string; }
interface ProductColor { id: string; color_name: string; colorway_code?: string | null; color_hex?: string | null; product_id?: string | null; }
interface Pcam { id: string; name?: string | null; product_color_id: string; }
interface Size { id: string; name: string; size_code?: string | null; }
interface Project { id: string; name: string; }
interface SupplierRequest { id: string; code?: string | null; }
interface Product { id: string; code?: string | null; name: string; images?: string[] | null; }

interface SampleStep { id: string; sequence: number; workflow_status?: string | null; [k: string]: unknown; }

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
}

export default function SamplesDataTable({
  samples, columnSet, onRowUpdate, onRoutingGenerated, onStepUpdate,
  suppliersArray = [], currentUser, emptyState,
  colorsMap = {}, pcamsMap = {}, sizesMap = {}, projectsMap = {}, rfqsMap = {}, productsMap = {},
  colorsByProduct = {}, pcamsByColor = {}, sizesByProduct = {},
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stepsCache, setStepsCache] = useState<Record<string, SampleStep[] | 'loading' | undefined>>({});
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterConformity, setFilterConformity] = useState('all');
  const [filterRouting, setFilterRouting] = useState('all');
  const [routingDialog, setRoutingDialog] = useState<Sample | null>(null);

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

  const filtered = samples.filter((s) => {
    if (filterType !== 'all' && s.sample_type !== filterType) return false;
    if (filterConformity !== 'all' && s.conformity_status !== filterConformity) return false;
    if (filterRouting === 'with' && !s.linked_routing_id) return false;
    if (filterRouting === 'without' && s.linked_routing_id) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.code.toLowerCase().includes(q) && !(s.notes ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SAMPLE_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterConformity} onValueChange={setFilterConformity}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All conformity</SelectItem>
            {CONFORMITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRouting} onValueChange={setFilterRouting}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All routing</SelectItem>
            <SelectItem value="with">With routing</SelectItem>
            <SelectItem value="without">Without routing</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
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
                // mark unused vars used to keep TS happy
                void pcamsMap; void rfqsMap; void colorsByProduct; void pcamsByColor; void sizesByProduct;
                return (
                  <>
                    <tr key={r.id} className="hover:bg-muted/30">
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
                      <tr key={r.id + '-exp'}>
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
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {routingDialog && (
        <GenerateSampleRoutingDialog
          open={!!routingDialog}
          sample={routingDialog as { id: string; code: string; product_id: string }}
          onClose={() => setRoutingDialog(null)}
          onGenerated={() => { setRoutingDialog(null); onRoutingGenerated(); }}
        />
      )}

      {/* keep onRowUpdate referenced for parent contracts */}
      {false && onRowUpdate && <span />}
    </div>
  );
}
