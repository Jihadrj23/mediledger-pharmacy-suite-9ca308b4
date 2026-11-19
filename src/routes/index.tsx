import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Pill } from "lucide-react";
import { fetchCurrentStaff, homeFor } from "@/lib/staff";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PharmaDesk — Pharmacy POS & Inventory" },
      { name: "description", content: "Sign in to manage your pharmacy's sales, stock and accounts." },
      { property: "og:title", content: "PharmaDesk — Pharmacy POS & Inventory" },
      { property: "og:description", content: "Sign in to manage your pharmacy's sales, stock and accounts." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    fetchCurrentStaff().then((s) => {
      navigate({ to: s ? homeFor(s.role) : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Pill className="size-5 animate-pulse text-primary" /> Loading PharmaDesk…
      </div>
    </div>
  );
}
