import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  draftActionDigest, loadLocalValidatedDraft, storeLocalValidatedDraft,
  GmDraftIdentityError, type GmValidatedDraft,
} from "./gm-draft-checkpoint";

function fixture(): GmValidatedDraft {
  return {
    version: 1,
    stage: "validated",
    interpretation: { semantic: { intent: "commerce" }, fallbackReason: null },
    roll: { raw: 11, total: 17, outcome: "success" },
    provider: "nvidia",
    model: "isolated-scripted-fixture",
    content: "## GAMEPLAY RESULT\nThe merchant confirms the lease.\n<!--STATE:{\"credits\":-126000}-->",
  };
}

describe("validated GM draft checkpoints", () => {
  it("recovers only a complete intermediate draft for the exact pending turn", () => {
    const db = new DatabaseSync(":memory:");
    try {
      const draft = fixture();
      storeLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "I authorize the lease.", draft);
      expect(loadLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "I authorize the lease.")).toEqual(draft);
      expect(loadLocalValidatedDraft(db, "other-actor", "turn-lease-01", 42, "I authorize the lease.")).toBeNull();
      expect(loadLocalValidatedDraft(db, "isolated-actor", "different-turn", 42, "I authorize the lease.")).toBeNull();
    } finally { db.close(); }
  });

  it("rejects changed declarations and revisions without overwriting the original", () => {
    const db = new DatabaseSync(":memory:");
    try {
      const draft = fixture();
      storeLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay 126000", draft);
      expect(() => loadLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay 126001")).toThrow(GmDraftIdentityError);
      expect(() => loadLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 43, "Pay 126000")).toThrow(GmDraftIdentityError);
      expect(() => storeLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay 126001", draft)).toThrow(GmDraftIdentityError);
      expect(loadLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay 126000")).toEqual(draft);
    } finally { db.close(); }
  });

  it("does not modify a saved campaign or invent a new roll", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE datapad_saves (account_id TEXT, revision INTEGER, snapshot TEXT)");
      db.prepare("INSERT INTO datapad_saves VALUES (?,?,?)")
        .run("isolated-actor", 42, JSON.stringify({ gameState: { credits: 500000 } }));
      const before = db.prepare("SELECT * FROM datapad_saves").get();
      const draft = fixture();
      storeLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay", draft);
      const replay = loadLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay");
      expect(replay?.roll).toEqual(draft.roll);
      expect(db.prepare("SELECT * FROM datapad_saves").get()).toEqual(before);
    } finally { db.close(); }
  });

  it("ignores corrupt stored draft data and binds identity to all four inputs", () => {
    const db = new DatabaseSync(":memory:");
    try {
      const draft = fixture();
      storeLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay", draft);
      db.prepare("UPDATE gm_validated_drafts SET draft=?").run('{"version":1,"content":"", "provider":"nvidia"}');
      expect(loadLocalValidatedDraft(db, "isolated-actor", "turn-lease-01", 42, "Pay")).toBeNull();
      expect(draftActionDigest("isolated-actor", "turn-lease-01", 42, "Pay"))
        .not.toEqual(draftActionDigest("isolated-actor", "turn-lease-01", 42, "Pay more"));
    } finally { db.close(); }
  });
});
