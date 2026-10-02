import { requireAccount } from "./accounts";
export function assertLocalRequest(request: Request) {
  const url = new URL(request.url);
  const external = new URL(`${url.protocol}//${request.headers.get("host") ?? url.host}`);
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  const hosted = Boolean(process.env.VERCEL || process.env.GOC_ALLOW_HOSTED_WEB === "1");
  if (!hosted && (!localHosts.includes(url.hostname) || !localHosts.includes(external.hostname))) throw new Error("Local access only");
  const origin = request.headers.get("origin");
  if (origin && origin !== external.origin) throw new Error("Cross-origin request refused");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new Error("Cross-site request refused");
}
export async function readObject(request: Request): Promise<Record<string, unknown>> {
  assertAuthenticatedRequest(request);
  return readLocalObject(request);
}
export function assertAuthenticatedRequest(request: Request) {
  assertLocalRequest(request);
  return requireAccount(request);
}
export async function readLocalObject(request: Request): Promise<Record<string, unknown>> {
  assertLocalRequest(request);
  const text = await request.text();
  if (text.length > 24000) throw new Error("Request too large");
  const body = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Object required");
  return body;
}
export function boundedText(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim())) throw new Error("Invalid text field");
  return value.trim();
}
