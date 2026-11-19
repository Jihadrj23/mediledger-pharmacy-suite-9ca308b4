import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Download, Pencil, Plus, Search, Upload, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, EmptyState } from "@/components/app/AppShell";
import { lookupsQuery, medicinesQuery, stockStatus, type MedicineRow } from "@/lib/queries";
import { describeQty, formatBDT, formatDate, daysUntil } from "@/lib/format";
import { downloadFile, parseCSV, toCSV } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/admin/medicines")({
  head: () => ({ meta: [{ title: "Medicine Catalog — PharmaDesk" }, { name: "description", content: "Manage medicines, prices and unit conversions" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(medicinesQuery), context.queryClient.ensureQueryData(lookupsQuery)]),
  component: MedicinesPage,
});

const ALL = "all";
type CsvKey = "brand_name" | "generic_name" | "strength" | "manufacturer" | "category" | "dosage_form" | "barcode" | "strips_per_box" | "pieces_per_strip" | "price_piece" | "price_strip" | "price_box" | "mrp" | "reorder_level" | "status";

const medSchema = z.object({
  brand_name: z.string().trim().min(1, "Brand name is required").max(120),
  generic_name: z.string().trim().max(160),
  strength: z.string().trim().max(60),
  manufacturer_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  dosage_form_id: z.string().uuid().nullable(),
  barcode: z.string().trim().max(64).nullable(),
  strips_per_box: z.coerce.number().int().min(1).max(1000),
  pieces_per_strip: z.coerce.number().int().min(1).max(1000),
  is_divisible: z.boolean(),
  price_piece: z.coerce.number().min(0),
  price_strip: z.coerce.number().min(0),
  price_box: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  reorder_level: z.coerce.number().int().min(0),
  status: z.enum(["active", "inactive"]),
});
type MedForm = z.input<typeof medSchema>;

const blank: MedForm = {
  brand_name: "", generic_name: "", strength: "", manufacturer_id: null, category_id: null, dosage_form_id: null, barcode: null,
  strips_per_box: 10, pieces_per_strip: 10, is_divisible: true, price_piece: 0, price_strip: 0, price_box: 0, mrp: 0, reorder_level: 20, status: "active",
};

function MedicinesPage() {
  const { data: meds } = useSuspenseQuery(medicinesQuery);
  const { data: lk } = useSuspenseQuery(lookupsQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(ALL);
  const [form, setForm] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [editing, setEditing] = useState<{ id?: string; values: MedForm } | null>(null);
  const [batchesFor, setBatchesFor] = useState<MedicineRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return meds.filter((m) => {
      if (cat !== ALL && m.category_id !== cat) return false;
      if (form !== ALL && m.dosage_form_id !== form) return false;
      if (status !== ALL) {
        const st = stockStatus(m).label;
        if (status === "inactive" ? m.status !== "inactive" : st !== status) return false;
      }
      if (!s) return true;
      return [m.brand_name, m.generic_name, m.strength, m.barcode, m.manufacturer?.name, m.form?.name].some((v) => v?.toLowerCase().includes(s));
    });
  }, [meds, q, cat, form, status]);

  function exportCSV() {
    const rows = meds.map((m) => ({
      brand_name: m.brand_name, generic_name: m.generic_name, strength: m.strength, manufacturer: m.manufacturer?.name ?? "",
      category: m.category?.name ?? "", dosage_form: m.form?.name ?? "", barcode: m.barcode ?? "", strips_per_box: m.strips_per_box,
      pieces_per_strip: m.pieces_per_strip, price_piece: m.price_piece, price_strip: m.price_strip, price_box: m.price_box, mrp: m.mrp,
      reorder_level: m.reorder_level, status: m.status, sellable_stock_pieces: m.sellable_qty,
    }));
    downloadFile(`medicines-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  }

  async function importCSV(file: File) {
    const rows = parseCSV(await file.text()) as Array<Partial<Record<CsvKey, string>>>;
    if (!rows.length) return void toast.error("The file has no rows.");
    const find = (list: { id: string; name: string }[], name?: string) => list.find((x) => x.name.toLowerCase() === (name ?? "").toLowerCase())?.id ?? null;
    const existing = new Set(meds.map((m) => `${m.brand_name}|${m.strength}`.toLowerCase()));
    const toInsert = [];
    let dup = 0, bad = 0;
    for (const r of rows) {
      if (!r.brand_name) { bad++; continue; }
      if (existing.has(`${r.brand_name}|${r.strength ?? ""}`.toLowerCase())) { dup++; continue; }
      const spb = Math.max(1, parseInt(r.strips_per_box || "1")), pps = Math.max(1, parseInt(r.pieces_per_strip || "1"));
      const pp = Number(r.price_piece || 0);
      toInsert.push({
        brand_name: r.brand_name, generic_name: r.generic_name ?? "", strength: r.strength ?? "", barcode: r.barcode || null,
        manufacturer_id: find(lk.manufacturers, r.manufacturer), category_id: find(lk.categories, r.category), dosage_form_id: find(lk.forms, r.dosage_form),
        strips_per_box: spb, pieces_per_strip: pps, is_divisible: spb * pps > 1, price_piece: pp,
        price_strip: Number(r.price_strip || pp * pps), price_box: Number(r.price_box || pp * pps * spb), mrp: Number(r.mrp || r.price_box || pp * pps * spb),
        reorder_level: parseInt(r.reorder_level || "20"), status: r.status === "inactive" ? "inactive" : "active",
      });
      existing.add(`${r.brand_name}|${r.strength ?? ""}`.toLowerCase());
    }
    if (toInsert.length) {
      const { error } = await supabase.from("medicines").insert(toInsert);
      if (error) return void toast.error(`Import failed: ${error.message}`);
    }
    toast.success(`Imported ${toInsert.length}. Skipped ${dup} duplicates${bad ? ` and ${bad} rows without a brand name` : ""}.`);
    qc.invalidateQueries({ queryKey: ["medicines"] });
  }

  return (
    <>
      <PageHeader
        title="Medicine Catalog"
        description={`${meds.length} medicines. Stock is stored in pieces and shown as box · strip · piece.`}
        actions={<>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = ""; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Import CSV</Button>
          <Button variant="outline" onClick={exportCSV}><Download /> Export CSV</Button>
          <Button onClick={() => setEditing({ values: blank })}><Plus /> Add medicine</Button>
        </>}
      />
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_160px_160px]">
        <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search brand, generic, maker, strength, barcode…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={cat} onValueChange={setCat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All categories</SelectItem>{lk.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={form} onValueChange={setForm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All forms</SelectItem>{lk.forms.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value={ALL}>Any status</SelectItem>
          {["In stock", "Low stock", "Out of stock", "Expiring soon"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent></Select>
      </div>

      {filtered.length === 0 ? <EmptyState title="No medicines match" text="Try a different search or filter." /> : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Medicine</th><th className="px-3">Maker</th><th className="px-3">Pack</th><th className="px-3 text-right">Piece / Strip / Box</th><th className="px-3">Stock</th><th className="px-3">Status</th><th className="px-3" /></tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((m) => {
                const st = stockStatus(m);
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{m.brand_name} <span className="text-muted-foreground">{m.strength}</span>{m.is_demo && <span className="ml-2"><StatusBadge tone="muted">Demo</StatusBadge></span>}</div>
                      <div className="text-xs text-muted-foreground">{m.generic_name} · {m.form?.name ?? "—"}</div>
                    </td>
                    <td className="px-3 text-xs">{m.manufacturer?.name ?? "—"}</td>
                    <td className="px-3 text-xs">{m.is_divisible ? `${m.strips_per_box} strip × ${m.pieces_per_strip} pc` : "Single unit"}</td>
                    <td className="num px-3 text-right text-xs">{formatBDT(m.price_piece)}{m.is_divisible && <> / {formatBDT(m.price_strip)} / {formatBDT(m.price_box)}</>}</td>
                    <td className="num px-3 text-xs">{describeQty(m.sellable_qty, m.strips_per_box, m.pieces_per_strip)}<div className="text-muted-foreground">{m.sellable_qty} pcs</div></td>
                    <td className="px-3">{m.status === "inactive" ? <StatusBadge tone="muted">Inactive</StatusBadge> : <StatusBadge tone={st.tone}>{st.label}</StatusBadge>}{m.expired_qty > 0 && <div className="mt-1"><StatusBadge tone="danger">Has expired</StatusBadge></div>}</td>
                    <td className="whitespace-nowrap px-3 text-right">
                      <Button size="icon" variant="ghost" aria-label="Batches" onClick={() => setBatchesFor(m)}><Layers /></Button>
                      <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing({ id: m.id, values: {
                        brand_name: m.brand_name, generic_name: m.generic_name, strength: m.strength, manufacturer_id: m.manufacturer_id, category_id: m.category_id,
                        dosage_form_id: m.dosage_form_id, barcode: m.barcode, strips_per_box: m.strips_per_box, pieces_per_strip: m.pieces_per_strip, is_divisible: m.is_divisible,
                        price_piece: m.price_piece, price_strip: m.price_strip, price_box: m.price_box, mrp: m.mrp, reorder_level: m.reorder_level, status: m.status as "active" | "inactive",
                      } })}><Pencil /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <MedicineDialog key={editing.id ?? "new"} initial={editing} onClose={() => setEditing(null)} />}
      <BatchesSheet med={batchesFor} onClose={() => setBatchesFor(null)} />
    </>
  );
}

function MedicineDialog({ initial, onClose }: { initial: { id?: string; values: MedForm }; onClose: () => void }) {
  const { data: lk } = useSuspenseQuery(lookupsQuery);
  const qc = useQueryClient();
  const [v, setV] = useState<MedForm>(initial.values);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof MedForm, val: unknown) => setV((p) => ({ ...p, [k]: val }));

  function autoPrice() {
    const pp = Number(v.price_piece || 0), pps = Number(v.pieces_per_strip || 1), spb = Number(v.strips_per_box || 1);
    setV((p) => ({ ...p, price_strip: +(pp * pps).toFixed(2), price_box: +(pp * pps * spb).toFixed(2), mrp: +(pp * pps * spb).toFixed(2) }));
  }

  async function save() {
    const parsed = medSchema.safeParse({ ...v, barcode: v.barcode || null, is_divisible: Number(v.strips_per_box) * Number(v.pieces_per_strip) > 1 ? v.is_divisible : false });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
    setBusy(true);
    const payload = { ...parsed.data, updated_at: new Date().toISOString() };
    const { error } = initial.id
      ? await supabase.from("medicines").update(payload).eq("id", initial.id)
      : await supabase.from("medicines").insert(payload);
    setBusy(false);
    if (error) {
      return void toast.error(error.code === "23505" ? "A medicine with the same name, strength, form and maker (or barcode) already exists." : error.message);
    }
    toast.success(initial.id ? "Medicine updated" : "Medicine added");
    qc.invalidateQueries({ queryKey: ["medicines"] });
    onClose();
  }

  const sel = (k: "manufacturer_id" | "category_id" | "dosage_form_id", list: { id: string; name: string }[], label: string) => (
    <div className="space-y-1.5"><Label>{label}</Label>
      <Select value={(v[k] as string) ?? "none"} onValueChange={(x) => set(k, x === "none" ? null : x)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="none">—</SelectItem>{list.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select></div>
  );
  const field = (k: keyof MedForm, label: string, type = "text") => (
    <div className="space-y-1.5"><Label>{label}</Label><Input type={type} step={type === "number" ? "any" : undefined} value={(v[k] as string | number | null) ?? ""} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{initial.id ? "Edit medicine" : "Add medicine"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("brand_name", "Brand name *")}
          {field("generic_name", "Generic name")}
          {field("strength", "Strength (e.g. 500 mg)")}
          {field("barcode", "Barcode")}
          {sel("manufacturer_id", lk.manufacturers, "Manufacturer")}
          {sel("category_id", lk.categories, "Category")}
          {sel("dosage_form_id", lk.forms, "Dosage form")}
          {field("reorder_level", "Reorder level (pieces)", "number")}
        </div>
        <div className="mt-2 rounded-lg border bg-muted/40 p-4">
          <p className="mb-3 text-sm font-medium">Unit conversion & selling prices</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {field("strips_per_box", "Strips per box", "number")}
            {field("pieces_per_strip", "Pieces per strip", "number")}
            <div className="flex items-end gap-2 pb-2"><Switch checked={v.is_divisible} onCheckedChange={(c) => set("is_divisible", c)} /><Label>Can sell loose strips / pieces</Label></div>
            {field("price_piece", "Price per piece (৳)", "number")}
            {field("price_strip", "Price per strip (৳)", "number")}
            {field("price_box", "Price per box (৳)", "number")}
            {field("mrp", "MRP per box (৳)", "number")}
            <div className="flex items-end"><Button type="button" variant="outline" size="sm" onClick={autoPrice}>Calculate strip & box from piece price</Button></div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">1 box = {Number(v.strips_per_box) * Number(v.pieces_per_strip)} pieces. Stock is always stored in pieces.</p>
        </div>
        <div className="flex items-center gap-2"><Switch checked={v.status === "active"} onCheckedChange={(c) => set("status", c ? "active" : "inactive")} /><Label>Active (available for sale)</Label></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchesSheet({ med, onClose }: { med: MedicineRow | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["batches", med?.id],
    enabled: !!med,
    queryFn: async () => {
      const { data, error } = await supabase.from("medicine_batches").select("*").eq("medicine_id", med!.id).order("expiry_date");
      if (error) throw error;
      return data;
    },
  });
  return (
    <Sheet open={!!med} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{med?.brand_name} {med?.strength} — batches</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3 px-4 pb-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data?.length ? <EmptyState title="No batches yet" text="Stock In (Phase 2) will add batches here." /> : data.map((b) => {
            const d = daysUntil(b.expiry_date) ?? 0;
            return (
              <div key={b.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between"><span className="font-mono font-medium">{b.batch_number}</span>
                  <StatusBadge tone={b.is_damaged ? "danger" : d <= 0 ? "danger" : b.remaining_qty === 0 ? "muted" : d <= 90 ? "warning" : "success"}>
                    {b.is_damaged ? "Damaged" : d <= 0 ? "Expired" : b.remaining_qty === 0 ? "Empty" : d <= 90 ? `Expires in ${d}d` : "Good"}
                  </StatusBadge></div>
                <div className="num mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Remaining: <b className="text-foreground">{b.remaining_qty}</b> / {b.original_qty} pcs</span>
                  <span>Expiry: <b className="text-foreground">{formatDate(b.expiry_date)}</b></span>
                  <span>Cost / pc: <b className="text-foreground">{formatBDT(b.purchase_price)}</b></span>
                  <span>Sell / pc: <b className="text-foreground">{formatBDT(b.selling_price)}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
