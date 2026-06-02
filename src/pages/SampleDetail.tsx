import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePageOptions } from '@/contexts/PageOptionsContext';
import { PAGE_WRAPPER } from '@/lib/utils';
import { ArrowLeft, Wand2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SampleQRLabel from '@/components/samples/SampleQRLabel';
import SampleStepsPanel from '@/components/samples/SampleStepsPanel';
import GenerateSampleRoutingDialog from '@/components/samples/GenerateSampleRoutingDialog';
import SampleDeleteDialog from '@/components/samples/SampleDeleteDialog';
import WorkflowStatusBadge from '@/components/samples/WorkflowStatusBadge';
import { SAMPLE_TYPE_LABELS, CONFORMITY_LABEL_MAP, CONFORMITY_STYLE_MAP } from '@/lib/sampleUtils';
import { computeParentWorkflowStatus } from '@/lib/sampleStepUtils';

export default function SampleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setOptions } = usePageOptions();

  const [sample, setSample] = useState<any | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [color, setColor] = useState<any | null>(null);
  const [size, setSize] = useState<any | null>(null);
  const [project, setProject] = useState<any | null>(null);
  const [rfq, setRfq] = useState<any | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stepsCache, setStepsCache] = useState<Record<string, any[] | 'loading' | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [openRouting, setOpenRouting] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from('samples').select('*').eq('id', id).single();
    setSample(data);
    if (data) {
      const [{ data: p }, { data: prj }] = await Promise.all([
        data.product_id ? supabase.from('products').select('*').eq('id', data.product_id).single() : Promise.resolve({ data: null }),
        data.project_id ? supabase.from('projects').select('*').eq('id', data.project_id).single() : Promise.resolve({ data: null }),
      ]);
      setProduct(p);
      setProject(prj);
      if (data.product_color_id) {
        const { data: c } = await supabase.from('product_colors').select('*').eq('id', data.product_color_id).single();
        setColor(c);
      } else setColor(null);
      if (data.size_id) {
        const { data: s } = await supabase.from('sizes').select('*').eq('id', data.size_id).single();
        setSize(s);
      } else setSize(null);
      if (data.supplier_request_id) {
        const { data: r } = await supabase.from('supplier_requests').select('*').eq('id', data.supplier_request_id).single();
        setRfq(r);
      } else setRfq(null);
    }
    const { data: sup } = await supabase.from('suppliers').select('id, name, code');
    setSuppliers(sup ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const fetchSteps = useCallback(async (sampleId: string) => {
    setStepsCache((prev) => ({ ...prev, [sampleId]: 'loading' }));
    const { data } = await supabase.from('sample_steps').select('*').eq('sample_id', sampleId).order('sequence');
    setStepsCache((prev) => ({ ...prev, [sampleId]: data ?? [] }));
  }, []);

  useEffect(() => {
    if (sample?.linked_routing_id && !stepsCache[sample.id]) fetchSteps(sample.id);
  }, [sample?.id, sample?.linked_routing_id, stepsCache, fetchSteps]);

  useEffect(() => {
    if (!sample) { setOptions(null); return; }
    const items: any[] = [];
    if (!sample.linked_routing_id) items.push({ label: 'Generate Sample Routing', icon: Wand2, onClick: () => setOpenRouting(true) });
    items.push({ label: 'Delete Sample', icon: Trash2, onClick: () => setOpenDelete(true), className: 'text-destructive' });
    setOptions({ items });
    return () => setOptions(null);
  }, [sample, setOptions]);

  const handleStepUpdate = async (stepId: string, updates: Record<string, unknown>) => {
    await supabase.from('sample_steps').update(updates).eq('id', stepId);
  };

  if (loading) return <div className={PAGE_WRAPPER}><div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></div>;
  if (!sample) return <div className={PAGE_WRAPPER}><p className="text-sm text-muted-foreground">Sample not found.</p></div>;

  const steps = Array.isArray(stepsCache[sample.id]) ? (stepsCache[sample.id] as any[]) : [];
  const parentStatus = computeParentWorkflowStatus(steps);
  const conf = sample.conformity_status ?? 'not_assessed';

  return (
    <div className={PAGE_WRAPPER + ' space-y-6'}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        {project && <><span>/</span><Link to={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link></>}
        <span>/</span><span className="text-foreground font-mono">{sample.code}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-mono font-bold">{sample.code}</h1>
            {product && <Link to={`/products/${product.id}`} className="text-sm text-primary hover:underline">{product.name}</Link>}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Type" value={sample.sample_type ? SAMPLE_TYPE_LABELS[sample.sample_type] ?? sample.sample_type : '—'} />
            <Field label="Phase" value={sample.phase ?? '—'} />
            <Field label="Color" value={color?.color_name ?? '—'} />
            <Field label="Size" value={size?.size_code ?? size?.name ?? '—'} />
            <Field label="Requested Qty" value={sample.requested_quantity ?? '—'} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Workflow</div>
              <WorkflowStatusBadge status={parentStatus} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Conformity</div>
              <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border ${CONFORMITY_STYLE_MAP[conf]}`}>{CONFORMITY_LABEL_MAP[conf] ?? conf}</span>
            </div>
            {rfq && <Field label="Supplier Request" value={rfq.code ?? rfq.id} />}
            <Field label="Created" value={sample.created_at ? new Date(sample.created_at).toLocaleDateString() : '—'} />
          </div>
          {sample.notes && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Notes</div>
              <p className="text-sm whitespace-pre-wrap">{sample.notes}</p>
            </div>
          )}
        </div>
        <div>
          <SampleQRLabel sample={sample} product={product} color={color} size={size} />
        </div>
      </div>

      <section className="border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-3">Sample Routing</h2>
        {sample.linked_routing_id ? (
          <SampleStepsPanel
            sample={sample}
            suppliersArray={suppliers}
            stepsCache={stepsCache}
            onFetchSteps={fetchSteps}
            onStepUpdate={handleStepUpdate}
            currentUser={user}
          />
        ) : (
          <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground mb-3">No routing yet for this sample.</p>
            <Button onClick={() => setOpenRouting(true)}><Wand2 className="w-4 h-4 mr-1" />Generate Sample Routing</Button>
          </div>
        )}
      </section>

      <section className="border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Sample BOM</h2>
        <p className="text-xs text-muted-foreground">Coming soon.</p>
      </section>

      {openRouting && (
        <GenerateSampleRoutingDialog
          open={openRouting}
          sample={sample}
          onClose={() => setOpenRouting(false)}
          onGenerated={load}
        />
      )}
      <SampleDeleteDialog
        open={openDelete}
        sample={sample}
        onClose={() => setOpenDelete(false)}
        onDeleted={() => navigate(-1)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
