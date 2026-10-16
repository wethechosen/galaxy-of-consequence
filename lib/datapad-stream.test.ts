import { afterEach, expect, it, vi } from "vitest";
vi.mock("./accounts", () => ({ requireAccount: vi.fn(() => ({ id: "own", username: "own", role: "player" })), listAccounts: () => [] }));
vi.mock("./local-http", () => ({ assertLocalRequest: () => {} }));
vi.mock("./hosted-bridge", () => ({ hostedPersistenceEnabled: () => true }));
vi.mock("./neon-db", () => ({ neonQuery: vi.fn(async () => [{ revision: "5" }]) }));
import { GET } from "../app/api/datapad/stream/route";
import { requireAccount } from "./accounts";
import { neonQuery } from "./neon-db";
afterEach(() => vi.clearAllMocks());

it("blocks streaming another player's account before querying the database", async () => {
  const response = await GET(new Request("http://localhost/api/datapad/stream?accountId=someone-else"));
  expect(response.status).toBe(403);
  expect(neonQuery).not.toHaveBeenCalled();
});
it("streams committed revisions without transferring campaign secrets or a full snapshot", async () => {
  const response = await GET(new Request("http://localhost/api/datapad/stream?accountId=own&since=4"));
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = decoder.decode((await reader.read()).value);
  output += decoder.decode((await reader.read()).value);
  await reader.cancel();
  expect(output).toContain('event: revision\ndata: {"revision":5}');
  expect(output).not.toContain("snapshot");
});
it("rejects an unauthenticated stream", async () => {
  vi.mocked(requireAccount).mockImplementationOnce(() => { throw new Error("Sign in"); });
  expect((await GET(new Request("http://localhost/api/datapad/stream"))).status).toBe(403);
});
