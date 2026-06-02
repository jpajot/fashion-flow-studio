import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SamplesDataTable, { Sample } from './SamplesDataTable';
import SampleCreateDialog from './SampleCreateDialog';

interface Rfq { id: string; code?: string | null; project_id?: string | null; }

export default function RFQSamplesTab({ rfq }: { rfq: Rfq; project?: { name: string } | null }) {
  const { user } = useAuth();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [colorsMap, setColorsMap] = useState<Record<string, any>>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

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

  const handleRowUpdate = async (id: string, updates: Partial<Sample>) => {
    await supabase.from('samples').update(updates).eq('id', id);
    load();
  };
  const handleStepUpdate = async (stepId: string, updates: Record<string, unknown>) => {
    await supabase.from('sample_steps').update(updates).eq('id', stepId);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpenCreate(true)}><Plus className="w-4 h-4 mr-1" />Add Sample</Button>
      </div>
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
        emptyState={{ icon: FlaskConical, title: 'No samples linked to this RFQ', ctaLabel: 'Add Sample', ctaOnClick: () => setOpenCreate(true) }}
      />
      <SampleCreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => load()}
        preset={{ project_id: rfq.project_id ?? null, supplier_request_id: rfq.id }}
      />
    </div>
  );
}
