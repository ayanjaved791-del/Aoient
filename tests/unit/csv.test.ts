import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("quotes separators and neutralises spreadsheet formulas", () => {
    expect(csvCell('Ali "the boss", Raza')).toBe('"Ali ""the boss"", Raza"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+92 300")).toBe("'+92 300");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["a", 1], ["b", 2]])).toBe("a,1\r\nb,2\r\n");
  });
});
