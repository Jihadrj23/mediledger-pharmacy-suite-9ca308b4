import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/pos/account")({
  head: () => ({ meta: [{ title: "My Account — PharmaDesk" }, { name: "description", content: "Your staff account" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { staff } = Route.useRouteContext();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (pw.length < 8) return void toast.error("New password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as { password: string });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Password changed");
    setCur(""); setPw("");
  }

  return (
    <>
      <PageHeader title="My Account" />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2 rounded-xl border bg-card p-5 text-sm shadow-card">
          <h3 className="mb-2 font-semibold">Profile</h3>
          <p><span className="text-muted-foreground">Name:</span> {staff.full_name}</p>
          <p><span className="text-muted-foreground">Email:</span> {staff.email}</p>
          <p><span className="text-muted-foreground">Role:</span> {staff.role === "admin" ? "Admin" : "Cashier"}</p>
          <p><span className="text-muted-foreground">Max discount:</span> {staff.max_discount_percent}%</p>
          <p><span className="text-muted-foreground">Due collection:</span> {staff.can_collect_due ? "Allowed" : "Not allowed"}</p>
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-semibold">Change password</h3>
          <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button onClick={change} disabled={busy}>Update password</Button>
        </section>
      </div>
    </>
  );
}
