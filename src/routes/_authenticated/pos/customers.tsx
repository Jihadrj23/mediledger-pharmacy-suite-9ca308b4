import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, EmptyState } from "@/components/app/AppShell";
import { formatBDT } from "@/lib/format";

const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name").limit(5000);
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/pos/customers")({
  head: () => ({ meta: [{ title: "Customers — PharmaDesk" }, { name: "description", content: "Search and register customers" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(customersQuery),
  component: CustomersPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name").max(100),
  phone: z.string().trim().regex(/^(\+?880|0)?1[3-9]\d{8}$|^$/, "Enter a valid Bangladeshi mobile number").max(20),
  address: z.string().trim().max(200),
});

function CustomersPage() {
  const { data } = useSuspenseQuery(customersQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", phone: "", address: "" });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? data.filter((c) => c.name.toLowerCase().includes(s) || c.phone?.includes(s)) : data;
  }, [data, q]);

  async function save() {
    const p = schema.safeParse({ ...v, phone: v.phone.replace(/[\s-]/g, "") });
    if (!p.success) return void toast.error(p.error.issues[0]?.message ?? "Please check the form");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customers").insert({ ...p.data, phone: p.data.phone || null, created_by: u.user?.id ?? null });
    if (error) return void toast.error(error.code === "23505" ? "A customer with this phone number already exists." : error.message);
    toast.success("Customer registered");
    setOpen(false); setV({ name: "", phone: "", address: "" });
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <>
      <PageHeader title="Customers" description="Find a customer by name or phone, or register a new one." actions={<Button onClick={() => setOpen(true)}><UserPlus /> New customer</Button>} />
      <div className="relative mb-4"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Name or phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length === 0 ? <EmptyState title="No customers found" /> : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Name</th><th className="px-3">Phone</th><th className="px-3">Address</th><th className="px-3 text-right">Current due</th></tr></thead>
            <tbody className="divide-y">
              {list.map((c) => (
                <tr key={c.id}><td className="px-4 py-2.5 font-medium">{c.name}{c.is_demo && <span className="ml-2"><StatusBadge tone="muted">Demo</StatusBadge></span>}</td><td className="px-3">{c.phone ?? "—"}</td><td className="px-3 text-muted-foreground">{c.address}</td>
                  <td className="num px-3 text-right">{Number(c.current_due) > 0 ? <StatusBadge tone="warning">{formatBDT(c.current_due)}</StatusBadge> : <span className="text-muted-foreground">{formatBDT(0)}</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input placeholder="01XXXXXXXXX" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
