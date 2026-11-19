import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard, Pill, Users, Settings, ScrollText, ShoppingCart } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/AppShell";

const nav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/medicines", label: "Medicine Catalog", icon: Pill },
  { to: "/pos", label: "Cashier Screens", icon: ShoppingCart },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/activity", label: "Activity Logs", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (context.staff.role !== "admin") throw redirect({ to: "/pos" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { staff } = Route.useRouteContext();
  return (
    <AppShell staff={staff} nav={nav} title="Admin">
      <Outlet />
    </AppShell>
  );
}
