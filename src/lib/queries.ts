import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const lookupsQuery = queryOptions({
  queryKey: ["lookups"],
  queryFn: async () => {
    const [c, m, f] = await Promise.all([
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("manufacturers").select("id,name").order("name"),
      supabase.from("dosage_forms").select("id,name").order("name"),
    ]);
    if (c.error || m.error || f.error) throw c.error ?? m.error ?? f.error;
    return { categories: c.data, manufacturers: m.data, forms: f.data };
  },
});

export type MedicineRow = Awaited<ReturnType<typeof fetchMedicines>>[number];

async function fetchMedicines() {
  const [{ data: meds, error }, { data: stock, error: e2 }] = await Promise.all([
    supabase.from("medicines").select("*, manufacturer:manufacturers(name), category:categories(name), form:dosage_forms(name)").order("brand_name").limit(5000),
    supabase.rpc("get_stock_overview"),
  ]);
  if (error || e2) throw error ?? e2;
  const byId = new Map((stock ?? []).map((s) => [s.medicine_id, s]));
  return (meds ?? []).map((m) => {
    const s = byId.get(m.id);
    return {
      ...m,
      sellable_qty: Number(s?.sellable_qty ?? 0),
      expired_qty: Number(s?.expired_qty ?? 0),
      nearest_expiry: s?.nearest_expiry ?? null,
    };
  });
}

export const medicinesQuery = queryOptions({ queryKey: ["medicines"], queryFn: fetchMedicines });

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("pharmacy_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});

export function stockStatus(m: { sellable_qty: number; reorder_level: number; nearest_expiry: string | null; status: string }, expiryDays = 90) {
  if (m.sellable_qty <= 0) return { tone: "danger" as const, label: "Out of stock" };
  if (m.sellable_qty <= m.reorder_level) return { tone: "warning" as const, label: "Low stock" };
  if (m.nearest_expiry) {
    const d = (new Date(m.nearest_expiry).getTime() - Date.now()) / 86400000;
    if (d <= expiryDays) return { tone: "info" as const, label: "Expiring soon" };
  }
  return { tone: "success" as const, label: "In stock" };
}
