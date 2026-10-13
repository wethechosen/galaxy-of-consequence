import { beforeEach, describe, expect, it, vi } from "vitest";
import { hostedGet, hostedPersistenceEnabled, hostedPut } from "./hosted-bridge";
import {
  bridgeGet, bridgeGetHud, bridgeListCheckpoints, bridgeLoadCheckpoint,
  bridgeRagStats, bridgeReconcile, bridgeSave, bridgeSaveCheckpoint,
  bridgeSaveConfig, bridgeSearchRag,
} from "./datapad-bridge";
import { hostedRuntimeRequired } from "./neon-db";
import * as store from "./neon-campaign-store";

vi.mock("./neon-db", () => ({ hostedRuntimeRequired: vi.fn() }));
vi.mock("./neon-campaign-store", () => ({
  neonGetSaveByUsername: vi.fn(),
  neonGetSaveByAccountId: vi.fn(),
  neonPutSave: vi.fn(),
  neonGetConfig: vi.fn(),
  neonSaveConfig: vi.fn(),
  neonHud: vi.fn(),
  neonRagSearch: vi.fn(),
  neonRagStats: vi.fn(),
  neonListCheckpoints: vi.fn(),
  neonSaveCheckpoint: vi.fn(),
  neonLoadCheckpoint: vi.fn(),
  neonReconcile: vi.fn(),
}));

const snapshot = { character: {}, gameState: {}, messages: [], comms: [], settings: {} };
const save = {
  account_username: "dmir",
  account_id: "account-1",
  revision: 8,
  snapshot,
  updated_at: "2026-10-13T10:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(hostedRuntimeRequired).mockReturnValue(true);
});

describe("direct Neon campaign bridges", () => {
  it("enables hosted persistence only in hosted runtime", () => {
    expect(hostedPersistenceEnabled()).toBe(true);
    vi.mocked(hostedRuntimeRequired).mockReturnValue(false);
    expect(hostedPersistenceEnabled()).toBe(false);
  });

  it("reads and writes the hosted save through the Neon store", async () => {
    vi.mocked(store.neonGetSaveByUsername).mockResolvedValue(save);
    vi.mocked(store.neonPutSave).mockResolvedValue({ ok: true, ...save, revision: 9 });

    await expect(hostedGet("dmir")).resolves.toEqual(save);
    await expect(hostedPut("dmir", "account-1", 8, snapshot)).resolves.toMatchObject({ revision: 9 });
    expect(store.neonGetSaveByUsername).toHaveBeenCalledExactlyOnceWith("dmir");
    expect(store.neonPutSave).toHaveBeenCalledExactlyOnceWith("dmir", "account-1", 8, snapshot);
  });

  it("reads a datapad save and optional config without inventing a missing save", async () => {
    vi.mocked(store.neonGetSaveByAccountId).mockResolvedValueOnce(save).mockResolvedValueOnce(null);
    vi.mocked(store.neonGetConfig).mockResolvedValue({ revision: 2, config: { tone: "immersive" }, updatedAt: save.updated_at });

    await expect(bridgeGet("account-1")).resolves.toEqual(save);
    await expect(bridgeGet("account-1", true)).resolves.toEqual({
      save: {}, config: { revision: 2, config: { tone: "immersive" }, updatedAt: save.updated_at },
    });
    expect(store.neonGetConfig).toHaveBeenCalledExactlyOnceWith("account-1");
  });

  it("uses the saved username and supplied revision for a datapad write", async () => {
    vi.mocked(store.neonGetSaveByAccountId).mockResolvedValue(save);
    vi.mocked(store.neonPutSave).mockResolvedValue({ ok: true, ...save, revision: 9 });

    await expect(bridgeSave("account-1", 8, snapshot)).resolves.toMatchObject({ revision: 9 });
    expect(store.neonPutSave).toHaveBeenCalledExactlyOnceWith("dmir", "account-1", 8, snapshot);
  });

  it("refuses a write when the account has no save", async () => {
    vi.mocked(store.neonGetSaveByAccountId).mockResolvedValue(null);

    await expect(bridgeSave("account-1", 8, snapshot)).rejects.toMatchObject({ status: 404 });
    expect(store.neonPutSave).not.toHaveBeenCalled();
  });

  it("preserves a revision conflict from Neon instead of treating it as a disconnected bridge", async () => {
    const conflict = Object.assign(new Error("revision_conflict"), { status: 409, currentRevision: 9 });
    vi.mocked(store.neonGetSaveByAccountId).mockResolvedValue(save);
    vi.mocked(store.neonPutSave).mockRejectedValue(conflict);

    await expect(bridgeSave("account-1", 8, snapshot)).rejects.toBe(conflict);
    await expect(hostedPut("dmir", "account-1", 8, snapshot)).rejects.toBe(conflict);
  });

  it("propagates a database outage rather than returning empty campaign state", async () => {
    const outage = Object.assign(new Error("database unavailable"), { status: 503 });
    vi.mocked(store.neonGetSaveByAccountId).mockRejectedValue(outage);

    await expect(bridgeGet("account-1")).rejects.toBe(outage);
    await expect(bridgeSave("account-1", 8, snapshot)).rejects.toBe(outage);
  });

  it("delegates HUD, checkpoint, reconciliation, and config operations with exact arguments", async () => {
    const hud = { ok: true, revision: 8, hud: { health: 26 } };
    const checkpoints = { ok: true, checkpoints: [] };
    const checkpoint = { ok: true, checkpointId: "cp-1" };
    const reconciliation = { ok: true, revision: 9, changedKeys: ["location"] };
    const config = { ok: true, configRevision: 3 };
    vi.mocked(store.neonHud).mockResolvedValue(hud as Awaited<ReturnType<typeof store.neonHud>>);
    vi.mocked(store.neonListCheckpoints).mockResolvedValue(checkpoints);
    vi.mocked(store.neonSaveCheckpoint).mockResolvedValue(checkpoint as Awaited<ReturnType<typeof store.neonSaveCheckpoint>>);
    vi.mocked(store.neonLoadCheckpoint).mockResolvedValue(checkpoint as Awaited<ReturnType<typeof store.neonLoadCheckpoint>>);
    vi.mocked(store.neonReconcile).mockResolvedValue(reconciliation as Awaited<ReturnType<typeof store.neonReconcile>>);
    vi.mocked(store.neonSaveConfig).mockResolvedValue(config as Awaited<ReturnType<typeof store.neonSaveConfig>>);

    await expect(bridgeGetHud("account-1")).resolves.toBe(hud);
    await expect(bridgeListCheckpoints("account-1")).resolves.toBe(checkpoints);
    await expect(bridgeSaveCheckpoint("account-1", "Before docking")).resolves.toBe(checkpoint);
    await expect(bridgeLoadCheckpoint("account-1", "cp-1", 8)).resolves.toBe(checkpoint);
    await expect(bridgeReconcile("account-1", 8, { location: "Coruscant" }, "continuity repair")).resolves.toBe(reconciliation);
    await expect(bridgeSaveConfig("account-1", 2, { tone: "immersive" })).resolves.toBe(config);
    expect(store.neonSaveCheckpoint).toHaveBeenCalledExactlyOnceWith("account-1", "Before docking");
    expect(store.neonLoadCheckpoint).toHaveBeenCalledExactlyOnceWith("account-1", "cp-1", 8);
    expect(store.neonReconcile).toHaveBeenCalledExactlyOnceWith("account-1", 8, { location: "Coruscant" }, "continuity repair");
    expect(store.neonSaveConfig).toHaveBeenCalledExactlyOnceWith("account-1", 2, { tone: "immersive" });
  });

  it("routes sourcebook search and statistics to Neon without a network fetch", async () => {
    const hits = { ok: true, hits: [] };
    const stats = { ok: true, stats: { documents: 4, chunks: 935, reviewedChunks: 0, ocrChunks: 0 } };
    vi.mocked(store.neonRagSearch).mockResolvedValue(hits);
    vi.mocked(store.neonRagStats).mockResolvedValue(stats);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    try {
      await expect(bridgeSearchRag("Saga equipment", 12)).resolves.toBe(hits);
      await expect(bridgeRagStats()).resolves.toBe(stats);
      expect(store.neonRagSearch).toHaveBeenCalledExactlyOnceWith("Saga equipment", 12);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
