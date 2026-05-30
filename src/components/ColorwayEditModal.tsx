import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ColorwayForm, { ColorwayFormProps } from "@/components/ColorwayForm";

export default function ColorwayEditModal(
  props: ColorwayFormProps & { open: boolean; onOpenChange: (o: boolean) => void },
) {
  const { open, onOpenChange, ...rest } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rest.existing ? "Edit Colorway" : "New Colorway"}</DialogTitle>
        </DialogHeader>
        <ColorwayForm {...rest} />
      </DialogContent>
    </Dialog>
  );
}
