import { describe, it, expect } from "vitest";
import { parseCSV, toCSV } from "./csv";

describe("csv", () => {
  it("round-trips quoted values", () => {
    const csv = toCSV([{ brand_name: 'Napa, "Extra"', strength: "500 mg" }]);
    expect(parseCSV(csv)).toEqual([{ brand_name: 'Napa, "Extra"', strength: "500 mg" }]);
  });
});
