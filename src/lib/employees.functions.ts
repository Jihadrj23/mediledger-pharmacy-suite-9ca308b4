import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Only the owner/admin can manage employees.");
}

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  phone: z.string().trim().max(20).optional().default(""),
  role: z.enum(["admin", "cashier"]),
  max_discount_percent: z.number().min(0).max(100),
  can_collect_due: z.boolean(),
});

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createSchema>) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
      app_metadata: { created_by_admin: "true", staff_role: data.role },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create account");
    await supabaseAdmin.from("profiles").update({
      phone: data.phone, max_discount_percent: data.max_discount_percent, can_collect_due: data.can_collect_due,
    }).eq("id", created.user.id);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "create_employee", entity: "profiles", entity_id: created.user.id,
      details: { email: data.email, role: data.role },
    });
    return { id: created.user.id };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).nullable(),
  role: z.enum(["admin", "cashier"]),
  is_active: z.boolean(),
  max_discount_percent: z.number().min(0).max(100),
  can_collect_due: z.boolean(),
  new_password: z.string().min(8).max(72).optional(),
});

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof updateSchema>) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId && (!data.is_active || data.role !== "admin")) {
      throw new Error("You cannot deactivate or demote your own owner account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({
      full_name: data.full_name, phone: data.phone, is_active: data.is_active,
      max_discount_percent: data.max_discount_percent, can_collect_due: data.can_collect_due, updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.is_active ? "none" : "876000h",
      ...(data.new_password ? { password: data.new_password } : {}),
    });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "update_employee", entity: "profiles", entity_id: data.id,
      details: { role: data.role, is_active: data.is_active, max_discount_percent: data.max_discount_percent, password_reset: !!data.new_password },
    });
    return { ok: true };
  });
