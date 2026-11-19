import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Pill, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCurrentStaff, homeFor } from "@/lib/staff";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PharmaDesk" },
      { name: "description", content: "Staff sign in for the pharmacy POS and admin panel." },
      { property: "og:title", content: "Sign in — PharmaDesk" },
      { property: "og:description", content: "Staff sign in for the pharmacy POS and admin panel." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(6, "At least 6 characters") });
const setupSchema = loginSchema.extend({ full_name: z.string().trim().min(2, "Enter your name").max(80) });

function AuthPage() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.rpc("setup_required").then(({ data }) => setSetup(Boolean(data)));
    fetchCurrentStaff().then((s) => s && navigate({ to: homeFor(s.role), replace: true }));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (setup) {
        const v = setupSchema.safeParse(form);
        if (!v.success) return void toast.error(v.error.issues[0]?.message ?? "Please check the form");
        const { error } = await supabase.auth.signUp({
          email: v.data.email, password: v.data.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: v.data.full_name } },
        });
        if (error) return void toast.error(error.message);
        setSent(true);
      } else {
        const v = loginSchema.safeParse(form);
        if (!v.success) return void toast.error(v.error.issues[0]?.message ?? "Please check the form");
        const { error } = await supabase.auth.signInWithPassword(v.data);
        if (error) return void toast.error(error.message);
        const staff = await fetchCurrentStaff();
        if (!staff || !staff.is_active) {
          await supabase.auth.signOut();
          return void toast.error("This account is not active. Contact the pharmacy owner.");
        }
        await supabase.rpc("log_activity", { _action: "login" });
        navigate({ to: homeFor(staff.role), replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold"><Pill className="size-6" /> PharmaDesk</div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight">Run your pharmacy with confidence.</h1>
          <p className="mt-4 max-w-md text-primary-foreground/80">Fast billing, batch-wise stock with expiry tracking, dues and real profit — built for pharmacies in Bangladesh.</p>
        </div>
        <p className="text-sm text-primary-foreground/70">৳ BDT · Asia/Dhaka</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="space-y-1">
            <div className="mb-4 flex items-center gap-2 font-semibold text-primary lg:hidden"><Pill className="size-5" /> PharmaDesk</div>
            <h2 className="text-2xl font-semibold">{setup ? "Create the owner account" : "Staff sign in"}</h2>
            <p className="text-sm text-muted-foreground">
              {setup ? "This first account becomes the pharmacy owner (admin). Staff accounts are created by the owner later." : "Use the account your pharmacy owner created for you."}
            </p>
          </div>
          {sent ? (
            <div className="rounded-lg border bg-accent p-4 text-sm text-accent-foreground">
              <ShieldCheck className="mb-2 size-5" /> Check your email and click the confirmation link, then come back here to sign in.
            </div>
          ) : (
            <>
              {setup && (
                <div className="space-y-2"><Label htmlFor="name">Full name</Label>
                  <Input id="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              )}
              <div className="space-y-2"><Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete={setup ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={busy || setup === null}>
                {busy ? "Please wait…" : setup ? "Create owner account" : "Sign in"}
              </Button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
