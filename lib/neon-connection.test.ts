import { expect, it } from "vitest";
import { neonConnectionString } from "./neon-connection";

it("keeps certificate verification explicit while preserving connection credentials and options", () => {
  const value = new URL(neonConnectionString("postgresql://user:pass@database.example/db?sslmode=require&channel_binding=require")!);
  expect(value.searchParams.get("sslmode")).toBe("verify-full");
  expect(value.searchParams.get("channel_binding")).toBe("require");
  expect(value.username).toBe("user");
  expect(value.password).toBe("pass");
  expect(neonConnectionString(undefined)).toBeUndefined();
});
