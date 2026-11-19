import { forwardRef, useMemo, useState } from "react";
import { ScanBarcode, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/AppShell";
import { searchMedicines, stockStatus, type MedicineRow } from "@/lib/queries";
import { describeQty } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Pick a medicine from the existing catalog — no free typing of medicine names. */
export const MedicinePicker = forwardRef<HTMLInputElement, {
  medicines: MedicineRow[];
  onSelect: (m: MedicineRow) => void;
  placeholder?: string;
  autoFocus?: boolean;
  hideOutOfStock?: boolean;
}>(function MedicinePicker({ medicines, onSelect, placeholder, autoFocus, hideOutOfStock }, ref) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const base = hideOutOfStock ? medicines.filter((m) => m.sellable_qty > 0) : medicines;
    return searchMedicines(base, q, 8);
  }, [medicines, q, hideOutOfStock]);

  function choose(m: MedicineRow | undefined) {
    if (!m) return;
    onSelect(m);
    setQ("");
    setActive(0);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted-foreground" />
      <Input
        ref={ref}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-label="Search medicine"
        className="h-12 pl-11 pr-11 text-base"
        placeholder={placeholder ?? "Search medicine by brand, generic or scan barcode…"}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      <ScanBarcode className="pointer-events-none absolute right-3.5 top-3.5 size-5 text-muted-foreground" />
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">No medicine found. Ask the owner to add it to the catalog.</li>
          ) : results.map((m, i) => {
            const st = stockStatus(m);
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(m); }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2", i === active && "bg-accent text-accent-foreground")}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.brand_name} <span className="font-normal text-muted-foreground">{m.strength}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{m.generic_name} · {m.form?.name} · {m.manufacturer?.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge tone={st.tone}>{m.sellable_qty > 0 ? describeQty(m.sellable_qty, m.strips_per_box, m.pieces_per_strip) : st.label}</StatusBadge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
