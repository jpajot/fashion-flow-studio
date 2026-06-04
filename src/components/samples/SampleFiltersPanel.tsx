import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown } from 'lucide-react';
import { SAMPLE_TYPE_OPTIONS, CONFORMITY_OPTIONS } from '@/lib/sampleUtils';
import { SampleFilters, DEFAULT_SAMPLE_FILTERS } from './SamplesDataTable';

interface Supplier { id: string; code?: string | null; name: string; }

interface Props {
  filters: SampleFilters;
  onFiltersChange: (f: SampleFilters) => void;
  suppliersArray?: Supplier[];
}

const PHASE_OPTIONS = [
  { value: 'development', label: 'Development' },
  { value: 'production', label: 'Production' },
];

function MultiSelect({ label, value, options, onChange }: {
  label: string;
  value: string[];
  options: { value: string; label: string }[];
  onChange: (next: string[]) => void;
}) {
  const summary = value.length === 0
    ? `All ${label.toLowerCase()}`
    : value.length <= 2
      ? value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')
      : `${value.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button"
          className="w-full flex items-center justify-between h-8 px-2.5 text-xs border border-input rounded-md bg-background hover:bg-muted/40">
          <span className="truncate">{summary}</span>
          <ChevronDown className="w-3 h-3 opacity-50 shrink-0 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="start">
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <label key={o.value} className="flex items-center gap-2 px-1.5 py-1 rounded text-xs hover:bg-muted cursor-pointer">
                <Checkbox checked={checked} onCheckedChange={() => {
                  onChange(checked ? value.filter((x) => x !== o.value) : [...value, o.value]);
                }} className="h-3.5 w-3.5" />
                <span className="truncate">{o.label}</span>
              </label>
            );
          })}
        </div>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])}
            className="mt-1 w-full text-[11px] text-muted-foreground hover:text-foreground py-1 border-t border-border">Clear</button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function SampleFiltersPanel({ filters, onFiltersChange, suppliersArray = [] }: Props) {
  const set = (patch: Partial<SampleFilters>) => onFiltersChange({ ...filters, ...patch });
  const anyActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_SAMPLE_FILTERS);

  return (
    <div className="p-3 space-y-3 border-t">
      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Search</Label>
        <Input value={filters.search} onChange={(e) => set({ search: e.target.value })}
          placeholder="Code or notes…" className="h-8 text-xs" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Sample Type</Label>
        <MultiSelect label="types" value={filters.sampleTypes}
          options={SAMPLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => set({ sampleTypes: v })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Phase</Label>
        <MultiSelect label="phases" value={filters.phases} options={PHASE_OPTIONS}
          onChange={(v) => set({ phases: v })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Conformity</Label>
        <MultiSelect label="conformity" value={filters.conformities}
          options={CONFORMITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => set({ conformities: v })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Supplier</Label>
        <MultiSelect label="suppliers" value={filters.suppliers}
          options={suppliersArray.map((s) => ({ value: s.id, label: `${s.code ? s.code + ' · ' : ''}${s.name}` }))}
          onChange={(v) => set({ suppliers: v })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Routing</Label>
        <Select value={filters.routing} onValueChange={(v) => set({ routing: v as SampleFilters['routing'] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="with">With routing</SelectItem>
            <SelectItem value="without">Without routing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Due Window</Label>
        <Select value={filters.dueWindow} onValueChange={(v) => set({ dueWindow: v as SampleFilters['dueWindow'] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="due_today">Due today</SelectItem>
            <SelectItem value="due_2d">Due in 2 days</SelectItem>
            <SelectItem value="due_7d">Due in 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {anyActive && (
        <Button variant="outline" size="sm" className="w-full text-xs"
          onClick={() => onFiltersChange(DEFAULT_SAMPLE_FILTERS)}>Clear all filters</Button>
      )}
    </div>
  );
}
