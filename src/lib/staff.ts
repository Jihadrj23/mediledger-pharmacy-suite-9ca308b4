import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "admin" | "cashier";
export interface Staff {
  id: string;
  email: string | null;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  max_discount_percent: number;
  can_collect_due: boolean;
}

export async function fetchCurrentStaff(): Promise<Staff | null> {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) return null;
  const role: StaffRole = roles?.some((r) => r.role === "admin") ? "admin" : "cashier";
  return {
    id: user.id,
    email: profile.email,
    full_name: profile.full_name,
    role,
    is_active: profile.is_active,
    max_discount_percent: Number(profile.max_discount_percent),
    can_collect_due: profile.can_collect_due,
  };
}

export function homeFor(role: StaffRole) {
  return role === "admin" ? "/admin" : "/pos";
}
