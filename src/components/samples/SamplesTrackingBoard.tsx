import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import { CONFORMITY_LABEL_MAP, CONFORMITY_STYLE_MAP } from '@/lib/sampleUtils';

interface SampleStep {
  id: string;
  sample_id: string;
  sequence: number;
  // step_type removed — operation comes from operation_product_id.
  // TODO(round 9.3): render the operation product's name in this board.
  operation_product_id?: string | null;
  supplier_id?: string | null;
  due_date?: string | null;
  workflow_status?: string | null;
  conformity_status?: string | null;
  notes?: string | null;
}

interface Sample { id: string; code: string; product_id?: string | null; }
interface Supplier { id: string; name: string; code?: string | null; }
interface Product { id: string; name: string; code?: string | null; }

export default function SamplesTrackingBoard({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [steps, setSteps] = useState<SampleStep[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, Supplier>>({});
  const [products, setProducts] = useState<Record<string, Product>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: smp } = await supabase.from('samples').select('id, code, product_id').eq('project_id', projectId);
    const sList = (smp ?? []) as Sample[];
    setSamples(sList);

    if (sList.length === 0) { setSteps([]); setLoading(false); return; }

    const ids = sList.map((s) => s.id);
    const productIds = [...new Set(sList.map((s) => s.product_id).filter(Boolean) as string[])];

    const [{ data: stp }, { data: prods }] = await Promise.all([
      supabase.from('sample_steps').select('*').in('sample_id', ids).order('sequence'),
      productIds.length ? supabase.from('products').select('id, name, code').in('id', productIds) : Promise.resolve({ data: [] }),
    ]);

    const stepArr = (stp ?? []) as SampleStep[];
    setSteps(stepArr);

    const pMap: Record<string, Product> = {};
    ((prods ?? []) as Product[]).forEach((p) => { pMap[p.id] = p; });
    setProducts(pMap);

    const supIds = [...new Set(stepArr.map((s) => s.supplier_id).filter(Boolean) as string[])];
    if (supIds.length) {
      const { data: sup } = await supabase.from('suppliers').select('id, name, code').in('id', supIds);
      const sMap: Record<string, Supplier> = {};
      ((sup ?? []) as Supplier[]).forEach((s) => { sMap[s.id] = s; });
      setSuppliers(sMap);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (steps.length === 0) {
    return <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/20"><p className="text-sm text-muted-foreground">No sample steps for this project yet.</p></div>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (s: SampleStep) => s.due_date && s.due_date < today && s.workflow_status !== 'received' && s.workflow_status !== 'partially_received';

  // group by supplier
  const groups: Record<string, SampleStep[]> = {};
  steps.forEach((s) => {
    const key = s.supplier_id ?? '__unassigned';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  const sampleById: Record<string, Sample> = {};
  samples.forEach((s) => { sampleById[s.id] = s; });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '__unassigned') return 1;
    if (b === '__unassigned') return -1;
    return (suppliers[a]?.name ?? '').localeCompare(suppliers[b]?.name ?? '');
  });

  return (
    <div className="space-y-4">
      {sortedKeys.map((key) => {
        const sup = key === '__unassigned' ? null : suppliers[key];
        const list = groups[key].slice().sort((a, b) => {
          const da = a.due_date ?? '\uffff'; const db = b.due_date ?? '\uffff';
          if (da !== db) return da.localeCompare(db);
          return (sampleById[a.sample_id]?.code ?? '').localeCompare(sampleById[b.sample_id]?.code ?? '');
        });
        return (
          <div key={key} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{sup ? sup.name : 'Unassigned'}</span>
              <span className="text-xs text-muted-foreground">{list.length} step{list.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/20">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Sample</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Step</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Due</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Workflow</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Conformity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((s) => {
                  const sample = sampleById[s.sample_id];
                  const prod = sample?.product_id ? products[sample.product_id] : null;
                  const conf = s.conformity_status ?? 'not_assessed';
                  return (
                    <tr key={s.id} className={isOverdue(s) ? 'bg-red-50' : 'hover:bg-muted/20'}>
                      <td className="px-2 py-1.5 font-mono">{sample?.code ?? '—'}</td>
                      <td className="px-2 py-1.5">{prod?.name ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.step_type ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.due_date ?? '—'}</td>
                      <td className="px-2 py-1.5"><WorkflowStatusBadge status={s.workflow_status} /></td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border ${CONFORMITY_STYLE_MAP[conf]}`}>{CONFORMITY_LABEL_MAP[conf] ?? conf}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
