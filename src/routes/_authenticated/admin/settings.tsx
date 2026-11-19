import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/app/AppShell";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — PharmaDesk" }, { name: "description", content: "Pharmacy settings" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const qc = useQueryClient();
  const [v, setV] = useState(data);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: unknown) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    if (!v.pharmacy_name.trim()) return void toast.error("Pharmacy name is required");
    setBusy(true);
    const { id: _id, updated_at: _u, ...rest } = v;
    const { error } = await supabase.from("pharmacy_settings").update({
      ...rest,
      vat_percent: Number(v.vat_percent), max_cashier_discount_percent: Number(v.max_cashier_discount_percent),
      low_stock_threshold: Number(v.low_stock_threshold), expiry_alert_days: Number(v.expiry_alert_days), updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  async function clearDemo() {
    const { error } = await supabase.rpc("clear_demo_data");
    if (error) return void toast.error(error.message);
    toast.success("Demo data removed. Your own records were not touched.");
    qc.invalidateQueries();
  }

  const text = (k: keyof typeof v, label: string, type = "text") => (
    <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={(v[k] as string | number | null) ?? ""} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <>
      <PageHeader title="Settings" description="Pharmacy profile, receipt, tax and alert preferences." actions={<Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-semibold">Pharmacy profile</h3>
          {text("pharmacy_name", "Pharmacy name")}
          {text("logo_url", "Logo image URL")}
          {text("address", "Address")}
          {text("phone", "Phone")}
          {text("trade_info", "Trade licence / DGDA info (optional)")}
          <div className="space-y-1.5"><Label>Receipt footer</Label><Textarea value={v.receipt_footer ?? ""} onChange={(e) => set("receipt_footer", e.target.value)} /></div>
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-semibold">Billing & alerts</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Currency</Label><Input value="BDT (৳)" disabled /></div>
            <div className="space-y-1.5"><Label>Language</Label>
              <Select value={v.language} onValueChange={(x) => set("language", x)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="bn">বাংলা (Bengali)</SelectItem></SelectContent></Select></div>
            {text("invoice_prefix", "Invoice prefix")}
            {text("max_cashier_discount_percent", "Max cashier discount (%)", "number")}
            <div className="flex items-end gap-2 pb-2"><Switch checked={v.vat_enabled} onCheckedChange={(c) => set("vat_enabled", c)} /><Label>Charge VAT</Label></div>
            {text("vat_percent", "VAT (%)", "number")}
            {text("low_stock_threshold", "Default low-stock threshold (pcs)", "number")}
            {text("expiry_alert_days", "Expiry alert period (days)", "number")}
          </div>
        </section>
        <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5 shadow-card lg:col-span-2">
          <h3 className="font-semibold">Demo data</h3>
          <p className="text-sm text-muted-foreground">Sample medicines, batches, customers and suppliers are tagged “Demo”. Remove them before you start real business. Records you created yourself are never deleted.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive">Remove all demo data</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Remove demo data?</AlertDialogTitle>
                <AlertDialogDescription>This deletes every sample record marked Demo. It cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={clearDemo}>Remove</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </>
  );
}
