import { afterEach, expect, it, vi } from "vitest";
vi.mock("./accounts", () => ({ requireAccount: vi.fn(() => ({ id: "own", username: "own", role: "player" })), listAccounts: () => [] }));
vi.mock("./local-http", () => ({ assertLocalRequest: () => {} }));
vi.mock("./hosted-bridge", () => ({ hostedPersistenceEnabled: () => true, hostedGet: vi.fn(), ensureHostedActor: vi.fn() }));
vi.mock("./neon-db", () => ({ neonQuery: vi.fn(async () => [{ revision: "584" }]) }));
import { GET } from "../app/api/datapad/route";
import { hostedGet } from "./hosted-bridge";
import { neonQuery } from "./neon-db";
afterEach(() => vi.clearAllMocks());
it("checks only revision without downloading the campaign or sourcebook configuration", async () => {
  const response = await GET(new Request("http://localhost/api/datapad?accountId=own&revisionOnly=1"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ revision: 584 });
  expect(hostedGet).not.toHaveBeenCalled();
  expect(neonQuery).toHaveBeenCalledWith("SELECT revision FROM private.goc_datapad_saves WHERE account_id=$1", ["own"]);
});
it("rejects a foreign account before database access", async () => {
  const response = await GET(new Request("http://localhost/api/datapad?accountId=foreign&revisionOnly=1"));
  expect(response.status).toBe(403);
  expect(neonQuery).not.toHaveBeenCalled();
});
