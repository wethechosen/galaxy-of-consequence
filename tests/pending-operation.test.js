import { describe, expect, it } from "vitest";
import { pendingOperation, clearPendingOperation } from "../original/lib/pendingOperation";

describe("client operation retries", () => {
  it("reuses an ID through lost responses and reloads, then allows a fresh confirmed purchase", () => {
    const data = new Map();
    const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
    const choices = { action: "buy", goodId: "medpac" };
    expect(pendingOperation(storage, "a", 5, "market", choices, () => "first-id")).toBe("first-id");
    expect(pendingOperation(storage, "a", 5, "market", choices, () => "reroll-id")).toBe("first-id");
    expect(() => pendingOperation(storage, "a", 5, "market", { goodId: "gun" })).toThrow(/previous request/);
    clearPendingOperation(storage, "a", "market");
    expect(pendingOperation(storage, "a", 6, "market", choices, () => "second-id")).toBe("second-id");
    expect(pendingOperation(storage, "b", 6, "market", choices, () => "other-account")).toBe("other-account");
  });
  it("ignores malformed UI cache without inventing mechanical state", () => {
    const storage = { getItem: () => "{broken", setItem: () => {}, removeItem: () => {} };
    expect(pendingOperation(storage, "a", 5, "advancement", {}, () => "fresh-id")).toBe("fresh-id");
  });
});
