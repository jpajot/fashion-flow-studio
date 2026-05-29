import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  // status generic
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  archived: "bg-gray-100 text-gray-700 border-gray-200",
  // priority
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
  // eco status
  proposed: "bg-gray-100 text-gray-700 border-gray-200",
  under_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  applied: "bg-indigo-100 text-indigo-800 border-indigo-200",
  cancelled: "bg-muted text-muted-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
  // ecr
  open: "bg-blue-100 text-blue-800 border-blue-200",
  under_investigation: "bg-yellow-100 text-yellow-800 border-yellow-200",
  converted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  closed_no_action: "bg-gray-100 text-gray-700 border-gray-200",
  // portal invites
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  expired: "bg-gray-100 text-gray-700 border-gray-200",
  revoked: "bg-red-100 text-red-800 border-red-200",
  // sample type
  proto: "bg-blue-100 text-blue-800 border-blue-200",
  sms: "bg-purple-100 text-purple-800 border-purple-200",
  gold_seal: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pps: "bg-emerald-100 text-emerald-800 border-emerald-200",
  // phase
  development: "bg-indigo-100 text-indigo-800 border-indigo-200",
  production: "bg-emerald-100 text-emerald-800 border-emerald-200",
  // conformity
  not_assessed: "bg-gray-100 text-gray-700 border-gray-200",
  pass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  fail_minor: "bg-orange-100 text-orange-800 border-orange-200",
  fail_major: "bg-red-100 text-red-800 border-red-200",
  pending_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

export function StatusBadge({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cls = COLORS[value] ?? "bg-secondary text-secondary-foreground border-border";
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", cls, className)}>
      {value.replace(/_/g, " ")}
    </Badge>
  );
}
