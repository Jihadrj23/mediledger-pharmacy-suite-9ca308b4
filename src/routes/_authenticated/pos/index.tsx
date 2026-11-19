import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader, StatusBadge, EmptyState } from "@/components/app/AppShell";
import { medicinesQuery, stockStatus } from "@/lib/queries";
import { describeQty, formatBDT, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pos/")({
  head: () => ({ meta: [{ title: "Stock Lookup — PharmaDesk" }, { name: "description", content: "Find medicines and check available stock" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(medicinesQuery),
  component: StockLookup,
});

function StockLookup() {
  const { data } = useSuspenseQuery(medicinesQuery);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "F2") { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const active = data.filter((m) => m.status === "active");
    if (!s) return active.slice(0, 40);
    const exact = active.filter((m) => m.barcode === s);
    if (exact.length) return exact;
    return active.filter((m) => [m.brand_name, m.generic_name, m.strength, m.manufacturer?.name, m.form?.name].some((v) => v?.toLowerCase().includes(s))).slice(0, 60);
  }, [data, q]);

  return (
    <>
      <PageHeader title="Stock Lookup" description="Search by brand, generic, maker, strength or scan a barcode. Press F2 to jump to search. Billing arrives in Phase 3." />
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-3.5 size-5 text-muted-foreground" />
        <Input ref={ref} autoFocus className="h-12 pl-11 pr-11 text-base" placeholder="Type a medicine name or scan barcode…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ScanBarcode className="absolute right-3.5 top-3.5 size-5 text-muted-foreground" />
      </div>
      {list.length === 0 ? <EmptyState title="No medicine found" text="Check the spelling or try the generic name." /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => {
            const st = stockStatus(m);
            return (
              <div key={m.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate font-semibold">{m.brand_name} <span className="font-normal text-muted-foreground">{m.strength}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{m.generic_name} · {m.form?.name} · {m.manufacturer?.name}</p></div>
                  <span className="shrink-0"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></span>
                </div>
                <div className="num mt-3 flex items-end justify-between text-sm">
                  <div><p className="text-xs text-muted-foreground">Available</p><p className="font-medium">{describeQty(m.sellable_qty, m.strips_per_box, m.pieces_per_strip)}</p></div>
                  <div className="text-right text-xs">
                    {m.is_divisible ? <><p>Piece {formatBDT(m.price_piece)}</p><p>Strip {formatBDT(m.price_strip)}</p><p className="font-semibold">Box {formatBDT(m.price_box)}</p></> : <p className="text-sm font-semibold">{formatBDT(m.price_box)}</p>}
                  </div>
                </div>
                {m.nearest_expiry && <p className="mt-2 text-xs text-muted-foreground">Next expiry: {formatDate(m.nearest_expiry)}</p>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
