const TZ = "Asia/Dhaka";

const bdt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ৳1,250.00 — uses South-Asian digit grouping. */
export function formatBDT(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const sign = n < 0 ? "-" : "";
  return `${sign}৳${bdt.format(Math.abs(Number.isFinite(n) ? n : 0))}`;
}

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { dd: get("day"), mm: get("month"), yyyy: get("year"), hh: get("hour"), min: get("minute"), ap: get("dayPeriod").toUpperCase() };
}

/** DD-MM-YYYY in Asia/Dhaka. Accepts ISO strings or plain YYYY-MM-DD dates. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}-${m}-${y}`;
  }
  const { dd, mm, yyyy } = parts(new Date(value));
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const { dd, mm, yyyy, hh, min, ap } = parts(new Date(value));
  return `${dd}-${mm}-${yyyy} ${hh}:${min} ${ap}`;
}

/** Today's date (YYYY-MM-DD) in Dhaka. */
export function dhakaToday(): string {
  const { dd, mm, yyyy } = parts(new Date());
  return `${yyyy}-${mm}-${dd}`;
}

export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const a = new Date(dhakaToday() + "T00:00:00Z").getTime();
  const b = new Date(isoDate + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

/** Express a base-unit (piece) quantity as boxes / strips / pieces. */
export function describeQty(qty: number, stripsPerBox: number, piecesPerStrip: number): string {
  const perBox = stripsPerBox * piecesPerStrip;
  if (perBox <= 1) return `${qty} unit${qty === 1 ? "" : "s"}`;
  const boxes = Math.floor(qty / perBox);
  const rest = qty % perBox;
  const strips = Math.floor(rest / piecesPerStrip);
  const pcs = rest % piecesPerStrip;
  const out: string[] = [];
  if (boxes) out.push(`${boxes} box`);
  if (strips) out.push(`${strips} strip`);
  if (pcs || out.length === 0) out.push(`${pcs} pc`);
  return out.join(" · ");
}
