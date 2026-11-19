import { describe, expect, it } from "vitest";
import { computeBill, discountAllowed, unitFactor, unitsFor } from "./billing";

const napa = { strips_per_box: 10, pieces_per_strip: 10, is_divisible: true };
const syrup = { strips_per_box: 1, pieces_per_strip: 1, is_divisible: false };

describe("units", () => {
  it("a box of 10 strips x 10 pieces holds 100 pieces", () => {
    expect(unitFactor("box", napa)).toBe(100);
    expect(unitFactor("strip", napa)).toBe(10);
    expect(unitFactor("piece", napa)).toBe(1);
  });
  it("tablets sell by box, strip or piece; syrups only as one unit", () => {
    expect(unitsFor(napa)).toEqual(["box", "strip", "piece"]);
    expect(unitsFor(syrup)).toEqual(["box"]);
  });
});

describe("bill totals and due", () => {
  it("unpaid part of the bill becomes due", () => {
    const b = computeBill({ lines: [{ price: 120, qty: 2, discountPercent: 0 }], billDiscount: 0, vatPercent: 0, paid: 100 });
    expect(b.total).toBe(240);
    expect(b.paid).toBe(100);
    expect(b.due).toBe(140);
  });
  it("paying more than the bill gives change and no due", () => {
    const b = computeBill({ lines: [{ price: 60, qty: 1, discountPercent: 0 }], billDiscount: 0, vatPercent: 0, paid: 100 });
    expect(b.due).toBe(0);
    expect(b.change).toBe(40);
  });
  it("line discount percent and bill discount both reduce the total", () => {
    const b = computeBill({ lines: [{ price: 100, qty: 1, discountPercent: 5 }], billDiscount: 10, vatPercent: 0, paid: null });
    expect(b.discount).toBe(15);
    expect(b.total).toBe(85);
  });
});

describe("cashier discount limit", () => {
  it("a 5% cashier cannot give 6% but an admin can", () => {
    expect(discountAllowed(1000, 50, 5, false)).toBe(true);
    expect(discountAllowed(1000, 60, 5, false)).toBe(false);
    expect(discountAllowed(1000, 60, 5, true)).toBe(true);
  });
});
