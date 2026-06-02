export const WORKFLOW_STATUS_OPTIONS = [
  { value: 'created',            label: 'Created' },
  { value: 'in_progress',        label: 'In Progress' },
  { value: 'blocked',            label: 'Blocked' },
  { value: 'sent',               label: 'Sent' },
  { value: 'partially_sent',     label: 'Partially Sent' },
  { value: 'pending',            label: 'Pending' },
  { value: 'shipped',            label: 'Shipped' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received',           label: 'Received' },
] as const;

export const WORKFLOW_STATUS_STYLE: Record<string, { background: string; color: string }> = {
  created:            { background: '#E5E7EB', color: '#374151' },
  in_progress:        { background: '#FEF3C7', color: '#92400E' },
  blocked:            { background: '#FECACA', color: '#991B1B' },
  sent:               { background: '#DBEAFE', color: '#1E40AF' },
  partially_sent:     { background: '#DBEAFE', color: '#1E40AF' },
  pending:            { background: '#E0E7FF', color: '#3730A3' },
  shipped:            { background: '#EDE9FE', color: '#5B21B6' },
  partially_received: { background: '#D1FAE5', color: '#065F46' },
  received:           { background: '#A7F3D0', color: '#065F46' },
};

export function getWorkflowStatusStyle(status: string) {
  return WORKFLOW_STATUS_STYLE[status] ?? WORKFLOW_STATUS_STYLE['created'];
}

export function getWorkflowStatusLabel(status: string): string {
  return WORKFLOW_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? '—';
}

type SampleStepLike = { workflow_status?: string | null };

const SENT_RANGE = new Set(['sent', 'partially_sent', 'pending', 'shipped']);

export function computeParentWorkflowStatus(steps: SampleStepLike[]): string | null {
  if (!steps || steps.length === 0) return null;
  const statuses = steps.map((s) => {
    const st = s.workflow_status ?? 'created';
    return WORKFLOW_STATUS_STYLE[st] ? st : 'created';
  });
  if (statuses.some((s) => s === 'blocked')) return 'blocked';
  if (statuses.every((s) => s === 'received')) return 'received';
  if (statuses.some((s) => s === 'partially_received' || s === 'received')) return 'partially_received';
  if (statuses.every((s) => SENT_RANGE.has(s))) return 'sent';
  if (statuses.some((s) => SENT_RANGE.has(s))) return 'partially_sent';
  if (statuses.some((s) => s === 'in_progress')) return 'in_progress';
  return 'created';
}
