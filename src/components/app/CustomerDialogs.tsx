import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/app/AppShell";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { CustomerRow } from "@/lib/queries";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name").max(100),
  phone: z.string().trim().regex(/^(\+?880|0)?1[3-9]\d{8}$|^$/, "Enter a valid Bangladeshi mobile number").max(20),
  address: z.string().trim().max(200),
});

export function NewCustomerDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (c: CustomerRow) => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ name: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);

  async function save() {
    const p = schema.safeParse({ ...v, phone: v.phone.replace(/[\s-]/g, "") });
    if (!p.success) return void toast.error(p.error.issues[0]?.message ?? "Please check the form");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("customers").insert({ ...p.data, phone: p.data.phone || null, created_by: u.user?.id ?? null }).select("*").single();
    setBusy(false);
    if (error) return void toast.error(error.code === "23505" ? "A customer with this phone number already exists." : error.message);
    toast.success("Customer registered");
    setV({ name: "", phone: "", address: "" });
    await qc.invalidateQueries({ queryKey: ["customers"] });
    onCreated?.(data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Register customer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-phone">Mobile</Label><Input id="c-phone" placeholder="01XXXXXXXXX" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-addr">Address</Label><Input id="c-addr" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const kindLabel: Record<string, { label: string; tone: "warning" | "success" | "muted" | "info" }> = {
  opening: { label: "Opening due", tone: "muted" },
  sale_due: { label: "Due from sale", tone: "warning" },
  payment: { label: "Payment received", tone: "success" },
  adjustment: { label: "Adjustment", tone: "info" },
};

/** Customer due ledger (বাকি খাতা) with optional due collection. */
export function CustomerLedgerDialog({ customer, canCollect, onClose, onOpenSale }: { customer: CustomerRow | null; canCollect: boolean; onClose: () => void; onOpenSale?: (saleId: string) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ledger = useQuery({
    queryKey: ["ledger", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_ledger").select("id,kind,amount,method,note,sale_id,created_at").eq("customer_id", customer!.id).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const cust = useQuery({
    queryKey: ["customer", customer?.id],
    enabled: !!customer,
    initialData: customer ?? undefined,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", customer!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const due = Number(cust.data?.current_due ?? 0);

  async function collect() {
    const a = Number(amount);
    if (!(a > 0)) return void toast.error("Enter the amount received");
    if (a > due) return void toast.error(`Amount is more than the due of ${formatBDT(due)}`);
    setBusy(true);
    const { error } = await supabase.rpc("collect_due", { _customer_id: customer!.id, _amount: a, _method: method, _note: note || undefined });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`${formatBDT(a)} received from ${customer!.name}`);
    setAmount(""); setNote("");
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["customer", customer!.id] });
    qc.invalidateQueries({ queryKey: ["ledger", customer!.id] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  }

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{customer?.name} — due ledger</DialogTitle></DialogHeader>
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
          <div><p className="text-xs text-muted-foreground">Current due (বাকি)</p><p className="num text-xl font-semibold">{formatBDT(due)}</p></div>
          <p className="text-right text-xs text-muted-foreground">{customer?.phone}<br />{customer?.address}</p>
        </div>
        {canCollect ? due > 0 && (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1"><Label htmlFor="due-amt">Amount received</Label><Input id="due-amt" type="number" min={0} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(due)} /></div>
            <div className="space-y-1"><Label>Method</Label>
              <Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">bKash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent></Select></div>
            <Input className="sm:col-span-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2 sm:col-span-2">
              <Button variant="outline" onClick={() => setAmount(String(due))}>Full due</Button>
              <Button className="flex-1" onClick={collect} disabled={busy}>{busy ? "Saving…" : "Collect payment"}</Button>
            </div>
          </div>
        ) : <p className="text-xs text-muted-foreground">You can view dues. Ask the owner to allow due collection on your account.</p>}
        {ledger.isLoading ? <Skeleton className="h-40" /> : (
          <ul className="divide-y rounded-lg border">
            {(ledger.data ?? []).length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No due history yet.</li>}
            {(ledger.data ?? []).map((l) => {
              const k = kindLabel[l.kind] ?? { label: l.kind, tone: "muted" as const };
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <StatusBadge tone={k.tone}>{k.label}</StatusBadge>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{formatDateTime(l.created_at)}{l.note ? ` · ${l.note}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`num font-medium ${Number(l.amount) < 0 ? "text-success" : ""}`}>{Number(l.amount) < 0 ? "− " : "+ "}{formatBDT(Math.abs(Number(l.amount)))}</p>
                    {l.sale_id && onOpenSale && <button className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => onOpenSale(l.sale_id!)}>View bill</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
