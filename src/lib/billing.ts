/** Pure billing helpers shared by the POS screen and tests. Server (create_sale) applies the same rules. */
export type SaleUnit = "box" | "strip" | "piece";

export interface PackInfo {
  strips_per_box: number;
  pieces_per_strip: number;
  is_divisible: boolean;
  price_box: number;
  price_strip: number;
  price_piece: number;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** How many base pieces one unit holds. */
export function unitFactor(unit: SaleUnit, m: Pick<PackInfo, "strips_per_box" | "pieces_per_strip">): number {
  if (unit === "box") return m.strips_per_box * m.pieces_per_strip;
  if (unit === "strip") return m.pieces_per_strip;
  return 1;
}

/** Units a medicine can be sold or stocked in (largest first). Whole-unit items (syrups, creams) only sell as one unit. */
export function unitsFor(m: Pick<PackInfo, "strips_per_box" | "pieces_per_strip" | "is_divisible">): SaleUnit[] {
  if (!m.is_divisible || m.strips_per_box * m.pieces_per_strip <= 1) return ["box"];
  const out: SaleUnit[] = [];
  if (m.strips_per_box > 1) out.push("box");
  if (m.pieces_per_strip > 1) out.push("strip");
  out.push("piece");
  return out;
}

export function unitLabel(unit: SaleUnit, m: Pick<PackInfo, "is_divisible" | "strips_per_box" | "pieces_per_strip">): string {
  if (!m.is_divisible || m.strips_per_box * m.pieces_per_strip <= 1) return "Unit";
  return unit === "box" ? "Box" : unit === "strip" ? "Strip" : "Piece";
}

export function unitPrice(unit: SaleUnit, m: Pick<PackInfo, "price_box" | "price_strip" | "price_piece">): number {
  return Number(unit === "box" ? m.price_box : unit === "strip" ? m.price_strip : m.price_piece);
}

export interface BillLine { price: number; qty: number; discountPercent: number }

export function lineAmounts(l: BillLine) {
  const gross = round2(l.price * l.qty);
  const pct = Math.min(Math.max(l.discountPercent || 0, 0), 100);
  const discount = round2((gross * pct) / 100);
  return { gross, discount, net: round2(gross - discount) };
}

export interface BillInput { lines: BillLine[]; billDiscount: number; vatPercent: number; paid: number | null }

/** Totals for a bill. `paid: null` means the customer pays in full. */
export function computeBill({ lines, billDiscount, vatPercent, paid }: BillInput) {
  let subtotal = 0;
  let lineDiscount = 0;
  for (const l of lines) {
    const a = lineAmounts(l);
    subtotal += a.gross;
    lineDiscount += a.discount;
  }
  subtotal = round2(subtotal);
  const discount = round2(lineDiscount + Math.max(billDiscount || 0, 0));
  const vat = round2(((subtotal - discount) * Math.max(vatPercent || 0, 0)) / 100);
  const total = round2(subtotal - discount + vat);
  const tendered = paid === null ? total : Math.max(paid, 0);
  const paidAmount = round2(Math.min(tendered, total));
  return {
    subtotal,
    discount,
    discountPercent: subtotal > 0 ? round2((discount / subtotal) * 100) : 0,
    vat,
    total,
    paid: paidAmount,
    due: round2(total - paidAmount),
    change: round2(Math.max(tendered - total, 0)),
  };
}

/** Cashiers may give at most `maxPercent` of the subtotal as discount; admins have no limit. */
export function discountAllowed(subtotal: number, discount: number, maxPercent: number, isAdmin: boolean): boolean {
  if (isAdmin) return discount <= subtotal;
  return discount <= round2((subtotal * maxPercent) / 100);
}
