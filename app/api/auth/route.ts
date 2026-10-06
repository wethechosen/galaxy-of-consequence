import { NextResponse } from "next/server";
import { authenticate, createAccount, endSession, needsSetup, refreshSession, requestToken, requireAccount, sessionAccount, SESSION_COOKIE, setupOwner, startSession, updateProfile } from "@/lib/accounts";
import { assertLocalRequest, boundedText, readLocalObject } from "@/lib/local-http";
import { authenticateHosted, hostedAuthEnabled, hostedStartSession } from "@/lib/hosted-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const options = { httpOnly: true, sameSite: "strict" as const, path: "/", maxAge: 28800 };

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const token = requestToken(request);
    const user = sessionAccount(token);
    const response = NextResponse.json({ user, setupRequired: needsSetup() }, { headers: { "Cache-Control": "no-store" } });
    if (user) {
      const nextToken = hostedAuthEnabled()
        ? hostedStartSession(user)
        : refreshSession(token) ? token : "";
      if (nextToken) response.cookies.set(SESSION_COOKIE, nextToken, { ...options, secure: new URL(request.url).protocol === "https:" });
    }
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify session." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await readLocalObject(request);
    if (body.action === "logout") {
      endSession(requestToken(request));
      const response = NextResponse.json({ ok: true });
      response.cookies.set(SESSION_COOKIE, "", { ...options, maxAge: 0 });
      return response;
    }
    if (!["setup", "login", "register"].includes(String(body.action))) throw new Error("Invalid action.");
    const username = boundedText(body.username, 80);
    if (typeof body.password !== "string" || body.password.length > 128) throw new Error("Invalid password.");
    const user = hostedAuthEnabled()
      ? (body.action === "login" ? await authenticateHosted(username, body.password) : (() => { throw new Error("Hosted registration and setup are disabled."); })())
      : body.action === "register"
        ? (needsSetup() ? setupOwner(username, body.password, boundedText(body.displayName, 80)) : createAccount(username, body.password, boundedText(body.displayName, 80), "player"))
        : body.action === "setup"
          ? setupOwner(username, body.password, boundedText(body.displayName, 80))
          : authenticate(username, body.password);
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, startSession(user), { ...options, secure: new URL(request.url).protocol === "https:" });
    return response;
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && Number(error.status) === 504 ? 504 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign-in failed." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readLocalObject(request);
    const user = requireAccount(request);
    if (hostedAuthEnabled()) throw new Error("Hosted profile editing is not available from this build.");
    updateProfile(user.id, boundedText(body.displayName, 80));
    return NextResponse.json({ user: sessionAccount(requestToken(request)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile not saved." }, { status: 403 });
  }
}
