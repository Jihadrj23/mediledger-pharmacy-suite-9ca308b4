import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentStaff } from "@/lib/staff";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const staff = await fetchCurrentStaff();
    if (!staff) throw redirect({ to: "/auth" });
    if (!staff.is_active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    return { staff };
  },
  component: () => <Outlet />,
});
