import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/shared/DataTable";

interface Props {
  productId: string;
  colorVariants?: any[];
  projects?: any[];
}

export default function MoreVariationsSection({ productId, colorVariants = [], projects = [] }: Props) {
  const { toast } = useToast();
  const [variations, setVariations] = useState<any[]>([]);
  const [styleSizes, setStyleSizes] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [packCodes, setPackCodes] = useState<string[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);

  // Bulk add
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkColorways, setBulkColorways] = useState<string[]>([]);
  const [bulkPackCodes, setBulkPackCodes] = useState<string[]>([]);
  const [bulkVariants, setBulkVariants] = useState<string[]>([]);
  const [bulkSizes, setBulkSizes] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Edit
  const empty = {
    product_color_id: "",
    name: "",
    pack_code: "",
    variant: "",
    size_ids: [] as string[],
    image_url: "",
  };
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const [packLov, varLov, ss, sz] = await Promise.all([
        supabase.from("type_of_lov").select("id").eq("code", "Pack").maybeSingle(),
        supabase.from("type_of_lov").select("id").eq("code", "Variant").maybeSingle(),
        supabase.from("style_sizes").select("*").eq("product_id", productId),
        supabase.from("sizes").select("*").order("size_code"),
      ]);
      if (packLov.data) {
        const { data: pv } = await supabase
          .from("list_of_values")
          .select("name")
          .eq("type_of_lov_id", packLov.data.id);
        setPackCodes((pv ?? []).map((v: any) => v.name));
      }
      if (varLov.data) {
        const { data: vv } = await supabase
          .from("list_of_values")
          .select("name")
          .eq("type_of_lov_id", varLov.data.id);
        setVariants((vv ?? []).map((v: any) => v.name));
      }
      const cwIds = (colorVariants ?? []).map((cv) => cv.id);
      if (cwIds.length) {
        const { data: vars } = await supabase
          .from("product_color_and_more")
          .select("*")
          .in("product_color_id", cwIds)
          .order("sequence");
        setVariations(vars ?? []);
      } else {
        setVariations([]);
      }
      setStyleSizes(ss.data ?? []);
      setSizes(sz.data ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, refresh, colorVariants?.length]);

  const activeSizes = useMemo(
    () => styleSizes.filter((ss) => ss.is_active !== false),
    [styleSizes],
  );

  const sizeById = (id: string) => sizes.find((s) => s.id === id);
  const cwById = (id: string) => colorVariants?.find((cv) => cv.id === id);

  const filteredVariations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variations;
    return variations.filter((v) => {
      const cw = cwById(v.product_color_id);
      return (
        (v.name || "").toLowerCase().includes(q) ||
        (v.pack_code || "").toLowerCase().includes(q) ||
        (cw?.color_name || "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variations, search, colorVariants]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, product_color_id: colorVariants?.[0]?.id ?? "" });
    setEditOpen(true);
  };

  const openEdit = (v: any) => {
    setEditing(v);
    setForm({
      product_color_id: v.product_color_id ?? "",
      name: v.name ?? "",
      pack_code: v.pack_code ?? "",
      variant: v.variant ?? "",
      size_ids: v.size_ids ?? [],
      image_url: v.image_url ?? "",
    });
    setEditOpen(true);
  };

  const handleUpload = async (file: File | null | undefined) => {
    if (!file) return;
    setUploading(true);
    const path = `${productId}/variations/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f: any) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
  };

  const save = async () => {
    if (!form.product_color_id) {
      toast({ title: "Colorway required", variant: "destructive" });
      return;
    }
    if (!form.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
    if (!editing) {
      const maxSeq = variations.reduce((m, v) => {
        const n = parseInt(v.sequence || "0", 10);
        return n > m ? n : m;
      }, 0);
      payload.sequence = String(maxSeq + 1).padStart(4, "0");
    }
    const res = editing
      ? await supabase.from("product_color_and_more").update(payload).eq("id", editing.id)
      : await supabase.from("product_color_and_more").insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Updated" : "Created" });
    setEditOpen(false);
    setRefresh((r) => r + 1);
  };

  const remove = async () => {
    if (!editing) return;
    const { error } = await supabase.from("product_color_and_more").delete().eq("id", editing.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    setEditOpen(false);
    setRefresh((r) => r + 1);
  };

  const previewCount =
    bulkColorways.length *
    Math.max(bulkPackCodes.length, 1) *
    Math.max(bulkVariants.length, 1);

  const canCreate = bulkColorways.length > 0 && bulkPackCodes.length > 0;

  const createBulk = async () => {
    if (!canCreate) return;
    setBulkSaving(true);
    let seq = variations.reduce((m, v) => {
      const n = parseInt(v.sequence || "0", 10);
      return n > m ? n : m;
    }, 0);
    const variantList = bulkVariants.length ? bulkVariants : [null];
    const rows: any[] = [];
    for (const cwId of bulkColorways) {
      for (const pc of bulkPackCodes) {
        for (const vt of variantList) {
          seq += 1;
          rows.push({
            product_color_id: cwId,
            pack_code: pc,
            variant: vt,
            sequence: String(seq).padStart(4, "0"),
            size_ids: bulkSizes,
            name: `${cwById(cwId)?.color_name || ""} ${pc}${vt ? " " + vt : ""}`.trim(),
          });
        }
      }
    }
    const { error } = await supabase.from("product_color_and_more").insert(rows);
    setBulkSaving(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Created ${rows.length} variations` });
    setBulkOpen(false);
    setBulkColorways([]);
    setBulkPackCodes([]);
    setBulkVariants([]);
    setBulkSizes([]);
    setRefresh((r) => r + 1);
  };

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const columns = [
    {
      id: "sequence",
      label: "Seq.",
      width: 80,
      sortKey: (v: any) => v.sequence,
      render: (v: any) => (
        <span className="font-mono text-xs text-muted-foreground">{v.sequence || "—"}</span>
      ),
    },
    {
      id: "colorway",
      label: "Colorway",
      width: 150,
      sortKey: (v: any) => cwById(v.product_color_id)?.color_name || "",
      render: (v: any) => {
        const cw = cwById(v.product_color_id);
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-sm border shrink-0"
              style={{ backgroundColor: cw?.color_hex || "#ccc" }}
            />
            <span className="text-xs">{cw?.color_name || "—"}</span>
          </div>
        );
      },
    },
    {
      id: "name",
      label: "Name",
      width: 160,
      sortKey: (v: any) => v.name,
      render: (v: any) => <span className="font-medium text-sm">{v.name || "—"}</span>,
    },
    {
      id: "pack_code",
      label: "Pack Code",
      width: 110,
      sortKey: (v: any) => v.pack_code,
      render: (v: any) => (
        <span className="text-xs text-muted-foreground">{v.pack_code || "—"}</span>
      ),
    },
    {
      id: "variant",
      label: "Variant",
      width: 100,
      sortKey: (v: any) => v.variant,
      render: (v: any) => (
        <span className="text-xs text-muted-foreground">{v.variant || "—"}</span>
      ),
    },
    {
      id: "sizes",
      label: "Sizes",
      width: 180,
      sortKey: (v: any) => (v.size_ids || []).length,
      render: (v: any) => {
        const codes = (v.size_ids || [])
          .map((sid: string) => sizeById(sid)?.size_code)
          .filter(Boolean);
        return <span className="text-xs text-muted-foreground">{codes.join(", ") || "—"}</span>;
      },
    },
    {
      id: "creation_project",
      label: "Creation Project",
      width: 150,
      sortKey: (v: any) => projects?.find((p) => p.id === v.creation_project_id)?.name || "",
      render: (v: any) => {
        const p = projects?.find((pr) => pr.id === v.creation_project_id);
        return <span className="text-xs text-muted-foreground">{p?.name || "—"}</span>;
      },
    },
    {
      id: "actions",
      label: "",
      width: 50,
      render: (v: any) => (
        <button
          type="button"
          onClick={() => openEdit(v)}
          className="p-1.5 rounded hover:bg-muted ml-auto block"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name, pack code, colorway…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex-1" />
        <Button size="sm" onClick={() => setBulkOpen(true)} disabled={!colorVariants?.length}>
          <Plus className="h-4 w-4 mr-2" /> Add Variations
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={filteredVariations}
        fixedColumns={["sequence", "colorway"]}
        hideColumnToggle
        onRowClick={(v) => openEdit(v)}
      />

      {/* Bulk add dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Variations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Colorways */}
            <div>
              <Label className="text-xs font-semibold">Colorways</Label>
              <div className="mt-1 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {(colorVariants ?? []).map((cv) => {
                  const checked = bulkColorways.includes(cv.id);
                  return (
                    <label
                      key={cv.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => setBulkColorways((a) => toggleArr(a, cv.id))}
                      />
                      <div
                        className="w-4 h-4 rounded-sm border shrink-0"
                        style={{ backgroundColor: cv.color_hex || "#ccc" }}
                      />
                      <span className="text-sm">{cv.color_name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {cv.colorway_code}
                      </span>
                    </label>
                  );
                })}
                {!colorVariants?.length && (
                  <div className="text-xs text-muted-foreground p-2">No colorways available</div>
                )}
              </div>
            </div>

            {/* Pack Codes */}
            <div>
              <Label className="text-xs font-semibold">Pack Codes</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {packCodes.length === 0 && (
                  <span className="text-xs text-muted-foreground">No Pack LOV values</span>
                )}
                {packCodes.map((pc) => {
                  const on = bulkPackCodes.includes(pc);
                  return (
                    <button
                      key={pc}
                      type="button"
                      onClick={() => setBulkPackCodes((a) => toggleArr(a, pc))}
                      className={
                        "text-xs px-2.5 py-1 rounded-full border transition-colors " +
                        (on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted")
                      }
                    >
                      {pc}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div>
                <Label className="text-xs font-semibold">Variants</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {variants.map((vt) => {
                    const on = bulkVariants.includes(vt);
                    return (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => setBulkVariants((a) => toggleArr(a, vt))}
                        className={
                          "text-xs px-2.5 py-1 rounded-full border transition-colors " +
                          (on
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted")
                        }
                      >
                        {vt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizes */}
            <div>
              <Label className="text-xs font-semibold">Sizes</Label>
              <div className="mt-1 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {activeSizes.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">No active sizes</div>
                )}
                {activeSizes.map((ss) => {
                  const s = sizeById(ss.size_id);
                  const checked = bulkSizes.includes(ss.size_id);
                  return (
                    <label
                      key={ss.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => setBulkSizes((a) => toggleArr(a, ss.size_id))}
                      />
                      <span className="font-mono text-xs w-12">{s?.size_code}</span>
                      <span className="text-sm">{s?.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-3">
              {bulkColorways.length} colorways × {bulkPackCodes.length || 0} pack codes ×{" "}
              {bulkVariants.length || 1} variants ={" "}
              <span className="font-semibold text-foreground">{previewCount}</span> variations
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createBulk} disabled={!canCreate || bulkSaving}>
              Create Variations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Variation" : "New Variation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colorway *</Label>
              <Select
                value={form.product_color_id}
                onValueChange={(v) => setForm({ ...form, product_color_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(colorVariants ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.color_name} ({c.colorway_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pack Code</Label>
                <Select
                  value={form.pack_code || ""}
                  onValueChange={(v) => setForm({ ...form, pack_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {packCodes.map((pc) => (
                      <SelectItem key={pc} value={pc}>
                        {pc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Variant</Label>
                <Select
                  value={form.variant || ""}
                  onValueChange={(v) => setForm({ ...form, variant: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((vt) => (
                      <SelectItem key={vt} value={vt}>
                        {vt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Sizes</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {activeSizes.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">No active sizes</div>
                )}
                {activeSizes.map((ss) => {
                  const s = sizeById(ss.size_id);
                  const checked = (form.size_ids || []).includes(ss.size_id);
                  return (
                    <label
                      key={ss.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setForm((f: any) => ({
                            ...f,
                            size_ids: toggleArr(f.size_ids || [], ss.size_id),
                          }))
                        }
                      />
                      <span className="font-mono text-xs w-12">{s?.size_code}</span>
                      <span className="text-sm">{s?.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Image</Label>
              {form.image_url ? (
                <div className="relative inline-block">
                  <img src={form.image_url} alt="" className="h-24 w-24 object-cover rounded border" />
                  <button
                    onClick={() => setForm({ ...form, image_url: "" })}
                    className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed rounded-md py-3 text-sm hover:bg-muted/50">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : "Upload image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {editing ? (
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
