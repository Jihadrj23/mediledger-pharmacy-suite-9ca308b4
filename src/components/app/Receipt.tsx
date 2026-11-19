import { useEffect } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { settingsQuery } from "@/lib/queries";
import { formatBDT, formatDateTime } from "@/lib/format";

export const saleQuery = (id: string) => queryOptions({
  queryKey: ["sale", id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("id,invoice_no,created_at,cashier_name,subtotal,discount,vat,total,paid,due,payment_method,note,customer:customers(name,phone,current_due),items:sale_items(id,unit,qty,unit_price,discount,line_total,medicine:medicines(brand_name,strength,is_divisible,strips_per_box,pieces_per_strip))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },
});

const methodLabel: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", card: "Card" };
export const paymentLabel = (m: string) => methodLabel[m] ?? m;

function unitName(unit: string, m: { is_divisible: boolean; strips_per_box: number; pieces_per_strip: number } | null) {
  if (!m || !m.is_divisible || m.strips_per_box * m.pieces_per_strip <= 1) return "unit";
  return unit === "box" ? "box" : unit === "strip" ? "strip" : "pc";
}

export function ReceiptDialog({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  const sale = useQuery({ ...saleQuery(saleId ?? ""), enabled: !!saleId });
  const settings = useQuery(settingsQuery);

  useEffect(() => {
    const after = () => document.body.classList.remove("printing-receipt");
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);

  function print() {
    document.body.classList.add("printing-receipt");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-receipt"), 1000);
  }

  const s = sale.data;
  const p = settings.data;
  return (
    <Dialog open={!!saleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
        <DialogHeader className="no-print"><DialogTitle>Receipt</DialogTitle></DialogHeader>
        {!s || !p ? <Skeleton className="h-96" /> : (
          <div className="print-area rounded-lg border bg-card p-4 font-mono text-xs leading-relaxed text-card-foreground">
            <div className="text-center">
              <p className="text-sm font-bold">{p.pharmacy_name}</p>
              {p.address && <p>{p.address}</p>}
              {p.phone && <p>Phone: {p.phone}</p>}
              {p.trade_info && <p>{p.trade_info}</p>}
            </div>
            <div className="my-2 border-t border-dashed" />
            <div className="flex justify-between"><span>Invoice</span><span className="font-semibold">{s.invoice_no}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{formatDateTime(s.created_at)}</span></div>
            <div className="flex justify-between"><span>Served by</span><span>{s.cashier_name || "—"}</span></div>
            {s.customer && <div className="flex justify-between"><span>Customer</span><span>{s.customer.name}{s.customer.phone ? ` (${s.customer.phone})` : ""}</span></div>}
            <div className="my-2 border-t border-dashed" />
            <table className="w-full">
              <thead><tr className="text-left"><th className="font-semibold">Item</th><th className="text-right font-semibold">Qty</th><th className="text-right font-semibold">Amount</th></tr></thead>
              <tbody>
                {s.items.map((it) => (
                  <tr key={it.id} className="align-top">
                    <td className="py-0.5 pr-1">{it.medicine?.brand_name} {it.medicine?.strength}<br /><span className="text-muted-foreground">@ {formatBDT(it.unit_price)}{Number(it.discount) > 0 ? ` − ${formatBDT(it.discount)}` : ""}</span></td>
                    <td className="whitespace-nowrap py-0.5 text-right">{it.qty} {unitName(it.unit, it.medicine)}</td>
                    <td className="py-0.5 text-right">{formatBDT(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="my-2 border-t border-dashed" />
            <Row l="Subtotal" v={formatBDT(s.subtotal)} />
            {Number(s.discount) > 0 && <Row l="Discount" v={`− ${formatBDT(s.discount)}`} />}
            {Number(s.vat) > 0 && <Row l="VAT" v={formatBDT(s.vat)} />}
            <Row l="Total" v={formatBDT(s.total)} bold />
            <Row l={`Paid (${paymentLabel(s.payment_method)})`} v={formatBDT(s.paid)} />
            {Number(s.due) > 0 && <Row l="Due (বাকি)" v={formatBDT(s.due)} bold />}
            {s.customer && Number(s.customer.current_due) > 0 && <Row l="Customer total due now" v={formatBDT(s.customer.current_due)} />}
            <div className="my-2 border-t border-dashed" />
            <p className="text-center">{p.receipt_footer}</p>
          </div>
        )}
        <div className="no-print flex gap-2">
          <Button className="flex-1" onClick={print} disabled={!s}><Printer /> Print receipt</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "text-sm font-bold" : ""}`}><span>{l}</span><span>{v}</span></div>;
}
