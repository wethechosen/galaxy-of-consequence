import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { consumeGoogleFlow, googleAccount, googleCookie } from "@/lib/google-auth";
import { SESSION_COOKIE, startSession } from "@/lib/accounts";
export const runtime = "nodejs";
const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export async function GET(request: Request) {
  const here = new URL(request.url);
  try {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(here.hostname) || request.headers.get("host") !== here.host) throw new Error("Local access only.");
    const state = here.searchParams.get("state"), cookie = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${googleCookie}=`))?.slice(googleCookie.length + 1);
    if (!state || state !== cookie) throw new Error("Google sign-in expired. Please try again.");
    const flow = consumeGoogleFlow(state);
    if (!flow || !here.searchParams.get("code")) throw new Error("Google sign-in was cancelled or expired.");
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code: here.searchParams.get("code")!, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${here.origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: flow.verifier }), signal: AbortSignal.timeout(15000) });
    const token = await response.json();
    if (!response.ok || !token.id_token) throw new Error("Google could not complete sign-in.");
    const { payload } = await jwtVerify(token.id_token, keys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: process.env.GOOGLE_CLIENT_ID });
    if (payload.nonce !== flow.nonce || !payload.sub || payload.email_verified !== true || typeof payload.email !== "string") throw new Error("Google identity could not be verified.");
    const account = googleAccount(payload.sub, payload.email, String(payload.name || payload.email).slice(0,80));
    const result = NextResponse.redirect(new URL(flow.returnTo, here));
    result.cookies.set(SESSION_COOKIE, startSession(account), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 28800, secure: here.protocol === "https:" });
    result.cookies.set(googleCookie, "", { path: "/api/auth/google", maxAge: 0 });
    return result;
  } catch (error) {
    const url = new URL("/login", here); url.searchParams.set("error", error instanceof Error ? error.message : "Google sign-in failed.");
    return NextResponse.redirect(url);
  }
}
