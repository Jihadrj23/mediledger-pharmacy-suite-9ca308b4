import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PackageSearch, Users, UserCircle, LayoutDashboard } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/pos")({
  component: PosLayout,
});

function PosLayout() {
  const { staff } = Route.useRouteContext();
  const nav: NavItem[] = [
    { to: "/pos", label: "Stock Lookup", icon: PackageSearch, exact: true },
    { to: "/pos/customers", label: "Customers", icon: Users },
    { to: "/pos/account", label: "My Account", icon: UserCircle },
    ...(staff.role === "admin" ? [{ to: "/admin", label: "Back to Admin", icon: LayoutDashboard }] : []),
  ];
  return (
    <AppShell staff={staff} nav={nav} title="Cashier">
      <Outlet />
    </AppShell>
  );
}
