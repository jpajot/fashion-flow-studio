import { ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  // Old signature
  onClose?: () => void;
  line?: any;
  variantCount?: number;
  // New signature
  onCancel?: () => void;
  description?: ReactNode;
  deleteCount?: number;
  // Shared
  onConfirm: () => void;
}

export default function BOMLineDestructiveConfirmDialog({
  open, onClose, onCancel, onConfirm, variantCount, deleteCount, description,
}: Props) {
  const close = onCancel ?? onClose ?? (() => {});
  const count = deleteCount ?? variantCount ?? 0;
  const body = description ?? (
    <>This will permanently delete the line and <strong>{count} variant{count !== 1 ? "s" : ""}</strong> attached to it. This action cannot be undone.</>
  );
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{description ? "Confirm change" : "Delete this BOM line?"}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{body}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            {description ? "Confirm" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
