import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lock } from 'lucide-react';
import { derivePhase, SAMPLE_TYPE_OPTIONS } from '@/lib/sampleUtils';

const HASH_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateHashCode(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) result += HASH_ALPHA[Math.floor(Math.random() * HASH_ALPHA.length)];
  return result;
}

async function generateUniqueSampleCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `SMP-${generateHashCode(6)}`;
    const { data } = await supabase.from('samples').select('id').eq('code', code).limit(1);
    if (!data || data.length === 0) return code;
  }
  throw new Error('Failed to generate unique sample code after 10 attempts.');
}

interface Product { id: string; code?: string | null; name: string; images?: string[] | null; size_grid_id?: string | null; }
interface Project { id: string; name: string; }
interface SupplierRequest { id: string; code?: string | null; }
interface Color { id: string; color_name: string; colorway_code?: string | null; color_hex?: string | null; product_id: string; }
interface Pcam { id: string; name?: string | null; sequence?: string | null; product_color_id: string; }
interface Size { id: string; name: string; size_code?: string | null; }

interface Preset {
  product_id?: string | null;
  project_id?: string | null;
  supplier_request_id?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (sample: { id: string; code: string }) => void;
  preset?: Preset;
  productOptions?: Product[];
}

export default function SampleCreateDialog({ open, onClose, onCreated, preset = {}, productOptions }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState(preset.product_id ?? '');
  const [projectId, setProjectId] = useState(preset.project_id ?? '');
  const [sampleType, setSampleType] = useState('');
  const [colorId, setColorId] = useState('');
  const [pcamId, setPcamId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [notes, setNotes] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [pcams, setPcams] = useState<Pcam[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [resolvedProduct, setResolvedProduct] = useState<Product | null>(null);
  const [resolvedProject, setResolvedProject] = useState<Project | null>(null);
  const [resolvedRfq, setResolvedRfq] = useState<SupplierRequest | null>(null);

  const phase = sampleType ? derivePhase(sampleType) : null;

  useEffect(() => {
    if (!open) return;
    setProductId(preset.product_id ?? '');
    setProjectId(preset.project_id ?? '');
    setSampleType('');
    setColorId('');
    setPcamId('');
    setSizeId('');
    setRequestedQty('');
    setNotes('');
    setProductSearch('');
    setResolvedProduct(null);
    setResolvedProject(null);
    setResolvedRfq(null);
  }, [open]);

  const loadProductDependents = async (prod: Product) => {
    const { data: cols } = await supabase.from('product_colors').select('*').eq('product_id', prod.id);
    setColors((cols ?? []) as Color[]);
    const { data: allPcams } = await supabase.from('product_color_and_more').select('*');
    setPcams((allPcams ?? []) as Pcam[]);

    if (prod.size_grid_id) {
      const { data: gridSizes } = await supabase.from('size_grid_sizes').select('size_id').eq('size_grid_id', prod.size_grid_id);
      const sizeIds = ((gridSizes ?? []) as { size_id: string | null }[]).map((gs) => gs.size_id).filter(Boolean) as string[];
      if (sizeIds.length) {
        const { data: sizeRecords } = await supabase.from('sizes').select('id, name, size_code').in('id', sizeIds).order('name');
        setSizes((sizeRecords ?? []) as Size[]);
      } else { setSizes([]); }
    } else { setSizes([]); }
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: projs } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false });
      setProjects((projs ?? []) as Project[]);

      if (!preset.product_id) {
        if (productOptions) {
          setProducts(productOptions);
        } else {
          const { data: prods } = await supabase.from('products').select('id, code, name, images, size_grid_id').order('name');
          setProducts((prods ?? []) as Product[]);
        }
      }

      if (preset.product_id) {
        const { data: prod } = await supabase.from('products').select('id, code, name, images, size_grid_id').eq('id', preset.product_id).single();
        setResolvedProduct(prod as Product);
        if (prod) await loadProductDependents(prod as Product);
      }

      if (preset.project_id && projs) {
        setResolvedProject(((projs as Project[]).find((p) => p.id === preset.project_id)) ?? null);
      }

      if (preset.supplier_request_id) {
        const { data: sr } = await supabase.from('supplier_requests').select('id, code').eq('id', preset.supplier_request_id).single();
        setResolvedRfq(sr as SupplierRequest);
      }
    })();
  }, [open]);

  const handleProductSelect = async (pid: string) => {
    setProductId(pid);
    setColorId('');
    setPcamId('');
    setSizeId('');
    if (pid) {
      const found = products.find((p) => p.id === pid);
      if (found) { setResolvedProduct(found); await loadProductDependents(found); }
    } else { setResolvedProduct(null); setColors([]); setPcams([]); setSizes([]); }
  };

  const filteredProducts = productSearch
    ? products.filter((p) => (p.name ?? '').toLowerCase().includes(productSearch.toLowerCase()) || (p.code ?? '').toLowerCase().includes(productSearch.toLowerCase()))
    : products;

  const pcamsForColor = colorId ? pcams.filter((pc) => pc.product_color_id === colorId) : [];
  const canSubmit = productId && projectId && sampleType && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const code = await generateUniqueSampleCode();
      const { data: record, error } = await supabase.from('samples').insert({
        project_id: projectId,
        supplier_request_id: preset.supplier_request_id ?? null,
        code,
        qr_code_data: code,
        product_id: productId,
        product_color_id: colorId || null,
        product_color_and_more_id: pcamId || null,
        size_id: sizeId || null,
        sample_type: sampleType,
        phase: derivePhase(sampleType),
        requested_quantity: requestedQty ? Number(requestedQty) : null,
        linked_routing_id: null,
        conformity_status: 'not_assessed',
        notes: notes || null,
        created_by: user?.email ?? null,
      }).select().single();

      if (error || !record) { toast.error('Failed to create sample.'); return; }
      onCreated(record as { id: string; code: string });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create sample.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Sample</DialogTitle></DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Product <span className="text-destructive">*</span></Label>
            {preset.product_id ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm">
                {resolvedProduct?.images?.[0] && <img src={resolvedProduct.images[0]} alt="" className="w-7 h-7 rounded object-cover shrink-0" />}
                <span className="flex-1 truncate font-medium">
                  {resolvedProduct ? `${resolvedProduct.code ? resolvedProduct.code + ' — ' : ''}${resolvedProduct.name}` : preset.product_id}
                </span>
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            ) : (
              <>
                <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search product…" className="h-8 text-xs mb-1" />
                <div className="border border-border rounded-lg max-h-36 overflow-y-auto">
                  {filteredProducts.slice(0, 50).map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => { handleProductSelect(p.id); setProductSearch(`${p.code ? p.code + ' — ' : ''}${p.name}`); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors ${productId === p.id ? 'bg-primary/10 text-primary' : ''}`}>
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-5 h-5 rounded object-cover shrink-0" />}
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.code && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{p.code}</span>}
                    </button>
                  ))}
                  {filteredProducts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No products found</p>}
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Project <span className="text-destructive">*</span></Label>
            {preset.project_id ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm">
                <span className="flex-1 truncate font-medium">{resolvedProject?.name ?? preset.project_id}</span>
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            ) : (
              <Select value={projectId || 'none'} onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select project…</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {preset.supplier_request_id && (
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier Request</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm">
                <span className="flex-1 font-mono font-medium">{resolvedRfq?.code ?? preset.supplier_request_id}</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">Attached to this SR</span>
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Sample Type <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={sampleType || 'none'} onValueChange={(v) => setSampleType(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select type…</SelectItem>
                    {SAMPLE_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {phase && (
                <span className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border"
                  style={phase === 'production'
                    ? { color: '#059669', backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }
                    : { color: '#6B7280', backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }}>
                  {phase === 'production' ? 'Production' : 'Development'}
                </span>
              )}
            </div>
          </div>

          {colors.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Color (optional)</Label>
              <Select value={colorId || 'none'} onValueChange={(v) => { setColorId(v === 'none' ? '' : v); setPcamId(''); }}>
                <SelectTrigger><SelectValue placeholder="Any color" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any color</SelectItem>
                  {colors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.color_hex && <span className="w-3 h-3 rounded-full inline-block border border-border" style={{ backgroundColor: c.color_hex }} />}
                        {c.colorway_code ? `${c.colorway_code} — ${c.color_name}` : c.color_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {pcamsForColor.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Variation (optional)</Label>
              <Select value={pcamId || 'none'} onValueChange={(v) => setPcamId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Any variation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any variation</SelectItem>
                  {pcamsForColor.map((pc) => <SelectItem key={pc.id} value={pc.id}>{pc.name ?? pc.sequence ?? pc.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Size (optional)</Label>
              <Select value={sizeId || 'none'} onValueChange={(v) => setSizeId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Any size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any size</SelectItem>
                  {sizes.map((s) => <SelectItem key={s.id} value={s.id}>{s.size_code ?? s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Requested Quantity (optional)</Label>
            <Input type="number" min={1} value={requestedQty} onChange={(e) => setRequestedQty(e.target.value)} placeholder="e.g. 2" className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context to record." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Create Sample
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
