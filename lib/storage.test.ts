import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { openStorage } from "./storage";

it("preserves campaign state and checkpoint snapshots after reopening", () => {
  const folder = mkdtempSync(join(tmpdir(), "galaxy-storage-"));
  try {
    const path = join(folder, "test.sqlite");
    const first = openStorage(path);
    first.prepare("INSERT INTO campaigns VALUES (?, ?)").run("campaign", "saved-state");
    first.prepare("INSERT INTO checkpoints VALUES (?, ?, ?)").run("save", "campaign", "snapshot");
    first.close();
    const second = openStorage(path);
    try {
      expect(second.prepare("SELECT state FROM campaigns WHERE id = ?").get("campaign")?.state).toBe("saved-state");
      expect(second.prepare("SELECT state FROM checkpoints WHERE id = ?").get("save")?.state).toBe("snapshot");
    } finally { second.close(); }
  } finally { rmSync(folder, { recursive: true }); }
});
