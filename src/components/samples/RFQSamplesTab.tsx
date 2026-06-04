import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePageOptions, PageOptionItem } from '@/contexts/PageOptionsContext';
import { Plus, FlaskConical, List, LayoutGrid, Filter, Pencil } from 'lucide-react';
import SamplesDataTable, { Sample, SampleFilters, DEFAULT_SAMPLE_FILTERS } from './SamplesDataTable';
import SampleCreateDialog from './SampleCreateDialog';
import SampleFiltersPanel from './SampleFiltersPanel';
import ViewDrawerContent from '@/components/ViewDrawerContent';
import { SAMPLE_TYPE_LABELS } from '@/lib/sampleUtils';
import WorkflowStatusBadge from './WorkflowStatusBadge';

interface Rfq { id: string; code?: string | null; project_id?: string | null; }

const ALL_FIELDS = [
  { id: 'code', label: 'Code' }, { id: 'product', label: 'Product' },
  { id: 'type', label: 'Type' }, { id: 'phase', label: 'Phase' },
  { id: 'color', label: 'Color' }, { id: 'qty', label: 'Req. Qty' },
  { id: 'conformity', label: 'Conformity' }, { id: 'workflow', label: 'Workflow' },
];

export default function RFQSamplesTab({ rfq }: { rfq: Rfq; project?: { name: string } | null }) {
  const { user } = useAuth();
  const { setOptions } = usePageOptions();
  const navigate = useNavigate();
  const storageKey = `rfq-samples-view-${rfq.id}`;
  const [view, setView] = useState<'list' | 'gallery'>(() => (localStorage.getItem(storageKey) as 'list' | 'gallery') ?? 'list');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [colorsMap, setColorsMap] = useState<Record<string, any>>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [filters, setFilters] = useState<SampleFilters>(DEFAULT_SAMPLE_FILTERS);
  const [showQF, setShowQF] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [activeViewId, setActiveViewId] = useState('default');

  useEffect(() => { localStorage.setItem(storageKey, view); }, [view, storageKey]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('samples').select('*').eq('supplier_request_id', rfq.id).order('created_at', { ascending: false });
    setSamples((data ?? []) as Sample[]);
  }, [rfq.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: cols }, { data: sup }] = await Promise.all([
        supabase.from('products').select('id, name, code, images'),
        supabase.from('product_colors').select('id, color_name, colorway_code, color_hex, product_id'),
        supabase.from('suppliers').select('id, name, code'),
      ]);
      const pMap: Record<string, any> = {}; (prods ?? []).forEach((p: any) => { pMap[p.id] = p; });
      setProductsMap(pMap);
      const cMap: Record<string, any> = {}; (cols ?? []).forEach((c: any) => { cMap[c.id] = c; });
      setColorsMap(cMap);
      setSuppliers(sup ?? []);
    })();
  }, []);

  useEffect(() => {
    const items: PageOptionItem[] = [
      { label: 'Add Sample', icon: Plus, onClick: () => setOpenCreate(true), className: 'text-primary hover:bg-primary/10' },
      { divider: true },
      { label: view === 'gallery' ? 'View: List' : 'View: Gallery', icon: view === 'gallery' ? List : LayoutGrid, onClick: () => setView((v) => v === 'gallery' ? 'list' : 'gallery'), keepOpen: true },
      { divider: true },
      { label: 'Quick Filters', icon: Filter, onClick: () => { setShowQF((v) => !v); setShowViewMenu(false); }, keepOpen: true },
      { label: 'Manage Views', icon: Pencil, onClick: () => { setShowViewMenu((v) => !v); setShowQF(false); }, keepOpen: true },
    ];
    const customContent = showQF
      ? <SampleFiltersPanel filters={filters} onFiltersChange={setFilters} suppliersArray={suppliers} />
      : showViewMenu
      ? <ViewDrawerContent pageKey={`rfq_samples_${rfq.id}`} activeViewId={activeViewId} onSelectView={setActiveViewId} allFields={ALL_FIELDS} />
      : null;
    setOptions({ items, customContent });
    return () => setOptions(null);
  }, [setOptions, view, showQF, showViewMenu, filters, suppliers, activeViewId, rfq.id]);

  const handleRowUpdate = async (id: string, updates: Partial<Sample>) => {
    await supabase.from('samples').update(updates).eq('id', id);
    load();
  };
  const handleStepUpdate = async (stepId: string, updates: Record<string, unknown>) => {
    await supabase.from('sample_steps').update(updates).eq('id', stepId);
  };

  return (
    <div className="space-y-4">
      {view === 'list' && (
        <SamplesDataTable
          samples={samples}
          columnSet="rfq_context"
          onRowUpdate={handleRowUpdate}
          onRoutingGenerated={load}
          onStepUpdate={handleStepUpdate}
          suppliersArray={suppliers}
          currentUser={user}
          productsMap={productsMap}
          colorsMap={colorsMap}
          filters={filters}
          onFiltersChange={setFilters}
          activeViewId={activeViewId}
          emptyState={{ icon: FlaskConical, title: 'No samples linked to this RFQ', ctaLabel: 'Add Sample', ctaOnClick: () => setOpenCreate(true) }}
        />
      )}
      {view === 'gallery' && (
        samples.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
            <FlaskConical className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No samples linked to this RFQ</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {samples.map((s) => {
              const prod = s.product_id ? productsMap[s.product_id] : null;
              const col = s.product_color_id ? colorsMap[s.product_color_id] : null;
              return (
                <button key={s.id} onClick={() => navigate(`/samples/${s.id}`)}
                  className="text-left border border-border rounded-lg p-3 hover:border-primary transition-colors bg-card">
                  <div className="font-mono text-xs text-primary font-semibold mb-1">{s.code}</div>
                  <div className="text-sm font-medium truncate">{prod?.name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    {col?.color_hex && <span className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: col.color_hex }} />}
                    {col?.color_name ?? ''}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.sample_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{SAMPLE_TYPE_LABELS[s.sample_type] ?? s.sample_type}</span>}
                    {s.phase && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{s.phase}</span>}
                    <WorkflowStatusBadge status={null} />
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
      <SampleCreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => load()}
        preset={{ project_id: rfq.project_id ?? null, supplier_request_id: rfq.id }}
      />
    </div>
  );
}
