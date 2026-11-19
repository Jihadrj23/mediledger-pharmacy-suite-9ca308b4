import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge } from "@/components/app/AppShell";
import { formatDateTime } from "@/lib/format";

const logsQuery = queryOptions({
  queryKey: ["audit-logs"],
  queryFn: async () => {
    const [{ data, error }, { data: people }] = await Promise.all([
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (error) throw error;
    const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    return (data ?? []).map((l) => ({ ...l, who: l.user_id ? names.get(l.user_id) ?? "Unknown" : "System" }));
  },
});

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({ meta: [{ title: "Activity Logs — PharmaDesk" }, { name: "description", content: "Audit trail of staff actions" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logsQuery),
  component: ActivityPage,
});

function describe(l: { action: string; entity: string | null; details: unknown }) {
  const d = (l.details ?? {}) as { new?: { brand_name?: string; full_name?: string }; email?: string };
  if (l.entity === "medicines") return `${l.action === "insert" ? "Added" : "Edited"} medicine ${d.new?.brand_name ?? ""}`;
  if (l.entity === "pharmacy_settings") return "Changed pharmacy settings";
  if (l.entity === "profiles" && l.action === "update") return `Profile updated: ${d.new?.full_name ?? ""}`;
  return `${l.action.replace(/_/g, " ")}${d.email ? ` (${d.email})` : ""}`;
}

function ActivityPage() {
  const { data } = useSuspenseQuery(logsQuery);
  return (
    <>
      <PageHeader title="Activity Logs" description="Permanent record of logins, catalog changes, employee changes and settings. Logs cannot be edited or deleted." />
      {data.length === 0 ? <EmptyState title="No activity yet" /> : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">When</th><th className="px-3">Who</th><th className="px-3">Action</th><th className="px-3">Area</th></tr></thead>
            <tbody className="divide-y">
              {data.map((l) => (
                <tr key={l.id}><td className="num whitespace-nowrap px-4 py-2 text-xs">{formatDateTime(l.created_at)}</td><td className="px-3">{l.who}</td><td className="px-3 capitalize">{describe(l)}</td><td className="px-3"><StatusBadge tone="muted">{l.entity ?? "session"}</StatusBadge></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
