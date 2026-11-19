import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Boxes, CalendarClock, HandCoins, PackageX, Truck, Wallet, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "@/components/app/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBDT, formatDate, daysUntil, describeQty } from "@/lib/format";
import { medicinesQuery } from "@/lib/queries";

interface Summary { purchase_value: number; mrp_value: number; customer_due: number; supplier_payable: number; low_stock: number; out_of_stock: number; exp_30: number; exp_60: number; exp_90: number; expired: number }

const summaryQuery = queryOptions({
  queryKey: ["admin-summary"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_inventory_summary");
    if (error) throw error;
    return data as unknown as Summary;
  },
});

const batchesQuery = queryOptions({
  queryKey: ["batches-dashboard"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("medicine_batches")
      .select("id,batch_number,remaining_qty,expiry_date,purchase_price,mrp,is_damaged,medicine:medicines(brand_name,strength,strips_per_box,pieces_per_strip,category:categories(name))")
      .gt("remaining_qty", 0)
      .order("expiry_date")
      .limit(5000);
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — PharmaDesk" }, { name: "description", content: "Pharmacy overview" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(summaryQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data: s } = useSuspenseQuery(summaryQuery);
  const batches = useQuery(batchesQuery);
  const meds = useQuery(medicinesQuery);

  const byCategory = new Map<string, number>();
  const today = new Date().toISOString().slice(0, 10);
  for (const b of batches.data ?? []) {
    if (b.expiry_date <= today || b.is_damaged) continue;
    const k = b.medicine?.category?.name ?? "Other";
    byCategory.set(k, (byCategory.get(k) ?? 0) + b.remaining_qty * Number(b.purchase_price));
  }
  const chart = [...byCategory.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  const expiring = (batches.data ?? []).filter((b) => (daysUntil(b.expiry_date) ?? 999) <= 90).slice(0, 8);
  const low = (meds.data ?? []).filter((m) => m.status === "active" && m.sellable_qty <= m.reorder_level).slice(0, 8);

  return (
    <>
      <PageHeader title="Dashboard" description="Inventory, dues and alerts at a glance. Sales and profit cards appear once billing goes live (Phase 3)." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Inventory value (cost)" value={formatBDT(s.purchase_value)} icon={Boxes} hint="Sellable stock at batch purchase price" />
        <StatCard label="Inventory value (MRP)" value={formatBDT(s.mrp_value)} icon={Wallet} tone="info" />
        <StatCard label="Customer outstanding due" value={formatBDT(s.customer_due)} icon={HandCoins} tone="warning" />
        <StatCard label="Supplier payable" value={formatBDT(s.supplier_payable)} icon={Truck} tone="danger" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Inventory alerts</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { l: "Low stock", v: s.low_stock, i: AlertTriangle, t: "warning" as const },
          { l: "Out of stock", v: s.out_of_stock, i: PackageX, t: "danger" as const },
          { l: "Expiring ≤30 days", v: s.exp_30, i: CalendarClock, t: "danger" as const },
          { l: "Expiring 31–60 days", v: s.exp_60, i: CalendarClock, t: "warning" as const },
          { l: "Expiring 61–90 days", v: s.exp_90, i: CalendarClock, t: "info" as const },
          { l: "Expired batches", v: s.expired, i: Ban, t: "danger" as const },
        ].map((x) => (
          <StatCard key={x.l} label={x.l} value={x.v} icon={x.i} tone={x.t} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-5">
        <section className="rounded-xl border bg-card p-5 shadow-card xl:col-span-3">
          <h3 className="font-semibold">Stock value by category</h3>
          <p className="mb-4 text-xs text-muted-foreground">At purchase cost, excluding expired and damaged stock</p>
          {batches.isLoading ? <Skeleton className="h-72" /> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBDT(v)} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-card xl:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Low / out of stock</h3><Link to="/admin/medicines" className="text-sm text-primary">View all</Link></div>
          {meds.isLoading ? <Skeleton className="h-60" /> : low.length === 0 ? <EmptyState title="All stocked up" /> : (
            <ul className="divide-y">
              {low.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate">{m.brand_name} <span className="text-muted-foreground">{m.strength}</span></span>
                  <StatusBadge tone={m.sellable_qty === 0 ? "danger" : "warning"}>{m.sellable_qty === 0 ? "Out" : describeQty(m.sellable_qty, m.strips_per_box, m.pieces_per_strip)}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-card">
        <h3 className="mb-3 font-semibold">Expired & expiring within 90 days</h3>
        {batches.isLoading ? <Skeleton className="h-40" /> : expiring.length === 0 ? <EmptyState title="No batches near expiry" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Medicine</th><th>Batch</th><th>Qty</th><th>Expiry</th><th>Status</th></tr></thead>
              <tbody className="divide-y">
                {expiring.map((b) => {
                  const d = daysUntil(b.expiry_date) ?? 0;
                  return (
                    <tr key={b.id}>
                      <td className="py-2">{b.medicine?.brand_name} <span className="text-muted-foreground">{b.medicine?.strength}</span></td>
                      <td className="font-mono text-xs">{b.batch_number}</td>
                      <td className="num">{b.remaining_qty}</td>
                      <td className="num">{formatDate(b.expiry_date)}</td>
                      <td><StatusBadge tone={d <= 0 ? "danger" : d <= 30 ? "danger" : d <= 60 ? "warning" : "info"}>{d <= 0 ? "Expired" : `${d} days left`}</StatusBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
