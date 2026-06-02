import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, FlaskConical, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SamplesDataTable, { Sample } from '@/components/samples/SamplesDataTable';
import SamplesTrackingBoard from '@/components/samples/SamplesTrackingBoard';
import SampleCreateDialog from '@/components/samples/SampleCreateDialog';
import { SAMPLE_TYPE_LABELS } from '@/lib/sampleUtils';
import WorkflowStatusBadge from '@/components/samples/WorkflowStatusBadge';

export default function ProjectSamplesTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const storageKey = `project-samples-view-${projectId}`;
  const [view, setView] = useState<'list' | 'gallery'>(() => (localStorage.getItem(storageKey) as 'list' | 'gallery') ?? 'gallery');
  const [subTab, setSubTab] = useState<'samples' | 'tracking'>('samples');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [colorsMap, setColorsMap] = useState<Record<string, any>>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  useEffect(() => { localStorage.setItem(storageKey, view); }, [view, storageKey]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('samples').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    setSamples((data ?? []) as Sample[]);
  }, [projectId]);

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

  const handleRowUpdate = async (id: string, updates: Partial<Sample>) => {
    await supabase.from('samples').update(updates).eq('id', id);
    load();
  };
  const handleStepUpdate = async (stepId: string, updates: Record<string, unknown>) => {
    await supabase.from('sample_steps').update(updates).eq('id', stepId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['samples', 'tracking'] as const).map((id) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border ${subTab === id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}>
              {id === 'samples' ? 'Samples' : 'Samples Tracking'}
            </button>
          ))}
        </div>
        {subTab === 'samples' && (
          <div className="flex gap-2 items-center">
            <div className="flex border border-border rounded-md overflow-hidden">
              <button onClick={() => setView('list')} className={`p-1.5 ${view === 'list' ? 'bg-muted' : ''}`} title="List"><List className="w-3.5 h-3.5" /></button>
              <button onClick={() => setView('gallery')} className={`p-1.5 ${view === 'gallery' ? 'bg-muted' : ''}`} title="Gallery"><LayoutGrid className="w-3.5 h-3.5" /></button>
            </div>
            <Button size="sm" onClick={() => setOpenCreate(true)}><Plus className="w-4 h-4 mr-1" />Add Sample</Button>
          </div>
        )}
      </div>

      {subTab === 'samples' && view === 'list' && (
        <SamplesDataTable
          samples={samples}
          columnSet="project_context"
          onRowUpdate={handleRowUpdate}
          onRoutingGenerated={load}
          onStepUpdate={handleStepUpdate}
          suppliersArray={suppliers}
          currentUser={user}
          productsMap={productsMap}
          colorsMap={colorsMap}
          emptyState={{ icon: FlaskConical, title: 'No samples yet', ctaLabel: 'Add Sample', ctaOnClick: () => setOpenCreate(true) }}
        />
      )}

      {subTab === 'samples' && view === 'gallery' && (
        samples.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
            <FlaskConical className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No samples yet</p>
            <Button size="sm" className="mt-3" onClick={() => setOpenCreate(true)}>Add Sample</Button>
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

      {subTab === 'tracking' && <SamplesTrackingBoard projectId={projectId} />}

      <SampleCreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => load()}
        preset={{ project_id: projectId }}
      />
    </div>
  );
}
