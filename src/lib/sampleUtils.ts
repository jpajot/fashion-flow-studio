export const PRODUCTION_TYPES = new Set(['gold_seal', 'pps']);

export function derivePhase(sampleType: string): 'production' | 'development' {
  return PRODUCTION_TYPES.has(sampleType) ? 'production' : 'development';
}

export const SAMPLE_TYPE_OPTIONS = [
  { value: 'volume',         label: 'Volume' },
  { value: 'proto',          label: 'Proto' },
  { value: 'sample',         label: 'Sample' },
  { value: 'sms',            label: 'SMS' },
  { value: 'test_au_porter', label: 'Test Au Porter' },
  { value: 'gold_seal',      label: 'Gold Seal' },
  { value: 'pps',            label: 'PPS' },
] as const;

export const SAMPLE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SAMPLE_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export const CONFORMITY_OPTIONS = [
  { value: 'not_assessed',   label: 'Not Assessed',   style: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'pass',           label: 'Pass',           style: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'fail_minor',     label: 'Fail (Minor)',   style: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'fail_major',     label: 'Fail (Major)',   style: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'pending_review', label: 'Pending Review', style: 'bg-blue-100 text-blue-700 border-blue-200' },
] as const;

export const CONFORMITY_STYLE_MAP: Record<string, string> = Object.fromEntries(
  CONFORMITY_OPTIONS.map((o) => [o.value, o.style])
);
export const CONFORMITY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CONFORMITY_OPTIONS.map((o) => [o.value, o.label])
);
