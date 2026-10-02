import { NextResponse } from "next/server";
import { assertLocalRequest } from "@/lib/local-http";
import { beginGoogleFlow, googleCookie } from "@/lib/google-auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured by the administrator. You can sign in with your username below.");
    const here = new URL(request.url), flow = beginGoogleFlow(here.searchParams.get("returnTo") || "/");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${here.origin}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state: flow.state, nonce: flow.nonce, code_challenge: flow.challenge, code_challenge_method: "S256" }).toString();
    const response = NextResponse.redirect(url);
    response.cookies.set(googleCookie, flow.state, { httpOnly: true, sameSite: "lax", path: "/api/auth/google", maxAge: 600, secure: here.protocol === "https:" });
    return response;
  } catch (error) {
    const url = new URL("/login", request.url); url.searchParams.set("error", error instanceof Error ? error.message : "Google sign-in unavailable.");
    return NextResponse.redirect(url);
  }
}
