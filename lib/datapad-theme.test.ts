import { expect, it } from "vitest";
import { datapadTheme } from "./datapad-theme";

it("keeps setup, provisional and invalid morality neutral", () => {
  const neutral = datapadTheme(null, false);
  for (const score of [null, -1, NaN, Infinity, 1.5]) expect(datapadTheme(score, true)).toEqual(neutral);
  expect(datapadTheme(10, false)).toEqual(neutral);
});
it("derives a reversible cosmetic palette from recorded score without moral ranks", () => {
  expect(datapadTheme(0, true).accent).toBe("100, 220, 255");
  expect(datapadTheme(5, true).accent).toBe("178, 164, 190");
  expect(datapadTheme(10, true).accent).toBe("255, 108, 124");
  expect(datapadTheme(25, true).accent).toBe(datapadTheme(10, true).accent);
  expect(datapadTheme(0, true).label).toContain("Score 0");
});
