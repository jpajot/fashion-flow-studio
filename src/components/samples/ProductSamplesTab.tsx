import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePageOptions } from '@/contexts/PageOptionsContext';
import { Plus, FlaskConical } from 'lucide-react';
import SamplesDataTable, { Sample } from './SamplesDataTable';
import SampleCreateDialog from './SampleCreateDialog';

interface Product { id: string; size_grid_id?: string | null; }

export default function ProductSamplesTab({ product }: { product: Product }) {
  const { user } = useAuth();
  const { setOptions } = usePageOptions();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [colorsMap, setColorsMap] = useState<Record<string, any>>({});
  const [sizesMap, setSizesMap] = useState<Record<string, any>>({});
  const [projectsMap, setProjectsMap] = useState<Record<string, any>>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('samples').select('*').eq('product_id', product.id).order('created_at', { ascending: false });
    setSamples((data ?? []) as Sample[]);
  }, [product.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const [{ data: cols }, { data: prj }, { data: sup }] = await Promise.all([
        supabase.from('product_colors').select('*').eq('product_id', product.id),
        supabase.from('projects').select('id, name'),
        supabase.from('suppliers').select('id, name, code'),
      ]);
      const cMap: Record<string, any> = {}; (cols ?? []).forEach((c: any) => { cMap[c.id] = c; });
      setColorsMap(cMap);
      const pMap: Record<string, any> = {}; (prj ?? []).forEach((p: any) => { pMap[p.id] = p; });
      setProjectsMap(pMap);
      setSuppliers(sup ?? []);

      if (product.size_grid_id) {
        const { data: gs } = await supabase.from('size_grid_sizes').select('size_id').eq('size_grid_id', product.size_grid_id);
        const ids = ((gs ?? []) as any[]).map((g) => g.size_id).filter(Boolean);
        if (ids.length) {
          const { data: szs } = await supabase.from('sizes').select('id, name, size_code').in('id', ids);
          const sMap: Record<string, any> = {}; (szs ?? []).forEach((s: any) => { sMap[s.id] = s; });
          setSizesMap(sMap);
        }
      }
    })();
  }, [product.id, product.size_grid_id]);

  useEffect(() => {
    setOptions({ items: [{ label: 'Add Sample', icon: Plus, onClick: () => setOpenCreate(true) }] });
    return () => setOptions(null);
  }, [setOptions]);

  const handleRowUpdate = async (id: string, updates: Partial<Sample>) => {
    await supabase.from('samples').update(updates).eq('id', id);
    load();
  };

  const handleStepUpdate = async (stepId: string, updates: Record<string, unknown>) => {
    await supabase.from('sample_steps').update(updates).eq('id', stepId);
  };

  return (
    <div className="space-y-4">
      <SamplesDataTable
        samples={samples}
        columnSet="product_context"
        onRowUpdate={handleRowUpdate}
        onRoutingGenerated={load}
        onStepUpdate={handleStepUpdate}
        suppliersArray={suppliers}
        currentUser={user}
        colorsMap={colorsMap}
        sizesMap={sizesMap}
        projectsMap={projectsMap}
        emptyState={{ icon: FlaskConical, title: 'No samples yet', body: 'Add a sample to start tracking.', ctaLabel: 'Add Sample', ctaOnClick: () => setOpenCreate(true) }}
      />
      <SampleCreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => { load(); }}
        preset={{ product_id: product.id }}
      />
    </div>
  );
}
