import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, Pill, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Staff } from "@/lib/staff";
import { cn } from "@/lib/utils";

export interface NavItem { to: string; label: string; icon: LucideIcon; exact?: boolean }

export function AppShell({ staff, nav, title, children }: { staff: Staff; nav: NavItem[]; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.rpc("log_activity", { _action: "logout" });
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navList = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
      {nav.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          activeOptions={{ exact: !!n.exact }}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold [&>svg]:text-sidebar-primary" }}
        >
          <n.icon className="size-4" /> {n.label}
        </Link>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-2 px-6 py-5 font-display text-lg font-semibold text-sidebar-accent-foreground">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand"><Pill className="size-4 text-primary-foreground" /></span>
        PharmaDesk
      </div>
      <p className="px-6 pb-3 text-xs uppercase tracking-wider text-sidebar-foreground/60">{title}</p>
      {navList}
      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{staff.full_name}</p>
        <p className="truncate text-xs capitalize text-sidebar-foreground/70">{staff.role === "admin" ? "Owner / Admin" : "Cashier"}</p>
        <Button variant="ghost" size="sm" onClick={signOut} className="mt-2 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></Button>
          <span className="font-display font-semibold">PharmaDesk</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/10 text-info border-info/25",
  muted: "bg-muted text-muted-foreground border-border",
} as const;

export function StatusBadge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "primary" }: { label: string; value: ReactNode; hint?: string; icon: LucideIcon; tone?: "primary" | "info" | "warning" | "danger" }) {
  const t = { primary: "bg-accent text-accent-foreground", info: "bg-info/10 text-info", warning: "bg-warning/20 text-warning-foreground", danger: "bg-destructive/10 text-destructive" }[tone];
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-lg", t)}><Icon className="size-4" /></span>
      </div>
      <p className="num mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
