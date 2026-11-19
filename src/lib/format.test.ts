import { describe, it, expect } from "vitest";
import { formatBDT, formatDate, describeQty } from "./format";

describe("format", () => {
  it("formats taka with 2 decimals", () => {
    expect(formatBDT(1250)).toBe("৳1,250.00");
    expect(formatBDT(125000.5)).toBe("৳1,25,000.50");
  });
  it("formats dates as DD-MM-YYYY", () => {
    expect(formatDate("2026-11-19")).toBe("19-11-2026");
  });
  it("converts base pieces to box/strip/piece (1 box = 10 strips = 100 pcs)", () => {
    expect(describeQty(100, 10, 10)).toBe("1 box");
    expect(describeQty(125, 10, 10)).toBe("1 box · 2 strip · 5 pc");
  });
});
