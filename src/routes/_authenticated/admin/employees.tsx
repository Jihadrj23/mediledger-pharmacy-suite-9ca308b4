import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge } from "@/components/app/AppShell";
import { createEmployee, updateEmployee } from "@/lib/employees.functions";
import { formatDate } from "@/lib/format";

const staffQuery = queryOptions({
  queryKey: ["employees"],
  queryFn: async () => {
    const [{ data: p, error }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw error;
    return (p ?? []).map((x) => ({ ...x, role: (r ?? []).some((y) => y.user_id === x.id && y.role === "admin") ? "admin" as const : "cashier" as const }));
  },
});

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({ meta: [{ title: "Employees — PharmaDesk" }, { name: "description", content: "Manage staff accounts and permissions" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(staffQuery),
  component: EmployeesPage,
});

type Emp = { id: string; full_name: string; email: string | null; phone: string | null; role: "admin" | "cashier"; is_active: boolean; max_discount_percent: number; can_collect_due: boolean; created_at: string };
interface FormState { id?: string; full_name: string; email: string; password: string; phone: string; role: "admin" | "cashier"; is_active: boolean; max_discount_percent: string; can_collect_due: boolean }

function EmployeesPage() {
  const { data } = useSuspenseQuery(staffQuery);
  const { staff } = Route.useRouteContext();
  const [edit, setEdit] = useState<FormState | null>(null);

  return (
    <>
      <PageHeader title="Employees" description="Create staff accounts, set roles, discount limits and due-collection permission."
        actions={<Button onClick={() => setEdit({ full_name: "", email: "", password: "", phone: "", role: "cashier", is_active: true, max_discount_percent: "5", can_collect_due: false })}><UserPlus /> Add employee</Button>} />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Name</th><th className="px-3">Role</th><th className="px-3">Max discount</th><th className="px-3">Due collection</th><th className="px-3">Status</th><th className="px-3">Joined</th><th /></tr></thead>
          <tbody className="divide-y">
            {data.map((e: Emp) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5"><div className="font-medium">{e.full_name}{e.id === staff.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</div><div className="text-xs text-muted-foreground">{e.email} {e.phone && `· ${e.phone}`}</div></td>
                <td className="px-3"><StatusBadge tone={e.role === "admin" ? "info" : "muted"}>{e.role === "admin" ? "Admin" : "Cashier"}</StatusBadge></td>
                <td className="num px-3">{Number(e.max_discount_percent)}%</td>
                <td className="px-3">{e.can_collect_due ? "Allowed" : "—"}</td>
                <td className="px-3"><StatusBadge tone={e.is_active ? "success" : "danger"}>{e.is_active ? "Active" : "Deactivated"}</StatusBadge></td>
                <td className="num px-3 text-xs">{formatDate(e.created_at)}</td>
                <td className="px-3 text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ id: e.id, full_name: e.full_name, email: e.email ?? "", password: "", phone: e.phone ?? "", role: e.role, is_active: e.is_active, max_discount_percent: String(e.max_discount_percent), can_collect_due: e.can_collect_due })}><Pencil /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <EmployeeDialog initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EmployeeDialog({ initial, onClose }: { initial: FormState; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateEmployee);

  async function save() {
    setBusy(true);
    try {
      const pct = Number(v.max_discount_percent);
      if (v.id) {
        await update({ data: { id: v.id, full_name: v.full_name, phone: v.phone || null, role: v.role, is_active: v.is_active, max_discount_percent: pct, can_collect_due: v.can_collect_due, new_password: v.password || undefined } });
        toast.success("Employee updated");
      } else {
        await create({ data: { full_name: v.full_name, email: v.email, password: v.password, phone: v.phone, role: v.role, max_discount_percent: pct, can_collect_due: v.can_collect_due } });
        toast.success("Employee account created. Share the email and password with them.");
      }
      qc.invalidateQueries({ queryKey: ["employees"] });
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.startsWith("[") ? "Please check the form: name, valid email and an 8+ character password are required." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{v.id ? "Edit employee" : "New employee"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Full name</Label><Input value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email (login)</Label><Input type="email" disabled={!!v.id} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{v.id ? "New password (optional)" : "Password"}</Label><Input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Role</Label>
            <Select value={v.role} onValueChange={(r) => setV({ ...v, role: r as FormState["role"] })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="cashier">Cashier</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Max discount (%)</Label><Input type="number" min={0} max={100} value={v.max_discount_percent} onChange={(e) => setV({ ...v, max_discount_percent: e.target.value })} /></div>
          <div className="flex items-end gap-2 pb-2"><Switch checked={v.can_collect_due} onCheckedChange={(c) => setV({ ...v, can_collect_due: c })} /><Label>Can collect customer dues</Label></div>
          {v.id && <div className="flex items-center gap-2"><Switch checked={v.is_active} onCheckedChange={(c) => setV({ ...v, is_active: c })} /><Label>Account active</Label></div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
