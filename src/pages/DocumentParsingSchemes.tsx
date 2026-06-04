import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, FileJson, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PAGE_WRAPPER } from '@/lib/utils';

const EMPTY_FORM = {
  document_type: '',
  name: '',
  description: '',
  extraction_prompt: '',
  json_schema: '',
  is_active: true,
};

function SchemeDialog({ open, onOpenChange, scheme, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scheme: any | null;
  onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [schemaError, setSchemaError] = useState('');
  const [docTypes, setDocTypes] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('list_of_values')
      .select('name')
      .eq('type_of_lov_id', '89a3e3dc-9094-49ac-b254-96a1753a84a3')
      .order('name')
      .then(({ data }) => setDocTypes((data ?? []).map((v: any) => v.name)));
  }, []);

  useEffect(() => {
    if (scheme) {
      setForm({
        document_type: scheme.document_type ?? '',
        name: scheme.name ?? '',
        description: scheme.description ?? '',
        extraction_prompt: scheme.extraction_prompt ?? '',
        json_schema: scheme.json_schema ? JSON.stringify(scheme.json_schema, null, 2) : '',
        is_active: scheme.is_active !== false,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setSchemaError('');
  }, [scheme, open]);

  const update = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  const handleSave = async () => {
    setSchemaError('');
    let parsedSchema: any = null;
    if (form.json_schema.trim()) {
      try { parsedSchema = JSON.parse(form.json_schema); }
      catch { setSchemaError('Invalid JSON — please fix before saving.'); return; }
    }
    setSaving(true);
    await onSave({ ...form, json_schema: parsedSchema });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{scheme ? `Edit: ${scheme.name}` : 'New Parsing Scheme'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Document Type *</Label>
              <Select value={form.document_type} onValueChange={v => update('document_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  {docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scheme Name *</Label>
              <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Line Sheet V1" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Notes about this scheme or document layout…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Extraction Prompt *</Label>
            <p className="text-xs text-muted-foreground">Instructions sent to the AI to guide extraction.</p>
            <Textarea value={form.extraction_prompt} onChange={e => update('extraction_prompt', e.target.value)} rows={6} className="font-mono text-xs" placeholder="Extract product data from document…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">JSON Schema (output structure)</Label>
            <p className="text-xs text-muted-foreground">Defines the structure the AI should return. Must be valid JSON.</p>
            <Textarea
              value={form.json_schema}
              onChange={e => { update('json_schema', e.target.value); setSchemaError(''); }}
              rows={12}
              className={`font-mono text-xs ${schemaError ? 'border-destructive' : ''}`}
              placeholder='{"type": "object", "properties": { ... }}'
            />
            {schemaError && <p className="text-xs text-destructive">{schemaError}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={v => update('is_active', v)} id="is_active_switch" />
            <Label htmlFor="is_active_switch" className="text-sm cursor-pointer">Active (used for parsing)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.document_type.trim() || !form.name.trim() || !form.extraction_prompt.trim()}
            className="gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {scheme ? 'Save Changes' : 'Create Scheme'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentParsingSchemes() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    supabase
      .from('document_parsing_schemes')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setSchemes(data ?? []); setLoading(false); });
  }, []);

  const handleSave = async (data: any) => {
    if (editing) {
      const { data: updated } = await supabase
        .from('document_parsing_schemes')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
        .select()
        .single();
      setSchemes(prev => prev.map(s => s.id === editing.id ? (updated ?? { ...s, ...data }) : s));
      toast.success('Scheme updated');
    } else {
      const { data: created } = await supabase
        .from('document_parsing_schemes')
        .insert(data)
        .select()
        .single();
      if (created) setSchemes(prev => [created, ...prev]);
      toast.success('Scheme created');
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('document_parsing_schemes').delete().eq('id', id);
    setSchemes(prev => prev.filter(s => s.id !== id));
    toast.success('Scheme deleted');
  };

  const handleToggle = async (scheme: any) => {
    const newVal = !scheme.is_active;
    await supabase.from('document_parsing_schemes').update({ is_active: newVal }).eq('id', scheme.id);
    setSchemes(prev => prev.map(s => s.id === scheme.id ? { ...s, is_active: newVal } : s));
  };

  return (
    <div className={`${PAGE_WRAPPER} max-w-4xl space-y-6`}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/config')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Document Parsing Schemes</h1>
          <p className="text-muted-foreground mt-1">Define AI extraction rules and JSON schemas per document type</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Scheme
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : schemes.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
          <FileJson className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No parsing schemes yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create one to control how documents are parsed by AI</p>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> New Scheme
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {schemes.map(scheme => (
            <div key={scheme.id} className="bg-card rounded-xl border border-border p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileJson className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{scheme.name}</span>
                  <Badge variant="outline" className="text-xs">{scheme.document_type}</Badge>
                  {scheme.is_active
                    ? <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>
                    : <Badge variant="secondary" className="text-xs">Inactive</Badge>
                  }
                </div>
                {scheme.description && <p className="text-xs text-muted-foreground mt-1">{scheme.description}</p>}
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 font-mono bg-muted/50 px-2 py-1 rounded">
                  {scheme.extraction_prompt?.slice(0, 150)}{(scheme.extraction_prompt?.length ?? 0) > 150 ? '…' : ''}
                </p>
                {scheme.json_schema && (
                  <p className="text-xs text-muted-foreground mt-1">
                    JSON Schema: <span className="font-mono">{Object.keys(scheme.json_schema?.properties ?? {}).length} top-level properties</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={!!scheme.is_active} onCheckedChange={() => handleToggle(scheme)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(scheme); setDialogOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Scheme</AlertDialogTitle>
                      <AlertDialogDescription>Delete "{scheme.name}"? This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(scheme.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <SchemeDialog open={dialogOpen} onOpenChange={setDialogOpen} scheme={editing} onSave={handleSave} />
    </div>
  );
}
