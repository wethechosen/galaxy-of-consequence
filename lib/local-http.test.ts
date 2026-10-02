import { expect, it } from "vitest";
import { assertLocalRequest } from "./local-http";
it("rejects cross-site mutation requests and nonlocal hostnames", () => {
  expect(() => assertLocalRequest(new Request("http://127.0.0.1:3000/api/player", { headers: { origin: "https://attacker.example" } }))).toThrow();
  expect(() => assertLocalRequest(new Request("http://attacker.example/api/player"))).toThrow();
  expect(() => assertLocalRequest(new Request("http://localhost:3000/api/player", { headers: { origin: "http://localhost:3000" } }))).not.toThrow();
  expect(() => assertLocalRequest(new Request("http://localhost:3000/api/player", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).not.toThrow();
  expect(() => assertLocalRequest(new Request("http://localhost:3000/api/player", { headers: { host: "attacker.example", origin: "http://attacker.example" } }))).toThrow();
});
